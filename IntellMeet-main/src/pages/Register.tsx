import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { registerUser } from "../services/authService";
import "./Auth.css";

function Register() {
const navigate = useNavigate();

const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [confirmPassword, setConfirmPassword] = useState("");
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);

async function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();
setError("");

if (password.length < 8) {
  setError("Password must contain at least 8 characters.");
  return;
}

if (password !== confirmPassword) {
  setError("Passwords do not match.");
  return;
}

setLoading(true);

try {
  const response = await registerUser({
    name: name.trim(),
    email: email.trim(),
    password,
  });

  // Automatically sign in after successful registration.
  localStorage.setItem("intellmeet_token", response.token);
  localStorage.setItem(
    "intellmeet_user",
    JSON.stringify(response.user)
  );

  navigate("/dashboard", { replace: true });
} catch (err: unknown) {
  if (axios.isAxiosError(err)) {
    setError(
      err.response?.data?.message ??
        "Registration failed. Please try again."
    );
  } else {
    setError("Something went wrong. Please try again.");
  }
} finally {
  setLoading(false);
}

}

return (
<main className="auth-page">
<section className="auth-card">
<div className="auth-brand">
<div className="auth-logo">I</div>
<div>
<h1>IntellMeet</h1>
<p>SMART COLLABORATION</p>
</div>
</div>

    <h2>Create your account</h2>
    <p className="auth-description">
      Join your team and make every meeting count.
    </p>

    {error && (
      <div className="auth-error" role="alert">
        {error}
      </div>
    )}

    <form onSubmit={handleSubmit}>
      <label htmlFor="register-name">Full name</label>
      <input
        id="register-name"
        type="text"
        placeholder="Enter your full name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        required
      />

      <label htmlFor="register-email">Email address</label>
      <input
        id="register-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />

      <label htmlFor="register-password">Password</label>
      <input
        id="register-password"
        type="password"
        placeholder="At least 8 characters"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="new-password"
        minLength={8}
        required
      />

      <label htmlFor="confirm-password">Confirm password</label>
      <input
        id="confirm-password"
        type="password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChange={(event) =>
          setConfirmPassword(event.target.value)
        }
        autoComplete="new-password"
        minLength={8}
        required
      />

      <button
        className="auth-submit"
        type="submit"
        disabled={loading}
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>
    </form>

    <p className="auth-switch">
      Already have an account?{" "}
      <Link to="/login">Sign in</Link>
    </p>
  </section>
</main>

);
}

export default Register;