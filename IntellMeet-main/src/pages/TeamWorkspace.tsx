import { useEffect, useState } from "react";
import api from "../api/axios";
import { useNavigate} from "react-router-dom";
import {
  Users,
  ArrowLeft,
  Plus,
  Briefcase,
  UserPlus,
  Video,
  Copy,
} from "lucide-react";
import axios from "axios";
interface Member {
  _id: string;
  name: string;
  email: string;
}

interface Meeting {
  _id: string;
  title: string;
  meetingCode: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  participants: Member[];
}

interface Workspace {
  _id: string;
  name: string;
  description: string;
  owner: Member;
  members: Member[];
}

export default function TeamWorkspace() {
  const [workspaceName, setWorkspaceName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const navigate = useNavigate();
  const [workspaceMeetings, setWorkspaceMeetings] = useState<
    Record<string, Meeting[]>
  >({});
  const [meetingTitles, setMeetingTitles] = useState<Record<string, string>>(
    {}
  );

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [addingMember, setAddingMember] = useState("");
  const [creatingMeeting, setCreatingMeeting] = useState("");
  const [memberEmails, setMemberEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const token = localStorage.getItem("intellmeet_token");

  const currentUser = JSON.parse(
    localStorage.getItem("intellmeet_user") || "{}"
  );

  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  const loadWorkspaceMeetings = async (workspaceId: string) => {
    try {
     const response = await api.get(
      `/meetings/workspace/${workspaceId}`,
      { headers: authHeaders }
    );

      setWorkspaceMeetings((previous) => ({
        ...previous,
        [workspaceId]: response.data.meetings || [],
      }));
    } catch (err) {
      console.error("Workspace meetings loading error:", err);
    }
  };

  // Refresh workspaces after creating a workspace or adding a member
  const loadWorkspaces = async () => {
    try {
     const response = await api.get(
        "/workspaces",
        { headers: authHeaders }
      );

      const fetchedWorkspaces: Workspace[] =
        response.data.workspaces || [];

      setWorkspaces(fetchedWorkspaces);

      await Promise.all(
        fetchedWorkspaces.map((workspace) =>
          loadWorkspaceMeetings(workspace._id)
        )
      );
    } catch (err) {
      console.error("Workspace loading error:", err);
      setError("Unable to load workspaces.");
    }
  };

  // Initial workspace loading
  useEffect(() => {
    const fetchData = async () => {
      try {
        setError("");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

       const response = await api.get(
          "/workspaces",
          { headers }
        );
        const fetchedWorkspaces: Workspace[] =
          response.data.workspaces || [];

        setWorkspaces(fetchedWorkspaces);

        await Promise.all(
          fetchedWorkspaces.map(async (workspace) => {
            try {
              const meetingResponse = await api.get(
                `/meetings/workspace/${workspace._id}`,
                { headers }
              );
              setWorkspaceMeetings((previous) => ({
                ...previous,
                [workspace._id]: meetingResponse.data.meetings || [],
              }));
            } catch (err) {
              console.error("Workspace meetings loading error:", err);
            }
          })
        );
      } catch (err) {
        console.error("Workspace loading error:", err);
        setError("Unable to load workspaces.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleCreateWorkspace = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!workspaceName.trim()) return;

    try {
      setCreating(true);
      setError("");
      setSuccess("");

     await api.post(
        "/workspaces",
        {
          name: workspaceName.trim(),
          description: description.trim(),
        },
        { headers: authHeaders }
      );

      setWorkspaceName("");
      setDescription("");
      setSuccess("Workspace created successfully!");

      await loadWorkspaces();
    } catch (err) {
      console.error("Workspace creation error:", err);
      setError("Unable to create workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async (
    e: React.FormEvent<HTMLFormElement>,
    workspaceId: string
  ) => {
    e.preventDefault();

    const email = memberEmails[workspaceId]?.trim();

    if (!email) return;

    try {
      setAddingMember(workspaceId);
      setError("");
      setSuccess("");

     await api.post(
  `/workspaces/${workspaceId}/members`,
  { email },
  { headers: authHeaders }
);

      setMemberEmails((previous) => ({
        ...previous,
        [workspaceId]: "",
      }));

      setSuccess("Team member added successfully!");

      await loadWorkspaces();
    } catch (err) {
      console.error("Add member error:", err);

      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Unable to add team member."
          : "Unable to add team member."
      );
    } finally {
      setAddingMember("");
    }
  };

  const handleCreateMeeting = async (
    e: React.FormEvent<HTMLFormElement>,
    workspaceId: string
  ) => {
    e.preventDefault();

    const title = meetingTitles[workspaceId]?.trim();

    if (!title) return;

    try {
      setCreatingMeeting(workspaceId);
      setError("");
      setSuccess("");

        await api.post(
        "/meetings",
        {
          title,
          workspaceId,
        },
        { headers: authHeaders }
      );
      setMeetingTitles((previous) => ({
        ...previous,
        [workspaceId]: "",
      }));

      setSuccess("Workspace meeting created successfully!");

      await loadWorkspaceMeetings(workspaceId);
    } catch (err) {
      console.error("Meeting creation error:", err);

      setError(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Unable to create meeting."
          : "Unable to create meeting."
      );
    } finally {
      setCreatingMeeting("");
    }
  };

  const copyMeetingCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setSuccess("Meeting code copied!");
    } catch {
      setError("Unable to copy meeting code.");
    }
  };

  return (
    <div className="workspace-page">
      <div className="workspace-header">
        <button
          className="button secondary-button"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>
        <h1>Team Workspace</h1>
        <p>Manage your team's shared workspaces and meetings.</p>
      </div>

      <div className="workspace-create-card">
        <Briefcase size={35} />

        <h2>Create Your Workspace</h2>
        <p>Set up a workspace for your team to collaborate.</p>

        <form onSubmit={handleCreateWorkspace}>
          <label>Workspace Name</label>
          <input
            type="text"
            placeholder="Enter workspace name"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
          />

          <label>Description</label>
          <textarea
            placeholder="Enter a short description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <button type="submit" disabled={creating}>
            <Plus size={18} />
            {creating ? "Creating..." : "Create Workspace"}
          </button>
        </form>
      </div>

      {error && <p className="workspace-error">{error}</p>}
      {success && <p className="workspace-success">{success}</p>}

      <div className="workspace-list">
        <h2>Your Workspaces</h2>

        {loading ? (
          <p>Loading workspaces...</p>
        ) : workspaces.length === 0 ? (
          <p>No workspaces created yet.</p>
        ) : (
          workspaces.map((workspace) => (
            <div className="workspace-details-card" key={workspace._id}>
                <div className="workspace-card-header">
                    <div className="workspace-icon">
                    <Users size={28} />
                    </div>

                    <h2>{workspace.name}</h2>
                    <p>{workspace.description || "No description added."}</p>
                </div>

                <div className="workspace-card-body">

  {/* LEFT COLUMN: Workspace Info and Members */}
  <div className="workspace-left-column">
    <div className="workspace-info">
      <span>Workspace Status</span>
      <strong>Active</strong>
    </div>

    <div className="workspace-info">
      <span>Team Members</span>
      <strong>{workspace.members.length}</strong>
    </div>

    <div className="workspace-info">
      <span>Created By</span>
      <strong>{workspace.owner?.name || "Unknown"}</strong>
    </div>

    <div className="workspace-members">
      <h3>Team Members</h3>

      {workspace.members.map((member) => (
        <div className="workspace-member" key={member._id}>
          <div className="workspace-member-avatar">
            {member.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{member.name}</strong>
            <p>{member.email}</p>
          </div>
        </div>
      ))}
    </div>
  </div>

  {/* MIDDLE COLUMN: Forms */}
  <div className="workspace-forms-column">
    {workspace.owner?._id === currentUser.id && (
      <>
        <form
          className="workspace-add-member"
          onSubmit={(e) => handleAddMember(e, workspace._id)}
        >
          <label>Add Team Member</label>
          <input
            type="email"
            placeholder="Enter registered user's email"
            value={memberEmails[workspace._id] || ""}
            onChange={(e) =>
              setMemberEmails((previous) => ({
                ...previous,
                [workspace._id]: e.target.value,
              }))
            }
            required
          />
          <button type="submit" disabled={addingMember === workspace._id}>
            <UserPlus size={17} />
            {addingMember === workspace._id ? "Adding..." : "Add Member"}
          </button>
        </form>

        <form
          className="workspace-add-member"
          onSubmit={(e) => handleCreateMeeting(e, workspace._id)}
        >
          <label>Create Workspace Meeting</label>
          <input
            type="text"
            placeholder="Enter meeting title"
            value={meetingTitles[workspace._id] || ""}
            onChange={(e) =>
              setMeetingTitles((previous) => ({
                ...previous,
                [workspace._id]: e.target.value,
              }))
            }
            required
          />
          <button
            type="submit"
            disabled={creatingMeeting === workspace._id}
          >
            <Video size={17} />
            {creatingMeeting === workspace._id
              ? "Creating..."
              : "Create Meeting"}
          </button>
        </form>
      </>
    )}
  </div>

  {/* RIGHT COLUMN: Workspace Meetings */}
  <div className="workspace-right-column">
    <div className="workspace-meetings">
      <h3>Workspace Meetings</h3>

      {(workspaceMeetings[workspace._id] || []).length === 0 ? (
        <p>No meetings associated with this workspace yet.</p>
      ) : (
        (workspaceMeetings[workspace._id] || []).map((meeting) => (
          <div className="workspace-meeting" key={meeting._id}>
            <div className="workspace-meeting-heading">
              <Video size={20} />
              <strong>{meeting.title}</strong>
            </div>

            <div className="workspace-info">
              <span>Meeting Code</span>
              <strong>{meeting.meetingCode}</strong>
            </div>

            <div className="workspace-info">
              <span>Status</span>
              <strong>{meeting.status}</strong>
            </div>

            <div className="workspace-info">
              <span>Participants</span>
              <strong>{meeting.participants?.length || 0}</strong>
            </div>

            <div className="workspace-info">
              <span>Date</span>
              <strong>
                {new Date(
                  meeting.scheduledAt || meeting.createdAt
                ).toLocaleDateString()}
              </strong>
            </div>

            <button
              type="button"
              className="workspace-copy-button"
              onClick={() => copyMeetingCode(meeting.meetingCode)}
            >
              <Copy size={16} />
              Copy Meeting Code
            </button>
          </div>
        ))
      )}
    </div>
  </div>

</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}