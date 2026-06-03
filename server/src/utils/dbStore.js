import { randomUUID } from "crypto";
import Srf from "../models/Srf.js";
import { toApi } from "./toApi.js";

export async function createRecord(payload) {
  const employeeCode = String(payload.employeeCode || "").trim();
  const duplicate = await Srf.findOne({ employeeCode });
  if (duplicate) {
    throw new Error("Employee code already exists");
  }

  const doc = await Srf.create({
    id: randomUUID(),
    ...payload,
    employeeCode,
    approvalStatus: "pending",
    approvalHistory: []
  });
  return toApi(doc);
}

export async function updateRecord(id, patch) {
  const doc = await Srf.findOneAndUpdate({ id }, patch, { new: true });
  if (!doc) throw new Error("Record not found");
  return toApi(doc);
}

export async function getRecordById(id) {
  const doc = await Srf.findOne({ id });
  return toApi(doc);
}

export async function getRecordByEmployeeCode(employeeCode) {
  const doc = await Srf.findOne({
    employeeCode: String(employeeCode || "").trim()
  });
  return toApi(doc);
}

export async function getAllRecords() {
  const docs = await Srf.find().sort({ createdAt: -1 });
  return docs.map(toApi);
}
