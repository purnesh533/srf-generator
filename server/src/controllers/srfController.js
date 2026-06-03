import { generatePdfBuffer } from "../utils/generatePdfBuffer.js";
import {
  appendRecordToMasterExcel,
  buildMasterExcelFromRecords,
  generateExcelBuffer
} from "../utils/generateExcelBuffer.js";
import {
  createRecord,
  getAllRecords,
  getRecordByEmployeeCode,
  getRecordById,
  updateRecord
} from "../utils/localStore.js";
import { computeAnnualCtc } from "../utils/salary.js";
import { sendApprovalEmail } from "../utils/mailer.js";
import { extractText, parseOfferLetter } from "../utils/offerLetterParser.js";
import {
  deleteDraftForUser,
  listDraftsForUser,
  saveDraftForUser
} from "../utils/draftsStore.js";
import { access, mkdir, readFile, writeFile } from "fs/promises";
import { constants as fsConstants } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { createReadStream } from "fs";
const archiver = createRequire(import.meta.url)("archiver");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const generatedDir = path.resolve(__dirname, "../../generated");
const pdfDir = path.join(generatedDir, "pdf");
const excelDir = path.join(generatedDir, "excel");
const masterExcelPath = path.join(generatedDir, "SRF_Master.xlsx");

function sanitizeForFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");
}

function getSafePrefix(employeeCode) {
  const prefix = sanitizeForFileName(employeeCode);
  return prefix || "UNKNOWN_CODE";
}

function getStoredFileNames(record) {
  const prefix = getSafePrefix(record.employeeCode);
  return {
    pdfFileName: `${prefix}_SRF.pdf`,
    excelFileName: `${prefix}_SRF.xlsx`
  };
}

async function ensureGeneratedDirs() {
  await mkdir(pdfDir, { recursive: true });
  await mkdir(excelDir, { recursive: true });
}

export async function createSrf(req, res) {
  try {
    if (!req.body?.candidateName) {
      return res.status(400).json({ message: "candidateName is required" });
    }
    if (!req.body?.employeeCode) {
      return res.status(400).json({ message: "employeeCode is required" });
    }

    const employeeCode = String(req.body.employeeCode).trim();
    const existing = await getRecordByEmployeeCode(employeeCode);
    if (existing) {
      return res.status(409).json({ message: "employeeCode already exists" });
    }

    const payload = { ...req.body, employeeCode };
    payload.annualCTC = computeAnnualCtc(payload);
    payload.submittedBy = req.user?.username || "unknown";
    payload.submittedByName = req.user?.displayName || req.user?.username || "unknown";
    const record = await createRecord(payload);
    const { pdfFileName, excelFileName } = getStoredFileNames(record);

    await ensureGeneratedDirs();

    const [pdfBuffer, excelBuffer] = await Promise.all([
      generatePdfBuffer(record),
      generateExcelBuffer(record)
    ]);

    await Promise.all([
      writeFile(path.join(pdfDir, pdfFileName), Buffer.from(pdfBuffer)),
      writeFile(path.join(excelDir, excelFileName), Buffer.from(excelBuffer))
    ]);

    // NOTE: Master Excel intentionally NOT updated on submission.
    // It only contains records whose approvalStatus === "approved".

    res.status(201).json({
      id: record.id,
      employeeCode: record.employeeCode,
      message: "SRF created and files generated",
      data: record
    });
  } catch (error) {
    const detail = error?.message || "Unknown error";
    console.error("[createSrf]", detail);
    res.status(400).json({
      message: detail.includes("Chrome") || detail.includes("puppeteer")
        ? detail
        : `Failed to create SRF: ${detail}`,
      error: detail
    });
  }
}

export async function getSrf(req, res) {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "SRF record not found" });
    }
    res.json(record);
  } catch (error) {
    res.status(400).json({ message: "Failed to fetch SRF", error: error.message });
  }
}

export async function downloadPdf(req, res) {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "SRF record not found" });
    }

    const { pdfFileName } = getStoredFileNames(record);
    const filePath = path.join(pdfDir, pdfFileName);

    try {
      await access(filePath, fsConstants.F_OK);
    } catch {
      await ensureGeneratedDirs();
      const buffer = await generatePdfBuffer(record);
      await writeFile(filePath, Buffer.from(buffer));
    }

    res.download(filePath, pdfFileName);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate PDF", error: error.message });
  }
}

