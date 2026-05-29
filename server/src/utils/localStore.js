import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "srf-records.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf-8");
  } catch {
    await writeFile(dataFile, "[]", "utf-8");
  }
}

async function readRecords() {
  await ensureStore();
  const raw = await readFile(dataFile, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [];
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeRecords(records) {
  await writeFile(dataFile, JSON.stringify(records, null, 2), "utf-8");
}

export async function createRecord(payload) {
  const records = await readRecords();
  const employeeCode = String(payload.employeeCode || "").trim();
  const duplicate = records.find((item) => item.employeeCode === employeeCode);
  if (duplicate) {
    throw new Error("Employee code already exists");
  }

  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    ...payload,
    employeeCode,
    approvalStatus: "pending",
    approvalHistory: [],
    createdAt: now,
    updatedAt: now
  };
  records.push(record);
  await writeRecords(records);
  return record;
}

export async function updateRecord(id, patch) {
  const records = await readRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error("Record not found");
  records[idx] = {
    ...records[idx],
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeRecords(records);
  return records[idx];
}

export async function getRecordById(id) {
  const records = await readRecords();
  return records.find((item) => item.id === id) || null;
}

export async function getRecordByEmployeeCode(employeeCode) {
  const records = await readRecords();
  return (
    records.find((item) => item.employeeCode === String(employeeCode || "").trim()) || null
  );
}

export async function getAllRecords() {
  return readRecords();
}
