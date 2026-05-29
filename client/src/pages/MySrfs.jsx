import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function MySrfs({ onLoadDraft }) {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const refresh = () => {
    setLoading(true);
    setError("");
    api
      .get("/srf/drafts")
      .then((d) => setDrafts(d.data))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDeleteDraft = async (id) => {
    if (!window.confirm("Delete this draft? It cannot be recovered.")) return;
    try {
      await api.delete(`/srf/drafts/${id}`);
      setMsg("Draft deleted");
      refresh();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to delete");
    }
  };

  const handleLoadDraft = (d) => {
    if (typeof onLoadDraft === "function") onLoadDraft(d);
  };

  return (
    <div className="container wide">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>My SRFs</h2>
          <p className="muted">
            Hello {user?.displayName} — here are your saved drafts. Load one back into the form to continue, or delete it.
          </p>
        </div>
      </div>

      {msg && <div className="notice">{msg}</div>}
      {error && <div className="error">{error}</div>}
      {loading && <p>Loading…</p>}

      {!loading && (
        <>
          <h3 style={{ marginTop: 16 }}>Saved Drafts ({drafts.length})</h3>
          <p className="muted small">
            Drafts are unfinished SRFs you saved from the form. They are not submitted yet.
            Click <strong>Load into Form</strong> to continue editing, or <strong>Delete</strong> to discard.
          </p>
          <div className="tableWrap">
            <table className="masterTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Candidate</th>
                  <th>E. Code</th>
                  <th>Last Saved</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td><strong>{d.name}</strong></td>
                    <td>{d.data?.candidateName || "-"}</td>
                    <td>{d.data?.employeeCode || "-"}</td>
                    <td>{d.updatedAt ? new Date(d.updatedAt).toLocaleString() : "-"}</td>
                    <td>
                      <div className="actionGroup">
                        <button
                          className="primaryBtn"
                          style={{ width: "auto", padding: "6px 14px" }}
                          onClick={() => handleLoadDraft(d)}
                        >
                          Load into Form
                        </button>
                        <button
                          className="dlBtn"
                          style={{ background: "#b91c1c" }}
                          onClick={() => handleDeleteDraft(d.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {drafts.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center" }}>No drafts saved.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
