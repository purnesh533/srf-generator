import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../AuthContext";

export default function Users() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [roleMsg, setRoleMsg] = useState("");
  const [roleErr, setRoleErr] = useState("");
  const [roleBusy, setRoleBusy] = useState(""); // username currently being updated

  // Email dialog state
  const [emailFor, setEmailFor] = useState(null); // submission object OR { bulk: true, ids, count }
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", message: "" });
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [sending, setSending] = useState(false);

  // Bulk-select state for the All Submissions table
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const refresh = () => {
    setLoading(true);
    Promise.all([api.get("/auth/users"), api.get("/srf/all")])
      .then(([u, s]) => {
        setUsers(u.data);
        setSubmissions(s.data);
      })
      .catch((err) => setError(err?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user?.role !== "superadmin") return;
    refresh();
  }, [user]);

  if (user?.role !== "superadmin") {
    return (
      <div className="container">
        <div className="error">Super admin access required.</div>
      </div>
    );
  }

  const submissionsByUser = submissions.reduce((acc, s) => {
    const key = s.submittedBy || "unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  // DOJ stored as DD/MM/YYYY -> ISO yyyy-mm-dd for comparison
  const dojToIso = (s) => {
    if (!s) return "";
    const m = String(s).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!m) return "";
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  };

  const filteredSubmissions = submissions.filter((s) => {
    const iso = dojToIso(s.dateOfJoining);
    if (dateFrom && (!iso || iso < dateFrom)) return false;
    if (dateTo && (!iso || iso > dateTo)) return false;
    return true;
  });

  const dateFilterActive = Boolean(dateFrom || dateTo);
  const withoutDoj = submissions.filter((s) => !dojToIso(s.dateOfJoining)).length;

  useEffect(() => {
    if (!dateFilterActive) return;
    setSelectedIds(new Set(filteredSubmissions.map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openBulkEmailDialog = () => {
    const ids = filteredSubmissions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.id);
    if (ids.length === 0) return;
    setEmailFor({ bulk: true, ids, count: ids.length });
    setEmailForm({ to: "", cc: "", message: "" });
    setEmailMsg("");
    setEmailErr("");
  };

  const [bulkBusy, setBulkBusy] = useState("");

  // Which ids should the bulk download/summary use?  If at least one row is
  // ticked, only those; otherwise everything currently filtered.
  const bulkIds = () => {
    const ticked = filteredSubmissions
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.id);
    return ticked.length ? ticked : filteredSubmissions.map((s) => s.id);
  };

  const downloadBulkBlob = async (path, fallbackName) => {
    const ids = bulkIds();
    if (ids.length === 0) {
      alert("There are no SRFs in the current date range to download.");
      return;
    }
    setBulkBusy(path);
    try {
      const res = await api.post(
        path,
        { ids, from: dateFrom || null, to: dateTo || null },
        { responseType: "blob" }
      );
      const cd = res.headers["content-disposition"] || "";
      const m = /filename="?([^"]+)"?/i.exec(cd);
      const name = m?.[1] || fallbackName;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      // Server may send JSON-as-blob on error
      let msg = err?.message || "Download failed";
      try {
        const txt = await err?.response?.data?.text?.();
        if (txt) {
          try { msg = JSON.parse(txt).message || msg; } catch { msg = txt; }
        }
      } catch {}
      alert(msg);
    } finally {
      setBulkBusy("");
    }
  };

  const downloadBulkZip = () =>
    downloadBulkBlob("/srf/bulk-download", "SRFs.zip");
  const downloadBulkSummary = () =>
    downloadBulkBlob("/srf/bulk-summary-excel", "SRFs_Summary.xlsx");

  const downloadMasterExcel = async () => {
    try {
      const res = await api.get("/srf/master-excel", { responseType: "blob" });
      const cd = res.headers["content-disposition"] || "";
      const match = /filename="?([^"]+)"?/i.exec(cd);
      const name = match?.[1] || "SRF_Master.xlsx";
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Download failed");
    }
  };

  const changeRole = async (u, nextRole) => {
    setRoleErr("");
    setRoleMsg("");
    const verb = nextRole === "admin" ? "grant admin access to" : "revoke admin access from";
    if (!window.confirm(`Are you sure you want to ${verb} "${u.displayName || u.username}"?`)) {
      return;
    }
    setRoleBusy(u.username);
    try {
      await api.patch(`/auth/users/${encodeURIComponent(u.username)}/role`, {
        role: nextRole
      });
      setRoleMsg(
        nextRole === "admin"
          ? `"${u.displayName || u.username}" is now an admin.`
          : `Admin access removed from "${u.displayName || u.username}".`
      );
      refresh();
    } catch (err) {
      setRoleErr(err?.response?.data?.message || "Failed to update role");
    } finally {
      setRoleBusy("");
    }
  };

  const openEmailDialog = (sub) => {
    setEmailFor(sub);
    setEmailForm({ to: "", cc: "", message: "" });
    setEmailMsg("");
    setEmailErr("");
  };

  const downloadFile = async (path, fallbackName) => {
    const res = await api.get(path, { responseType: "blob" });
    const cd = res.headers["content-disposition"] || "";
    const match = /filename="?([^"]+)"?/i.exec(cd);
    const name = match?.[1] || fallbackName;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return name;
  };

  const viewFile = async (path, mimeFallback) => {
    try {
      const res = await api.get(path, { responseType: "blob" });
      const blob = new Blob([res.data], {
        type: res.data.type || mimeFallback
      });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      alert(err?.response?.data?.message || "Unable to open file");
    }
  };

  const sendEmail = async (e) => {
    e.preventDefault();
    setEmailErr("");
    setEmailMsg("");
    setSending(true);

    try {
      const isBulk = emailFor?.bulk === true;
      const url = isBulk
        ? "/srf/bulk-approval-email"
        : `/srf/${emailFor.id}/approval-email`;
      const payload = {
        to: emailForm.to.trim(),
        cc: emailForm.cc.trim(),
        message: emailForm.message.trim()
      };
      if (isBulk) payload.ids = emailFor.ids;
      const { data } = await api.post(url, payload, { timeout: 60000 });
      setEmailMsg(
        data.message || `Approval email sent to ${emailForm.to.trim()}.`
      );
    } catch (err) {
      setEmailErr(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to send email"
      );
    } finally {
      setSending(false);
    }
  };

  const closeEmailModal = () => {
    setSending(false);
    setEmailFor(null);
  };

  return (
    <div className="container wide">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Super Admin Console</h2>
          <p className="muted">Grant admin access, view submissions, and send for approval.</p>
        </div>
        <button className="dlBtn admin" onClick={downloadMasterExcel} disabled={loading}>
          Download Master Excel
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <>
          <h3 style={{ marginTop: 24 }}>Registered Users</h3>
          {roleMsg && <div className="notice" style={{ marginBottom: 8 }}>{roleMsg}</div>}
          {roleErr && <div className="error" style={{ marginBottom: 8 }}>{roleErr}</div>}
          <div className="tableWrap">
            <table className="masterTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Username</th>
                  <th>Display Name</th>
                  <th>Role</th>
                  <th>SRF Submissions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const isSuper = u.role === "superadmin";
                  const isAdmin = u.role === "admin";
                  const busy = roleBusy === u.username;
                  return (
                    <tr key={u.username}>
                      <td>{i + 1}</td>
                      <td><strong>{u.username}</strong></td>
                      <td>{u.displayName}</td>
                      <td><span className={`roleBadge role-${u.role}`}>{u.role}</span></td>
                      <td>{(submissionsByUser[u.username] || []).length}</td>
                      <td>
                        {isSuper ? (
                          <span className="muted small">Super admin (locked)</span>
                        ) : isAdmin ? (
                          <button
                            className="linkBtn"
                            disabled={busy}
                            onClick={() => changeRole(u, "user")}
                            style={{ color: "#b91c1c" }}
                          >
                            {busy ? "Updating..." : "Revoke Admin"}
                          </button>
                        ) : (
                          <button
                            className="primaryBtn"
                            disabled={busy}
                            onClick={() => changeRole(u, "admin")}
                            style={{ width: "auto", padding: "6px 14px" }}
                          >
                            {busy ? "Updating..." : "Make Admin"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center" }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pending approvals */}
          <h3 style={{ marginTop: 24 }}>Pending / Rejected Approvals</h3>
          <p className="muted small">
            These SRFs have not been approved yet, so they do not appear in the Master Excel.
          </p>
          <div className="tableWrap">
            <table className="masterTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>E. Code</th>
                  <th>Candidate</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th>Rejection Reason</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {submissions
                  .filter((s) => s.approvalStatus !== "approved")
                  .map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td>{s.employeeCode}</td>
                      <td>{s.candidateName}</td>
                      <td>{s.submittedByName || s.submittedBy || "-"}</td>
                      <td>
                        <span className={`roleBadge role-${s.approvalStatus || "pending"}`}>
                          {(s.approvalStatus || "pending").toUpperCase()}
                        </span>
                      </td>
                      <td>{s.rejectionReason || "-"}</td>
                      <td>
                        <button
                          className="dlBtn"
                          onClick={() => { window.location.hash = `#/approve/${s.id}`; }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                {submissions.filter((s) => s.approvalStatus !== "approved").length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center" }}>Nothing pending</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* All Submissions table */}
          <h3 style={{ marginTop: 24 }}>All SRF Submissions</h3>

          <div className="bulkPanel">
            <div className="bulkPanelHeader">
              <h4 style={{ margin: 0 }}>Bulk Approval</h4>
              <p className="muted small" style={{ margin: "2px 0 0" }}>
                Filter by Date of Joining, pick the SRFs to include, then email
                them to the approver in one click.
              </p>
            </div>

            <div className="bulkPanelFilters">
              <label className="field" style={{ margin: 0 }}>
                <span>Joining date from</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                />
              </label>
              <button
                type="button"
                className="linkBtn"
                onClick={() => { setDateFrom(""); setDateTo(""); }}
              >
                Clear dates
              </button>
              <button
                type="button"
                className="dlBtn"
                onClick={downloadBulkZip}
                disabled={
                  bulkBusy === "/srf/bulk-download" ||
                  filteredSubmissions.length === 0
                }
                title="Download every PDF & individual Excel of the SRFs in this range as one zip"
              >
                {bulkBusy === "/srf/bulk-download" ? "Zipping…" : "Download ZIP"}
              </button>
              <button
                type="button"
                className="dlBtn"
                style={{ background: "#0f766e" }}
                onClick={downloadBulkSummary}
                disabled={
                  bulkBusy === "/srf/bulk-summary-excel" ||
                  filteredSubmissions.length === 0
                }
                title="Download a single Excel listing every SRF in this date range"
              >
                {bulkBusy === "/srf/bulk-summary-excel" ? "Building…" : "Download Excel"}
              </button>
            </div>

            <div className="bulkPanelStats">
              <span><strong>{filteredSubmissions.length}</strong> of {submissions.length} shown</span>
              <span><strong>{selectedIds.size}</strong> selected</span>
              {selectedIds.size > 0 && (
                <button type="button" className="linkBtn" onClick={clearSelection}>
                  Clear selection
                </button>
              )}
            </div>

            <div className="bulkPanelList">
              <div className="muted small" style={{ marginBottom: 8, textAlign: "center" }}>
                {dateFilterActive ? (
                  <>
                    SRFs with Date of Joining between{" "}
                    <strong>{dateFrom || "any"}</strong> and{" "}
                    <strong>{dateTo || "any"}</strong> — ticked rows will be sent for approval.
                  </>
                ) : (
                  <>
                    All {submissions.length} SRF(s) — pick a date range above to narrow down,
                    or tick rows individually.
                  </>
                )}
              </div>
              {filteredSubmissions.length === 0 ? (
                <div className="muted small" style={{ textAlign: "center", padding: 12 }}>
                  {submissions.length === 0
                    ? "No SRFs in the system yet."
                    : "No SRFs match this date range."}
                </div>
              ) : (
                <ul className="bulkRows">
                  {filteredSubmissions.map((s) => (
                    <li key={s.id} className="bulkRow">
                      <label className="bulkRowLabel">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleOne(s.id)}
                        />
                        <span className="bulkName">{s.candidateName || "-"}</span>
                        <span className="bulkMeta">E.Code {s.employeeCode || "-"}</span>
                        <span className="bulkMeta">DOJ {s.dateOfJoining || "-"}</span>
                        <span
                          className={`roleBadge role-${s.approvalStatus || "pending"}`}
                          style={{ fontSize: 10, padding: "1px 8px" }}
                        >
                          {(s.approvalStatus || "pending").toUpperCase()}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {withoutDoj > 0 && (
                <div className="muted small" style={{ marginTop: 10, textAlign: "center" }}>
                  Note: {withoutDoj} SRF(s) have no Date of Joining set
                  {dateFilterActive ? " and are not included in the range." : "."}
                </div>
              )}
            </div>

            <div className="bulkPanelActions">
              <button
                type="button"
                className="primaryBtn"
                style={{ width: "auto", minWidth: 280 }}
                disabled={selectedIds.size === 0}
                onClick={openBulkEmailDialog}
              >
                Email Selected for Approval ({selectedIds.size})
              </button>
            </div>
          </div>

          <div className="tableWrap">
            <table className="masterTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>E. Code</th>
                  <th>Candidate</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th>Date of Joining</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{s.employeeCode}</td>
                    <td>{s.candidateName}</td>
                    <td>{s.submittedByName || s.submittedBy || "-"}</td>
                    <td>
                      <span className={`roleBadge role-${s.approvalStatus || "pending"}`}>
                        {(s.approvalStatus || "pending").toUpperCase()}
                      </span>
                    </td>
                    <td>{s.dateOfJoining || "-"}</td>
                    <td>
                      <div className="actionGroup">
                        <select
                          className="actionSelect view"
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            if (v === "pdf") viewFile(`/srf/${s.id}/pdf`, "application/pdf");
                            else if (v === "excel") viewFile(`/srf/${s.id}/excel`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>View</option>
                          <option value="pdf">View PDF</option>
                          <option value="excel">View Excel</option>
                        </select>

                        <select
                          className="actionSelect download"
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            if (v === "pdf") downloadFile(`/srf/${s.id}/pdf`, `${s.employeeCode}_SRF.pdf`);
                            else if (v === "excel") downloadFile(`/srf/${s.id}/excel`, `${s.employeeCode}_SRF.xlsx`);
                            e.target.value = "";
                          }}
                        >
                          <option value="" disabled>Download</option>
                          <option value="pdf">Download PDF</option>
                          <option value="excel">Download Excel</option>
                        </select>

                        <button className="dlBtn" onClick={() => openEmailDialog(s)}>
                          Email for Approval
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center" }}>
                      {submissions.length === 0
                        ? "No submissions yet"
                        : "No submissions match the selected joining-date range"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {emailFor && (
        <div className="modalBackdrop" onClick={closeEmailModal}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="sectionTitle">
              <span className="dot" />
              <h3>{emailFor?.bulk ? "Bulk Send for Approval" : "Send for Approval"}</h3>
            </div>
            {emailFor?.bulk ? (
              <p className="muted small">
                One email with a secure <strong>review link</strong> will be sent for
                <strong> {emailFor.count}</strong> selected SRF(s). The approver logs in,
                opens the PDF/Excel from the page, and approves or rejects each one.
                Only approved SRFs are added to the Master Excel.
              </p>
            ) : (
              <p className="muted small">
                An email with a secure <strong>review link</strong> will be sent to the approver
                for <strong>{emailFor.candidateName}</strong> ({emailFor.employeeCode}).
                They will log in, view the PDF/Excel, and approve or reject from the page.
                Only approved SRFs are added to the Master Excel.
              </p>
            )}

            <form onSubmit={sendEmail} className="formStack">
              <label className="field">
                <span>To (approver email) *</span>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                  placeholder="approver@company.com"
                  required
                />
              </label>
              <label className="field">
                <span>CC (optional)</span>
                <input
                  type="text"
                  value={emailForm.cc}
                  onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                  placeholder="cc1@company.com, cc2@company.com"
                />
              </label>
              <label className="field">
                <span>Message (optional)</span>
                <input
                  type="text"
                  value={emailForm.message}
                  onChange={(e) => setEmailForm({ ...emailForm, message: e.target.value })}
                  placeholder="Brief note for the approver"
                />
              </label>

              {emailMsg && <div className="notice">{emailMsg}</div>}
              {emailErr && <div className="error">{emailErr}</div>}

              <div className="downloads">
                <button type="submit" disabled={sending} className="primaryBtn" style={{ width: "auto" }}>
                  {sending ? "Sending..." : "Send Email"}
                </button>
                <button
                  type="button"
                  className="linkBtn"
                  onClick={closeEmailModal}
                  disabled={sending}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
