import dotenv from "dotenv";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { connectDb } from "../src/config/db.js";
import Srf from "../src/models/Srf.js";
import Draft from "../src/models/Draft.js";
import User from "../src/models/User.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../data");

async function readJsonArray(fileName) {
  const filePath = path.join(dataDir, fileName);
  try {
    const raw = await readFile(filePath, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "").trim();
    if (!cleaned) return [];
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const NUMERIC_SRF_FIELDS = [
  "salaryFixed",
  "annualRetentionBonus",
  "annualCTC",
  "variablePayAnnual",
  "noticePeriodBuyout",
  "earlyJoiningBonus"
];

function sanitizeSrfRecord(record) {
  const out = { ...record };
  for (const field of NUMERIC_SRF_FIELDS) {
    if (out[field] === "" || out[field] == null) {
      out[field] = 0;
    } else {
      out[field] = Number(out[field]) || 0;
    }
  }
  return out;
}

async function migrateCollection(Model, items, keyField, { sanitize } = {}) {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    const key = item[keyField];
    if (!key) {
      skipped += 1;
      continue;
    }
    const payload = sanitize ? sanitize(item) : item;
    const existing = await Model.findOne({ [keyField]: key });
    if (existing) {
      await Model.updateOne({ [keyField]: key }, { $set: payload });
      updated += 1;
    } else {
      await Model.create(payload);
      inserted += 1;
    }
  }
  return { inserted, updated, skipped };
}

async function main() {
  await connectDb();

  const [records, drafts, users] = await Promise.all([
    readJsonArray("srf-records.json"),
    readJsonArray("srf-drafts.json"),
    readJsonArray("users.json")
  ]);

  const srfResult = await migrateCollection(Srf, records, "id", {
    sanitize: sanitizeSrfRecord
  });
  const draftResult = await migrateCollection(Draft, drafts, "id");
  const userResult = await migrateCollection(User, users, "username");

  console.log("Migration complete:");
  console.log(
    `  SRF records: ${srfResult.inserted} inserted, ${srfResult.updated} updated, ${srfResult.skipped} skipped`
  );
  console.log(
    `  Drafts:      ${draftResult.inserted} inserted, ${draftResult.updated} updated, ${draftResult.skipped} skipped`
  );
  console.log(
    `  Users:       ${userResult.inserted} inserted, ${userResult.updated} updated, ${userResult.skipped} skipped`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
