import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logoPath = path.resolve(__dirname, "../assets/rsi-logo.png");

let cachedLogoDataUri = null;
function getLogoDataUri() {
  if (cachedLogoDataUri) return cachedLogoDataUri;
  try {
    const buf = readFileSync(logoPath);
    cachedLogoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cachedLogoDataUri = "";
  }
  return cachedLogoDataUri;
}

function value(v) {
  return v === null || v === undefined || v === "" ? "NA" : String(v);
}

function currencyMeta(code) {
  if (String(code || "").toUpperCase() === "USD") {
    return { symbol: "$", locale: "en-US" };
  }
  return { symbol: "Rs. ", locale: "en-IN" };
}

function formatAmount(n, currency) {
  const num = Number(n || 0);
  const meta = currencyMeta(currency);
  if (!Number.isFinite(num) || num === 0) {
    if (n === 0 || n === "0") return `${meta.symbol}0`;
    return "NA";
  }
  return `${meta.symbol}${num.toLocaleString(meta.locale)}`;
}

function salaryFixedDisplay(data) {
  const amt = Number(data.salaryFixed || 0);
  if (!amt) return "NA";
  const freq = String(data.salaryFrequency || "yearly").toLowerCase();
  const suffix =
    freq === "hourly" ? " /hr" : freq === "monthly" ? " /month" : " /year";
  const meta = currencyMeta(data.currency);
  return `${meta.symbol}${amt.toLocaleString(meta.locale)}${suffix}`;
}

export function buildSrfHtml(data) {
  const logoUri = getLogoDataUri();

  const rows = [
    ["Name", value(data.candidateName)],
    ["Contact Telephone No.", value(data.contactNumber)],
    ["Visa Status", value(data.visaStatus)],
    ["Years Of Experience", value(data.experience)],
    ["Skill Set", value(data.skillSet)],
    ["Project", value(data.project)],
    ["Services", value(data.services)],
    ["BU Head", value(data.buHead)],
    ["Designation", value(data.designation)],
    ["Salary(Fixed)", salaryFixedDisplay(data)],
    ["Variable Pay (Annual)", formatAmount(data.variablePayAnnual, data.currency)],
    ["Annual Retention Bonus", formatAmount(data.annualRetentionBonus, data.currency)],
    ["Annual CTC", formatAmount(data.annualCTC, data.currency)],
    ["Any Other Commitment", ""],
    ["i. Notice Pay Reimbursement", formatAmount(data.noticePeriodBuyout, data.currency)],
    ["ii. Early Joining Bonus", formatAmount(data.earlyJoiningBonus, data.currency)],
    ["iii. Relocation/Expenses", value(data.relocation)],
    ["iv. Guest House", value(data.guestHouse)],
    ["v. Source", value(data.source)],
    ["vi. Source Category", value(data.sourceCategory)],
    ["vii. Referral (if any)", value(data.referral)],
    ["Date of Offer", value(data.dateOfOffer)],
    ["Date of Joining", value(data.dateOfJoining)],
    ["Recruiter", value(data.recruiter)],
    ["Joining Location", value(data.joiningLocation)]
  ];

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        body {
          font-family: "Times New Roman", Times, serif;
          color: #000;
          font-size: 11pt;
          margin: 0;
          padding: 40px 56px 48px 56px;
        }
        .header {
          display: table;
          width: 100%;
          margin-bottom: 4px;
        }
        .header > div {
          display: table-cell;
          vertical-align: middle;
        }
        .header .logo-cell {
          width: 90px;
        }
        .header .logo-cell img {
          width: 70px;
          height: auto;
          display: block;
        }
        .header .form-no {
          font-weight: 700;
          font-size: 13pt;
          padding-left: 10px;
          width: 130px;
        }
        .header .title {
          text-align: right;
          font-weight: 700;
          font-size: 13pt;
        }
        .divider {
          border: 0;
          border-bottom: 1px solid #000;
          margin: 4px 0 14px 0;
        }
        .fields-wrap {
          width: 100%;
          text-align: center;
        }
        table.fields {
          width: 70%;
          margin: 0 auto;
          border-collapse: collapse;
          text-align: left;
        }
        table.fields td {
          vertical-align: top;
          padding: 2px 0;
          font-size: 11pt;
          line-height: 1.3;
        }
        table.fields td.label {
          width: 55%;
          font-weight: 700;
          padding-right: 20px;
        }
        table.fields td.value {
          width: 45%;
          font-weight: 700;
        }
        .signatures {
          margin-top: 70px;
          width: 100%;
          border-collapse: collapse;
        }
        .signatures td {
          width: 50%;
          font-weight: 700;
          font-size: 11pt;
          padding: 40px 0 0 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-cell">
          ${logoUri ? `<img src="${logoUri}" alt="RSi" />` : ""}
        </div>
        <div class="form-no">FORM 104</div>
        <div class="title">Selection Recommendation Form</div>
      </div>
      <hr class="divider" />

      <div class="fields-wrap">
        <table class="fields">
          ${rows
            .map(
              ([label, val]) =>
                `<tr><td class="label">${label}</td><td class="value">${val}</td></tr>`
            )
            .join("")}
        </table>
      </div>

      <table class="signatures">
        <tr>
          <td>AVP - RMG</td>
          <td>RMG (Recruiter)</td>
        </tr>
        <tr>
          <td>EVP &amp; CTO</td>
          <td>VP/AVP (Project)</td>
        </tr>
      </table>
    </body>
  </html>`;
}
