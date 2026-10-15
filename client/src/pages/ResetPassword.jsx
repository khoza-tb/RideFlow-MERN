
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Car, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import api from "../services/api";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setMsg("");

    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        `/auth/reset-password/${token}`,
        {
          password,
        }
      );

      setMsg(
        response.data?.message ||
          "Password reset successfully."
      );

      setTimeout(() => {
        navigate("/auth?mode=signin");
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "This reset link is invalid or has expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="simpleAuth">
      <div className="simpleCard">

        <Link className="brand" to="/">
          <span>
            <Car />
          </span>
          Ride<span className="brandAccent">Flow</span>
        </Link>

        <div className="eyebrow">
          ACCOUNT RECOVERY
        </div>

        <h1>Create a new password.</h1>

        <p>
          Choose a strong password you haven't used
          before.
        </p>

        <form
          className="authForm"
          onSubmit={submit}
        >

          {/* NEW PASSWORD */}
          <div className="inputIcon">
            <Lock />

            <input
              required
              minLength={8}
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="New password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

            <button
              type="button"
              className="passwordToggle"
              onClick={() =>
                setShowPassword((value) => !value)
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="inputIcon">
            <Lock />

            <input
              required
              minLength={8}
              type={
                showConfirm
                  ? "text"
                  : "password"
              }
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
            />

            <button
              type="button"
              className="passwordToggle"
              onClick={() =>
                setShowConfirm((value) => !value)
              }
              aria-label={
                showConfirm
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showConfirm ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {/* PASSWORD REQUIREMENT */}
          <div className="passwordHint">
            <CheckCircle2 size={16} />
            Password must contain at least 8
            characters.
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {msg && (
            <div className="success">
              {msg}
            </div>
          )}

          <button
            className="btn primary full"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Resetting password..."
              : "Reset password"}
          </button>

        </form>

        <div className="authBack">
          <Link to="/auth?mode=signin">
            ← Back to sign in
          </Link>
        </div>

      </div>
    </main>
  );
}

