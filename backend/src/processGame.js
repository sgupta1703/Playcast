// src/processGame.js
const { getPlayByPlay } = require("./sportsRadar");
const { sliceAudio, sliceVideo } = require("./media");
const { transcribeShortAudio } = require("./stt");
const { evaluatePlay } = require("./genai");
const { clockToGameSeconds } = require("./utils");
const path = require("path");
const { AUDIO_PRE_SECONDS, VIDEO_CLIP_PRE, VIDEO_CLIP_LENGTH, OUTPUT_DIR: CFG_OUTPUT_DIR } = require("./config");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");

/**
 * @param {Object} params
 * @param {string} params.gameId - Sportradar game ID (required)
 * @param {number} [params.playLimit=0] - Number of plays to process. 0 => process ALL plays.
 * @param {string} [params.language="en"]
 * @param {string} [params.videoPath] - Optional path to override source video file.
 * @param {string} [params.outputDir] - Optional output directory for reels/audio.
 */
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

    // Step 1: Fetch play-by-play
    out.logs.push(`Fetching play-by-play for game id ${gameId}`);
    const pbp = await getPlayByPlay(gameId, language);

    if (!pbp) throw new Error("Failed to fetch play-by-play data");

    // Step 2: Extract plays (universal recursive extraction)
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
            // ignore
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

    // Decide how many plays to process: if playLimit <= 0 => process all
    const limit = playLimit && Number(playLimit) > 0 ? Math.min(Number(playLimit), plays.length) : plays.length;
    out.logs.push(`Will process top ${limit} plays (playLimit param = ${playLimit})`);

    // Prepare reels output dir (use override or config)
    const reelsDir = outputDir ? path.resolve(outputDir, "reels") : path.resolve(CFG_OUTPUT_DIR, "reels");
    try { fs.mkdirSync(reelsDir, { recursive: true }); } catch (e) { /* ignore */ }
    out.logs.push(`Reels will be written to: ${reelsDir}`);

    // compute starting sequence number by scanning existing reelN files to avoid overwrite
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
      // if reading dir fails we'll start at 1
      out.logs.push(`Could not read existing reels folder to determine sequence start: ${String(e.message || e)}`);
      reelSeq = 1;
    }

    const results = [];
    let processedCount = 0;
    let reelsCreated = 0;

    const forceReels = (process.env.FORCE_CREATE_REELS === "true");
    out.logs.push(`Processing ${limit} plays (forceReels=${forceReels})...`);

    // helper: choose next non-colliding reel filename (reelN.mp4)
    function getNextReelName() {
      let seq = reelSeq;
      while (true) {
        const candidate = `reel${seq}.mp4`;
        const full = path.join(reelsDir, candidate);
        if (!fs.existsSync(full)) {
          // reserve it by incrementing reelSeq for next call
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
        const desc = play.description || play.summary || JSON.stringify(play).slice(0, 200);
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
          audioPath = await sliceAudio({ startSeconds: audioStart, durationSeconds: audioDuration, outName: audioFileName, sourceVideoPath: videoPath, outputDir });
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

        const playMeta = { id: play.id || `play-${i + 1}`, quarter, clock, description: desc, gameSeconds, raw: play };

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

          // Build sequential reel filename
          let reelName = getNextReelName();
          const reelFullPath = path.join(reelsDir, reelName);

          try {
            const reelPath = await sliceVideo({
              startSeconds: clipStart,
              durationSeconds: VIDEO_CLIP_LENGTH,
              outName: reelName,
              sourceVideoPath: videoPath,
              outputDir
            });

            // Ensure returned path is the file we expect; some functions may return absolute path
            const reelBasename = path.basename(reelPath || reelFullPath || reelName);

            out.reels.push({ playId: playMeta.id, reelPath, eval: evalResult, transcript, playMeta, file: reelBasename });
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

        // Clean up audio slice
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
