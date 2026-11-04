import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createWorkspace,
  getWorkspaces,
  addWorkspaceMember,
} from "../controllers/workspaceController.js";

const router = express.Router();

router.post("/", authMiddleware, createWorkspace);
router.get("/", authMiddleware, getWorkspaces);

// Add a member to a workspace
router.post("/:workspaceId/members", authMiddleware, addWorkspaceMember);

export default router;