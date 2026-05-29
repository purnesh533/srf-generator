import mongoose from "mongoose";

const srfSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, default: "" },
    candidateName: { type: String, required: true },
    contactNumber: { type: String, default: "" },
    visaStatus: { type: String, default: "NA" },
    experience: { type: String, default: "" },
    skillSet: { type: String, default: "" },
    project: { type: String, default: "" },
    services: { type: String, default: "" },
    buHead: { type: String, default: "" },
    designation: { type: String, default: "" },
    bandWise: { type: String, default: "" },
    salaryFixed: { type: Number, default: 0 },
    annualRetentionBonus: { type: Number, default: 0 },
    annualCTC: { type: Number, default: 0 },
    variablePayAnnual: { type: Number, default: 0 },
    noticePeriodBuyout: { type: Number, default: 0 },
    earlyJoiningBonus: { type: Number, default: 0 },
    relocation: { type: String, default: "No" },
    guestHouse: { type: String, default: "NA" },
    source: { type: String, default: "" },
    sourceCategory: { type: String, default: "" },
    referral: { type: String, default: "NA" },
    dateOfOffer: { type: String, default: "" },
    dateOfJoining: { type: String, default: "" },
    recruiter: { type: String, default: "" },
    joiningLocation: { type: String, default: "" }
  },
  { timestamps: true }
);

const Srf = mongoose.model("Srf", srfSchema);

export default Srf;
