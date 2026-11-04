import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  MonitorUp,
  MonitorOff,
  MessageCircle,
  Send,
  FileText,
} from "lucide-react";

import { getMeetingByCode, endMeeting, type Meeting } from "../services/meetingService";
import {
  socket,
  connectSocket,
  leaveSocketMeeting,
} from "../services/socketService";

import "./../App.css";

type ParticipantList = string[];
type SpeechRecognitionResult = {
  isFinal: boolean;
  [index: number]: {
    transcript: string;
  };
};

type SpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResult;
  };
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
};

function MeetingRoom() {
  const { meetingCode } = useParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [endMeetingError, setEndMeetingError] = useState("");
  useEffect(() => {
  let cancelled = false;

  async function loadMeeting() {
    if (!meetingCode) {
      setEndMeetingError("Meeting code is missing.");
      return;
    }

    try {
      const meetingDetails = await getMeetingByCode(meetingCode);

      if (!cancelled) {
        setMeeting(meetingDetails);
        setEndMeetingError("");
      }
    } catch (error) {
      console.error("Failed to load meeting details:", error);

      if (!cancelled) {
        setEndMeetingError("Unable to load meeting details.");
      }
    }
  }

  void loadMeeting();

  return () => {
    cancelled = true;
  };
}, [meetingCode]);
const storedUser = localStorage.getItem("intellmeet_user");

const currentUser = storedUser
  ? JSON.parse(storedUser)
  : null;

const currentUserId = currentUser?._id ?? currentUser?.id;

const hostId =
  typeof meeting?.host === "string"
    ? meeting.host
    : meeting?.host?._id;

const isMeetingHost =
  Boolean(currentUserId && hostId) &&
  String(currentUserId) === String(hostId);
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const blackStreamRef = useRef<MediaStream | null>(null);
  const blackTrackRef = useRef<MediaStreamTrack | null>(null);

  const joinedRef = useRef(false);
  const otherParticipantsRef = useRef<string[]>([]);
  const remoteSocketIdRef = useRef("");
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const startOfferRef = useRef<((socketId: string) => void) | null>(null);

  const [meetingTitle, setMeetingTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isMicOn, setIsMicOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [remoteReady, setRemoteReady] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState("");
  const [showTranscript, setShowTranscript] = useState(true);

  const roomCode = meetingCode?.toUpperCase();
  // Keep track of the browser speech recognition instance.
  const speechRecognitionRef =
    useRef<SpeechRecognitionInstance | null>(null);
  const shouldContinueTranscriptionRef = useRef(false);
  

  // Start meeting transcription.
  function startTranscription() {
    shouldContinueTranscriptionRef.current = true;
    transcriptRef.current = "";
    setTranscript("");
    const browserWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognitionAPI =
      browserWindow.SpeechRecognition ||
      browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setTranscriptionError(
        "Speech recognition is not supported in this browser. Try the latest Chrome or Edge."
      );
      return;
    }

    if (speechRecognitionRef.current) {
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const text = result[0].transcript;

          if (result.isFinal) {
            finalText += text + " ";
          } else {
            interimText += text;
          }
        }

        if (finalText) {
          transcriptRef.current += finalText;
          setTranscript(transcriptRef.current);

          // Send recognized text to the host and other participants.
          socket.emit("send-transcript", { text: finalText });
        }

        if (interimText) {
          setTranscriptionError("");
        }
      };
      recognition.onerror = (event) => {
      const speechEvent = event as Event & { error?: string };
      const errorMessage = speechEvent.error || "unknown";

      console.error("Speech recognition error:", errorMessage);

      shouldContinueTranscriptionRef.current = false;
      speechRecognitionRef.current = null;
      setIsTranscribing(false);

      setTranscriptionError(
        `Transcription error: ${errorMessage}. Check microphone permission and try again.`
      );
    };

      recognition.onend = () => {
      if (shouldContinueTranscriptionRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.error("Unable to restart transcription:", error);
          }
        }, 300);
      } else {
        speechRecognitionRef.current = null;
        setIsTranscribing(false);
      }
    };
      speechRecognitionRef.current = recognition;
      setTranscriptionError("");
      setIsTranscribing(true);

      recognition.start();
    } catch (error) {
      speechRecognitionRef.current = null;
      setIsTranscribing(false);

      setTranscriptionError(
        error instanceof Error
          ? error.message
          : "Unable to start transcription."
      );
    }
  }

