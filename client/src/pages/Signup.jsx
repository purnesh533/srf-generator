import { useState } from "react";
import { useAuth } from "../AuthContext";

export default function Signup({ onSwitchToLogin }) {
  const { signup, loading } = useAuth();
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    password: "",
    confirmPassword: ""
  });
  const [error, setError] = useState("");

  const handleChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      await signup({
        username: form.username.trim().toLowerCase(),
        password: form.password,
        displayName: form.displayName.trim() || form.username.trim()
      });
      onSwitchToLogin?.({
        username: form.username.trim().toLowerCase(),
        message: "Account created successfully. Please sign in."
      });
    } catch (err) {
      setError(err?.response?.data?.message || "Sign up failed");
    }
  };

  return (
    <div className="authShell">
      <div className="authBackdrop" />
      <div className="authCard">
        <div className="authBrand">
          <img src="/rsi-logo.png" alt="RSi" className="brandLogo" />
          <h2>Create your account</h2>
          <p className="muted">Sign up to access the SRF portal</p>
        </div>

        <form onSubmit={submit} className="authForm">
          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              value={form.displayName}
              onChange={handleChange("displayName")}
              placeholder="Your full name"
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={form.username}
              onChange={handleChange("username")}
              placeholder="Choose a username"
              required
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={handleChange("password")}
              placeholder="At least 6 characters"
              required
            />
          </label>

          <label className="field">
            <span>Confirm Password</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              placeholder="Re-enter your password"
              required
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="primaryBtn">
            {loading ? "Creating account..." : "Sign Up"}
          </button>

          <div className="switchAuth">
            Already have an account?{" "}
            <button type="button" className="linkBtnAccent" onClick={onSwitchToLogin}>
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
