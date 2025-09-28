const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { processGameJob } = require("./processGame");
const { ensureDir } = require("./utils");
const path = require("path");
const fs = require("fs");
const { OUTPUT_DIR } = require("./config");

const SPORTS = {
  football: { reels: "reels", info: "info" }, // legacy
  basketball: { reels: "reels_basketball", info: "info_basketball" },
  tennis: { reels: "reels_tennis", info: "info_tennis" },
  baseball: { reels: "reels_baseball", info: "info_baseball" },
  soccer: { reels: "reels_soccer", info: "info_soccer" }
};

ensureDir(path.resolve(OUTPUT_DIR));
Object.values(SPORTS).forEach(({ reels, info }) => {
  ensureDir(path.resolve(OUTPUT_DIR, reels));
  ensureDir(path.resolve(OUTPUT_DIR, info));
});

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

const jobs = {};

app.get("/", (req, res) => {
  res.json({
    status: "PlayCast backend running",
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /process-game",
      "GET /status/:jobId",
      "GET /reels",
      "GET /reels/:sport",
      "GET /reels/:sport/:filename",
      "GET /info/:sport/:filename"
    ]
  });
});

app.post("/process-game", async (req, res) => {
  const { season, week, home, away, playLimit } = req.body;

  if (!season || !week || !home || !away) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["season", "week", "home", "away"],
      received: { season, week, home, away }
    });
  }

  const jobId =
    Date.now().toString(36) + "-" + Math.floor(Math.random() * 10000);
  jobs[jobId] = {
    status: "queued",
    created: new Date().toISOString(),
    params: { season, week, home, away, playLimit: playLimit || 30 }
  };

  console.log(`Created job ${jobId} for ${away} @ ${home}, ${season} week ${week}`);
  res.json({ jobId, status: "queued" });

  (async () => {
    try {
      console.log(`Starting processing for job ${jobId}`);
      jobs[jobId].status = "processing";
      jobs[jobId].startTime = new Date().toISOString();

      const result = await processGameJob({
        season,
        week,
        home,
        away,
        playLimit: playLimit || 30
      });

      jobs[jobId].status = "completed";
      jobs[jobId].result = result;
      jobs[jobId].finished = new Date().toISOString();

      console.log(
        `Job ${jobId} completed successfully. Generated ${
          result.reels?.length || 0
        } reels.`
      );
    } catch (err) {
      console.error(`Job ${jobId} failed:`, err.message);
      jobs[jobId].status = "error";
      jobs[jobId].error = err.message;
      jobs[jobId].stack =
        process.env.NODE_ENV === "development" ? err.stack : undefined;
    }
  })();
});

app.get("/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.get("/jobs", (req, res) => {
  const jobList = Object.entries(jobs).map(([id, job]) => ({
    jobId: id,
    status: job.status,
    created: job.created,
    params: job.params
  }));
  res.json(jobList);
});

function listReelsForSport(sp) {
  const dirs = SPORTS[sp];
  if (!dirs) return [];
  const reelsDir = path.resolve(OUTPUT_DIR, dirs.reels);
  const infoDir = path.resolve(OUTPUT_DIR, dirs.info);

  if (!fs.existsSync(reelsDir)) return [];

  return fs.readdirSync(reelsDir)
    .filter(f => f.match(/\.(mov|mp4)$/i))
    .map(f => {
      const filePath = path.join(reelsDir, f);
      const stats = fs.statSync(filePath);

      const baseName = f.replace(/\.(mov|mp4)$/i, "");
      const infoJsonFilename = `${baseName}.json`;
      const infoTxtFilename = `${baseName}.txt`;
      const infoJsonPath = path.join(infoDir, infoJsonFilename);
      const infoTxtPath = path.join(infoDir, infoTxtFilename);

      let infoUrl = null;
      if (fs.existsSync(infoJsonPath)) {
        infoUrl = `/info/${sp}/${infoJsonFilename}`;
      } else if (fs.existsSync(infoTxtPath)) {
        infoUrl = `/info/${sp}/${infoTxtFilename}`;
      }

      return {
        sport: sp,
        file: f,
        url: `/reels/${sp}/${f}`,
        infoUrl: infoUrl,
        size: stats.size,
        created: stats.birthtime
      };
    });
}

app.get("/reels/:sport?", (req, res) => {
  try {
    const { sport } = req.params;
    let files = [];

    if (sport) {
      if (!SPORTS[sport]) {
        return res.status(400).json({ error: `Unknown sport: ${sport}` });
      }
      files = listReelsForSport(sport);
    } else {
      Object.keys(SPORTS).forEach(sp => {
        files.push(...listReelsForSport(sp));
      });
    }

    files.sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json(files);
  } catch (error) {
    console.error("Error listing reels:", error);
    res.status(500).json({ error: "Failed to list reels" });
  }
});

Object.entries(SPORTS).forEach(([sp, dirs]) => {
  app.use(`/reels/${sp}`, (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  }, express.static(path.resolve(OUTPUT_DIR, dirs.reels)));

  app.use(`/info/${sp}`, (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  }, express.static(path.resolve(OUTPUT_DIR, dirs.info)));
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PlayCast backend listening on http://localhost:${PORT}`);
  console.log("API endpoints:");
  console.log("  POST /process-game - Start game processing");
  console.log("  GET /status/:jobId - Check job status");
  console.log("  GET /reels - List reels for all sports");
  console.log("  GET /reels/:sport - List reels for one sport");
  console.log("  GET /reels/:sport/:filename - Download reel");
  console.log("  GET /info/:sport/:filename - Download reel info (.json or .txt)");
  console.log(`Output directory: ${OUTPUT_DIR}`);
});
