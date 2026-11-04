import Meeting from "../models/Meeting.js";
import { randomUUID } from "crypto";
import Workspace from "../models/workspace.js";

// Create a new meeting
export const createMeeting = async (req, res) => {
  try {
    const { title, description, scheduledAt, workspaceId } = req.body;
    let selectedWorkspace = null;

    if (workspaceId) {
      selectedWorkspace = await Workspace.findById(workspaceId);

      if (!selectedWorkspace) {
        return res.status(404).json({
          message: "Workspace not found",
        });
      }

      const isMember = selectedWorkspace.members.some(
        (memberId) => memberId.toString() === req.user.id
      );

      if (!isMember) {
        return res.status(403).json({
          message: "You are not a member of this workspace",
        });
      }
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "Meeting title is required",
      });
    }

    const meeting = await Meeting.create({
      title: title.trim(),
      description: description || "",
      meetingCode: randomUUID().slice(0, 8).toUpperCase(),
      host: req.user.id,
      participants: [req.user.id],
      scheduledAt: scheduledAt || null,
      workspace: selectedWorkspace ? selectedWorkspace._id : null,
    });

    res.status(201).json({
      message: "Meeting created successfully",
      meeting,
    });
  } catch (error) {
    console.error("Create meeting error:", error);

    res.status(500).json({
      message: "Failed to create meeting",
    });
  }
};

// Get meetings created by or joined by the logged-in user
export const getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({
      participants: req.user.id,
    })
      .populate("host", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: meetings.length,
      meetings,
    });
  } catch (error) {
    console.error("Get meetings error:", error);

    res.status(500).json({
      message: "Failed to retrieve meetings",
    });
  }
};
export const joinMeeting = async (req, res) => {
  try {
    const { meetingCode } = req.body;

    if (!meetingCode || !meetingCode.trim()) {
      return res.status(400).json({
        message: "Meeting code is required",
      });
    }

    const meeting = await Meeting.findOne({
      meetingCode: meetingCode.trim().toUpperCase(),
    });

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found. Please check the code.",
      });
    }

    const alreadyJoined = meeting.participants.some(
      (participant) => participant.toString() === req.user.id
    );

    if (alreadyJoined) {
      return res.status(200).json({
        message: "You have already joined this meeting.",
        meeting,
      });
    }

    meeting.participants.push(req.user.id);

    await meeting.save();

    return res.status(200).json({
      message: "Meeting joined successfully!",
      meeting,
    });
  } catch (error) {
    console.error("Join meeting error:", error);

    return res.status(500).json({
      message: "Failed to join meeting",
    });
  }
};
export const getMeetingByCode = async (req, res) => {
  try {
    const { meetingCode } = req.params;

    const meeting = await Meeting.findOne({
      meetingCode: meetingCode.trim().toUpperCase(),
      participants: req.user.id,
    }).populate("host", "name email");

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found, or you are not a participant.",
      });
    }

    return res.status(200).json({ meeting });
  } catch (error) {
    console.error("Get meeting details error:", error);

    return res.status(500).json({
      message: "Failed to retrieve meeting details.",
    });
  }
};
// End a meeting and generate its AI summary independently
export const endMeeting = async (req, res) => {
  try {
    const { meetingCode } = req.params;
    const { transcript } = req.body ?? {};

    if (typeof transcript !== "string" || !transcript.trim()) {
      return res.status(400).json({
        success: false,
        message: "The final meeting transcript is required.",
      });
    }

    if (transcript.length > 100000) {
      return res.status(413).json({
        success: false,
        message: "The meeting transcript is too long.",
      });
    }

    const meeting = await Meeting.findOne({
      meetingCode: meetingCode.trim().toUpperCase(),
    });

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found.",
      });
    }

    if (meeting.host.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the meeting host can end this meeting.",
      });
    }

    if (meeting.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Meeting has already ended.",
        meeting,
      });
    }

    // First, save the transcript and complete the meeting.
    meeting.transcript = transcript.trim();
    meeting.status = "completed";
    meeting.endedAt = new Date();

    await meeting.save();

    // Generate the AI summary separately.
    try {
      const { generateSummary } = await import(
        "../services/summaryService.js"
      );

      const summary = await generateSummary(transcript.trim());

      const actionItemsSection = summary.match(
        /4\.\s*Action Items([\s\S]*?)(?=\n\s*\d+\.\s|$)/i
      );

      const actionItems = actionItemsSection
        ? actionItemsSection[1]
            .split("\n")
            .map((item) =>
              item.replace(/^\s*[-*•\d.)]+\s*/, "").trim()
            )
            .filter(
              (item) => item && !/^not specified$/i.test(item)
            )
        : [];

      meeting.summary = summary;
      meeting.actionItems = actionItems;

      await meeting.save();

      return res.status(200).json({
        success: true,
        summaryAvailable: true,
        message: "Meeting ended and AI summary generated successfully.",
        meeting,
      });
    } catch (aiError) {
      console.error("AI summary generation failed:", aiError);

      return res.status(200).json({
        success: true,
        summaryAvailable: false,
        message:
          "Meeting ended successfully. AI summary is temporarily unavailable. Please try again later.",
        meeting,
      });
    }
  } catch (error) {
    console.error("End meeting error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to end the meeting.",
    });
  }
};
// Get meetings associated with a workspace
export const getWorkspaceMeetings = async (req, res) => {
  try {
    const { workspaceId } = req.params;

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        message: "Workspace not found",
      });
    }

    const isMember = workspace.members.some(
      (memberId) => memberId.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({
        message: "You are not a member of this workspace",
      });
    }

    const meetings = await Meeting.find({
      workspace: workspaceId,
    })
      .populate("host", "name email")
      .populate("participants", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: meetings.length,
      meetings,
    });
  } catch (error) {
    console.error("Get workspace meetings error:", error);

    return res.status(500).json({
      message: "Failed to retrieve workspace meetings",
    });
  }
};
// Delete a meeting - only the creator can delete it
export const deleteMeeting = async (req, res) => {
  try {
    const { meetingCode } = req.params;

    const meeting = await Meeting.findOne({
      meetingCode: meetingCode.trim().toUpperCase(),
    });

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found.",
      });
    }

    // Only the meeting creator can delete it.
    if (meeting.host.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        message: "Only the meeting creator can delete this meeting.",
      });
    }

    await Meeting.deleteOne({ _id: meeting._id });

    return res.status(200).json({
      message: "Meeting deleted successfully.",
    });
  } catch (error) {
    console.error("Delete meeting error:", error);

    return res.status(500).json({
      message: "Failed to delete meeting.",
    });
  }
};