export async function downloadExcel(req, res) {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "SRF record not found" });
    }

    const { excelFileName } = getStoredFileNames(record);
    const filePath = path.join(excelDir, excelFileName);

    try {
      await access(filePath, fsConstants.F_OK);
    } catch {
      await ensureGeneratedDirs();
      const buffer = await generateExcelBuffer(record);
      await writeFile(filePath, Buffer.from(buffer));
    }

    res.download(filePath, excelFileName);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate Excel", error: error.message });
  }
}

export async function listAllSrf(_req, res) {
  try {
    const records = await getAllRecords();
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: "Failed to list records", error: error.message });
  }
}

export async function listMySrf(req, res) {
  try {
    const me = req.user?.username;
    if (!me) return res.status(401).json({ message: "Not authenticated" });
    const records = await getAllRecords();
    res.json(records.filter((r) => r.submittedBy === me));
  } catch (error) {
    res.status(500).json({ message: "Failed to list your records", error: error.message });
  }
}

export async function listDrafts(req, res) {
  try {
    const drafts = await listDraftsForUser(req.user.username);
    res.json(drafts);
  } catch (error) {
    res.status(500).json({ message: "Failed to list drafts", error: error.message });
  }
}

export async function saveDraft(req, res) {
  try {
    const draft = await saveDraftForUser(req.user.username, req.body || {});
    res.json({ message: "Draft saved", draft });
  } catch (error) {
    res.status(400).json({ message: "Failed to save draft", error: error.message });
  }
}

export async function deleteDraft(req, res) {
  try {
    await deleteDraftForUser(req.user.username, req.params.id);
    res.json({ message: "Draft deleted" });
  } catch (error) {
    const status = /not found/i.test(error.message) ? 404 : 400;
    res.status(status).json({ message: error.message });
  }
}

