const dotenv = require("dotenv");
const path = require("path");
dotenv.config();

function resolveIfPresent(envVar, fallback) {
  if (process.env[envVar]) {
    return path.resolve(process.env[envVar]);
  }
  return fallback;
}

module.exports = {
  SPORTS_RADAR_KEY: process.env.SPORTS_RADAR_KEY || "LsKeAHojugOoCrBwQSPazN3pDou8wKIcmh8zlVZ1",
  SPORTS_RADAR_BASE: process.env.SPORTS_RADAR_BASE || "https://api.sportradar.com",
  SPORTS_RADAR_ACCESS: process.env.SPORTS_RADAR_ACCESS || "nfl/official/trial",

  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "AIzaSyDQk6gzR4TWCC71kaZokG8cF7canutaN10",
  GOOGLE_GENAI_KEY: process.env.GOOGLE_GENAI_KEY || "AIzaSyDQk6gzR4TWCC71kaZokG8cF7canutaN10",

  VIDEO_PATH: process.env.VIDEO_PATH ? path.resolve(process.env.VIDEO_PATH) : path.resolve(__dirname, "../gameplay.mp4"),
  AUDIO_PATH: process.env.AUDIO_PATH ? path.resolve(process.env.AUDIO_PATH) : path.resolve(__dirname, "../output/audio/game_audio.wav"),

  OUTPUT_DIR: process.env.OUTPUT_DIR ? path.resolve(process.env.OUTPUT_DIR) : path.resolve(__dirname, "../output"),

  AUDIO_PRE_SECONDS: Number(process.env.AUDIO_PRE_SECONDS || 75), 
  VIDEO_CLIP_PRE: Number(process.env.VIDEO_CLIP_PRE || 10),
  VIDEO_CLIP_LENGTH: Number(process.env.VIDEO_CLIP_LENGTH || 45), 
};
