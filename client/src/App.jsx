import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import SrfForm from "./pages/SrfForm";
import AdminMaster from "./pages/AdminMaster";
import Users from "./pages/Users";
import ApproveSrf from "./pages/ApproveSrf";
import MySrfs from "./pages/MySrfs";
import Approvals from "./pages/Approvals";

function parseHash() {
  const h = window.location.hash || "";
  const single = h.match(/^#\/approve\/([^/?#]+)/i);
  if (single) return { route: "approve", id: single[1], ids: [] };
  const bulk = h.match(/^#\/approvals(?:\?ids=([^#]*))?/i);
  if (bulk) {
    const ids = (bulk[1] || "")
      .split(",")
      .map((s) => decodeURIComponent(s).trim())
      .filter(Boolean);
    return { route: "approvals", id: null, ids };
  }
  return { route: "app", id: null, ids: [] };
}

function Shell() {
  const { user, isAdmin, logout } = useAuth();
  const isSuperAdmin = user?.role === "superadmin";
  const [view, setView] = useState("form");
  const [authMode, setAuthMode] = useState("login");
  const [loginPrefill, setLoginPrefill] = useState(null);
  const [hashRoute, setHashRoute] = useState(parseHash());
  const [pendingDraft, setPendingDraft] = useState(null);

  useEffect(() => {
    const onHash = () => setHashRoute(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (!user) {
    const note =
      hashRoute.route === "approve" || hashRoute.route === "approvals"
        ? "Please log in with your admin account to review this SRF approval request."
        : null;
    return authMode === "login" ? (
      <Login
        prefill={loginPrefill}
        notice={note}
        onSwitchToSignup={() => {
          setLoginPrefill(null);
          setAuthMode("signup");
        }}
      />
    ) : (
      <Signup
        onSwitchToLogin={(prefill) => {
          setLoginPrefill(prefill || null);
          setAuthMode("login");
        }}
      />
    );
  }

  if (hashRoute.route === "approve") {
    return (
      <>
        <nav className="nav">
          <div className="navInner">
            <div className="brandSmall">
              <img src="/rsi-logo.png" alt="RSi" className="navLogo" />
            </div>
            <div className="navLinks">
              <span className="muted">Approval Review</span>
            </div>
            <div className="navUser">
              <span>{user.displayName}</span>
              <em className="roleBadge">{user.role}</em>
              <button className="linkBtn" onClick={logout}>Logout</button>
            </div>
          </div>
        </nav>
        <ApproveSrf
          id={hashRoute.id}
          onDone={() => {
            window.location.hash = "";
          }}
        />
      </>
    );
  }

  if (hashRoute.route === "approvals") {
    return (
      <>
        <nav className="nav">
          <div className="navInner">
            <div className="brandSmall">
              <img src="/rsi-logo.png" alt="RSi" className="navLogo" />
            </div>
            <div className="navLinks">
              <span className="muted">Bulk Approval Review</span>
            </div>
            <div className="navUser">
              <span>{user.displayName}</span>
              <em className="roleBadge">{user.role}</em>
              <button className="linkBtn" onClick={logout}>Logout</button>
            </div>
          </div>
        </nav>
        <Approvals
          ids={hashRoute.ids}
          onDone={() => { window.location.hash = ""; }}
        />
      </>
    );
  }

  return (
    <>
      <nav className="nav">
        <div className="navInner">
          <div className="brandSmall">
            <img src="/rsi-logo.png" alt="RSi" className="navLogo" />
          </div>
          <div className="navLinks">
            <button
              className={`navBtn ${view === "form" ? "active" : ""}`}
              onClick={() => setView("form")}
            >
              SRF Form
            </button>
            <button
              className={`navBtn ${view === "mine" ? "active" : ""}`}
              onClick={() => setView("mine")}
            >
              My SRFs
            </button>
            {isAdmin && (
              <button
                className={`navBtn ${view === "master" ? "active" : ""}`}
                onClick={() => setView("master")}
              >
                Master Table
              </button>
            )}
            {isSuperAdmin && (
              <button
                className={`navBtn ${view === "users" ? "active" : ""}`}
                onClick={() => setView("users")}
              >
                Users
              </button>
            )}
          </div>
          <div className="navUser">
            <span>{user.displayName}</span>
            <em className="roleBadge">{user.role}</em>
            <button className="linkBtn" onClick={logout}>Logout</button>
          </div>
        </div>
      </nav>

      {view === "form" && (
        <SrfForm
          loadDraft={pendingDraft}
          onDraftConsumed={() => setPendingDraft(null)}
        />
      )}
      {view === "mine" && (
        <MySrfs
          onLoadDraft={(d) => {
            setPendingDraft(d);
            setView("form");
          }}
        />
      )}
      {view === "master" && isAdmin && <AdminMaster />}
      {view === "users" && isSuperAdmin && <Users />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
