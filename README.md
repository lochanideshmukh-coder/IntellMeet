IntellMeet – AI-Powered Meeting & Collaboration Platform

IntellMeet is a full-stack meeting and collaboration platform designed to make remote teamwork easier. It combines real-time video conferencing, messaging, screen sharing, and AI-powered meeting insights in one place.

Features

Authentication

User registration and login.
Secure password hashing and JWT authentication.
Forgot password with email OTP verification.
Protected routes.
Video Conferencing

Create and join meetings.
Real-time video and audio communication using WebRTC.
Live meeting chat using Socket.IO.
Screen sharing.
Host-controlled meeting termination.
AI-Powered Meeting Assistance

Live meeting transcription using browser speech recognition.
AI-generated meeting summaries.
Key discussion points and decisions.
Automatically generated action items.
Meeting transcripts and summaries stored in MongoDB.
Team Workspace

Create team workspaces.
Add registered users using their email addresses.
Create and manage workspace meetings.
Access shared workspace information.
Tech Stack

Frontend

React
TypeScript
Vite
CSS
Backend

Node.js
Express.js
MongoDB
Mongoose
JWT
Socket.IO
Real-Time Communication

WebRTC
Socket.IO
AI Integration

Google Gemini API
Browser Speech Recognition API
Project Structure

├── public/
├── src/
│   ├── api/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── Dashboard.tsx
│   ├── App.tsx
│   └── main.tsx
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── server.js
├── package.json
└── README.md
Installation and Setup

Prerequisites

Node.js
MongoDB
Git
API credentials for the required integrations
Clone the repository
git clone https://github.com/Ananthu-R-S/IntellMeet.git cd IntellMeet

Install frontend dependencies
npm install

Install backend dependencies
cd server npm install

Configure environment variables
Create the required ".env" files for the frontend and backend.

Configure your MongoDB connection, JWT secret, email credentials, Gemini API key, and other required settings.

Never upload actual credentials or ".env" files to GitHub.

Run the application
Start the backend using the development command configured in "server/package.json".

Start the frontend from the project root:

npm run dev

Open the local URL displayed by Vite in your browser.

Security

Passwords are hashed before storage.
Authentication uses JWT.
Password reset OTPs are securely hashed and expire.
Environment variables are used for sensitive configuration.
Future Improvements

Production deployment.
Enhanced mobile responsiveness.
Additional enterprise collaboration features.
Further AI-powered meeting assistance.
