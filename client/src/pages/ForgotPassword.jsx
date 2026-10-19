
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Car,
  Mail,
  ArrowLeft,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import api from "../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setMsg("");
    setLink("");
    setError("");

    try {
      const response = await api.post("/auth/forgot-password", {
        email: email.trim().toLowerCase(),
      });

      setMsg(
        response.data?.message ||
          "If your account exists, password recovery instructions are available."
      );

      // Only show a reset URL in local development.
      if (import.meta.env.DEV && response.data?.devResetUrl) {
        setLink(response.data.devResetUrl);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to process your request. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="simpleAuth">
      <div className="simpleCard">
        <Link className="brand" to="/" aria-label="RideFlow home">
          <span>
            <Car />
          </span>
          Ride<span className="brandAccent">Flow</span>
        </Link>

        <div className="eyebrow">ACCOUNT RECOVERY</div>

        <h1>Forgot your password?</h1>

        <p>
          Don't worry. Enter the email address associated with your
          RideFlow account to get back on the road.
        </p>

        <form className="authForm" onSubmit={submit}>
          <label htmlFor="recovery-email">Email address</label>

          <div className="inputIcon">
            <Mail size={20} />

            <input
              id="recovery-email"
              name="email"
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <button
            className="btn primary full"
            type="submit"
            disabled={busy}
          >
            {busy ? "Processing request..." : "Continue"}
            {!busy && <ArrowRight size={18} />}
          </button>
        </form>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {msg && (
          <div className="success" role="status">
            <CheckCircle2 size={19} />
            <span>{msg}</span>
          </div>
        )}

        {link && (
          <section
            className="resetLinkPanel"
            aria-labelledby="reset-link-title"
          >
            <div className="resetLinkIcon">
              <ShieldCheck size={23} />
            </div>

            <div className="resetLinkContent">
              <h2 id="reset-link-title">
                Your reset link is ready
              </h2>

              <p>
                Continue securely to create a new password for your
                RideFlow account.
              </p>

              <a className="resetDevLink" href={link}>
                Continue to reset password
                <ArrowRight size={17} />
              </a>

              <span className="resetLinkExpiry">
                For your security, this link expires in 15 minutes
                and can only be used once.
              </span>
            </div>
          </section>
        )}

        <div className="authBack">
          <Link to="/auth?mode=signin">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>

        <div className="recoveryFooter">
          <ShieldCheck size={15} />
          <span>Your account security matters to us.</span>
        </div>
      </div>
    </main>
  );
}
