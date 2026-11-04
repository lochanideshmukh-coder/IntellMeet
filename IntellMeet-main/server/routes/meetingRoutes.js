import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createMeeting,
  getMeetings,
  joinMeeting,
  getMeetingByCode,
  endMeeting,
  getWorkspaceMeetings,
  deleteMeeting
} from "../controllers/meetingController.js";

const router = express.Router();

// Create a meeting
router.post("/", authMiddleware, createMeeting);

// Get meetings for the logged-in user
router.get("/", authMiddleware, getMeetings);

// Join a meeting
router.post("/join", authMiddleware, joinMeeting);

// Get meetings associated with a workspace
router.get(
  "/workspace/:workspaceId",
  authMiddleware,
  getWorkspaceMeetings
);

// End a meeting
router.post("/:meetingCode/end", authMiddleware, endMeeting);

// Delete a meeting
router.delete("/:meetingCode", authMiddleware, deleteMeeting);

// Get meeting details
router.get("/:meetingCode", authMiddleware, getMeetingByCode);

export default router;