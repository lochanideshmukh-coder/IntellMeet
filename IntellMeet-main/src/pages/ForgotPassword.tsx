import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import "./Auth.css";
import api from "../api/axios";

type ResetStep = "email" | "otp" | "password";

function ForgotPassword() {
  const [step, setStep] = useState<ResetStep>("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOTP(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
     const response = await api.post(
      "/auth/forgot-password",
      { email: email.trim() }
    );

      setMessage(response.data.message);
      setStep("otp");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "Unable to send OTP. Please try again."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await api.post(
        "/auth/verify-reset-otp",
        {
          email: email.trim(),
          otp,
        }
      );

      setResetToken(response.data.resetToken);
      setMessage("OTP verified successfully.");
      setStep("password");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "OTP verification failed. Please try again."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(
        "/auth/reset-password",
        {
          resetToken,
          newPassword,
        }
      );

      setMessage(response.data.message);
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
      setOtp("");
      setStep("email");
      setEmail("");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(
          err.response?.data?.message ??
            "Unable to reset password. Please try again."
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

        {step === "email" && (
          <>
            <h2>Forgot Password?</h2>

            <p className="auth-description">
              Enter your registered email address. We'll send you a
              verification code.
            </p>

            {message && (
              <div className="auth-success" role="status">
                {message}
              </div>
            )}

            <form onSubmit={handleSendOTP}>
              <label htmlFor="reset-email">Email address</label>

              <input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />

              <button
                className="auth-submit"
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending OTP..." : "Send OTP"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <h2>Verify OTP</h2>

            <p className="auth-description">
              Enter the six-digit verification code sent to {email}.
            </p>

            <form onSubmit={handleVerifyOTP}>
              <label htmlFor="reset-otp">Verification code</label>

              <input
                id="reset-otp"
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                required
              />

              <button
                className="auth-submit"
                type="submit"
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </form>

            <button
              type="button"
              className="auth-back-button"
              onClick={() => {
                setStep("email");
                setOtp("");
                setError("");
                setMessage("");
              }}
            >
              Change email address
            </button>
          </>
        )}

        {step === "password" && (
          <>
            <h2>Set New Password</h2>

            <p className="auth-description">
              Choose a new password for your IntellMeet account.
            </p>

            <form onSubmit={handleResetPassword}>
              <label htmlFor="new-password">New password</label>

              <input
                id="new-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

              <label htmlFor="confirm-password">
                Confirm new password
              </label>

              <input
                id="confirm-password"
                type="password"
                placeholder="Confirm new password"
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
                {loading ? "Updating password..." : "Reset Password"}
              </button>
            </form>
          </>
        )}

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        {message && step !== "email" && (
          <div className="auth-success" role="status">
            {message}
          </div>
        )}

        <p className="auth-switch">
          Remember your password?{" "}
          <Link to="/login">Back to Login</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPassword;