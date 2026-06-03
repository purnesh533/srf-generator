import mongoose from "mongoose";

const draftSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    owner: { type: String, required: true, index: true },
    name: { type: String, default: "" },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

const Draft = mongoose.model("Draft", draftSchema);

export default Draft;
