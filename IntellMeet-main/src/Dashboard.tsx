import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CheckSquare,
  Video,
  Plus,
  Search,
  Bell,
  Clock,
  ArrowUpRight,
  Mic,
  FileText,
  Sparkles,
  X,
  Link as LinkIcon,
  Copy,
  Trash2,
  LogOut,
} from "lucide-react";

import {
  createMeeting as createMeetingApi,
  getMeetings,
  joinMeeting as joinMeetingApi,
  deleteMeeting,
  type Meeting as ApiMeeting,
} from "./services/meetingService";

import "./App.css";

type Meeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  participants: number;
  color: string;
  status: "scheduled" | "live" | "completed";
  summary?: string;
  transcript?: string;
  hostId: string;
  actionItems?: string[];
  endedAt?: string | null;
};

function Dashboard() {
  const navigate = useNavigate();

  const storedUser = localStorage.getItem("intellmeet_user");

  const currentUser = storedUser
    ? JSON.parse(storedUser)
    : null;

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [modal, setModal] = useState<"create" | "join" | null>(
    null
  );

  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingId, setMeetingId] = useState("");
  const [notice, setNotice] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");

  const handleLogout = () => {
    localStorage.removeItem("intellmeet_token");
    localStorage.removeItem("intellmeet_user");

    navigate("/login", { replace: true });
  };

  // Convert a meeting received from MongoDB into the format
  // expected by the existing dashboard UI.
  const formatMeeting = (
    meeting: ApiMeeting
  ): Meeting => {
    const meetingDate = meeting.scheduledAt
      ? new Date(meeting.scheduledAt)
      : new Date(meeting.createdAt);

    const now = new Date();

    let dateLabel: string;

    if (meetingDate.toDateString() === now.toDateString()) {
      dateLabel = "Today";
    } else {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);

      if (
        meetingDate.toDateString() === tomorrow.toDateString()
      ) {
        dateLabel = "Tomorrow";
      } else {
        dateLabel = meetingDate.toLocaleDateString();
      }
    }

   return {
      id: meeting.meetingCode,
      title: meeting.title,
      date: dateLabel,
      time: meetingDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      participants: meeting.participants.length,
      color: "purple",
      status: meeting.status,
      summary: meeting.summary,
      transcript: meeting.transcript,
      actionItems: meeting.actionItems,
      endedAt: meeting.endedAt,
      hostId:
      typeof meeting.host === "string"
        ? meeting.host
        : meeting.host?._id,
    };
  };

  // Load saved meetings when the dashboard opens.
 useEffect(() => {
  let cancelled = false;

  const fetchMeetings = async () => {
    setLoadingMeetings(true);

    try {
      const data = await getMeetings();

      if (!cancelled) {
        setMeetings(data.map(formatMeeting));
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Failed to load meetings:", error);
        setNotice("Failed to load meetings. Please try again.");
      }
    } finally {
      if (!cancelled) {
        setLoadingMeetings(false);
      }
    }
  };

  void fetchMeetings();

  return () => {
    cancelled = true;
  };
}, []);

  // Create a meeting in MongoDB.
  async function handleCreateMeeting() {
    if (!meetingTitle.trim()) {
      setNotice("Please enter a meeting title.");
      return;
    }

    setCreatingMeeting(true);

    try {
      const newMeeting = await createMeetingApi({
        title: meetingTitle.trim(),
      });

      setMeetings((previous) => [
        formatMeeting(newMeeting),
        ...previous,
      ]);

      setMeetingTitle("");
      setModal(null);

      setNotice(
        `Meeting "${newMeeting.title}" created successfully! Meeting code: ${newMeeting.meetingCode}`
      );
    } catch (error: unknown) {
      console.error("Failed to create meeting:", error);

      let message = "Failed to create meeting. Please try again.";

      if (
        typeof error === "object" &&
        error !== null &&
        "response" in error
      ) {
        const response = (
          error as {
            response?: {
              data?: {
                message?: string;
              };
            };
          }
        ).response;

        if (response?.data?.message) {
          message = response.data.message;
        }
      }

      setNotice(message);
    } finally {
      setCreatingMeeting(false);
    }
  }

