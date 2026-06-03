import mongoose from "mongoose";

const approvalHistorySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    by: { type: String, default: "" },
    byName: { type: String, default: "" },
    at: { type: String, default: "" },
    comment: { type: String, default: undefined }
  },
  { _id: false }
);

const srfSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    employeeCode: { type: String, required: true, unique: true, trim: true },
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
    currency: { type: String, default: "INR" },
    salaryFixed: { type: Number, default: 0 },
    salaryFrequency: { type: String, default: "yearly" },
    annualRetentionBonus: { type: Number, default: 0 },
    annualCTC: { type: Number, default: 0 },
    variablePayAnnual: { type: Number, default: 0 },
    noticePeriodBuyout: { type: Number, default: 0 },
    earlyJoiningBonus: { type: Number, default: 0 },
    relocation: { type: String, default: "No" },
    guestHouse: { type: String, default: "NA" },
    source: { type: String, default: "" },
    sourceDetail: { type: String, default: "" },
    sourceCategory: { type: String, default: "" },
    referral: { type: String, default: "NA" },
    dateOfOffer: { type: String, default: "" },
    dateOfJoining: { type: String, default: "" },
    recruiter: { type: String, default: "" },
    joiningLocation: { type: String, default: "" },
    submittedBy: { type: String, default: "" },
    submittedByName: { type: String, default: "" },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    approvalHistory: { type: [approvalHistorySchema], default: [] },
    approvedBy: { type: String, default: null },
    approvedByName: { type: String, default: null },
    approvedAt: { type: String, default: null },
    rejectedBy: { type: String, default: null },
    rejectedByName: { type: String, default: null },
    rejectedAt: { type: String, default: null },
    rejectionReason: { type: String, default: null }
  },
  {
    timestamps: true,
    strict: false
  }
);

const Srf = mongoose.model("Srf", srfSchema);

export default Srf;
