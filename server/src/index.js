import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import srfRoutes from "./routes/srfRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(null, false);
      }
    }
  })
);
app.use(express.json({ limit: "15mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "SRF API is running. Open the Netlify frontend to use the app.",
    health: "/api/health"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, message: "SRF server running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/srf", srfRoutes);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log("Using local JSON file storage (prototype mode)");
  const smtpReady =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
  if (smtpReady) {
    console.log(`Email mode: REAL SMTP via ${process.env.SMTP_HOST}`);
  } else {
    console.log(
      "Email mode: ETHEREAL (test inbox - emails NOT delivered). " +
        "Set SMTP_HOST/SMTP_USER/SMTP_PASS in server/.env to send real emails."
    );
  }
});
