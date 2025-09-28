const { getPlayByPlay } = require("./sportsRadar");
const { sliceAudio, sliceVideo } = require("./media");
const { transcribeShortAudio } = require("./stt");
const { evaluatePlay } = require("./genai");
const { clockToGameSeconds } = require("./utils");
const path = require("path");
const { AUDIO_PRE_SECONDS, VIDEO_CLIP_PRE, VIDEO_CLIP_LENGTH, OUTPUT_DIR: CFG_OUTPUT_DIR } = require("./config");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const { ensureDir } = require("./utils");


function safeGet(obj, pathParts) {
  try {
    return pathParts.reduce((acc, k) => (acc && acc[k] !== undefined) ? acc[k] : undefined, obj);
  } catch (e) {
    return undefined;
  }
}


function extractTeamsAndScore(play, pbp) {
  const descObj = (play && typeof play.description === "object") ? play.description : null;
  const raw = play && play.raw ? play.raw : play;

  const pbpSummary = pbp && (pbp.summary || pbp);

  const homeCandidate = descObj?.home || raw?.home || pbpSummary?.home || pbp?.home;
  const awayCandidate = descObj?.away || raw?.away || pbpSummary?.away || pbp?.away;

  const homeName = safeGet(homeCandidate, ["name"]) || safeGet(homeCandidate, ["market"]) || safeGet(homeCandidate, ["alias"]) || null;
  const homeAlias = safeGet(homeCandidate, ["alias"]) || null;

  const awayName = safeGet(awayCandidate, ["name"]) || safeGet(awayCandidate, ["market"]) || safeGet(awayCandidate, ["alias"]) || null;
  const awayAlias = safeGet(awayCandidate, ["alias"]) || null;

  const homePoints =
    (typeof raw?.home_points === "number" ? raw.home_points : undefined) ||
    (typeof play?.home_points === "number" ? play.home_points : undefined) ||
    (descObj && typeof descObj.home?.points === "number" ? descObj.home.points : undefined) ||
    (pbpSummary && typeof pbpSummary.home?.points === "number" ? pbpSummary.home.points : undefined) ||
    (pbp && typeof pbp.home?.points === "number" ? pbp.home.points : undefined) ||
    null;

  const awayPoints =
    (typeof raw?.away_points === "number" ? raw.away_points : undefined) ||
    (typeof play?.away_points === "number" ? play.away_points : undefined) ||
    (descObj && typeof descObj.away?.points === "number" ? descObj.away.points : undefined) ||
    (pbpSummary && typeof pbpSummary.away?.points === "number" ? pbpSummary.away.points : undefined) ||
    (pbp && typeof pbp.away?.points === "number" ? pbp.away.points : undefined) ||
    null;

  return {
    home: { name: homeName, alias: homeAlias, points: homePoints },
    away: { name: awayName, alias: awayAlias, points: awayPoints }
  };
}


function findDescriptionFromObject(obj, seen = new Set()) {
  if (!obj || typeof obj !== "object") return null;
  if (seen.has(obj)) return null;
  seen.add(obj);

  const priorityKeys = ["description", "play_description", "summary", "text", "title", "display_value"];

  for (const k of priorityKeys) {
    if (typeof obj[k] === "string" && obj[k].trim().length > 0) {
      return obj[k].trim();
    }
  }

  if (Array.isArray(obj.events)) {
    for (const ev of obj.events) {
      if (ev && typeof ev.description === "string" && ev.description.trim().length > 0) {
        return ev.description.trim();
      }
      const evFound = findDescriptionFromObject(ev, seen);
      if (evFound) return evFound;
    }
  }

  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0 && (/desc|summary|text|play/i).test(k)) {
      return v.trim();
    }
  }

  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v)) {
      for (const item of v) {
        const found = findDescriptionFromObject(item, seen);
        if (found) return found;
      }
    } else if (v && typeof v === "object") {
      const found = findDescriptionFromObject(v, seen);
      if (found) return found;
    }
  }

  return null;
}

function extractPlayDescription(play, pbp) {
  if (!play) return "";

  if (typeof play.description === "string" && play.description.trim().length > 0) {
    return play.description.trim();
  }

  if (typeof play.play_description === "string" && play.play_description.trim().length > 0) {
    return play.play_description.trim();
  }

  if (typeof play.summary === "string" && play.summary.trim().length > 0) {
    return play.summary.trim();
  }

  if (play.raw && typeof play.raw.description === "string" && play.raw.description.trim().length > 0) {
    return play.raw.description.trim();
  }

  if (play.description && typeof play.description === "object") {
    const found = findDescriptionFromObject(play.description);
    if (found) return found;
  }

  if (play.raw && Array.isArray(play.raw.events)) {
    for (const ev of play.raw.events) {
      if (ev && typeof ev.description === "string" && ev.description.trim().length > 0) {
        return ev.description.trim();
      }
      const found = findDescriptionFromObject(ev);
      if (found) return found;
    }
  }

  if (pbp) {
    const summary = pbp.summary || pbp;
    const foundFromPbp = findDescriptionFromObject(summary);
    if (foundFromPbp) return foundFromPbp;
  }

  return "";
}