// Stop meeting transcription.
function stopTranscription(): Promise<void> {
  return new Promise((resolve) => {
    const recognition = speechRecognitionRef.current;
    shouldContinueTranscriptionRef.current = false;

    if (!recognition) {
      setIsTranscribing(false);
      resolve();
      return;
    }

    recognition.onend = () => {
      speechRecognitionRef.current = null;
      setIsTranscribing(false);
      resolve();
    };

    try {
      recognition.stop();
    } catch (error) {
      console.error("Error stopping transcription:", error);
      speechRecognitionRef.current = null;
      setIsTranscribing(false);
      resolve();
    }
  });
}

// Stop speech recognition when leaving the meeting page.
useEffect(() => {
  return () => {
    speechRecognitionRef.current?.abort();
    speechRecognitionRef.current = null;
  };
}, []);
// Receive live transcripts from other participants.
useEffect(() => {
  function handleReceiveTranscript(data: { text: string }) {
  const receivedText = data.text?.trim();

  if (!receivedText) return;

  transcriptRef.current += receivedText + " ";
  setTranscript(transcriptRef.current);
}
  socket.on("receive-transcript", handleReceiveTranscript);

  return () => {
    socket.off("receive-transcript", handleReceiveTranscript);
  };
}, []);
  // Receive live chat messages.
useEffect(() => {
  function handleChatMessage(message: ChatMessage) {
    setChatMessages((previous) => {
      // Avoid displaying the same message twice.
      if (previous.some((item) => item.id === message.id)) {
        return previous;
      }

      return [...previous, message];
    });
  }

  socket.on("receive-chat-message", handleChatMessage);

  return () => {
    socket.off("receive-chat-message", handleChatMessage);
  };
}, []);

