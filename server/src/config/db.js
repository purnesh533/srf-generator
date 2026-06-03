import mongoose from "mongoose";

export async function connectDb() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required in .env");
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
