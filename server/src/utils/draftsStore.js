import { randomUUID } from "crypto";
import Draft from "../models/Draft.js";
import { toApi } from "./toApi.js";

const MAX_DRAFTS_PER_USER = 20;

export async function listDraftsForUser(username) {
  const docs = await Draft.find({ owner: username }).sort({ updatedAt: -1 });
  return docs.map(toApi);
}

export async function saveDraftForUser(username, body) {
  const data = body?.data || {};
  const name =
    body?.name?.trim() ||
    data.candidateName?.trim() ||
    data.employeeCode?.trim() ||
    `Untitled draft ${new Date().toLocaleString()}`;

  const id = body?.id;
  if (id) {
    const existing = await Draft.findOne({ id, owner: username });
    if (existing) {
      existing.name = name;
      existing.data = data;
      await existing.save();
      return toApi(existing);
    }
  }

  const draft = await Draft.create({
    id: randomUUID(),
    owner: username,
    name,
    data
  });

  const ownDrafts = await Draft.find({ owner: username })
    .sort({ updatedAt: -1 })
    .select("id");
  if (ownDrafts.length > MAX_DRAFTS_PER_USER) {
    const removeIds = ownDrafts.slice(MAX_DRAFTS_PER_USER).map((d) => d.id);
    await Draft.deleteMany({ owner: username, id: { $in: removeIds } });
  }

  return toApi(draft);
}

export async function deleteDraftForUser(username, id) {
  const result = await Draft.deleteOne({ id, owner: username });
  if (result.deletedCount === 0) {
    throw new Error("Draft not found");
  }
  return { ok: true };
}
