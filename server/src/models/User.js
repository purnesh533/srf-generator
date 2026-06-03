import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user"
    },
    displayName: { type: String, default: "" }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
