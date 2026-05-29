import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import api from "../api";
import { useAuth } from "../AuthContext";

const HOURS_PER_YEAR = 2080;
const MONTHS_PER_YEAR = 12;

function toAnnual(amount, frequency) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return 0;
  switch ((frequency || "yearly").toLowerCase()) {
    case "hourly":
      return n * HOURS_PER_YEAR;
    case "monthly":
      return n * MONTHS_PER_YEAR;
    case "yearly":
    default:
      return n;
  }
}

const SOURCE_OPTIONS = [
  { value: "Employee Referral", label: "Employee Referral", detailLabel: "Employee Name (with E-Code)", detailType: "text", placeholder: "e.g. Ravi Sharma (E1234)" },
  { value: "Portal", label: "Portal", detailLabel: "Portal Name", detailType: "select", options: ["Naukri", "Indeed", "Monster", "Other"] },
  { value: "Social Media", label: "Social Media", detailLabel: "Platform", detailType: "select", options: ["LinkedIn", "Twitter / X", "Facebook", "Instagram", "Other"] },
  { value: "Career Site", label: "Career Site", detailLabel: "Site", detailType: "select", options: ["RSI Website", "Other"] },
  { value: "Vendor", label: "Vendor", detailLabel: "Vendor / Company Name", detailType: "text", placeholder: "e.g. ABC Staffing Pvt Ltd" }
];

const CURRENCIES = [
  { value: "INR", label: "INR (₹)", symbol: "₹", locale: "en-IN" },
  { value: "USD", label: "USD ($)", symbol: "$", locale: "en-US" }
];

function formatMoney(amount, currency) {
  const meta = CURRENCIES.find((c) => c.value === currency) || CURRENCIES[0];
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return `${meta.symbol}0`;
  return `${meta.symbol}${n.toLocaleString(meta.locale)}`;
}

