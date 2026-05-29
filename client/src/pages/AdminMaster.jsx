import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../AuthContext";

const COLUMNS = [
  ["employeeCode", "E. Code"],
  ["candidateName", "Candidate Name"],
  ["skillSet", "Skill"],
  ["experience", "Experience"],
  ["designation", "Designation"],
  ["bandWise", "Band"],
  ["project", "Project"],
  ["buHead", "BU Head"],
  ["dateOfJoining", "DOJ"],
  ["source", "Source"],
  ["sourceDetail", "Source Detail"],
  ["currency", "Currency"],
  ["salaryFixed", "Salary Fixed"],
  ["salaryFrequency", "Frequency"],
  ["variablePayAnnual", "Variable"],
  ["annualRetentionBonus", "Retention"],
  ["annualCTC", "Annual CTC"],
  ["recruiter", "Recruiter"],
  ["submittedByName", "Submitted By"]
];

export default function AdminMaster() {
  const { isAdmin } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    api
      .get("/srf/all")
      .then((res) => setRecords(res.data.filter((r) => r.approvalStatus === "approved")))
      .catch((err) => setError(err?.response?.data?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return <div className="container"><div className="error">Admin access required.</div></div>;
  }

  return (
    <div className="container wide">
      <h2>Master Table (Approved SRFs only)</h2>
      <p className="muted small">
        Only SRFs that have been approved appear here and in the downloaded Master Excel.
        Pending and rejected SRFs can be reviewed from the <strong>Users</strong> page.
      </p>
      {loading && <p>Loading...</p>}
      {error && <div className="error">{error}</div>}
      {!loading && !error && (
        <div className="tableWrap">
          <table className="masterTable">
            <thead>
              <tr>
                <th>#</th>
                {COLUMNS.map(([k, label]) => <th key={k}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  {COLUMNS.map(([k]) => (
                    <td key={k}>{r[k] === undefined || r[k] === "" ? "-" : String(r[k])}</td>
                  ))}
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: "center" }}>No entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
