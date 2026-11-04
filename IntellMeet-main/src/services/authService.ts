import api from "../api/axios";

export interface AuthUser {
id: string;
name: string;
email: string;
role: "user" | "admin";
}

export interface AuthResponse {
message: string;
token: string;
user: AuthUser;
}

export interface RegisterData {
name: string;
email: string;
password: string;
}

export interface LoginData {
email: string;
password: string;
}

export async function registerUser(
userData: RegisterData
): Promise<AuthResponse> {
const response = await api.post<AuthResponse>(
"/auth/register",
userData
);

return response.data;
}

export async function loginUser(
userData: LoginData
): Promise<AuthResponse> {
const response = await api.post<AuthResponse>(
"/auth/login",
userData
);

return response.data;
}