/** DD/MM/YYYY (stored) <-> YYYY-MM-DD (native date input) */
function dmyToIso(s) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(s).trim())) return String(s).trim();
  const m = String(s).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  let yyyy = m[3];
  if (yyyy.length === 2) yyyy = `20${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDmy(s) {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(s);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function SrfForm({ loadDraft, onDraftConsumed }) {
  const { user, logout, isAdmin } = useAuth();
  const [srfId, setSrfId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState("");
  const [parseErr, setParseErr] = useState("");
  const [draftId, setDraftId] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMsg, setDraftMsg] = useState("");

  const { register, handleSubmit, control, setValue, getValues, reset, formState: { errors } } = useForm({
    defaultValues: {
      relocation: "No",
      visaStatus: "NA",
      source: "Portal",
      sourceDetail: "Naukri",
      currency: "INR",
      salaryFrequency: "yearly",
      salaryFixed: "",
      variablePayAnnual: "",
      annualRetentionBonus: "",
      annualCTC: 0
    }
  });

  const salaryFixed = useWatch({ control, name: "salaryFixed" });
  const salaryFrequency = useWatch({ control, name: "salaryFrequency" });
  const variablePayAnnual = useWatch({ control, name: "variablePayAnnual" });
  const annualRetentionBonus = useWatch({ control, name: "annualRetentionBonus" });
  const source = useWatch({ control, name: "source" });
  const currency = useWatch({ control, name: "currency" });

  const sourceMeta = useMemo(
    () => SOURCE_OPTIONS.find((s) => s.value === source) || SOURCE_OPTIONS[0],
    [source]
  );

  useEffect(() => {
    if (sourceMeta.detailType === "select") {
      setValue("sourceDetail", sourceMeta.options[0]);
    } else {
      setValue("sourceDetail", "");
    }
  }, [sourceMeta, setValue]);

  const computedAnnualCtc = useMemo(() => {
    return (
      toAnnual(salaryFixed, salaryFrequency) +
      Number(variablePayAnnual || 0) +
      Number(annualRetentionBonus || 0)
    );
  }, [salaryFixed, salaryFrequency, variablePayAnnual, annualRetentionBonus]);

  useEffect(() => {
    setValue("annualCTC", computedAnnualCtc);
  }, [computedAnnualCtc, setValue]);

  useEffect(() => {
    if (loadDraft?.data) {
      reset({
        ...loadDraft.data,
        dateOfJoining: dmyToIso(loadDraft.data.dateOfJoining),
        salaryFrequency: loadDraft.data.salaryFrequency || "yearly"
      });
      setDraftId(loadDraft.id);
      setDraftMsg(`Loaded draft "${loadDraft.name}". Continue editing then click Generate SRF or Save Draft.`);
      if (typeof onDraftConsumed === "function") onDraftConsumed();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [loadDraft, reset, onDraftConsumed]);

  const saveDraft = async () => {
    setDraftMsg("");
    setError("");
    setSavingDraft(true);
    try {
      const values = getValues();
      const { data } = await api.post("/srf/drafts", {
        id: draftId || undefined,
        data: values
      });
      setDraftId(data.draft.id);
      setDraftMsg(
        `Draft "${data.draft.name}" saved at ${new Date(data.draft.updatedAt).toLocaleTimeString()}.`
      );
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const clearForm = () => {
    if (!window.confirm("Clear the form? Unsaved changes will be lost.")) return;
    reset({
      relocation: "No",
      visaStatus: "NA",
      source: "Portal",
      sourceDetail: "Naukri",
      currency: "INR",
      salaryFrequency: "yearly",
      salaryFixed: "",
      variablePayAnnual: "",
      annualRetentionBonus: "",
      annualCTC: 0
    });
    setDraftId(null);
    setSrfId("");
    setDraftMsg("");
    setParseMsg("");
    setParseErr("");
    setError("");
  };

  const onSubmit = async (formData) => {
    setError("");
    setLoading(true);
    try {
      const payload = {
        ...formData,
        dateOfJoining: isoToDmy(formData.dateOfJoining),
        salaryFrequency: formData.salaryFrequency || "yearly",
        salaryFixed: Number(formData.salaryFixed || 0),
        variablePayAnnual: Number(formData.variablePayAnnual || 0),
        annualRetentionBonus: Number(formData.annualRetentionBonus || 0),
        noticePeriodBuyout: Number(formData.noticePeriodBuyout || 0),
        earlyJoiningBonus: Number(formData.earlyJoiningBonus || 0),
        sourceCategory: formData.sourceDetail || formData.sourceCategory || ""
      };
      const { data } = await api.post("/srf", payload);
      setSrfId(data.id);
      if (draftId) {
        try { await api.delete(`/srf/drafts/${draftId}`); } catch {}
        setDraftId(null);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error;
      if (err?.response?.status === 409) {
        setError(msg || "This employee code already has an SRF. Use a different code.");
      } else {
        setError(msg || "Failed to submit form");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadAuth = async (path, fallbackName) => {
    try {
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
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err?.response?.data?.message || "Download failed");
    }
  };

  const handleOfferLetterUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-upload of same file
    if (!file) return;
    setParseErr("");
    setParseMsg("");
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/srf/parse-offer-letter", fd, {
        timeout: 120000
      });
      const fields = data.fields || {};
      const NUMERIC = new Set([
        "salaryFixed",
        "variablePayAnnual",
        "annualRetentionBonus",
        "annualCTC",
        "noticePeriodBuyout",
        "earlyJoiningBonus"
      ]);
      let applied = 0;
      const appliedNames = [];
      Object.entries(fields).forEach(([k, v]) => {
        if (v === "" || v === null || v === undefined) return;
        let val = NUMERIC.has(k) ? Number(String(v).replace(/[^0-9.\-]/g, "")) || 0 : v;
        if (k === "dateOfJoining" || k === "dateOfOffer") val = dmyToIso(v);
        setValue(k, val, { shouldDirty: true, shouldValidate: true, shouldTouch: true });
        applied++;
        appliedNames.push(k);
      });
      console.log("[srf] extracted fields:", fields);
      console.log("[srf] applied:", appliedNames);
      setParseMsg(
        applied > 0
          ? `Auto-filled ${applied} field(s) from "${data.fileName}" (${appliedNames.join(", ")}). Please review and complete the rest.`
          : `No fields could be extracted from "${data.fileName}". Please fill the form manually.`
      );
    } catch (err) {
      setParseErr(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to parse offer letter"
      );
    } finally {
      setParsing(false);
    }
  };

  const inputField = (name, label, opts = {}) => (
    <label key={name} className="field">
      <span>{label}{opts.required && " *"}</span>
      <input
        type={opts.type || "text"}
        step={opts.type === "number" ? "any" : undefined}
        {...register(name, opts.required ? { required: `${label} is required` } : {})}
        placeholder={opts.type === "date" ? undefined : (opts.placeholder || label)}
      />
      {errors[name] && <small>{errors[name].message}</small>}
    </label>
  );

  return (
    <div className="container">
      <header className="topbar">
        <div>
          <h1>Selection Recommendation Form</h1>
          <p className="muted">Fill the details below to generate PDF & Excel</p>
        </div>
        <div className="userInfo">
          <span>{user?.displayName} <em className="roleBadge">{user?.role}</em></span>
          <button className="linkBtn" onClick={logout}>Logout</button>
        </div>
      </header>

      <section
        className="formSection"
        style={{ marginBottom: 16, borderLeft: "4px solid var(--brand-700, #6d28d9)" }}
      >
        <div className="sectionTitle">
          <span className="dot" />
          <h3>Quick Fill from Offer Letter</h3>
        </div>
        <p className="muted small" style={{ marginTop: 0 }}>
          Upload the candidate's offer letter (PDF or Word). We will extract the
          details and pre-fill the form. You can still edit anything before submitting.
        </p>
        <div className="downloads" style={{ alignItems: "center" }}>
          <label className="primaryBtn" style={{ width: "auto", cursor: parsing ? "wait" : "pointer", display: "inline-block" }}>
            {parsing ? "Reading file…" : "Upload Offer Letter"}
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleOfferLetterUpload}
              disabled={parsing}
              style={{ display: "none" }}
            />
          </label>
          <span className="muted small">PDF or DOCX, max 10 MB</span>
        </div>
        {parseMsg && <div className="notice" style={{ marginTop: 10 }}>{parseMsg}</div>}
        {parseErr && <div className="error" style={{ marginTop: 10 }}>{parseErr}</div>}
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="formStack">
        {/* Candidate Section */}
        <section className="formSection">
          <div className="sectionTitle">
            <span className="dot" />
            <h3>Candidate Details</h3>
          </div>
          <div className="grid">
            {inputField("employeeCode", "Employee Code", { required: true })}
            {inputField("candidateName", "Candidate Name", { required: true })}
            {inputField("contactNumber", "Contact Number")}
            {inputField("visaStatus", "Visa Status")}
            {inputField("experience", "Experience (e.g. 6.8 years)")}
            {inputField("skillSet", "Skill Set")}
          </div>
        </section>

        {/* Role / Project */}
        <section className="formSection">
          <div className="sectionTitle">
            <span className="dot" />
            <h3>Role &amp; Project</h3>
          </div>
          <div className="grid">
            {inputField("project", "Project")}
            {inputField("services", "Services")}
            {inputField("buHead", "BU Head")}
            {inputField("designation", "Designation")}
            {inputField("bandWise", "Band Wise")}
          </div>
        </section>

        {/* Compensation */}
        <section className="formSection">
          <div className="sectionTitle">
            <span className="dot" />
            <h3>Compensation</h3>
          </div>
          <div className="grid">
            <label className="field">
              <span>Currency</span>
              <select {...register("currency")}>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Salary Fixed (amount)</span>
              <input type="number" step="any" {...register("salaryFixed")} placeholder="e.g. 750000" />
            </label>

            <label className="field">
              <span>Salary Frequency</span>
              <select {...register("salaryFrequency")}>
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
                <option value="hourly">Hourly</option>
              </select>
            </label>

            <label className="field">
              <span>Variable Pay (Annual)</span>
              <input type="number" step="any" {...register("variablePayAnnual")} placeholder="0" />
            </label>

            <label className="field">
              <span>Annual Retention Bonus</span>
              <input type="number" step="any" {...register("annualRetentionBonus")} placeholder="0" />
            </label>

            <label className="field highlight">
              <span>Annual CTC (auto)</span>
              <input value={formatMoney(computedAnnualCtc, currency)} readOnly />
              <input type="hidden" {...register("annualCTC")} />
            </label>
          </div>
          <p className="muted small">
            Annual CTC = Salary Fixed (annualized by frequency) + Variable Pay + Annual Retention Bonus
          </p>
        </section>

        {/* Source */}
        <section className="formSection">
          <div className="sectionTitle">
            <span className="dot" />
            <h3>Source</h3>
          </div>
          <div className="grid">
            <label className="field">
              <span>Source *</span>
              <select {...register("source", { required: "Source is required" })}>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>{sourceMeta.detailLabel}</span>
              {sourceMeta.detailType === "select" ? (
                <select {...register("sourceDetail")}>
                  {sourceMeta.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  {...register("sourceDetail")}
                  placeholder={sourceMeta.placeholder}
                />
              )}
            </label>

            {inputField("referral", "Referral (if any)")}
          </div>
        </section>

        {/* Other commitments */}
        <section className="formSection">
          <div className="sectionTitle">
            <span className="dot" />
            <h3>Other Commitments &amp; Joining</h3>
          </div>
          <div className="grid">
            {inputField("noticePeriodBuyout", "Notice Period Buyout", { type: "number" })}
            {inputField("earlyJoiningBonus", "Early Joining Bonus", { type: "number" })}
            {inputField("relocation", "Relocation")}
            {inputField("guestHouse", "Guest House")}
            {inputField("dateOfOffer", "Date of Offer (DD/MM/YYYY)")}
            {inputField("dateOfJoining", "Date of Joining", { type: "date" })}
            {inputField("recruiter", "Recruiter")}
            {inputField("joiningLocation", "Joining Location")}
          </div>
        </section>

        <div className="downloads" style={{ marginTop: 8 }}>
          <button disabled={loading} type="submit" className="submitBtn" style={{ width: "auto" }}>
            {loading ? "Saving..." : "Generate SRF"}
          </button>
          <button
            type="button"
            disabled={savingDraft}
            className="primaryBtn"
            style={{ width: "auto", background: "#0ea5e9" }}
            onClick={saveDraft}
          >
            {savingDraft ? "Saving Draft…" : draftId ? "Update Draft" : "Save as Draft"}
          </button>
          <button type="button" className="linkBtn" onClick={clearForm}>
            Clear Form
          </button>
        </div>
        {draftMsg && <div className="notice" style={{ marginTop: 8 }}>{draftMsg}</div>}
      </form>

      {error && <div className="error">{error}</div>}

      {srfId && (
        <div className="downloads">
          <h3>Files ready</h3>
          <button className="dlBtn" onClick={() => downloadAuth(`/srf/${srfId}/pdf`, "srf.pdf")}>
            Download PDF
          </button>
          <button className="dlBtn" onClick={() => downloadAuth(`/srf/${srfId}/excel`, "srf.xlsx")}>
            Download Excel
          </button>
          {isAdmin && (
            <button
              className="dlBtn admin"
              onClick={() => downloadAuth("/srf/master-excel", "SRF_Master.xlsx")}
            >
              Download Master Excel (admin)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