async function processGameJob({ gameId, playLimit = 0, language = "en", videoPath, outputDir } = {}) {
  const jobId = uuidv4();
  const startTime = Date.now();
  const out = { jobId, createdAt: new Date().toISOString(), reels: [], logs: [], errors: [] };

  try {
    if (!gameId) throw new Error("Missing gameId. Cannot process game without it.");

    out.logs.push(`=== STARTING GAME PROCESSING ===`);
    out.logs.push(`Job ID: ${jobId}`);
    out.logs.push(`Processing gameId: ${gameId}, playLimit: ${playLimit || "ALL"}`);
    if (videoPath) out.logs.push(`Using override VIDEO PATH: ${videoPath}`);
    if (outputDir) out.logs.push(`Using override OUTPUT DIR: ${outputDir}`);

    out.logs.push(`Fetching play-by-play for game id ${gameId}`);
    const pbp = await getPlayByPlay(gameId, language);

    if (!pbp) throw new Error("Failed to fetch play-by-play data");

    let plays = [];
    function extractPlays(obj) {
      if (!obj || typeof obj !== "object") return [];
      let found = [];

      if (Array.isArray(obj)) {
        for (const item of obj) found.push(...extractPlays(item));
      } else {
        if (obj.type === "play" || obj.description || obj.summary || obj.play_description) {
          found.push(obj);
        }
        for (const key of Object.keys(obj)) {
          try {
            found.push(...extractPlays(obj[key]));
          } catch (e) {
          }
        }
      }
      return found;
    }

    plays = extractPlays(pbp);

    if (!Array.isArray(plays) || plays.length === 0) {
      out.logs.push(`No plays found. PBP top-level keys: ${Object.keys(pbp).join(", ")}`);
      throw new Error("No plays found in play-by-play data.");
    }

    out.logs.push(`Total plays available: ${plays.length}`);

    const limit = playLimit && Number(playLimit) > 0 ? Math.min(Number(playLimit), plays.length) : plays.length;
    out.logs.push(`Will process top ${limit} plays (playLimit param = ${playLimit})`);

    const baseOutDir = outputDir ? path.resolve(outputDir) : path.resolve(CFG_OUTPUT_DIR);
    const reelsDir = path.resolve(baseOutDir, "reels");
    const infoDir = path.resolve(baseOutDir, "info");
    try { ensureDir(reelsDir); ensureDir(infoDir); } catch (e) { /* ignore */ }
    out.logs.push(`Reels will be written to: ${reelsDir}`);
    out.logs.push(`Info files will be written to: ${infoDir}`);

    let reelSeq = 1;
    try {
      const existing = fs.readdirSync(reelsDir).filter((f) => /^reel\d+\.mp4$/i.test(f));
      if (existing.length > 0) {
        const nums = existing.map((f) => {
          const m = f.match(/^reel(\d+)\.mp4$/i);
          return m ? Number(m[1]) : 0;
        }).filter(Boolean);
        if (nums.length > 0) {
          reelSeq = Math.max(...nums) + 1;
        }
      }
    } catch (e) {
      out.logs.push(`Could not read existing reels folder to determine sequence start: ${String(e.message || e)}`);
      reelSeq = 1;
    }

    const results = [];
    let processedCount = 0;
    let reelsCreated = 0;

    const forceReels = (process.env.FORCE_CREATE_REELS === "true");
    out.logs.push(`Processing ${limit} plays (forceReels=${forceReels})...`);

    function getNextReelName() {
      let seq = reelSeq;
      while (true) {
        const candidate = `reel${seq}.mp4`;
        const full = path.join(reelsDir, candidate);
        if (!fs.existsSync(full)) {
          reelSeq = seq + 1;
          return candidate;
        }
        seq++;
      }
    }

    for (let i = 0; i < limit; i++) {
      const play = plays[i];
      try {
        const quarter = play.quarter || play.period || 1;
        const clock = play.clock || play.game_clock || null;
        const descText = extractPlayDescription(play);
        const gameSeconds = clockToGameSeconds(Number(quarter), clock);
        if (gameSeconds === null) {
          out.logs.push(`Skipping play #${i + 1}: invalid/missing clock info (Q${quarter}, ${clock})`);
          continue;
        }

        const audioStart = Math.max(0, Math.floor(gameSeconds - AUDIO_PRE_SECONDS));
        const audioDuration = Math.floor(AUDIO_PRE_SECONDS + 15);
        const audioFileName = `play-${i + 1}-${Date.now()}.wav`;

        let audioPath;
        try {
          audioPath = await sliceAudio({ startSeconds: audioStart, durationSeconds: audioDuration, outName: audioFileName, sourceVideoPath: videoPath, outputDir: baseOutDir });
          out.logs.push(`Audio sliced: ${path.basename(audioPath)}`);
        } catch (err) {
          out.errors.push(`Play ${i + 1} audio slice: ${err.message}`);
          out.logs.push(`Audio slice failed for play ${i + 1}: ${err.message}`);
          continue;
        }

        let transcript = "";
        try {
          transcript = await transcribeShortAudio({ audioPath });
          out.logs.push(`Transcript (${transcript.length} chars) for play ${i + 1}`);
        } catch (err) {
          out.errors.push(`Play ${i + 1} STT: ${err.message}`);
          out.logs.push(`STT failed for play ${i + 1}: ${err.message}`);
          transcript = "";
        }

        const playMeta = { id: play.id || `play-${i + 1}`, quarter, clock, description: descText, gameSeconds, raw: play };

        let evalResult;
        try {
          evalResult = await evaluatePlay({ playMeta, transcript });
          if (!evalResult || typeof evalResult.goodPlay === "undefined") {
            evalResult = { goodPlay: false, reason: "AI returned invalid result", score: 0 };
          }
          out.logs.push(`AI evaluation for play ${i + 1}: ${evalResult.goodPlay ? "GOOD" : "SKIP"} - ${evalResult.reason || ""}`);
        } catch (err) {
          evalResult = { goodPlay: false, reason: "AI evaluation failed", score: 0 };
          out.errors.push(`Play ${i + 1} AI eval: ${err.message}`);
          out.logs.push(`AI eval error for play ${i + 1}: ${err.message}`);
        }

        if (forceReels) {
          if (!evalResult || !evalResult.goodPlay) {
            evalResult = {
              goodPlay: true,
              reason: "Forced highlight for local testing (FORCE_CREATE_REELS=true)",
              score: 0.5
            };
            out.logs.push(`DEV: Forcing reel creation for play ${i + 1}`);
          }
        }

        if (evalResult && evalResult.goodPlay) {
          const clipStart = Math.max(0, gameSeconds - VIDEO_CLIP_PRE);

          let reelName = getNextReelName();
          const reelFullPath = path.join(reelsDir, reelName);

          try {
            const reelPath = await sliceVideo({
              startSeconds: clipStart,
              durationSeconds: VIDEO_CLIP_LENGTH,
              outName: reelName,
              sourceVideoPath: videoPath,
              outputDir: baseOutDir
            });

            const reelBasename = path.basename(reelPath || reelFullPath || reelName);

            const teams = extractTeamsAndScore(play, pbp);
            const minimalInfo = {
              createdAt: new Date().toISOString(),
              jobId,
              playIndex: i + 1,
              quarter,
              clock,
              teams, 
              description: descText || ""
            };

            const infoFilename = reelBasename.replace(/\.mp4$/i, ".txt");
            const infoFullPath = path.join(infoDir, infoFilename);

            try {
              fs.writeFileSync(infoFullPath, JSON.stringify(minimalInfo, null, 2), "utf8");
              out.logs.push(`INFO FILE CREATED: ${infoFilename}`);
            } catch (writeErr) {
              out.errors.push(`Failed to write info file for ${reelBasename}: ${writeErr.message}`);
              out.logs.push(`Info write failed for ${reelBasename}: ${writeErr.message}`);
            }

            out.reels.push({ playId: playMeta.id, reelPath, eval: evalResult, transcript, playMeta, file: reelBasename, infoFile: infoFilename });
            reelsCreated++;
            out.logs.push(`REEL CREATED: ${reelBasename}`);
          } catch (err) {
            out.errors.push(`Play ${i + 1} video slice: ${err.message}`);
            out.logs.push(`Video slice failed for play ${i + 1}: ${err.message}`);
          }
        } else {
          out.logs.push(`Play not selected as highlight: ${evalResult?.reason || "no reason"}`);
        }

        results.push({ playMeta, transcript, evalResult });
        processedCount++;

        try { if (audioPath && fs.existsSync(audioPath)) fs.unlinkSync(audioPath); } catch (e) { /* ignore */ }

      } catch (err) {
        out.errors.push(`Play ${i + 1}: ${err.message}`);
        out.logs.push(`Error processing play ${i + 1}: ${err.message}`);
      }
    }

    out.results = results;
    out.logs.push(`Processed: ${processedCount}/${limit} plays, Reels created: ${reelsCreated}`);
    out.logs.push(`=== PROCESSING COMPLETE ===`);
    out.durationMs = Date.now() - startTime;

    return out;

  } catch (error) {
    out.logs.push(`=== PROCESSING FAILED ===`);
    out.errors.push(`Fatal error: ${error.message}`);
    throw error;
  }
}

module.exports = { processGameJob };
