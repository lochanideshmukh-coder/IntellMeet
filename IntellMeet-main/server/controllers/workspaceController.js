import Workspace from "../models/workspace.js";
import User from "../models/User.js";

// Create workspace
export const createWorkspace = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Workspace name is required",
      });
    }

    const workspace = await Workspace.create({
      name: name.trim(),
      description: description || "",
      owner: req.user.id,
      members: [req.user.id],
    });

    res.status(201).json({
      message: "Workspace created successfully",
      workspace,
    });
  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({
      message: "Failed to create workspace",
    });
  }
};

// Get workspaces
export const getWorkspaces = async (req, res) => {
  try {
    const workspaces = await Workspace.find({
      members: req.user.id,
    })
      .populate("owner", "name email")
      .populate("members", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ workspaces });
  } catch (error) {
    console.error("Get workspaces error:", error);
    res.status(500).json({
      message: "Failed to fetch workspaces",
    });
  }
};

// Add team member
export const addWorkspaceMember = async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        message: "Member email is required",
      });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    // Only the workspace owner can add members
    if (workspace.owner.toString() !== req.user.id) {
      return res.status(403).json({
        message: "Only the workspace owner can add members",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user) {
      return res.status(404).json({
        message: "No IntellMeet user found with this email",
      });
    }

    if (
      workspace.members.some(
        (memberId) => memberId.toString() === user._id.toString()
      )
    ) {
      return res.status(400).json({
        message: "User is already a workspace member",
      });
    }

    workspace.members.push(user._id);
    await workspace.save();

    await workspace.populate("members", "name email");

    res.status(200).json({
      message: "Team member added successfully",
      workspace,
    });
  } catch (error) {
    console.error("Add workspace member error:", error);
    res.status(500).json({
      message: "Failed to add team member",
    });
  }
};