export async function emailSrfForApproval(req, res) {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "SRF record not found" });
    }

    const { to, cc, message } = req.body || {};
    const recipient = (to || process.env.APPROVER_EMAIL || "").trim();
    if (!recipient) {
      return res.status(400).json({
        message: "Approver email is required (provide 'to' or set APPROVER_EMAIL)"
      });
    }

    await ensureGeneratedDirs();
    const { pdfFileName, excelFileName } = getStoredFileNames(record);
    const pdfPath = path.join(pdfDir, pdfFileName);
    const excelPath = path.join(excelDir, excelFileName);

    const ensureFile = async (filePath, generator) => {
      try {
        await access(filePath, fsConstants.F_OK);
      } catch {
        const buf = await generator();
        await writeFile(filePath, Buffer.from(buf));
      }
    };

    await ensureFile(pdfPath, () => generatePdfBuffer(record));
    await ensureFile(excelPath, () => generateExcelBuffer(record));

    const allRecords = await getAllRecords();
    if (allRecords.length) {
      await buildMasterExcelFromRecords(allRecords, masterExcelPath);
    }

    const [pdfBuffer, excelBuffer, masterBuffer] = await Promise.all([
      readFile(pdfPath),
      readFile(excelPath),
      readFile(masterExcelPath).catch(() => null)
    ]);

    const detailRow = (label, val) =>
      `<tr><td style="padding:4px 10px;border:1px solid #ddd;font-weight:600;background:#f5f3ff;">${label}</td><td style="padding:4px 10px;border:1px solid #ddd;">${val ?? "-"}</td></tr>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
        <p>Hello,</p>
        <p>Please find attached the Selection Recommendation Form for
        <strong>${record.candidateName || "the candidate"}</strong>
        (Employee Code: <strong>${record.employeeCode || "-"}</strong>) for your approval.</p>
        ${message ? `<p><em>${String(message).replace(/[<>]/g, "")}</em></p>` : ""}

        <h3 style="margin:18px 0 8px;color:#4c1d95;">Candidate Details</h3>
        <table style="border-collapse:collapse;font-size:13px;">
          ${detailRow("Candidate Name", record.candidateName)}
          ${detailRow("Employee Code", record.employeeCode)}
          ${detailRow("Contact Number", record.contactNumber)}
          ${detailRow("Experience", record.experience)}
          ${detailRow("Skill Set", record.skillSet)}
          ${detailRow("Designation", record.designation)}
          ${detailRow("Band", record.bandWise)}
          ${detailRow("Project", record.project)}
          ${detailRow("Services", record.services)}
          ${detailRow("BU Head", record.buHead)}
          ${detailRow("Source", `${record.source || "-"}${record.sourceDetail ? " / " + record.sourceDetail : ""}`)}
          ${detailRow("Currency", record.currency || "INR")}
          ${detailRow("Salary Fixed", `${record.salaryFixed ?? "-"} (${record.salaryFrequency || "yearly"})`)}
          ${detailRow("Variable Pay (Annual)", record.variablePayAnnual)}
          ${detailRow("Annual Retention Bonus", record.annualRetentionBonus)}
          ${detailRow("Annual CTC", record.annualCTC)}
          ${detailRow("Date of Offer", record.dateOfOffer)}
          ${detailRow("Date of Joining", record.dateOfJoining)}
          ${detailRow("Joining Location", record.joiningLocation)}
          ${detailRow("Recruiter", record.recruiter)}
          ${detailRow("Submitted By", record.submittedByName || record.submittedBy)}
        </table>

        <p style="margin-top:14px;">Attachments: SRF PDF, SRF Excel, and the cumulative Master Excel.</p>
        <p>Regards,<br/>RSI SRF System</p>
      </div>
    `;

    const attachments = [
      { filename: pdfFileName, content: pdfBuffer, contentType: "application/pdf" },
      {
        filename: excelFileName,
        content: excelBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    ];
    if (masterBuffer) {
      attachments.push({
        filename: "SRF_Master.xlsx",
        content: masterBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
    }

    const result = await sendApprovalEmail({
      to: recipient,
      cc: cc || undefined,
      subject: `SRF Approval Request - ${record.candidateName || "Candidate"} (${record.employeeCode || ""})`,
      html,
      attachments
    });

    res.json({
      message: "Email sent successfully",
      messageId: result.messageId,
      to: recipient
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
}

async function ensureSrfFiles(record) {
  await ensureGeneratedDirs();
  const { pdfFileName, excelFileName } = getStoredFileNames(record);
  const pdfPath = path.join(pdfDir, pdfFileName);
  const excelPath = path.join(excelDir, excelFileName);
  try { await access(pdfPath, fsConstants.F_OK); }
  catch { await writeFile(pdfPath, Buffer.from(await generatePdfBuffer(record))); }
  try { await access(excelPath, fsConstants.F_OK); }
  catch { await writeFile(excelPath, Buffer.from(await generateExcelBuffer(record))); }
  return { pdfPath, excelPath, pdfFileName, excelFileName };
}

function getAppBaseUrl() {
  return (process.env.APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendSingleApprovalLinkEmail(record, { to, cc, message }) {
  const recipient = String(to || process.env.APPROVER_EMAIL || "").trim();
  if (!recipient) {
    const err = new Error("Approver email is required");
    err.status = 400;
    throw err;
  }

  const approvalLink = `${getAppBaseUrl()}/#/approve/${record.id}`;
  const subject = `SRF Approval Request - ${record.candidateName || "Candidate"} (${record.employeeCode || ""})`;

  const bodyLines = [
    "Hi,",
    "",
    `An SRF for ${record.candidateName || "a candidate"} (Employee Code: ${record.employeeCode || "-"}) requires your approval.`,
    "",
    "Please click the link below to review the PDF and Excel and submit your decision:",
    approvalLink,
    "",
    "You will need to log in with your admin account."
  ];
  if (message) bodyLines.push("", String(message));
  bodyLines.push("", "Regards,", "RSI SRF System");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
      <p>Hi,</p>
      <p>An SRF for <strong>${escapeHtml(record.candidateName || "a candidate")}</strong>
      (Employee Code: <strong>${escapeHtml(record.employeeCode || "-")}</strong>) requires your approval.</p>
      <p>Please click the link below to review the PDF and Excel and submit your decision:</p>
      <p><a href="${approvalLink}">${escapeHtml(approvalLink)}</a></p>
      <p>You will need to log in with your admin account.</p>
      ${message ? `<p><em>${escapeHtml(message)}</em></p>` : ""}
      <p>Regards,<br/>RSI SRF System</p>
    </div>
  `;

  const result = await sendApprovalEmail({
    to: recipient,
    cc: cc || undefined,
    subject,
    html
  });

  return { result, recipient, approvalLink };
}

async function sendBulkApprovalLinkEmail(selected, { to, cc, message }) {
  const recipient = String(to || process.env.APPROVER_EMAIL || "").trim();
  if (!recipient) {
    const err = new Error("Approver email is required");
    err.status = 400;
    throw err;
  }

  const summaryLink = `${getAppBaseUrl()}/#/approvals?ids=${selected.map((r) => r.id).join(",")}`;
  const subject = `SRF Approval Request - ${selected.length} candidate(s)`;

  const bodyLines = [
    "Hi,",
    "",
    `${selected.length} Selection Recommendation Form(s) require your approval:`,
    "",
    ...selected.map(
      (r, idx) =>
        `${idx + 1}. ${r.candidateName || "-"} (E.Code ${r.employeeCode || "-"})` +
        (r.dateOfJoining ? ` — DOJ ${r.dateOfJoining}` : "") +
        ` — Status: ${(r.approvalStatus || "pending").toUpperCase()}`
    ),
    "",
    "Please click the link below to review them and submit your decisions:",
    summaryLink,
    "",
    "You will need to log in with your admin account."
  ];
  if (message) bodyLines.push("", String(message));
  bodyLines.push("", "Regards,", "RSI SRF System");

  const listHtml = selected
    .map(
      (r, idx) =>
        `<li>${escapeHtml(r.candidateName || "-")} (E.Code ${escapeHtml(r.employeeCode || "-")})` +
        `${r.dateOfJoining ? ` — DOJ ${escapeHtml(r.dateOfJoining)}` : ""}` +
        ` — ${escapeHtml((r.approvalStatus || "pending").toUpperCase())}</li>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
      <p>Hi,</p>
      <p><strong>${selected.length}</strong> Selection Recommendation Form(s) require your approval:</p>
      <ol>${listHtml}</ol>
      <p>Please click the link below to review them and submit your decisions:</p>
      <p><a href="${summaryLink}">${escapeHtml(summaryLink)}</a></p>
      <p>You will need to log in with your admin account.</p>
      ${message ? `<p><em>${escapeHtml(message)}</em></p>` : ""}
      <p>Regards,<br/>RSI SRF System</p>
    </div>
  `;

  const result = await sendApprovalEmail({
    to: recipient,
    cc: cc || undefined,
    subject,
    html
  });

  return { result, recipient, summaryLink };
}

function buildSrfFilterTag(req) {
  const { from, to } = req.body || {};
  if (from && to) return `${from}_to_${to}`;
  if (from) return `from_${from}`;
  if (to) return `until_${to}`;
  return new Date().toISOString().slice(0, 10);
}

export async function bulkDownloadZip(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Provide at least one SRF id" });
    }
    const all = await getAllRecords();
    const byId = new Map(all.map((r) => [r.id, r]));
    const selected = ids.map((id) => byId.get(id)).filter(Boolean);
    if (selected.length === 0) {
      return res.status(404).json({ message: "No matching SRFs" });
    }

    const tag = buildSrfFilterTag(req);
    const fileName = `SRFs_${tag}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      try { res.status(500).end(); } catch {}
      console.error("[zip] error", err);
    });
    archive.pipe(res);

    for (const record of selected) {
      const { pdfPath, excelPath, pdfFileName, excelFileName } = await ensureSrfFiles(record);
      const safeName = sanitizeForFileName(record.candidateName || record.employeeCode || "SRF");
      const folder = `${safeName}_${record.employeeCode || ""}`.replace(/_$/, "");
      archive.append(createReadStream(pdfPath), { name: `${folder}/${pdfFileName}` });
      archive.append(createReadStream(excelPath), { name: `${folder}/${excelFileName}` });
    }

    await archive.finalize();
  } catch (error) {
    console.error("[zip] failed", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to build zip", error: error.message });
    }
  }
}

export async function bulkSummaryExcel(req, res) {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Provide at least one SRF id" });
    }
    const all = await getAllRecords();
    const byId = new Map(all.map((r) => [r.id, r]));
    const selected = ids.map((id) => byId.get(id)).filter(Boolean);
    if (selected.length === 0) {
      return res.status(404).json({ message: "No matching SRFs" });
    }

    await ensureGeneratedDirs();
    const tag = buildSrfFilterTag(req);
    const tmpDir = path.resolve(__dirname, "../../generated/tmp");
    await mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `SRFs_Summary_${tag}_${Date.now()}.xlsx`);
    await buildMasterExcelFromRecords(selected, filePath);
    res.download(filePath, `SRFs_Summary_${tag}.xlsx`);
  } catch (error) {
    res.status(500).json({ message: "Failed to build summary", error: error.message });
  }
}

export async function sendBulkApprovalEmail(req, res) {
  try {
    const { ids, to, cc, message } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "Select at least one SRF" });
    }

    const allRecords = await getAllRecords();
    const byId = new Map(allRecords.map((r) => [r.id, r]));
    const selected = ids.map((id) => byId.get(id)).filter(Boolean);
    if (selected.length === 0) {
      return res.status(404).json({ message: "None of the selected SRFs were found" });
    }

    for (const record of selected) {
      await ensureSrfFiles(record);
    }

    const { result, recipient } = await sendBulkApprovalLinkEmail(selected, {
      to,
      cc,
      message
    });

    res.json({
      message: `Approval email sent to ${recipient} for ${selected.length} SRF(s)`,
      result: "SENT",
      messageId: result.messageId,
      srfCount: selected.length
    });
  } catch (error) {
    const status = error?.status || 500;
    res.status(status).json({
      message: error?.message || "Failed to send email",
      error: error.message
    });
  }
}

export async function sendApprovalLinkEmail(req, res) {
  try {
    const record = await getRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "SRF record not found" });
    }

    const { to, cc, message } = req.body || {};
    await ensureSrfFiles(record);

    const { result, recipient } = await sendSingleApprovalLinkEmail(record, {
      to,
      cc,
      message
    });

    res.json({
      message: `Approval email sent to ${recipient}`,
      result: "SENT",
      messageId: result.messageId
    });
  } catch (error) {
    const status = error?.status || 500;
    res.status(status).json({
      message: error?.message || "Failed to send email",
      error: error.message
    });
  }
}

export async function parseOfferLetterUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded (field name: file)" });
    }
    const payload = await buildOfferLetterParseResult(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );
    res.json(payload);
  } catch (error) {
    const status = error?.status || 400;
    res.status(status).json({
      message: error?.message || "Failed to parse offer letter"
    });
  }
}

export async function parseOfferLetterJson(req, res) {
  try {
    const { fileName, mimeType, dataBase64 } = req.body || {};
    if (!dataBase64) {
      return res.status(400).json({ message: "No file data provided (dataBase64)" });
    }

    const buffer = Buffer.from(String(dataBase64), "base64");
    if (!buffer.length) {
      return res.status(400).json({ message: "Invalid file data" });
    }
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ message: "File exceeds 10 MB limit" });
    }

    const payload = await buildOfferLetterParseResult(
      buffer,
      mimeType || "",
      fileName || "upload"
    );
    res.json(payload);
  } catch (error) {
    const status = error?.status || 400;
    res.status(status).json({
      message: error?.message || "Failed to parse offer letter"
    });
  }
}

async function buildOfferLetterParseResult(buffer, mimeType, fileName) {
  const text = await extractText(buffer, mimeType, fileName);
  if (!text.trim()) {
    const err = new Error(
      "Could not extract text from the file. If it's a scanned PDF, please retype the offer letter or use a text-based PDF."
    );
    err.status = 422;
    throw err;
  }

  const fields = parseOfferLetter(text);
  const filled = Object.values(fields).filter(
    (v) => v !== "" && v !== null && v !== undefined
  ).length;
  console.log("[parse] file:", fileName, "chars:", text.length, "filled:", filled);
  console.log("[parse] fields:", JSON.stringify(fields, null, 2));

  return {
    message: `Extracted ${filled} field(s) from ${fileName}`,
    fields,
    filledCount: filled,
    fileName,
    textLength: text.length,
    textPreview: text.slice(0, 4000),
    rawText: text
  };
}

export async function downloadMasterExcel(_req, res) {
  try {
    const records = await getAllRecords();
    const approved = records.filter((r) => r.approvalStatus === "approved");
    if (!approved.length) {
      return res
        .status(404)
        .json({ message: "No approved SRFs yet. The Master Excel only contains approved records." });
    }

    await ensureGeneratedDirs();
    await buildMasterExcelFromRecords(approved, masterExcelPath);
    res.download(masterExcelPath, "SRF_Master.xlsx");
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to build master Excel", error: error.message });
  }
}

function canApprove(user) {
  return user && (user.role === "admin" || user.role === "superadmin");
}

export async function approveSrf(req, res) {
  try {
    if (!canApprove(req.user)) {
      return res.status(403).json({ message: "Only admins can approve SRFs" });
    }
    const record = await getRecordById(req.params.id);
    if (!record) return res.status(404).json({ message: "SRF record not found" });

    const history = Array.isArray(record.approvalHistory) ? record.approvalHistory : [];
    history.push({
      action: "approved",
      by: req.user.username,
      byName: req.user.displayName || req.user.username,
      at: new Date().toISOString(),
      comment: (req.body?.comment || "").trim() || undefined
    });

    const updated = await updateRecord(record.id, {
      approvalStatus: "approved",
      approvedBy: req.user.username,
      approvedByName: req.user.displayName || req.user.username,
      approvedAt: new Date().toISOString(),
      rejectionReason: null,
      approvalHistory: history
    });

    // Rebuild master from approved-only records
    const all = await getAllRecords();
    const approved = all.filter((r) => r.approvalStatus === "approved");
    await ensureGeneratedDirs();
    if (approved.length) {
      await buildMasterExcelFromRecords(approved, masterExcelPath);
    }

    res.json({ message: "SRF approved", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to approve", error: error.message });
  }
}

export async function rejectSrf(req, res) {
  try {
    if (!canApprove(req.user)) {
      return res.status(403).json({ message: "Only admins can reject SRFs" });
    }
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ message: "A rejection comment is required" });
    }
    const record = await getRecordById(req.params.id);
    if (!record) return res.status(404).json({ message: "SRF record not found" });

    const history = Array.isArray(record.approvalHistory) ? record.approvalHistory : [];
    history.push({
      action: "rejected",
      by: req.user.username,
      byName: req.user.displayName || req.user.username,
      at: new Date().toISOString(),
      comment: reason
    });

    const updated = await updateRecord(record.id, {
      approvalStatus: "rejected",
      rejectionReason: reason,
      rejectedBy: req.user.username,
      rejectedByName: req.user.displayName || req.user.username,
      rejectedAt: new Date().toISOString(),
      approvalHistory: history
    });

    // If a previously-approved record was rejected, rebuild master without it.
    const all = await getAllRecords();
    const approved = all.filter((r) => r.approvalStatus === "approved");
    await ensureGeneratedDirs();
    if (approved.length) {
      await buildMasterExcelFromRecords(approved, masterExcelPath);
    }

    res.json({ message: "SRF rejected", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to reject", error: error.message });
  }
}

export async function resendSrf(req, res) {
  try {
    if (!canApprove(req.user) && req.user?.username !== (await getRecordById(req.params.id))?.submittedBy) {
      return res.status(403).json({ message: "Not allowed" });
    }
    const record = await getRecordById(req.params.id);
    if (!record) return res.status(404).json({ message: "SRF record not found" });
    if (record.approvalStatus !== "rejected") {
      return res.status(400).json({ message: "Only rejected SRFs can be re-sent" });
    }

    const history = Array.isArray(record.approvalHistory) ? record.approvalHistory : [];
    history.push({
      action: "resubmitted",
      by: req.user.username,
      byName: req.user.displayName || req.user.username,
      at: new Date().toISOString()
    });

    const updated = await updateRecord(record.id, {
      approvalStatus: "pending",
      rejectionReason: null,
      approvalHistory: history
    });
    res.json({ message: "SRF moved back to pending", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to resubmit", error: error.message });
  }
}
