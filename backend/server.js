// server.js
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const cors = require("cors");

const app = express();
app.use(cors());

const REELS_DIR = path.join(__dirname, "output", "reels");

app.use("/reels", express.static(REELS_DIR));

app.get("/api/reels", async (req, res) => {
  try {
    const files = await fs.readdir(REELS_DIR);
    const reels = files
      .filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f))
      .map((file) => ({
        file,
        url: `${req.protocol}://${req.get("host")}/reels/${encodeURIComponent(
          file
        )}`,
        caption: file.replace(/\.(mp4|mov|m4v|webm)$/i, ""),
      }));
    res.json(reels);
  } catch (err) {
    console.error("❌ Error reading reels folder:", err);
    res.status(500).json({ error: "Failed to read reels folder" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Server running at:`);
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`LAN:     http://172.20.0.183:${PORT}`);
  console.log(`Serving files from: ${REELS_DIR}`);

  try {
    const files = await fs.readdir(REELS_DIR);
    console.log("📂 Found reels:", files);
  } catch (err) {
    console.error("⚠️ Could not read reels folder:", err);
  }
});
