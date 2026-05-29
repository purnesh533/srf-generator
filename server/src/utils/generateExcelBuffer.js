import ExcelJS from "exceljs";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";

const EXCEL_COLUMNS = [
  { header: "S. No.", key: "sNo", width: 8 },
  { header: "E. Code", key: "employeeCode", width: 12 },
  { header: "Candidate Name", key: "candidateName", width: 24 },
  { header: "Skill", key: "skillSet", width: 24 },
  { header: "Experience", key: "experience", width: 14 },
  { header: "Designation", key: "designation", width: 30 },
  { header: "Band Wise", key: "bandWise", width: 12 },
  { header: "Project", key: "project", width: 18 },
  { header: "BU Head", key: "buHead", width: 20 },
  { header: "Date of Joining", key: "dateOfJoining", width: 16 },
  { header: "Source", key: "source", width: 18 },
  { header: "Source Detail", key: "sourceDetail", width: 22 },
  { header: "Currency", key: "currency", width: 10 },
  { header: "Salary Fixed", key: "salaryFixed", width: 14 },
  { header: "Salary Frequency", key: "salaryFrequency", width: 16 },
  { header: "Annual CTC", key: "annualCTC", width: 14 },
  { header: "Variable Pay (Annual)", key: "variablePayAnnual", width: 22 },
  { header: "Annual Retention Bonus", key: "annualRetentionBonus", width: 24 },
  { header: "Notice Period Buyout", key: "noticePeriodBuyout", width: 20 },
  { header: "Early Joining Bonus", key: "earlyJoiningBonus", width: 20 },
  { header: "Relocation", key: "relocation", width: 12 },
  { header: "Recruiter", key: "recruiter", width: 20 },
  { header: "Submitted By", key: "submittedByName", width: 22 }
];

function buildRowData(data, sNo) {
  return {
    sNo,
    employeeCode: data.employeeCode || "",
    candidateName: data.candidateName || "",
    skillSet: data.skillSet || "",
    experience: data.experience || "",
    designation: data.designation || "",
    bandWise: data.bandWise || "",
    project: data.project || "",
    buHead: data.buHead || "",
    dateOfJoining: data.dateOfJoining || "",
    source: data.source || "",
    sourceDetail: data.sourceDetail || data.sourceCategory || "",
    currency: data.currency || "INR",
    salaryFixed: Number(data.salaryFixed || 0),
    salaryFrequency: data.salaryFrequency || "yearly",
    annualCTC: Number(data.annualCTC || 0),
    variablePayAnnual: Number(data.variablePayAnnual || 0),
    annualRetentionBonus: Number(data.annualRetentionBonus || 0),
    noticePeriodBuyout: Number(data.noticePeriodBuyout || 0),
    earlyJoiningBonus: Number(data.earlyJoiningBonus || 0),
    relocation: data.relocation || "No",
    recruiter: data.recruiter || "",
    submittedByName: data.submittedByName || data.submittedBy || ""
  };
}

function prepareWorksheet(worksheet) {
  worksheet.columns = EXCEL_COLUMNS;
  worksheet.getRow(1).font = { bold: true };
}

export async function generateExcelBuffer(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  prepareWorksheet(worksheet);
  worksheet.addRow(buildRowData(data, 1));
  return workbook.xlsx.writeBuffer();
}

export async function appendRecordToMasterExcel(data, masterFilePath) {
  const workbook = new ExcelJS.Workbook();
  let worksheet;

  try {
    await access(masterFilePath, fsConstants.F_OK);
    await workbook.xlsx.readFile(masterFilePath);
    worksheet = workbook.getWorksheet("SRF Entries") || workbook.addWorksheet("SRF Entries");
    if (worksheet.rowCount === 0) {
      prepareWorksheet(worksheet);
    }
  } catch {
    worksheet = workbook.addWorksheet("SRF Entries");
    prepareWorksheet(worksheet);
  }

  const nextSerialNo = Math.max(1, worksheet.rowCount);
  worksheet.addRow(buildRowData(data, nextSerialNo));
  await workbook.xlsx.writeFile(masterFilePath);
}

export async function buildMasterExcelFromRecords(records, masterFilePath) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("SRF Entries");
  prepareWorksheet(worksheet);

  records.forEach((record, index) => {
    worksheet.addRow(buildRowData(record, index + 1));
  });

  await workbook.xlsx.writeFile(masterFilePath);
}
