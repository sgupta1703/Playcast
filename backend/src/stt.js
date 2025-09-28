// src/stt.js
const fs = require("fs");
const path = require("path");
const { GOOGLE_API_KEY } = require("./config");

/**
 * Transcribe a short audio file using Google Speech-to-Text (sync recognize).
 * This method sends base64 audio in the body (works for short samples).
 *
 * @param {string} audioPath 
 * @param {string} [languageCode="en-US"]
 */
async function transcribeShortAudio({ audioPath, languageCode = "en-US" }) {
  try {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    console.log(`Transcribing audio file: ${audioPath}`);

    const audioBuffer = fs.readFileSync(audioPath);
    const bytes = audioBuffer.toString("base64");

    console.log(`Audio file size (bytes): ${audioBuffer.length}`);

    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (audioBuffer.length > maxSizeBytes) {
      throw new Error(
        `Audio file too large for synchronous recognition: ${audioBuffer.length} bytes. Max: ${maxSizeBytes} bytes. Consider async longRunningRecognize.`
      );
    }

    const url = `https://speech.googleapis.com/v1/speech:recognize?key=${encodeURIComponent(GOOGLE_API_KEY)}`;

    const body = {
      config: {
        encoding: "LINEAR16",
        sampleRateHertz: 16000,
        languageCode,
        enableAutomaticPunctuation: true,
        model: "default",
        useEnhanced: false,
        enableWordTimeOffsets: false,
        maxAlternatives: 1,
        profanityFilter: false,
        audioChannelCount: 1,
      },
      audio: {
        content: bytes,
      },
    };

    console.log("Sending request to Google Speech-to-Text API...");

    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PlayCast/1.0",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Speech API error ${res.status}:`, errorText);
      throw new Error(`Speech API error ${res.status}: ${errorText}`);
    }

    const json = await res.json();
    console.log("Speech-to-Text response received");

    if (!json.results || json.results.length === 0) {
      console.log("No speech detected in audio");
      return "";
    }

    const transcript = json.results
      .map((r) => (r.alternatives?.[0]?.transcript || ""))
      .filter(t => t.length > 0)
      .join(" ");

    console.log(`Transcript length: ${transcript.length} characters`);
    console.log(`Transcript preview: ${transcript.substring(0, 100)}...`);

    return transcript.trim();

  } catch (error) {
    console.error("Speech-to-text transcription failed:", error.message);

    if (error.message.includes("404")) {
      console.error("Make sure Speech-to-Text API is enabled in Google Cloud Console");
    } else if (error.message.includes("403")) {
      console.error("Check your Google API key permissions");
    } else if (error.message.includes("too large")) {
      console.error("Audio file is too large for sync recognition. Consider shorter slices or async longRunningRecognize.");
    }

    throw error;
  }
}

module.exports = {
  transcribeShortAudio,
};
