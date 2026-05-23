import express from "express";
import cors from "cors";
import animalsRouter  from "./routes/animals";
import entriesRouter  from "./routes/entries";
import expensesRouter from "./routes/expenses";
import authRouter     from "./routes/auth";
import { initWhatsApp, getQRDataURL, isReady } from "./services/whatsapp";

const app  = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date().toISOString() }),
);

// WhatsApp QR code page — open in browser and scan with phone
app.get("/qr", async (_req, res) => {
  if (isReady()) {
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>✅ WhatsApp Connected!</h2><p>OTP service is active.</p>
    </body></html>`);
  }
  const dataUrl = await getQRDataURL();
  if (!dataUrl) {
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>⏳ QR not ready yet...</h2><p>Wait 30 seconds and refresh this page.</p>
      <script>setTimeout(()=>location.reload(), 5000)</script>
    </body></html>`);
  }
  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#f5f5f5">
    <h2>📱 Scan with WhatsApp</h2>
    <p>WhatsApp → Linked Devices → Link a Device</p>
    <img src="${dataUrl}" style="border:8px solid white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15)" />
    <p style="color:#888;font-size:13px">Page auto-refreshes every 10s</p>
    <script>setTimeout(()=>location.reload(), 10000)</script>
  </body></html>`);
});

app.use("/api/auth",     authRouter);
app.use("/api/animals",  animalsRouter);
app.use("/api/entries",  entriesRouter);
app.use("/api/expenses", expensesRouter);

app.listen(PORT, () => {
  console.log(`✅  MMS Backend  →  http://localhost:${PORT}`);
  console.log(`    Health:        http://localhost:${PORT}/health`);
  console.log(`    Entries API:   http://localhost:${PORT}/api/entries`);
  console.log(`    Expenses API:  http://localhost:${PORT}/api/expenses`);
  initWhatsApp();
});
