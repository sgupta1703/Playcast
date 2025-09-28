const { processGameJob } = require("../src/processGame");
const path = require("path");
const fs = require("fs");

const VIDEO_PATH = path.resolve(__dirname, "../gameplay.mp4");
const OUTPUT_DIR = path.resolve(__dirname, "../output");

// Example gameId (replace with real if needed)
const GAME_ID = "117502b6-bf44-4b37-b40e-8d1e34bd3a76";

async function testGame() {
  try {
    console.log("==================================================");
    console.log("PLAYCAST BACKEND");
    console.log("==================================================");

    if (!fs.existsSync(VIDEO_PATH)) {
      console.error("Video file not found:", VIDEO_PATH);
      process.exit(1);
    }
    console.log("Video file found:", VIDEO_PATH);

    console.log("\nStarting game processing test...");

    const result = await processGameJob({
      videoPath: VIDEO_PATH,
      outputDir: OUTPUT_DIR,
      gameId: GAME_ID,
      playLimit: 0 
    });

    console.log("\nmade files successfully!");
    console.log(`Reels created: ${result.reels.length}`);
    result.reels.forEach((r, idx) => {
      console.log(`  Reel #${idx + 1}: ${r.file} (${r.infoFile})`);
    });
    console.log(`\nOutput folder: ${OUTPUT_DIR}`);
  } catch (err) {
    console.error("\FAILED");
    console.error(err);
  }
}

testGame();
