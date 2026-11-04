import express from "express";
import {generateSummary} from "../services/summaryService.js"

const router = express.Router();

router.post("/", async (req, res) => {
  const startedAt = Date.now();

  try {
    const { transcript } = req.body ?? {};

    if (
      typeof transcript !== "string" ||
      !transcript.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "A meeting transcript is required.",
      });
    }

    if (transcript.length > 100000) {
      return res.status(413).json({
        success: false,
        message:
          "Transcript is too long. Please shorten it before summarizing.",
      });
    }

    console.log("Starting Gemini meeting summary...");

    const summary = await generateSummary(transcript);

    console.log(
      `Gemini summary completed in ${
        (Date.now() - startedAt) / 1000
      } seconds.`
    );

    return res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Gemini summary error:", error.message);

    const status = error.status ?? error.code;

    if (status === 429 || status === 503) {
      return res.status(503).json({
        success: false,
        message:
          "The AI service is temporarily busy. Please try again shortly.",
      });
    }

    return res.status(502).json({
      success: false,
      message:
        "Unable to generate the meeting summary. Please try again later.",
    });
  }
});

export default router;




