// src/index.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { processGameJob } = require("./processGame");
const { ensureDir } = require("./utils");
const path = require("path");
const fs = require("fs");
const { OUTPUT_DIR } = require("./config");

// Ensure output directory exists
ensureDir(path.resolve(OUTPUT_DIR));
ensureDir(path.resolve(OUTPUT_DIR, "reels"));
ensureDir(path.resolve(OUTPUT_DIR, "audio"));

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// in-memory job store (simple)
const jobs = {};

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "PlayCast backend running", 
    timestamp: new Date().toISOString(),
    endpoints: [
      "POST /process-game",
      "GET /status/:jobId", 
      "GET /reels",
      "GET /reels/:filename"
    ]
  });
});

// Process game endpoint
app.post("/process-game", async (req, res) => {
  const { season, week, home, away, playLimit } = req.body;
  
  if (!season || !week || !home || !away) {
    return res.status(400).json({ 
      error: "Missing required fields", 
      required: ["season", "week", "home", "away"],
      received: { season, week, home, away }
    });
  }
  
  const jobId = Date.now().toString(36) + "-" + Math.floor(Math.random() * 10000);
  jobs[jobId] = { 
    status: "queued", 
    created: new Date().toISOString(),
    params: { season, week, home, away, playLimit: playLimit || 30 }
  };
  
  console.log(`Created job ${jobId} for ${away} @ ${home}, ${season} week ${week}`);
  
  res.json({ jobId, status: "queued" });

  // Start processing async
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
      
      console.log(`Job ${jobId} completed successfully. Generated ${result.reels?.length || 0} reels.`);
      
    } catch (err) {
      console.error(`Job ${jobId} failed:`, err.message);
      jobs[jobId].status = "error";
      jobs[jobId].error = err.message;
      jobs[jobId].stack = process.env.NODE_ENV === 'development' ? err.stack : undefined;
    }
  })();
});

// Check job status
app.get("/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }
  res.json(job);
});

// List all jobs
app.get("/jobs", (req, res) => {
  const jobList = Object.entries(jobs).map(([id, job]) => ({
    jobId: id,
    status: job.status,
    created: job.created,
    params: job.params
  }));
  res.json(jobList);
});

// List generated reels
app.get("/reels", (req, res) => {
  try {
    const reelsDir = path.resolve(OUTPUT_DIR, "reels");
    
    if (!fs.existsSync(reelsDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(reelsDir)
      .filter((f) => f.endsWith(".mp4"))
      .map(f => {
        const filePath = path.join(reelsDir, f);
        const stats = fs.statSync(filePath);
        return {
          file: f,
          url: `/reels/${f}`,
          size: stats.size,
          created: stats.birthtime
        };
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created)); // Latest first
    
    res.json(files);
  } catch (error) {
    console.error("Error listing reels:", error);
    res.status(500).json({ error: "Failed to list reels" });
  }
});

// Serve reel files with proper headers
app.use("/reels", (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Content-Type", "video/mp4");
  next();
}, express.static(path.resolve(OUTPUT_DIR, "reels")));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`PlayCast backend listening on http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  POST /process-game - Start game processing`);
  console.log(`  GET /status/:jobId - Check job status`);
  console.log(`  GET /reels - List generated reels`);
  console.log(`  GET /reels/:filename - Download reel file`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
});