async function handleJoinMeeting() {
const code = meetingId.trim().toUpperCase();

if (!code) {
setNotice("Please enter a meeting code.");
return;
}

try {
const result = await joinMeetingApi(code);

setMeetingId("");
setModal(null);
setNotice(result.message || "Joining meeting...");

// Refresh the meeting list.
const data = await getMeetings();
setMeetings(data.map(formatMeeting));

// Open the meeting room.
navigate(`/meeting/${encodeURIComponent(code)}`);

} catch (error: unknown) {
// If the user already joined, they can still enter the room.
if (
axios.isAxiosError<{ message?: string }>(error) &&
error.response?.data?.message?.toLowerCase().includes("already")
) {
setMeetingId("");
setModal(null);
navigate("/meeting/${encodeURIComponent(code)}");
return;
}

let message = "Unable to join meeting. Please check the meeting code.";

if (axios.isAxiosError<{ message?: string }>(error)) {
  message = error.response?.data?.message || message;
}

setNotice(message);

}
}
  async function copyMeetingId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setNotice(`Meeting code ${id} copied.`);
    } catch {
      setNotice(`Meeting code: ${id}`);
    }
  }
  const filteredMeetings = meetings.filter((meeting) => {
  const query = searchQuery.toLowerCase().trim();

  return (
    meeting.title.toLowerCase().includes(query) ||
    meeting.id.toLowerCase().includes(query) ||
    meeting.date.toLowerCase().includes(query) ||
    meeting.status.toLowerCase().includes(query)
  );
});
async function handleDeleteMeeting(meetingCode: string) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this meeting? This action cannot be undone."
  );

  if (!confirmed) return;

  setDeletingMeeting(meetingCode);

  try {
    await deleteMeeting(meetingCode);

    setMeetings((previous) =>
      previous.filter((meeting) => meeting.id !== meetingCode)
    );

    setNotice("Meeting deleted successfully.");
  } catch (error) {
    console.error("Failed to delete meeting:", error);
    setNotice(
      axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || "Failed to delete meeting."
        : "Failed to delete meeting."
    );
  } finally {
    setDeletingMeeting(null);
  }
}
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Video size={23} />
          </div>

          <div>
            <h2>IntellMeet</h2>
            <span>SMART COLLABORATION</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          <button
            className={`nav-item ${
              activePage === "Dashboard" ? "active" : ""
            }`}
            onClick={() => setActivePage("Dashboard")}
          >
            <LayoutDashboard size={19} />
            <span>Dashboard</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "Meetings" ? "active" : ""
            }`}
            onClick={() => setActivePage("Meetings")}
          >
            <CalendarDays size={19} />
            <span>Meetings</span>
          </button>

          <button
            className={`nav-item ${
              activePage === "Team Workspace" ? "active" : ""
            }`}
            onClick={() => navigate("/workspace")}
          >
            <Users size={19} />
            <span>Team Workspace</span>
          </button>
        </nav>

        <div className="sidebar-bottom">

          <button
            onClick={handleLogout}
            className="logout-button"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>

          <div className="profile">
            <div className="avatar">
              {currentUser?.name
                ? currentUser.name.charAt(0).toUpperCase()
                : "U"}
            </div>

            <div className="profile-info">
              <strong>{currentUser?.name || "User"}</strong>
              <span>{currentUser?.role || "Member"}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activePage}
          </div>

          <div className="topbar-right">
            <div className="search-box">
            <Search size={17} />
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="shortcut">/</span>
          </div>

            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() =>
                setNotice("You have no new notifications.")
              }
            >
              <Bell size={20} />
              <span className="notification-dot"></span>
            </button>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className="notice">
              <span>{notice}</span>

              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                <X size={17} />
              </button>
            </div>
          )}

          <section className="welcome-section">
            <div>
              <div className="date-label">
                <Sparkles size={15} />
                YOUR COLLABORATION HUB
              </div>

              <h1>
                Good morning, {currentUser?.name || "User"}!{" "}
                <span>👋</span>
              </h1>

              <p>
                Bring your team together. Turn conversations into
                meaningful action.
              </p>
            </div>

            <div className="welcome-actions">
              <button
                className="button secondary-button"
                onClick={() => setModal("join")}
              >
                <LinkIcon size={17} />
                Join Meeting
              </button>

              <button
                className="button primary-button"
                onClick={() => setModal("create")}
              >
                <Plus size={18} />
                Create Meeting
              </button>
            </div>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <span>Total Meetings</span>
                <CalendarDays size={19} />
              </div>

              <h2>{meetings.length}</h2>

              <p>Saved meetings</p>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel activity-panel">
              <div className="panel-header">
                <div>
                  <h2>AI Meeting Assistant</h2>
                  <p>Your intelligent productivity partner</p>
                </div>

                <div className="ai-icon">
                  <Sparkles size={20} />
                </div>
              </div>

              <div className="ai-banner">
                <div className="ai-banner-icon">
                  <FileText size={23} />
                </div>

                <h3>Make every meeting count</h3>

                <p>
                  Turn conversations into searchable notes, clear
                  summaries, and actionable tasks.
                </p>
              </div>

              <div className="ai-feature">
                <div className="feature-icon">
                  <Mic size={18} />
                </div>

                <div>
                  <strong>Smart Transcription</strong>
                  <p>Capture meeting conversations</p>
                </div>
              </div>

              <div className="ai-feature">
                <div className="feature-icon">
                  <Sparkles size={18} />
                </div>

                <div>
                  <strong>AI Summaries</strong>
                  <p>Get the important points instantly</p>
                </div>
              </div>

              <div className="ai-feature">
                <div className="feature-icon">
                  <CheckSquare size={18} />
                </div>

                <div>
                  <strong>Action Items</strong>
                  <p>Turn decisions into tasks</p>
                </div>
              </div>
            </div>
            <div className="panel meetings-panel">
              <div className="panel-header">
                <div>
                  <h2>
                    {activePage === "Meetings"
                      ? "All Meetings"
                      : activePage === "Dashboard"
                        ? "Upcoming Meetings"
                        : activePage}
                  </h2>

                  <p>
                    {activePage === "Meetings"
                      ? "Your saved meetings"
                      : "Stay on top of your team's schedule"}
                  </p>
                </div>

                <button
                  className="text-button"
                  onClick={() => setActivePage("Meetings")}
                >
                  View all <ArrowUpRight size={16} />
                </button>
              </div>

              <div className="meeting-list">
                {loadingMeetings ? (
                  <p className="empty-state">
                    Loading your meetings...
                  </p>
                ) : meetings.length === 0 ? (
                  <p className="empty-state">
                    No meetings yet. Create your first meeting!
                  </p>
                ) : 
                  filteredMeetings.length === 0 ? (
                    <p className="empty-state">
                      No meetings match your search.
                    </p>
                  ) : 
                    filteredMeetings.map((meeting) => ( (
                    <div
                      className="meeting-row"
                      key={meeting.id}
                    >
                      <div
                        className={`meeting-icon ${meeting.color}`}
                      >
                        <Video size={21} />
                      </div>

                      <div className="meeting-info">
                        <h3>{meeting.title}</h3>

                        <p>
                          <Clock size={14} />
                          {meeting.date} · {meeting.time}
                        </p>
                      </div>

                      <div className="participant-count">
                        <Users size={16} />
                        {meeting.participants}
                      </div>

                      <button
                        className="join-small-button"
                        onClick={() => {
                          setMeetingId(meeting.id);
                          setModal("join");
                        }}
                      >
                        Join
                      </button>
                      {meeting.status === "completed" && meeting.summary && (
                        <button
                          className="text-button"
                          onClick={() => setSelectedMeeting(meeting)}
                        >
                          <Sparkles size={15} />
                          View Summary
                        </button>
                      )}
                      <button
                        className="copy-button"
                        title="Copy meeting code"
                        aria-label="Copy meeting code"
                        onClick={() =>
                          copyMeetingId(meeting.id)
                        }
                      >
                        <Copy size={15} />
                      </button>
                      {meeting.hostId === currentUser?.id && (
                      <button
                        className="copy-button delete-meeting-button"
                        title="Delete meeting"
                        aria-label="Delete meeting"
                        disabled={deletingMeeting === meeting.id}
                        onClick={() => void handleDeleteMeeting(meeting.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      {modal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal(null);
              setNotice("");
            }
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="modal-title">
                  {modal === "create"
                    ? "Create a Meeting"
                    : "Join a Meeting"}
                </h2>

                <p>
                  {modal === "create"
                    ? "Set up a new team meeting."
                    : "Enter the meeting code to continue."}
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() => {
                  setModal(null);
                  setNotice("");
                }}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            {modal === "create" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateMeeting();
                }}
              >
                <label htmlFor="meeting-title">
                  Meeting title
                </label>

                <input
                  id="meeting-title"
                  value={meetingTitle}
                  onChange={(event) =>
                    setMeetingTitle(event.target.value)
                  }
                  placeholder="e.g. Product Team Meeting"
                  autoFocus
                />

                <button
                  type="submit"
                  className="button primary-button modal-submit"
                  disabled={creatingMeeting}
                >
                  <Plus size={17} />
                  {creatingMeeting
                    ? "Creating..."
                    : "Create Meeting"}
                </button>
              </form>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleJoinMeeting();
                }}
              >
                <label htmlFor="meeting-id">Meeting code</label>

                <input
                  id="meeting-id"
                  value={meetingId}
                  onChange={(event) =>
                    setMeetingId(event.target.value)
                  }
                  placeholder="Enter meeting code"
                  autoFocus
                />

                <button
                  type="submit"
                  className="button primary-button modal-submit"
                >
                  <Video size={17} />
                  Continue to Meeting
                </button>
              </form>
            )}
          </div>
        </div>
      )}
      {selectedMeeting && (
      <div
        className="modal-overlay summary-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedMeeting(null);
          }
        }}
      >
        <div className="modal-card summary-modal">
          <div className="modal-header">
            <div>
              <div className="date-label">
                <Sparkles size={15} />
                AI-POWERED MEETING NOTES
              </div>

              <h2>{selectedMeeting.title}</h2>
              <p>Meeting Summary & Insights</p>
            </div>

            <button
              className="icon-button"
              onClick={() => setSelectedMeeting(null)}
              aria-label="Close summary"
            >
              <X size={20} />
            </button>
          </div>

          <div className="summary-content">
            <section className="summary-section">
              <h3>
                <FileText size={19} />
                Meeting Summary
              </h3>

              <ReactMarkdown>
                {selectedMeeting.summary || "No summary available."}
              </ReactMarkdown>
            </section>
          </div>

          <div className="summary-footer">
            <button
              className="button primary-button"
              onClick={() => setSelectedMeeting(null)}
            >
              Close Summary
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

export default Dashboard;