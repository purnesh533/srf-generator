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
  const resendReady =
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM?.trim();
  if (resendReady) {
    console.log("Email mode: Resend");
  } else {
    console.log(
      "Email mode: NOT CONFIGURED. Set RESEND_API_KEY and RESEND_FROM to send approval emails."
    );
  }
});
