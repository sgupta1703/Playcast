const { processGameJob } = require("../src/processGame");
const path = require("path");

const VIDEO_PATH = path.resolve(__dirname, "../gameplay.mp4");
const OUTPUT_DIR = path.resolve(__dirname, "../output");

const GAME_ID = "117502b6-bf44-4b37-b40e-8d1e34bd3a76";

async function testGame() {
  try {
    console.log("==================================================");
    console.log("PLAYCAST BACKEND TEST");
    console.log("==================================================");
    console.log("✅ Video file found:", VIDEO_PATH);

    console.log("\nStarting game processing test...");
    
    await processGameJob({
      videoPath: VIDEO_PATH,
      outputDir: OUTPUT_DIR,
      gameId: GAME_ID,
      playLimit: 0, 
    });

    console.log("\n🎉 Test completed successfully!");
  } catch (err) {
    console.error("\n❌ TEST FAILED");
    console.error(err);
  }
}

testGame();
