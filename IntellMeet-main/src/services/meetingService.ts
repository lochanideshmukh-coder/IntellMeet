import api from "../api/axios";

// Meeting data returned by the backend
export interface Meeting {
  _id: string;
  title: string;
  description: string;
  meetingCode: string;

  host:
    | string
    | {
        _id: string;
        name: string;
        email: string;
      };

  participants: string[];
  scheduledAt: string | null;

  status: "scheduled" | "live" | "completed";

  transcript?: string;
  summary?: string;
  actionItems?: string[];
  endedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

// Data required to create a meeting
export interface CreateMeetingData {
  title: string;
  description?: string;
  scheduledAt?: string | null;
}

// Create meeting API response
interface CreateMeetingResponse {
  meeting: Meeting;
}

// Get meetings API response
interface GetMeetingsResponse {
  meetings: Meeting[];
}

// Create a new meeting
export async function createMeeting(
  meetingData: CreateMeetingData
): Promise<Meeting> {
  const token = localStorage.getItem("intellmeet_token");

  const response = await api.post<CreateMeetingResponse>(
    "/meetings",
    meetingData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.meeting;
}

// Retrieve meetings
export async function getMeetings(): Promise<Meeting[]> {
  const token = localStorage.getItem("intellmeet_token");

  const response = await api.get<GetMeetingsResponse>("/meetings", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.meetings;
}

// Join a meeting
export async function joinMeeting(meetingCode: string) {
  const token = localStorage.getItem("intellmeet_token");

  const response = await api.post(
    "/meetings/join",
    { meetingCode },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
}

// Get meeting by code
export async function getMeetingByCode(
  meetingCode: string
): Promise<Meeting> {
  const token = localStorage.getItem("intellmeet_token");

  const response = await api.get<{ meeting: Meeting }>(
    `/meetings/${encodeURIComponent(meetingCode)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.meeting;
}

// End a meeting
export async function endMeeting(
  meetingCode: string,
  transcript: string
): Promise<Meeting> {
  const token = localStorage.getItem("intellmeet_token");

  const response = await api.post<{ meeting: Meeting }>(
    `/meetings/${encodeURIComponent(meetingCode)}/end`,
    { transcript },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.meeting;
}
// Delete a meeting
export async function deleteMeeting(
meetingCode: string
): Promise<{ message: string }> {
const token = localStorage.getItem("intellmeet_token");

const response = await api.delete<{ message: string }>(
`/meetings/${encodeURIComponent(meetingCode)}`,
{
headers: {
Authorization: `Bearer ${token}`,
},
}
);

return response.data;
}