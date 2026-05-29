import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function Approvals({ ids = [], onDone }) {
  const { user, isAdmin } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rowError, setRowError] = useState({});

  const idSet = useMemo(() => new Set(ids), [ids]);

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all(
      ids.map((id) =>
        api.get(`/srf/${id}`).then((r) => r.data).catch(() => null)
      )
    )
      .then((arr) => setRecords(arr.filter(Boolean)))
      .catch((e) => setError(e?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const updateRow = (id, patch) =>
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setRowErr = (id, msg) =>
    setRowError((prev) => ({ ...prev, [id]: msg }));

  const openBlob = async (path, mime) => {
    try {
      const res = await api.get(path, { responseType: "blob" });
      const blob = new Blob([res.data], { type: res.data.type || mime });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(e?.response?.data?.message || "Could not open file");
    }
  };

  const approve = async (id) => {
    if (!window.confirm("Approve this SRF? It will be added to the Master Excel.")) return;
    setBusyId(id);
    setRowErr(id, "");
    try {
      const { data } = await api.post(`/srf/${id}/approve`, {});
      updateRow(id, data.data);
    } catch (e) {
      setRowErr(id, e?.response?.data?.message || "Failed to approve");
    } finally {
      setBusyId("");
    }
  };

  const submitReject = async (e, id) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRowErr(id, "Please provide a reason");
      return;
    }
    setBusyId(id);
    setRowErr(id, "");
    try {
      const { data } = await api.post(`/srf/${id}/reject`, {
        reason: rejectReason.trim()
      });
      updateRow(id, data.data);
      setRejectingId(null);
      setRejectReason("");
    } catch (e) {
      setRowErr(id, e?.response?.data?.message || "Failed to reject");
    } finally {
      setBusyId("");
    }
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (error && records.length === 0) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button className="linkBtn" onClick={onDone}>Back</button>
      </div>
    );
  }

  return (
    <div className="container wide">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Bulk Approval Review</h2>
          <p className="muted">
            Logged in as <strong>{user?.displayName}</strong> ({user?.role}) — review each SRF below
            and submit your decision. Approved SRFs are added to the Master Excel automatically.
          </p>
        </div>
        <span className="muted">{records.length} SRF(s)</span>
      </div>

      {!isAdmin && (
        <div className="error" style={{ marginTop: 12 }}>
          You must be an admin (or super-admin) to approve or reject. You can still view the files below.
        </div>
      )}

      <div className="tableWrap" style={{ marginTop: 12 }}>
        <table className="masterTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Candidate</th>
              <th>E. Code</th>
              <th>Designation</th>
              <th>DOJ</th>
              <th>Submitted By</th>
              <th>Status</th>
              <th>Files</th>
              {isAdmin && <th>Decision</th>}
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => {
              const status = r.approvalStatus || "pending";
              const busy = busyId === r.id;
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td><strong>{r.candidateName || "-"}</strong></td>
                  <td>{r.employeeCode || "-"}</td>
                  <td>{r.designation || "-"}</td>
                  <td>{r.dateOfJoining || "-"}</td>
                  <td>{r.submittedByName || r.submittedBy || "-"}</td>
                  <td>
                    <span className={`roleBadge role-${status}`}>
                      {status.toUpperCase()}
                    </span>
                    {r.rejectionReason && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        Reason: {r.rejectionReason}
                      </div>
                    )}
                    {r.approvedByName && (
                      <div className="muted small" style={{ marginTop: 4 }}>
                        By {r.approvedByName} on {r.approvedAt ? new Date(r.approvedAt).toLocaleString() : ""}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="actionGroup">
                      <button className="dlBtn" onClick={() => openBlob(`/srf/${r.id}/pdf`, "application/pdf")}>
                        View PDF
                      </button>
                      <button className="dlBtn" onClick={() => openBlob(`/srf/${r.id}/excel`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}>
                        View Excel
                      </button>
                    </div>
                  </td>
                  {isAdmin && (
                    <td style={{ minWidth: 280 }}>
                      {status === "pending" && rejectingId !== r.id && (
                        <div className="actionGroup">
                          <button
                            className="primaryBtn"
                            style={{ width: "auto", background: "#16a34a", padding: "6px 14px" }}
                            disabled={busy}
                            onClick={() => approve(r.id)}
                          >
                            {busy ? "Approving…" : "Approve"}
                          </button>
                          <button
                            className="primaryBtn"
                            style={{ width: "auto", background: "#b91c1c", padding: "6px 14px" }}
                            disabled={busy}
                            onClick={() => { setRejectingId(r.id); setRejectReason(""); setRowErr(r.id, ""); }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {status === "pending" && rejectingId === r.id && (
                        <form onSubmit={(e) => submitReject(e, r.id)} className="formStack" style={{ gap: 6 }}>
                          <textarea
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection…"
                            required
                            style={{
                              width: "100%",
                              padding: 8,
                              fontFamily: "inherit",
                              borderRadius: 6,
                              border: "1px solid #d4d4d8"
                            }}
                          />
                          <div className="actionGroup">
                            <button
                              type="submit"
                              className="primaryBtn"
                              style={{ width: "auto", background: "#b91c1c", padding: "6px 14px" }}
                              disabled={busy}
                            >
                              {busy ? "Submitting…" : "Confirm Reject"}
                            </button>
                            <button
                              type="button"
                              className="linkBtn"
                              onClick={() => { setRejectingId(null); setRejectReason(""); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                      {status !== "pending" && (
                        <span className="muted small">Decision recorded.</span>
                      )}
                      {rowError[r.id] && (
                        <div className="error" style={{ marginTop: 6 }}>{rowError[r.id]}</div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr><td colSpan={isAdmin ? 9 : 8} style={{ textAlign: "center" }}>No SRFs to review.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="linkBtn" onClick={onDone}>← Back to app</button>
      </div>
    </div>
  );
}
