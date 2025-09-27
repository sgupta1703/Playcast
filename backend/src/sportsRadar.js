// src/sportsRadar.js
let fetchFn;

try {
  if (typeof global.fetch === "function") {
    fetchFn = global.fetch.bind(global);
  } else {
    // Try requiring node-fetch in a way compatible with v2 and v3
    const nf = require("node-fetch");
    fetchFn = nf.default || nf;
  }
} catch (err) {
  // no fetch available — throw later when used
  fetchFn = null;
}

const { SPORTS_RADAR_KEY, SPORTS_RADAR_BASE, SPORTS_RADAR_ACCESS } = require("./config");

const qs = (obj) => Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

async function fetchJson(url) {
  console.log(`Fetching: ${url}`);
  if (!fetchFn) {
    throw new Error("No fetch implementation available. Install node-fetch@2 or run on Node 18+ which includes global fetch.");
  }
  const r = await fetchFn(url);
  if (!r.ok) {
    const text = await r.text();
    const err = new Error(`Sportradar HTTP ${r.status}: ${text}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/**
 * Find a game by season and week and team substring match.
 * Uses season schedule endpoint then filters by week + team names (home/away).
 */
async function findGameByTeams({ season, week, home, away, language = "en" }) {
  try {
    const seasonType = "REG";
    const url = `${SPORTS_RADAR_BASE}/nfl/official/trial/v7/${language}/games/${season}/${seasonType}/schedule.json?${qs({ api_key: SPORTS_RADAR_KEY })}`;
    
    const json = await fetchJson(url);
    console.log(`Received schedule data with ${json.games ? json.games.length : 0} games`);
    
    const games = json.games || [];
    
    const candidate = games.find((g) => {
      if (!g || !g.home || !g.away) return false;
      
      const homeName = (g.home.name || g.home.alias || g.home.market || "").toLowerCase();
      const awayName = (g.away.name || g.away.alias || g.away.market || "").toLowerCase();
      const weekNum = g.week;
      
      const matchWeek = Number(weekNum) === Number(week);
      
      const matchTeams = (
        (homeName.includes(home.toLowerCase()) && awayName.includes(away.toLowerCase())) ||
        (homeName.includes(away.toLowerCase()) && awayName.includes(home.toLowerCase()))
      );
      
      console.log(`Checking game: ${awayName} @ ${homeName}, Week ${weekNum}, Match: ${matchWeek && matchTeams}`);
      
      return matchWeek && matchTeams;
    });
    
    if (candidate) {
      console.log(`Found game: ${candidate.id || candidate.game_id}`);
    } else {
      console.log("No matching game found");
      console.log("Available games for debugging:");
      games.slice(0, 5).forEach(g => {
        if (g.home && g.away) {
          console.log(`  Week ${g.week}: ${g.away.alias || g.away.name} @ ${g.home.alias || g.home.name}`);
        }
      });
    }
    
    return candidate || null;
  } catch (error) {
    console.error("Error finding game:", error.message);
    throw error;
  }
}

/**
 * Fetch play-by-play for a given game id
 */
async function getPlayByPlay(gameId, language = "en") {
  try {
    const url = `${SPORTS_RADAR_BASE}/nfl/official/trial/v7/${language}/games/${encodeURIComponent(gameId)}/pbp.json?${qs({ api_key: SPORTS_RADAR_KEY })}`;
    
    const data = await fetchJson(url);
    console.log(`Received play-by-play data for game ${gameId}`);
    
    return data;
  } catch (error) {
    console.error("Error fetching play-by-play:", error.message);
    throw error;
  }
}

module.exports = {
  findGameByTeams,
  getPlayByPlay,
};
