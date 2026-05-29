import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";

export async function extractText(buffer, mimeType, originalName = "") {
  const lower = (originalName || "").toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const result = await pdf(buffer);
    return result.text || "";
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }
  throw new Error("Unsupported file type. Please upload a PDF or DOCX.");
}

function normalize(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// Convert "Rs. 2,45,000" / "INR 750000" / "$ 95,000" -> "245000" / "750000" / "95000"
function cleanNumber(s) {
  if (!s) return "";
  const m = String(s).match(/-?\d[\d,.\s]*/);
  if (!m) return "";
  const digits = m[0].replace(/[\s,]/g, "");
  // remove trailing periods, keep one decimal
  const parts = digits.split(".");
  if (parts.length === 1) return parts[0];
  return parts[0] + "." + parts.slice(1).join("");
}

const MONTHS = {
  jan: "01", january: "01",
  feb: "02", february: "02",
  mar: "03", march: "03",
  apr: "04", april: "04",
  may: "05",
  jun: "06", june: "06",
  jul: "07", july: "07",
  aug: "08", august: "08",
  sep: "09", sept: "09", september: "09",
  oct: "10", october: "10",
  nov: "11", november: "11",
  dec: "12", december: "12"
};

function monthToNum(name) {
  if (!name) return "";
  const key = String(name).toLowerCase().replace(/\./g, "");
  return MONTHS[key] || MONTHS[key.slice(0, 3)] || "";
}

function parseDateToken(raw) {
  if (!raw) return "";
  const v = String(raw).trim();
  if (!v) return "";

  const dmy = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    let yyyy = dmy[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${dd}/${mm}/${yyyy}`;
  }

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const dMonY = v.match(/^(\d{1,2})[\-\/\s]([a-z]{3,9})[\-\/\s,]+(\d{2,4})/i);
  if (dMonY) {
    const mm = monthToNum(dMonY[2]);
    if (mm) {
      let yyyy = dMonY[3];
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      return `${dMonY[1].padStart(2, "0")}/${mm}/${yyyy}`;
    }
  }

  const dayMonthYear = v.toLowerCase().match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)[, ]+(\d{2,4})/);
  if (dayMonthYear) {
    const mm = monthToNum(dayMonthYear[2]);
    if (mm) {
      let yyyy = dayMonthYear[3];
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      return `${dayMonthYear[1].padStart(2, "0")}/${mm}/${yyyy}`;
    }
  }

  const monthDayYear = v.toLowerCase().match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?[, ]+(\d{2,4})/);
  if (monthDayYear) {
    const mm = monthToNum(monthDayYear[1]);
    if (mm) {
      let yyyy = monthDayYear[3];
      if (yyyy.length === 2) yyyy = `20${yyyy}`;
      return `${monthDayYear[2].padStart(2, "0")}/${mm}/${yyyy}`;
    }
  }

  return "";
}

/** Pull the first recognizable date out of a label value or sentence fragment. */
function extractDateFromFragment(s) {
  if (!s) return "";
  const v = String(s).trim();
  if (!v) return "";

  const direct = parseDateToken(v);
  if (direct) return direct;

  const patterns = [
    /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/,
    /\d{1,2}(?:st|nd|rd|th)?\s+[a-z]{3,9}[, \-]+\d{2,4}/i,
    /\d{1,2}[\-\/\s][a-z]{3,9}[\-\/\s,]+\d{2,4}/i,
    /[a-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?[, \-]+\d{2,4}/i,
    /\d{4}-\d{2}-\d{2}/
  ];
  for (const re of patterns) {
    const m = v.match(re);
    if (m) {
      const parsed = parseDateToken(m[0]);
      if (parsed) return parsed;
    }
  }
  return "";
}

function normalizeDate(s) {
  return extractDateFromFragment(s);
}

function findJoiningDateInText(text) {
  const patterns = [
    /join(?:ing)?\s+(?:on|before|by)\s+(?:on\s+|before\s+)?([^\n.]{1,50})/i,
    /(?:date\s+of\s+joining|expected\s+date\s+of\s+joining|doj)\s*[:\\-–]?\s*([^\n]{1,60})/i,
    /(?:commence(?:ment)?|start)\s+(?:on|date)\s*[:\\-–]?\s*([^\n]{1,50})/i,
    /report(?:ing)?\s+(?:on|date)\s*[:\\-–]?\s*([^\n]{1,50})/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const parsed = extractDateFromFragment(m[1]);
    if (parsed) return parsed;
  }
  return "";
}

// Find the value next to a label. Searches every line for a label match and
// returns whatever is after the separator on the same line, OR the next
// non-empty line if the label line has nothing after the separator.
function findByLabel(lines, labelPatterns) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const lp of labelPatterns) {
      // Build a regex that matches "<label>[: - – tab spaces]<value?>"
      const re = new RegExp(
        `^\\s*(?:[ivx]+\\.|[a-z]\\.|[0-9]+[.)])?\\s*${lp}\\s*[:\\-–]?\\s*(.*)$`,
        "i"
      );
      const m = line.match(re);
      if (!m) continue;
      const inline = (m[1] || "").trim();
      if (inline) return inline;
      // Look at the next non-empty line as the value
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nxt = (lines[j] || "").trim();
        if (nxt && !/^[:\-–]+$/.test(nxt)) return nxt;
      }
    }
  }
  return "";
}

function findNumber(lines, labelPatterns) {
  const raw = findByLabel(lines, labelPatterns);
  return cleanNumber(raw);
}

function findDate(lines, labelPatterns, fullText = "") {
  const inline = extractDateFromFragment(findByLabel(lines, labelPatterns));
  if (inline) return inline;

  if (fullText) {
    for (const lp of labelPatterns) {
      const re = new RegExp(`(?:${lp})\\s*[:\\-–]?\\s*([^\\n]{1,80})`, "i");
      const m = fullText.match(re);
      if (!m) continue;
      const parsed = extractDateFromFragment(m[1]);
      if (parsed) return parsed;
    }
  }
  return "";
}

export function parseOfferLetter(rawText) {
  const text = normalize(rawText);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Build the field set. Each field defines one or more label REGEX STRINGS
  // (already partial, will be wrapped by findByLabel).
  const candidateName =
    findByLabel(lines, [
      "Candidate(?:'s)?\\s*Name",
      "Name\\s*of\\s*Candidate",
      "Employee\\s*Name",
      "Full\\s*Name",
      "Name"
    ]) ||
    (() => {
      const m = text.match(
        /Dear\s+(?:Mr\.?|Ms\.?|Mrs\.?|Miss)?\s*([A-Z][A-Za-z .'-]{2,80})/i
      );
      return m ? m[1].trim() : "";
    })();

  const employeeCode = findByLabel(lines, [
    "Employee\\s*Code",
    "Employee\\s*ID",
    "Employee\\s*No\\.?",
    "Emp\\s*Code",
    "Emp\\s*ID",
    "E[-\\s]?Code"
  ]);

  const contactNumber = findByLabel(lines, [
    "Contact\\s*Telephone\\s*No\\.?",
    "Contact\\s*No\\.?",
    "Contact\\s*Number",
    "Mobile(?:\\s*No\\.?| Number)?",
    "Phone(?:\\s*No\\.?| Number)?",
    "Telephone(?:\\s*No\\.?| Number)?",
    "Contact"
  ]);

  const visaStatus = findByLabel(lines, ["Visa\\s*Status", "Work\\s*Authorization"]);

  const experience = findByLabel(lines, [
    "Years?\\s*of\\s*Experience",
    "Total\\s*Experience",
    "Experience"
  ]);

  const skillSet = findByLabel(lines, [
    "Skill\\s*Set",
    "Primary\\s*Skills?",
    "Skills?",
    "Technology",
    "Technologies"
  ]);

  const designation = findByLabel(lines, [
    "Designation",
    "Position",
    "Job\\s*Title",
    "Title",
    "Role"
  ]);

  const bandWise = findByLabel(lines, ["Band", "Grade", "Level"]);

  const project = findByLabel(lines, ["Project", "Account", "Engagement"]);

  const services = findByLabel(lines, [
    "Service\\s*Line",
    "Services",
    "Practice",
    "Department",
    "Business\\s*Unit"
  ]);

  const buHead = findByLabel(lines, ["BU\\s*Head", "Business\\s*Unit\\s*Head"]);

  const dateOfOffer = findDate(lines, [
    "Date\\s*of\\s*Offer",
    "Offer\\s*Date",
    "Letter\\s*Date"
  ], text);

  const dateOfJoining =
    findDate(lines, [
      "Date\\s*of\\s*Joining",
      "Joining\\s*Date",
      "Expected\\s*Date\\s*of\\s*Joining",
      "Anticipated\\s*Joining\\s*Date",
      "DOJ"
    ], text) || findJoiningDateInText(text);

  const joiningLocation = findByLabel(lines, [
    "Joining\\s*Location",
    "Work\\s*Location",
    "Place\\s*of\\s*Posting",
    "Base\\s*Location",
    "Location"
  ]);

  const recruiter = findByLabel(lines, [
    "Recruiter",
    "Recruited\\s*By",
    "Sourced\\s*By",
    "Hiring\\s*Manager"
  ]);

  const referral = findByLabel(lines, [
    "Referred\\s*By",
    "Referral",
    "Referrer",
    "vii\\.\\s*Referral\\s*\\(if\\s*any\\)"
  ]);

  const salaryFixed = findNumber(lines, [
    "Salary\\s*\\(\\s*Fixed\\s*\\)",
    "Salary\\s*Fixed",
    "Fixed\\s*Salary",
    "Annual\\s*Fixed",
    "Fixed\\s*CTC",
    "Fixed\\s*Pay",
    "Basic\\s*Salary"
  ]);

  const variablePayAnnual = findNumber(lines, [
    "Variable\\s*Pay\\s*\\(Annual\\)",
    "Variable\\s*Pay",
    "Annual\\s*Variable",
    "Performance\\s*Bonus",
    "Performance\\s*Pay"
  ]);

  const annualRetentionBonus = findNumber(lines, [
    "Annual\\s*Retention\\s*Bonus",
    "Retention\\s*Bonus",
    "Joining\\s*Bonus"
  ]);

  const annualCTC = findNumber(lines, [
    "Annual\\s*CTC",
    "Total\\s*CTC",
    "CTC\\s*\\(Annual\\)",
    "Cost\\s*to\\s*Company",
    "Gross\\s*CTC",
    "CTC"
  ]);

  const noticePeriodBuyout = findNumber(lines, [
    "i\\.\\s*Notice\\s*Pay\\s*Reimbursement",
    "Notice\\s*Pay\\s*Reimbursement",
    "Notice\\s*Period\\s*Buyout",
    "Notice\\s*Buyout"
  ]);

  const earlyJoiningBonus = findNumber(lines, [
    "ii\\.\\s*Early\\s*Joining\\s*Bonus",
    "Early\\s*Joining\\s*Bonus",
    "Joining\\s*Incentive",
    "Sign[-\\s]?on\\s*Bonus"
  ]);

  const relocation = findByLabel(lines, [
    "iii\\.\\s*Relocation/?Expenses",
    "Relocation\\s*/\\s*Expenses",
    "Relocation"
  ]);

  const guestHouse = findByLabel(lines, ["iv\\.\\s*Guest\\s*House", "Guest\\s*House"]);

  // Source-related (v. Source / vi. Source Category)
  const source = findByLabel(lines, ["v\\.\\s*Source", "Source"]);
  const sourceCategory = findByLabel(lines, [
    "vi\\.\\s*Source\\s*Category",
    "Source\\s*Category"
  ]);

  // Currency / frequency heuristics
  let currency = "INR";
  if (/\b(USD|US\s*\$|\$\s*[0-9])/i.test(text) && !/Rs\.?|INR|₹/i.test(text)) {
    currency = "USD";
  }
  // Normalize Yes/No-ish answers for relocation / guesthouse
  const yn = (s) => {
    if (!s) return "";
    const v = s.toLowerCase();
    if (/^(yes|y|provided|eligible|will\s*be|applicable|true|1)/i.test(v)) return "Yes";
    if (/^(no|n|not\s*provided|not\s*eligible|na|n\/a|false|0)/i.test(v)) return "No";
    return s;
  };

  return {
    candidateName,
    employeeCode,
    contactNumber,
    visaStatus,
    experience,
    skillSet,
    designation,
    bandWise,
    project,
    services,
    buHead,
    dateOfOffer,
    dateOfJoining,
    joiningLocation,
    recruiter,
    referral,
    salaryFixed,
    variablePayAnnual,
    annualRetentionBonus,
    annualCTC,
    noticePeriodBuyout,
    earlyJoiningBonus,
    currency,
    relocation: yn(relocation),
    guestHouse: yn(guestHouse),
    source,
    sourceCategory
  };
}
