// src/utils.js
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    mkdirp.sync(dir);
  }
}

/**
 * Convert quarter and clock time to game seconds
 * @param {number} quarter - Quarter number (1-4 for NFL)
 * @param {string} clock - Time in MM:SS format (e.g., "14:30")
 * @returns {number|null} - Total game seconds from start, or null if invalid
 */
function clockToGameSeconds(quarter, clock) {
  if (!quarter || !clock) return null;
  
  // Parse clock format (MM:SS)
  const timeParts = clock.toString().split(':');
  if (timeParts.length !== 2) return null;
  
  const minutes = parseInt(timeParts[0], 10);
  const seconds = parseInt(timeParts[1], 10);
  
  if (isNaN(minutes) || isNaN(seconds)) return null;
  
  // NFL quarters are 15 minutes each
  // Clock counts down in each quarter, so we need to convert
  const quarterLength = 15 * 60; // 900 seconds per quarter
  const timeElapsedInQuarter = quarterLength - (minutes * 60 + seconds);
  const quarterStartTime = (quarter - 1) * quarterLength;
  
  return quarterStartTime + timeElapsedInQuarter;
}

/**
 * Format seconds into MM:SS
 * @param {number} totalSeconds 
 * @returns {string}
 */
function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

module.exports = {
  ensureDir,
  clockToGameSeconds,
  formatClock,
};