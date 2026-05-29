import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function ApproveSrf({ id, onDone }) {
  const { user, isAdmin } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    api
      .get(`/srf/${id}`)
      .then((r) => setRecord(r.data))
      .catch((e) =>
        setError(e?.response?.data?.message || "Failed to load SRF")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [id]);

  const openBlob = async (path) => {
    try {
      const res = await api.get(path, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      alert(e?.response?.data?.message || "Could not open file");
    }
  };

  const approve = async () => {
    if (!window.confirm("Approve this SRF? It will be added to the Master Excel.")) return;
    setBusy("approve");
    setError("");
    setMsg("");
    try {
      const { data } = await api.post(`/srf/${id}/approve`, {});
      setRecord(data.data);
      setMsg("SRF approved successfully.");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to approve");
    } finally {
      setBusy("");
    }
  };

  const reject = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    setBusy("reject");
    setError("");
    setMsg("");
    try {
      const { data } = await api.post(`/srf/${id}/reject`, { reason: reason.trim() });
      setRecord(data.data);
      setShowReject(false);
      setReason("");
      setMsg("SRF rejected. The submitter has been notified in-app.");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to reject");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return <div className="container"><p>Loading…</p></div>;
  }
  if (error && !record) {
    return (
      <div className="container">
        <div className="error">{error}</div>
        <button className="linkBtn" onClick={onDone}>Back</button>
      </div>
    );
  }
  if (!record) return null;

  const status = record.approvalStatus || "pending";
  const detailRow = (label, value) => (
    <tr>
      <td style={{ fontWeight: 600, padding: "6px 10px", background: "#f5f3ff", width: 200 }}>
        {label}
      </td>
      <td style={{ padding: "6px 10px" }}>{value || "-"}</td>
    </tr>
  );

  return (
    <div className="container wide">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>SRF Approval</h2>
          <p className="muted">
            Logged in as <strong>{user?.displayName}</strong> ({user?.role})
          </p>
        </div>
        <span className={`roleBadge role-${status}`} style={{ fontSize: 14, padding: "6px 12px" }}>
          {status.toUpperCase()}
        </span>
      </div>

      {msg && <div className="notice" style={{ marginTop: 8 }}>{msg}</div>}
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}

      <section className="formSection" style={{ marginTop: 16 }}>
        <div className="sectionTitle">
          <span className="dot" /><h3>Candidate Details</h3>
        </div>
        <div className="tableWrap">
          <table className="masterTable">
            <tbody>
              {detailRow("Candidate Name", record.candidateName)}
              {detailRow("Employee Code", record.employeeCode)}
              {detailRow("Contact Number", record.contactNumber)}
              {detailRow("Experience", record.experience)}
              {detailRow("Skill Set", record.skillSet)}
              {detailRow("Designation", record.designation)}
              {detailRow("Band", record.bandWise)}
              {detailRow("Project", record.project)}
              {detailRow("Services", record.services)}
              {detailRow("BU Head", record.buHead)}
              {detailRow("Source", `${record.source || "-"}${record.sourceDetail ? " / " + record.sourceDetail : ""}`)}
              {detailRow("Currency", record.currency || "INR")}
              {detailRow("Salary Fixed", `${record.salaryFixed ?? "-"} (${record.salaryFrequency || "yearly"})`)}
              {detailRow("Variable Pay (Annual)", record.variablePayAnnual)}
              {detailRow("Annual Retention Bonus", record.annualRetentionBonus)}
              {detailRow("Annual CTC", record.annualCTC)}
              {detailRow("Date of Offer", record.dateOfOffer)}
              {detailRow("Date of Joining", record.dateOfJoining)}
              {detailRow("Joining Location", record.joiningLocation)}
              {detailRow("Recruiter", record.recruiter)}
              {detailRow("Submitted By", record.submittedByName || record.submittedBy)}
              {record.rejectionReason && detailRow("Rejection Reason", record.rejectionReason)}
              {record.approvedByName && detailRow("Approved By", `${record.approvedByName} on ${new Date(record.approvedAt).toLocaleString()}`)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="formSection" style={{ marginTop: 16 }}>
        <div className="sectionTitle">
          <span className="dot" /><h3>Files</h3>
        </div>
        <div className="downloads">
          <button className="dlBtn" onClick={() => openBlob(`/srf/${id}/pdf`)}>
            View PDF
          </button>
          <button className="dlBtn" onClick={() => openBlob(`/srf/${id}/excel`)}>
            View Excel
          </button>
        </div>
      </section>

      {isAdmin && status === "pending" && (
        <section className="formSection" style={{ marginTop: 16 }}>
          <div className="sectionTitle">
            <span className="dot" /><h3>Decision</h3>
          </div>
          {!showReject ? (
            <div className="downloads">
              <button
                className="primaryBtn"
                style={{ width: "auto", background: "#16a34a" }}
                disabled={busy === "approve"}
                onClick={approve}
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
              <button
                className="primaryBtn"
                style={{ width: "auto", background: "#b91c1c" }}
                disabled={busy === "reject"}
                onClick={() => setShowReject(true)}
              >
                Reject
              </button>
            </div>
          ) : (
            <form onSubmit={reject} className="formStack">
              <label className="field">
                <span>Reason for rejection *</span>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this SRF is being rejected…"
                  required
                  style={{ width: "100%", padding: 10, fontFamily: "inherit", borderRadius: 8, border: "1px solid #d4d4d8" }}
                />
              </label>
              <div className="downloads">
                <button
                  type="submit"
                  className="primaryBtn"
                  style={{ width: "auto", background: "#b91c1c" }}
                  disabled={busy === "reject"}
                >
                  {busy === "reject" ? "Submitting…" : "Confirm Reject"}
                </button>
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => { setShowReject(false); setReason(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {!isAdmin && status === "pending" && (
        <div className="notice" style={{ marginTop: 16 }}>
          Only admins can approve or reject this SRF. You can still view the files above.
        </div>
      )}

      {status !== "pending" && (
        <div className="notice" style={{ marginTop: 16 }}>
          This SRF has already been <strong>{status}</strong>.
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        <button className="linkBtn" onClick={onDone}>← Back to app</button>
      </div>
    </div>
  );
}
