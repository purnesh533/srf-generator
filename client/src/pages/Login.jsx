import { useState } from "react";
import { useAuth } from "../AuthContext";

export default function Login({ onSwitchToSignup, prefill }) {
  const { login, loading } = useAuth();
  const [username, setUsername] = useState(prefill?.username || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(prefill?.message || "");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="authShell">
      <div className="authBackdrop" />
      <div className="authCard">
        <div className="authBrand">
          <img src="/rsi-logo.png" alt="RSi" className="brandLogo" />
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your SRF account</p>
        </div>

        <form onSubmit={submit} className="authForm">
          <label className="field">
            <span>Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </label>

          {notice && <div className="notice">{notice}</div>}
          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="primaryBtn">
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div className="switchAuth">
            Don&apos;t have an account?{" "}
            <button type="button" className="linkBtnAccent" onClick={onSwitchToSignup}>
              Create one
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
