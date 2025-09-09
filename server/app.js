import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";

import symptomRoute from "./routes/symptom.js";
import symptomThreadRoute from "./routes/symptomThread.js";
import koerpersymptomThread from "./routes/koerpersymptomThread.js";
import transcribeRouter from "./routes/transcribe.js";
import { authRouter } from "./routes/auth.js";


import { transporter } from "./mailer.js";
import { sendVerificationEmail } from "./emailService.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use("/api/symptom", symptomRoute);
app.use("/api/symptom-thread", symptomThreadRoute);
app.use("/api/koerpersymptomthread", koerpersymptomThread);
app.use("/api/transcribe", transcribeRouter);
app.use("/api/auth", authRouter);


app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "medscout-server",
    time: new Date().toISOString(),
  });
});


app.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;
    const verifyLink = "http://localhost:5173/verify-email?token=TEST123";
    const info = await sendVerificationEmail(email, verifyLink);
    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


app.use((err, _req, res, _next) => {
  console.error("[UNCAUGHT]", err);
  res.status(500).json({
    error: "SERVER_ERROR",
    message: "Unerwarteter Serverfehler.",
  });
});


transporter
  .verify()
  .then(() => console.log(" SMTP ready to send"))
  .catch((err) => console.error("❌ SMTP VERIFY FAILED:", err));


app.listen(3000, () => {
  console.log(" Server läuft unter http://localhost:3000");
});
