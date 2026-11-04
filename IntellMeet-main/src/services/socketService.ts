import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.PROD
  ? "https://intellmeet-8jcu.onrender.com"
  : "http://localhost:4000";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export function connectSocket(): void {
  if (!socket.connected) {
    socket.connect();
  }
}

export function joinSocketMeeting(meetingCode: string): void {
  if (!socket.connected) {
    socket.connect();
  }

  socket.emit("join-meeting", meetingCode);
}

export function leaveSocketMeeting(meetingCode: string): void {
  if (socket.connected) {
    socket.emit("leave-meeting", meetingCode);
  }
}