// Send a message to the current meeting.
function sendChatMessage() {
  const message = chatInput.trim();

  if (!message || !roomCode || !socket.connected) {
    return;
  }

  const storedUser = localStorage.getItem("intellmeet_user");
  let senderName = "Participant";

  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      senderName = user.name || user.username || "Participant";
    } catch {
      senderName = "Participant";
    }
  }

  socket.emit("send-chat-message", {
    message,
    senderName,
  });

  setChatInput("");
}
  // 1. Load meeting details.
  useEffect(() => {
    let cancelled = false;

    async function loadMeeting() {
      if (!meetingCode) {
        setError("Meeting code is missing.");
        setLoading(false);
        return;
      }

      try {
        const meeting = await getMeetingByCode(meetingCode);
        if (!cancelled) {
          setMeetingTitle(meeting.title);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to load this meeting. Check the meeting code and your access."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMeeting();
    return () => {
      cancelled = true;
    };
  }, [meetingCode]);

  // 2. Start local camera and microphone.
  useEffect(() => {
    let cancelled = false;
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        currentStream = stream;
        streamRef.current = stream;

        if (videoRef.current) videoRef.current.srcObject = stream;

        setMediaReady(true);
        setNotice("Camera and microphone connected.");
      } catch (err) {
        console.error("Camera or microphone access failed:", err);
        if (!cancelled) {
          setNotice(
            "Camera unavailable. You can still join; a black video tile will be sent."
          );
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      currentStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === currentStream) streamRef.current = null;
    };
  }, []);

  // Attach local stream to the local video element.
  useEffect(() => {
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mediaReady]);

  // 3. Apply microphone and camera settings.
  useEffect(() => {
    const stream = streamRef.current;
    if (!stream) return;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = isMicOn;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOn;
    });
  }, [isMicOn, isCameraOn, mediaReady]);

  // 4. Maintain the Socket.IO room connection.
  useEffect(() => {
    if (!roomCode) return;

    let disposed = false;

    function handleParticipantList(socketIds: ParticipantList) {
      if (disposed) return;

      const otherIds = socketIds.filter((id) => id !== socket.id);
      otherParticipantsRef.current = otherIds;
      setParticipants(otherIds);

      console.log("My socket ID:", socket.id);
      console.log("Participants in room:", socketIds);

      if (otherIds.length === 0) {
        console.log("Waiting for another participant...");
        return;
      }

      otherIds.forEach((id) => startOfferRef.current?.(id));
    }

    function joinWhenConnected() {
      if (disposed || joinedRef.current) return;
      joinedRef.current = true;
      socket.emit("join-meeting", roomCode);
      console.log("Joined meeting room:", roomCode);
    }

    socket.on("participant-list", handleParticipantList);
    socket.on("connect", joinWhenConnected);
    connectSocket();

    if (socket.connected) joinWhenConnected();

    return () => {
      disposed = true;
      socket.off("connect", joinWhenConnected);
      socket.off("participant-list", handleParticipantList);

      if (joinedRef.current) {
        leaveSocketMeeting(roomCode);
        joinedRef.current = false;
      }

      socket.disconnect();
      otherParticipantsRef.current = [];
      startOfferRef.current = null;
    };
  }, [roomCode]);
  useEffect(() => {
  function handleMeetingEnded() {
    console.log("Meeting ended by the host. Returning to Dashboard.");

    navigate("/dashboard", { replace: true });
  }

  socket.on("meeting-ended", handleMeetingEnded);

  return () => {
    socket.off("meeting-ended", handleMeetingEnded);
  };
}, [navigate]);

  // 5. WebRTC connection and signaling.
  useEffect(() => {
    if (!roomCode) return;

    let disposed = false;
    const remoteStream = remoteStreamRef.current;

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    peerRef.current = peer;
    pendingCandidatesRef.current = [];

    const videoTransceiver = peer.addTransceiver("video", {
      direction: "sendrecv",
    });
    const audioTransceiver = peer.addTransceiver("audio", {
      direction: "sendrecv",
    });

    // Create a synthetic black video track if the camera is busy/unavailable.
    function createBlackVideoTrack(): MediaStreamTrack {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;

      const context = canvas.getContext("2d");
      if (context) {
        context.fillStyle = "#000000";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      const blackStream = canvas.captureStream(15);
      const track = blackStream.getVideoTracks()[0];

      blackStreamRef.current = blackStream;
      blackTrackRef.current = track;

      if (!track) {
        throw new Error("Could not create the fallback video track.");
      }

      return track;
    }

    async function addLocalTracks() {
      const stream = streamRef.current;
      const realVideoTrack = stream?.getVideoTracks()[0];
      const realAudioTrack = stream?.getAudioTracks()[0];

      try {
        // Always provide a video sender: real camera if available, otherwise black.
        const videoTrack = realVideoTrack ?? blackTrackRef.current ?? createBlackVideoTrack();
        await videoTransceiver.sender.replaceTrack(videoTrack);
        console.log(
          realVideoTrack
            ? "Real local video track attached."
            : "Black video fallback track attached."
        );

        if (realAudioTrack) {
          await audioTransceiver.sender.replaceTrack(realAudioTrack);
          console.log("Local audio track attached.");
        } else {
          await audioTransceiver.sender.replaceTrack(null);
          console.log("No local audio track available.");
        }
      } catch (err) {
        console.error("Could not attach local media tracks:", err);
        throw err;
      }
    }

    async function flushPendingCandidates() {
      if (!peer.remoteDescription) return;

      const candidates = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];

      for (const candidate of candidates) {
        try {
          await peer.addIceCandidate(candidate);
        } catch (err) {
          console.error("Could not add ICE candidate:", err);
        }
      }
    }

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;

      const targetSocketId = remoteSocketIdRef.current;
      if (!targetSocketId || !socket.connected) {
        console.log("ICE candidate waiting for a participant.");
        return;
      }

      socket.emit("webrtc-ice-candidate", {
        targetSocketId,
        candidate: event.candidate.toJSON(),
      });
    };

    peer.ontrack = (event: RTCTrackEvent) => {
      console.log("Remote track received:", event.track.kind);

      const incomingStream = event.streams[0];
      const tracksToAdd = incomingStream
        ? incomingStream.getTracks()
        : [event.track];

      tracksToAdd.forEach((track) => {
        const exists = remoteStream
          .getTracks()
          .some((existingTrack) => existingTrack.id === track.id);
        if (!exists) remoteStream.addTrack(track);
      });

      setRemoteReady(true);

      const attachRemoteVideo = () => {
        const video = remoteVideoRef.current;
        if (!video) {
          console.log("Remote video element is not ready yet.");
          return;
        }

        if (video.srcObject !== remoteStream) video.srcObject = remoteStream;
        void video.play().catch((err) => {
          console.log("Remote video playback will retry:", err);
        });
      };

      attachRemoteVideo();

      event.track.onunmute = () => {
        console.log("Remote track unmuted:", event.track.kind);
        attachRemoteVideo();
      };
      event.track.onended = () => {
        console.log("Remote track ended:", event.track.kind);
      };
    };

    peer.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", peer.connectionState);
      if (disposed) return;

      if (peer.connectionState === "connected") {
        setNotice("Connected to the other participant.");
      } else if (peer.connectionState === "failed") {
        setNotice("Video connection failed. Check network connectivity.");
      } else if (peer.connectionState === "disconnected") {
        setNotice("The video connection was interrupted.");
      }
    };

    async function createOffer(targetSocketId: string) {
      console.log("createOffer called for:", targetSocketId);

      if (disposed || !socket.connected || !socket.id) {
        console.log("Cannot create offer: socket unavailable.");
        return;
      }

      // Only one browser initiates the offer.
      if (socket.id >= targetSocketId) {
        console.log("This browser is not the selected offerer.");
        return;
      }

      if (remoteSocketIdRef.current === targetSocketId) {
        console.log("Already handling this participant.");
        return;
      }

      if (peer.signalingState !== "stable") {
        console.log("Cannot create offer. Signaling state:", peer.signalingState);
        return;
      }

      remoteSocketIdRef.current = targetSocketId;

      try {
        await addLocalTracks();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);

        if (disposed) return;

        console.log("Sending offer to:", targetSocketId);
        socket.emit("webrtc-offer", {
          targetSocketId,
          offer: peer.localDescription,
        });
      } catch (err) {
        console.error("Could not create WebRTC offer:", err);
        setNotice("Could not start the video connection.");
      }
    }

    startOfferRef.current = (socketId: string) => {
      void createOffer(socketId);
    };

    async function handleOffer(data: {
      senderSocketId: string;
      offer: RTCSessionDescriptionInit;
    }) {
      console.log("Received WebRTC offer from:", data.senderSocketId);
      if (disposed) return;

      try {
        remoteSocketIdRef.current = data.senderSocketId;
        await addLocalTracks();
        await peer.setRemoteDescription(data.offer);
        await flushPendingCandidates();

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        if (disposed) return;

        socket.emit("webrtc-answer", {
          targetSocketId: data.senderSocketId,
          answer: peer.localDescription,
        });
        console.log("WebRTC answer sent to:", data.senderSocketId);
      } catch (err) {
        console.error("Could not handle WebRTC offer:", err);
      }
    }

    async function handleAnswer(data: {
      senderSocketId: string;
      answer: RTCSessionDescriptionInit;
    }) {
      console.log("Received WebRTC answer from:", data.senderSocketId);
      if (disposed) return;

      try {
        remoteSocketIdRef.current = data.senderSocketId;

        if (peer.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(data.answer);
          await flushPendingCandidates();
          console.log("WebRTC answer received successfully.");
        } else {
          console.log(
            "Answer ignored because signaling state is:",
            peer.signalingState
          );
        }
      } catch (err) {
        console.error("Could not handle WebRTC answer:", err);
      }
    }

    async function handleIceCandidate(data: {
      senderSocketId: string;
      candidate: RTCIceCandidateInit;
    }) {
      if (disposed) return;

      try {
        if (data.senderSocketId !== remoteSocketIdRef.current) {
          console.log("ICE candidate from an unexpected participant.");
          return;
        }

        if (peer.remoteDescription) {
          await peer.addIceCandidate(data.candidate);
        } else {
          pendingCandidatesRef.current.push(data.candidate);
        }
      } catch (err) {
        console.error("Could not handle ICE candidate:", err);
      }
    }

    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("webrtc-ice-candidate", handleIceCandidate);
    console.log("WebRTC signaling listeners registered.");

    otherParticipantsRef.current.forEach((id) => {
      void createOffer(id);
    });

    return () => {
      disposed = true;

      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("webrtc-ice-candidate", handleIceCandidate);

      if (startOfferRef.current) startOfferRef.current = null;

      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.close();

      if (peerRef.current === peer) peerRef.current = null;

      remoteSocketIdRef.current = "";
      pendingCandidatesRef.current = [];

      remoteStream.getTracks().forEach((track) => remoteStream.removeTrack(track));
      setRemoteReady(false);

      blackStreamRef.current?.getTracks().forEach((track) => track.stop());
      blackStreamRef.current = null;
      blackTrackRef.current = null;
    };
  }, [roomCode]);

  // Attach the remote stream when the video element becomes available.
  useEffect(() => {
    if (loading || error || !remoteReady || !remoteVideoRef.current) return;

    const video = remoteVideoRef.current;
    video.srcObject = remoteStreamRef.current;

    void video.play().catch((err) => {
      console.log("Remote video playback will retry:", err);
    });
  }, [loading, error, remoteReady]);

  // 5.1 Attach real local media if it becomes available after WebRTC initializes.
  useEffect(() => {
    const peer = peerRef.current;
    const stream = streamRef.current;
    if (!mediaReady || !peer || !stream) return;

    async function attachAvailableTracks() {
      for (const track of stream!.getTracks()) {
        const transceiver = peer!
          .getTransceivers()
          .find((item) => item.receiver.track.kind === track.kind);

        if (!transceiver) continue;

        try {
          await transceiver.sender.replaceTrack(track);
          console.log("Local track attached after initialization:", track.kind);
        } catch (err) {
          console.error("Could not attach local track:", err);
        }
      }
    }

    void attachAvailableTracks();
  }, [mediaReady, roomCode]);
   // Screen sharing
  async function toggleScreenSharing() {
      const peer = peerRef.current;

      if (!peer) {
        setNotice("The meeting connection is not ready yet.");
        return;
      }

      const videoTransceiver = peer
        .getTransceivers()
        .find((transceiver) => transceiver.receiver.track.kind === "video");

      if (!videoTransceiver) {
        setNotice("Video connection is not available.");
        return;
      }

      if (isScreenSharing) {
        const cameraTrack = streamRef.current?.getVideoTracks()[0];

        try {
          await videoTransceiver.sender.replaceTrack(
            cameraTrack ?? blackTrackRef.current ?? null
          );

          setIsScreenSharing(false);
          setNotice("Screen sharing stopped.");
        } catch (err) {
          console.error("Could not restore camera video:", err);
          setNotice("Could not restore the camera video.");
        }

        return;
      }

      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];

        if (!screenTrack) {
          screenStream.getTracks().forEach((track) => track.stop());
          setNotice("No screen video was selected.");
          return;
        }

        await videoTransceiver.sender.replaceTrack(screenTrack);

        setIsScreenSharing(true);
        setNotice("You are sharing your screen.");

        screenTrack.onended = () => {
          const currentPeer = peerRef.current;
          const currentCameraTrack = streamRef.current?.getVideoTracks()[0];

          const currentVideoTransceiver = currentPeer
            ?.getTransceivers()
            .find(
              (transceiver) => transceiver.receiver.track.kind === "video"
            );

          if (currentVideoTransceiver) {
            void currentVideoTransceiver.sender
              .replaceTrack(currentCameraTrack ?? blackTrackRef.current ?? null)
              .catch((err) => {
                console.error("Could not restore camera video:", err);
              });
          }

          screenStream.getTracks().forEach((track) => {
            track.onended = null;
            track.stop();
          });

          setIsScreenSharing(false);
          setNotice("Screen sharing stopped.");
        };
      } catch (err) {
        console.error("Screen sharing could not start:", err);
        setNotice("Screen sharing was cancelled or permission was denied.");
      }
    }
  // 6. Copy the meeting code.
  async function copyMeetingCode() {

        if (!meetingCode) return;

        try {
          await navigator.clipboard.writeText(meetingCode);
          setNotice("Meeting code copied successfully!");
        } catch {
          setNotice(`Meeting code: ${meetingCode}`);
        }
      }

  // 7. Leave the meeting.
  function leaveMeeting() {
  if (roomCode && joinedRef.current) {
    leaveSocketMeeting(roomCode);
    joinedRef.current = false;
  }
  
  // Stop the local camera and microphone.
  streamRef.current?.getTracks().forEach((track) => track.stop());
  streamRef.current = null;

  blackStreamRef.current?.getTracks().forEach((track) => track.stop());
  blackStreamRef.current = null;
  blackTrackRef.current = null;

  // Disconnect this participant only.
  socket.disconnect();

  // Return to the dashboard.
  navigate("/dashboard");
}
async function handleEndMeeting() {
  if (!isMeetingHost || !roomCode || isEndingMeeting) {
    return;
  }

  const confirmed = window.confirm(
    "Are you sure you want to end this meeting for everyone? The AI summary will be generated and saved."
  );

  if (!confirmed) return;

  setIsEndingMeeting(true);
  setEndMeetingError("");

  try {
    // Stop transcription and collect the final transcript.
    await stopTranscription();

    const finalTranscript = transcriptRef.current.trim();

    if (!finalTranscript) {
      setEndMeetingError(
        "No transcript is available. Start transcription and speak before ending the meeting."
      );
      return;
    }

    // Save the completed meeting and generate its AI summary.
    const completedMeeting = await endMeeting(roomCode, finalTranscript);

    setMeeting(completedMeeting);

    // Notify everyone that the meeting has ended.
    socket.emit("end-meeting-for-everyone", {
      meetingCode: roomCode,
    });

    // Return the host to the Dashboard.
    leaveMeeting();
    navigate("/dashboard", { replace: true });

  } catch (error) {
    console.error("Failed to end meeting:", error);

    setEndMeetingError(
      "Unable to end the meeting. Please try again."
    );
  } finally {
    setIsEndingMeeting(false);
  }
}


  return (
    <div className="meeting-room">
      <header className="meeting-room-header">
        <button
          className="button secondary-button"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>

        <div className="meeting-room-info">
          <h2>{meetingTitle || "IntellMeet Meeting"}</h2>
          <button
            className="button secondary-button"
            onClick={() => void copyMeetingCode()}
            disabled={!meetingCode}
          >
            {meetingCode || "No meeting code"}
            <Copy size={16} />
          </button>
        </div>

        <div className="meeting-participant-indicator">
          <Users size={18} />
          <span>{participants.length + 1} participant(s)</span>
        </div>
      </header>

      <main className="meeting-room-content">
        {loading ? (
          <div className="meeting-video-placeholder">
            <Video size={54} />
            <h2>Loading meeting...</h2>
            <p>Connecting to your meeting details.</p>
          </div>
        ) : error ? (
          <div className="meeting-video-placeholder">
            <VideoOff size={54} />
            <h2>Unable to open meeting</h2>
            <p>{error}</p>
            <button
              className="button secondary-button"
              onClick={() => navigate("/dashboard")}
            >
              Return to Dashboard
            </button>
          </div>
        ) : (
          <div className="meeting-video-grid">
            <div className="meeting-video-preview">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={
                  isCameraOn ? "local-video" : "local-video hidden-video"
                }
              />

              {!mediaReady && (
                <div className="camera-off-message">
                  <VideoOff size={40} />
                  <p>Camera unavailable</p>
                </div>
              )}

              {mediaReady && !isCameraOn && (
                <div className="camera-off-message">
                  <VideoOff size={40} />
                  <p>Your camera is off</p>
                </div>
              )}

              <span className="video-label">You</span>
            </div>

            <div className="meeting-video-preview">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="local-video"
              />

              {!remoteReady && (
                <div className="camera-off-message">
                  <Users size={40} />
                  <p>Waiting for the other participant...</p>
                </div>
              )}

              <span className="video-label">Other participant</span>
            </div>
          </div>
        )}
      </main>

      {notice && (
        <div className="meeting-room-notice">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}
      {isChatOpen && (
        <section className="meeting-chat-panel">
          <div className="meeting-chat-header">
            <h3>Meeting Chat</h3>

            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="meeting-chat-messages">
            {chatMessages.length === 0 ? (
              <p className="meeting-chat-empty">
                No messages yet. Start the conversation!
              </p>
            ) : (
              chatMessages.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.senderId === socket.id
                      ? "meeting-chat-message own-message"
                      : "meeting-chat-message"
                  }
                >
                  <div className="meeting-chat-sender">
                    {item.senderId === socket.id ? "You" : item.senderName}
                  </div>

                  <div className="meeting-chat-bubble">
                    {item.message}
                  </div>

                  <small>
                    {new Date(item.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                </div>
              ))
            )}
          </div>

          <form
            className="meeting-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendChatMessage();
            }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type a message..."
              maxLength={2000}
              aria-label="Chat message"
            />

            <button
              type="submit"
              disabled={!chatInput.trim()}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
      {showTranscript && (
        <section className="meeting-transcription-panel">
          <div className="meeting-transcription-header">
            <h3>
              <FileText size={18} />
              Meeting Transcript
            </h3>

            <button
              type="button"
              className="Meeting-transcription-close"
              onClick={()=> setShowTranscript(false)}
              aria-label="Close transcript panel"
              >
               × 
              </button>
          </div>

          <div className="meeting-transcription-content">
            <p>{transcript}</p>
          </div>
        </section>
      )}

      {transcriptionError && (
        <div className="meeting-room-notice">
          <span>{transcriptionError}</span>
          <button
            onClick={() => setTranscriptionError("")}
            aria-label="Dismiss transcription error"
          >
            ×
          </button>
        </div>
      )}

      <footer className="meeting-controls">
        <button
          className="meeting-control-button"
          onClick={() => setIsMicOn((current) => !current)}
          aria-label={isMicOn ? "Mute microphone" : "Unmute microphone"}
          disabled={!mediaReady || Boolean(error)}
        >
          {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
          <span>{isMicOn ? "Mute" : "Unmute"}</span>
        </button>

        <button
          className="meeting-control-button"
          onClick={() => setIsCameraOn((current) => !current)}
          aria-label={isCameraOn ? "Turn camera off" : "Turn camera on"}
          disabled={!mediaReady || Boolean(error)}
        >
          {isCameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          <span>{isCameraOn ? "Camera on" : "Camera off"}</span>
        </button>
        <button
          className="meeting-control-button"
          onClick={() => void toggleScreenSharing()}
          aria-label={isScreenSharing ? "Stop screen sharing" : "Share screen"}
          disabled={Boolean(error) || loading}
        >
          {isScreenSharing ? (
            <MonitorOff size={22} />
          ) : (
            <MonitorUp size={22} />
          )}
          <span>{isScreenSharing ? "Stop sharing" : "Share screen"}</span>
        </button>
        <button
          className="meeting-control-button"
          onClick={() => setIsChatOpen((previous) => !previous)}
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
        >
          <MessageCircle size={22} />
          <span>{isChatOpen ? "Close Chat" : "Chat"}</span>
        </button>
        <button
          className="meeting-control-button"
          onClick={isTranscribing ? stopTranscription : startTranscription}
          disabled={Boolean(error) || loading}
        >
          <FileText size={22} />
          <span>
            {isTranscribing ? "Stop Transcription" : "Start Transcription"}
          </span>
        </button>
        <button
          type="button"
          className="meeting-control-button"
          onClick={() => setShowTranscript((previous) => !previous)}
        >
          <FileText size={18} />
          {"View Transcript"}
        </button>
        {isMeetingHost && (
          <button
            className="meeting-control-button leave-meeting-button"
            onClick={handleEndMeeting}
            disabled={isEndingMeeting}
          >
            <PhoneOff size={22} />
            <span>
              {isEndingMeeting ? "Ending..." : "End Meeting"}
            </span>
          </button>
        )}
        {endMeetingError && (
            <p className="error-message">
              {endMeetingError}
            </p>
          )}
        <button
          className="meeting-control-button"
          onClick={leaveMeeting}
        >
          <PhoneOff size={22} />
          <span>Leave</span>
        </button>
      </footer>
    </div>
  );
}

export default MeetingRoom;
