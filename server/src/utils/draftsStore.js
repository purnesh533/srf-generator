import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const draftsFile = path.join(dataDir, "srf-drafts.json");

const MAX_DRAFTS_PER_USER = 20;

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(draftsFile, "utf-8");
  } catch {
    await writeFile(draftsFile, "[]", "utf-8");
  }
}

async function readDrafts() {
  await ensureStore();
  const raw = await readFile(draftsFile, "utf-8");
  const cleaned = raw.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [];
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDrafts(drafts) {
  await writeFile(draftsFile, JSON.stringify(drafts, null, 2), "utf-8");
}

export async function listDraftsForUser(username) {
  const drafts = await readDrafts();
  return drafts
    .filter((d) => d.owner === username)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export async function saveDraftForUser(username, body) {
  const drafts = await readDrafts();
  const now = new Date().toISOString();
  const data = body?.data || {};
  const name =
    body?.name?.trim() ||
    data.candidateName?.trim() ||
    data.employeeCode?.trim() ||
    `Untitled draft ${new Date().toLocaleString()}`;

  let id = body?.id;
  if (id) {
    const idx = drafts.findIndex((d) => d.id === id && d.owner === username);
    if (idx !== -1) {
      drafts[idx] = { ...drafts[idx], name, data, updatedAt: now };
      await writeDrafts(drafts);
      return drafts[idx];
    }
  }

  const draft = {
    id: randomUUID(),
    owner: username,
    name,
    data,
    createdAt: now,
    updatedAt: now
  };
  drafts.push(draft);

  // Cap per user
  const ownDrafts = drafts
    .filter((d) => d.owner === username)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const keepIds = new Set(ownDrafts.slice(0, MAX_DRAFTS_PER_USER).map((d) => d.id));
  const trimmed = drafts.filter((d) => d.owner !== username || keepIds.has(d.id));

  await writeDrafts(trimmed);
  return draft;
}

export async function deleteDraftForUser(username, id) {
  const drafts = await readDrafts();
  const next = drafts.filter((d) => !(d.id === id && d.owner === username));
  if (next.length === drafts.length) {
    throw new Error("Draft not found");
  }
  await writeDrafts(next);
  return { ok: true };
}
