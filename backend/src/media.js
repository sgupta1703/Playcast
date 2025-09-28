const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
if (ffmpegPath) {
  try { ffmpeg.setFfmpegPath(ffmpegPath); } catch (e) { /* ignore if already set */ }
}

const path = require("path");
const fs = require("fs");
const { ensureDir } = require("./utils");
const { VIDEO_PATH: CFG_VIDEO_PATH, OUTPUT_DIR: CFG_OUTPUT_DIR } = require("./config");

console.log("MEDIA: Config VIDEO_PATH:", CFG_VIDEO_PATH);
console.log("MEDIA: Config OUTPUT_DIR:", CFG_OUTPUT_DIR);


function resolvePaths({ sourceVideoPath, outputDir } = {}) {
  const source = sourceVideoPath ? path.resolve(sourceVideoPath) : path.resolve(CFG_VIDEO_PATH);
  const outDir = outputDir ? path.resolve(outputDir) : path.resolve(CFG_OUTPUT_DIR);

  ensureDir(outDir);
  ensureDir(path.resolve(outDir, "reels"));
  ensureDir(path.resolve(outDir, "audio"));

  return { source, outDir, reelsDir: path.resolve(outDir, "reels"), audioDir: path.resolve(outDir, "audio") };
}


async function extractAudioFromVideo({ sourceVideoPath, outputDir } = {}) {
  const { source, audioDir } = resolvePaths({ sourceVideoPath, outputDir });
  const audioPath = path.resolve(audioDir, "game_audio.wav");

  if (fs.existsSync(audioPath)) {
    console.log("Audio file already exists, skipping extraction:", audioPath);
    return audioPath;
  }

  if (!fs.existsSync(source)) {
    throw new Error(`Video file not found at: ${source}`);
  }

  console.log("Extracting audio from video...");
  console.log(`Input video: ${source}`);
  console.log(`Output audio: ${audioPath}`);

  return new Promise((resolve, reject) => {
    ffmpeg(source)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(44100)
      .audioChannels(2)
      .output(audioPath)
      .on("start", (cmd) => console.log("FFmpeg command (extractAudio):", cmd))
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`Audio extraction progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on("end", () => {
        console.log("Audio extraction completed successfully");
        resolve(audioPath);
      })
      .on("error", (err) => {
        console.error("Audio extraction failed:", err.message || err);
        reject(err);
      })
      .run();
  });
}


async function sliceAudio({ startSeconds, durationSeconds, outName, sourceVideoPath, outputDir } = {}) {
  const { source, audioDir } = resolvePaths({ sourceVideoPath, outputDir });

  const mainAudioPath = await extractAudioFromVideo({ sourceVideoPath: source, outputDir });

  outName = outName || `audio-${Date.now()}-${Math.floor(Math.random() * 1000)}.wav`;
  const outPath = path.resolve(audioDir, outName);

  console.log(`Slicing audio from ${startSeconds}s for ${durationSeconds}s -> ${outPath}`);

  return new Promise((resolve, reject) => {
    ffmpeg(mainAudioPath)
      .setStartTime(startSeconds)
      .duration(durationDurationCheck(durationSeconds))
      .audioCodec("pcm_s16le")
      .audioFrequency(44100)
      .audioChannels(2)
      .output(outPath)
      .on("start", (cmd) => console.log("Audio slice FFmpeg command:", cmd))
      .on("end", () => {
        console.log(`Audio slice completed: ${outPath}`);
        resolve(outPath);
      })
      .on("error", (err) => {
        console.error("Audio slice failed:", err.message || err);
        reject(err);
      })
      .run();
  });
}

async function sliceVideo({ startSeconds, durationSeconds, outName, sourceVideoPath, outputDir } = {}) {
  const { source, reelsDir, audioDir } = resolvePaths({ sourceVideoPath, outputDir });

  outName = outName || `reel-${Date.now()}-${Math.floor(Math.random() * 1000)}.mp4`;
  const outPath = path.resolve(reelsDir, outName);

  console.log(`Slicing video from ${startSeconds}s for ${durationSeconds}s`);
  console.log(`Input video: ${source}`);
  console.log(`Output video: ${outPath}`);

  if (!fs.existsSync(source)) {
    throw new Error(`Video file not found at: ${source}`);
  }

  // Check for audio stream in source
  const hasAudio = await new Promise((resolve) => {
    ffmpeg.ffprobe(source, (err, metadata) => {
      if (err || !metadata || !Array.isArray(metadata.streams)) {
        console.warn("ffprobe failed or returned no streams; assuming no audio.");
        return resolve(false);
      }
      const audioStream = metadata.streams.find((s) => s.codec_type === "audio");
      resolve(!!audioStream);
    });
  });

  if (hasAudio) {
    return new Promise((resolve, reject) => {
      ffmpeg(source)
        .setStartTime(startSeconds)
        .duration(durationDurationCheck(durationSeconds))
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-movflags +faststart",
          "-pix_fmt yuv420p",
          "-map 0:v:0",
          "-map 0:a:0"
        ])
        .output(outPath)
        .on("start", (cmd) => console.log("Video slice FFmpeg command:", cmd))
        .on("progress", (progress) => {
          if (progress.percent) {
            console.log(`Video slice progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on("end", () => {
          console.log(`Video slice completed (with audio): ${outPath}`);
          resolve(outPath);
        })
        .on("error", (err) => {
          console.error("Video slice failed (with audio):", err.message || err);
          reject(err);
        })
        .run();
    });
  }

  console.log("Source has no audio — creating video-only clip then attempting to merge external audio (if present).");

  const tmpVideoPath = outPath + ".video.tmp.mp4";
  const mainAudioPath = path.resolve(audioDir, "game_audio.wav");
  const audioSliceName = `audio-for-${path.basename(outName, ".mp4")}-${Date.now()}.wav`;
  const audioSlicePath = path.resolve(audioDir, audioSliceName);

  await new Promise((resolve, reject) => {
    ffmpeg(source)
      .setStartTime(startSeconds)
      .duration(durationDurationCheck(durationSeconds))
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-movflags +faststart",
        "-pix_fmt yuv420p",
        "-an" 
      ])
      .output(tmpVideoPath)
      .on("start", (cmd) => console.log("Video-only slice FFmpeg command:", cmd))
      .on("progress", (progress) => {
        if (progress.percent) {
          console.log(`Video-only slice progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on("end", () => {
        console.log(`Video-only slice completed: ${tmpVideoPath}`);
        resolve();
      })
      .on("error", (err) => {
        console.error("Video-only slice failed:", err.message || err);
        reject(err);
      })
      .run();
  });

  if (fs.existsSync(mainAudioPath)) {
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(mainAudioPath)
          .setStartTime(startSeconds)
          .duration(durationDurationCheck(durationSeconds))
          .audioCodec("pcm_s16le")
          .audioFrequency(44100)
          .audioChannels(2)
          .output(audioSlicePath)
          .on("start", (cmd) => console.log("Audio-for-video FFmpeg command:", cmd))
          .on("end", () => {
            console.log(`Audio slice for video created: ${audioSlicePath}`);
            resolve();
          })
          .on("error", (err) => {
            console.error("Audio slice for video failed:", err.message || err);
            reject(err);
          })
          .run();
      });

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(tmpVideoPath)
          .input(audioSlicePath)
          .outputOptions([
            "-c:v copy",
            "-c:a aac",
            "-b:a 128k",
            "-map 0:v:0",
            "-map 1:a:0",
            "-shortest",
            "-movflags +faststart"
          ])
          .output(outPath)
          .on("start", (cmd) => console.log("Merge FFmpeg command:", cmd))
          .on("progress", (progress) => {
            if (progress.percent) {
              console.log(`Merge progress: ${Math.round(progress.percent)}%`);
            }
          })
          .on("end", () => {
            console.log(`Merged video+audio completed: ${outPath}`);
            resolve();
          })
          .on("error", (err) => {
            console.error("Merging video+audio failed:", err.message || err);
            reject(err);
          })
          .run();
      });

      try { if (fs.existsSync(tmpVideoPath)) fs.unlinkSync(tmpVideoPath); } catch (e) {}
      try { if (fs.existsSync(audioSlicePath)) fs.unlinkSync(audioSlicePath); } catch (e) {}

      return outPath;
    } catch (mergeErr) {
      console.warn("Audio merge fallback failed, returning video-only clip:", mergeErr.message || mergeErr);
      try {
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      } catch (e) {}
      fs.renameSync(tmpVideoPath, outPath);
      return outPath;
    }
  } else {
    try {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    } catch (e) {}
    fs.renameSync(tmpVideoPath, outPath);
    console.log("No external audio found; produced video-only clip:", outPath);
    return outPath;
  }
}


function durationDurationCheck(dur) {
  const n = Number(dur);
  return isFinite(n) && n > 0 ? n : 1;
}

module.exports = {
  sliceAudio,
  sliceVideo,
  extractAudioFromVideo,
};
