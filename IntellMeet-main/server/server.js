import express from "express";
import cors from "cors";
import "./env.js";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import summaryRoutes from "./routes/summaryRoutes.js";
import { createServer } from "http";
import { Server } from "socket.io";
import workspaceRoutes from "./routes/workspaceRoutes.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
  })
);

app.use(express.json());
app.use((req, res, next) => {
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/summary",summaryRoutes);
app.use("/api/workspaces", workspaceRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to the IntellMeet API",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "IntellMeet backend is running",
  });
});

// Track participants in each meeting room.
const meetingParticipants = new Map();

function sendParticipantList(roomCode) {
  const participants = meetingParticipants.get(roomCode);

  const socketIds = participants ? [...participants] : [];

  io.to(roomCode).emit("participant-list", socketIds);
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.data.meetingCode = null;

  // Join a meeting.
  socket.on("join-meeting", async (meetingCode) => {
    console.log("JOIN EVENT RECEIVED:", socket.id, meetingCode);
    if (typeof meetingCode !== "string" || !meetingCode.trim()) {
      return;
    }

    const roomCode = meetingCode.trim().toUpperCase();
    console.log("JOIN REQUEST:", socket.id, roomCode);
    const previousRoom = socket.data.meetingCode;

    // Leave the previous meeting if necessary.
    if (previousRoom && previousRoom !== roomCode) {
      const previousParticipants = meetingParticipants.get(previousRoom);

      previousParticipants?.delete(socket.id);

      await socket.leave(previousRoom);

      if (previousParticipants?.size === 0) {
        meetingParticipants.delete(previousRoom);
      }

      sendParticipantList(previousRoom);
    }

    // Prevent duplicate joins from adding duplicate entries.
    if (socket.data.meetingCode === roomCode) {
      sendParticipantList(roomCode);
      return;
    }

    await socket.join(roomCode);

    socket.data.meetingCode = roomCode;

    if (!meetingParticipants.has(roomCode)) {
      meetingParticipants.set(roomCode, new Set());
    }

    meetingParticipants.get(roomCode).add(socket.id);

    sendParticipantList(roomCode);

    console.log(
      `Socket ${socket.id} joined ${roomCode}. Participants: ${
        meetingParticipants.get(roomCode).size
      }`
    );
  });

  // Relay a WebRTC offer to another participant.
  socket.on("webrtc-offer", ({ targetSocketId, offer } = {}) => {
  const roomCode = socket.data.meetingCode;

  console.log("Offer received from:", socket.id);
  console.log("Offer target:", targetSocketId);
  console.log("Sender room:", roomCode);

  if (!roomCode || !targetSocketId || !offer) {
    console.log("Offer rejected: missing room, target, or offer");
    return;
  }

  const participants = meetingParticipants.get(roomCode);

  if (!participants?.has(targetSocketId)) {
    console.log("Offer rejected: target not in meeting room");
    return;
  }

  console.log("Forwarding offer to:", targetSocketId);

  io.to(targetSocketId).emit("webrtc-offer", {
    senderSocketId: socket.id,
    offer,
  });
});

  // Relay a WebRTC answer to another participant.
  socket.on("webrtc-answer", ({ targetSocketId, answer } = {}) => {
    const roomCode = socket.data.meetingCode;

    if (!roomCode || !targetSocketId || !answer) return;

    const participants = meetingParticipants.get(roomCode);

    if (!participants?.has(targetSocketId)) return;

    io.to(targetSocketId).emit("webrtc-answer", {
      senderSocketId: socket.id,
      answer,
    });
  });

  // Relay ICE candidates used to establish the connection.
  socket.on(
    "webrtc-ice-candidate",
    ({ targetSocketId, candidate } = {}) => {
      const roomCode = socket.data.meetingCode;

      if (!roomCode || !targetSocketId || !candidate) return;

      const participants = meetingParticipants.get(roomCode);

      if (!participants?.has(targetSocketId)) return;

      io.to(targetSocketId).emit("webrtc-ice-candidate", {
        senderSocketId: socket.id,
        candidate,
      });
    }
  );
  // Receive and broadcast live meeting transcripts.
  socket.on("send-transcript", (transcriptData = {}) => {
  const roomCode = socket.data.meetingCode;

  console.log("Transcript received from:", socket.id);
  console.log("Meeting room:", roomCode);
  console.log("Transcript:", transcriptData.text);

  if (!roomCode) {
    console.log("No meeting room found!");
    return;
  }

  const { text } = transcriptData;

  if (typeof text !== "string" || !text.trim()) return;

  socket.to(roomCode).emit("receive-transcript", {
    text: text.trim(),
    senderSocketId: socket.id,
  });

  console.log("Transcript broadcast successfully!");
});
  // Send a chat message to participants in the same meeting.
  socket.on("send-chat-message", (messageData = {}) => {
    const roomCode = socket.data.meetingCode;

    if (!roomCode) return;

    const { message, senderName } = messageData;

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 2000
    ) {
      return;
    }

    const participants = meetingParticipants.get(roomCode);

    if (!participants) return;

    const chatMessage = {
      id: `${socket.id}-${Date.now()}`,
      senderId: socket.id,
      senderName:
        typeof senderName === "string" && senderName.trim()
          ? senderName.trim().slice(0, 50)
          : "Participant",
      message: message.trim(),
      timestamp: new Date().toISOString(),
    };

    // Send the message to everyone else in this meeting.
    socket.to(roomCode).emit("receive-chat-message", chatMessage);

    // Send it back to the sender so their chat also updates.
    socket.emit("receive-chat-message", chatMessage);
  });

  // Leave a meeting.
  socket.on("leave-meeting", async (meetingCode) => {
    const roomCode =
      typeof meetingCode === "string"
        ? meetingCode.trim().toUpperCase()
        : socket.data.meetingCode;

    if (!roomCode || socket.data.meetingCode !== roomCode) return;

    const participants = meetingParticipants.get(roomCode);

    participants?.delete(socket.id);

    await socket.leave(roomCode);

    socket.data.meetingCode = null;

    if (participants?.size === 0) {
      meetingParticipants.delete(roomCode);
    }

    sendParticipantList(roomCode);

    console.log(`Socket ${socket.id} left ${roomCode}`);
  });

  // Clean up when a participant disconnects.
  socket.on("disconnect", () => {
    const roomCode = socket.data.meetingCode;

    if (roomCode) {
      const participants = meetingParticipants.get(roomCode);

      participants?.delete(socket.id);

      if (participants?.size === 0) {
        meetingParticipants.delete(roomCode);
      } else {
        sendParticipantList(roomCode);
      }

      console.log(`Socket ${socket.id} disconnected from ${roomCode}`);
    } else {
      console.log("Socket disconnected:", socket.id);
    }
  });
  socket.on("end-meeting-for-everyone", async ({ meetingCode } = {}) => {
    const roomCode = socket.data.meetingCode;

    if (!roomCode || roomCode !== meetingCode?.trim().toUpperCase()) {
      return;
    }

    io.to(roomCode).emit("meeting-ended");
    console.log(`Meeting ended notification sent to ${roomCode}`);
  });
});

const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 4000;

    httpServer.listen(PORT, () => {
      console.log(`IntellMeet server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start IntellMeet server:", error);
    process.exit(1);
  }
};

startServer();