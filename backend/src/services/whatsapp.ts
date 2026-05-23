import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

let client: Client | null = null;
let ready = false;
let reinitTimer: ReturnType<typeof setTimeout> | null = null;
let latestQR: string | null = null;   // raw QR string for image endpoint

/** Expose latest QR as a PNG data-URL (for /qr route) */
export async function getQRDataURL(): Promise<string | null> {
  if (!latestQR) return null;
  return QRCode.toDataURL(latestQR, { width: 400, margin: 2 });
}

export function isReady() { return ready; }

/** Delete entire .wwebjs_auth folder so Chrome always starts fresh */
function nukeAuthData() {
  const dir = path.resolve(".wwebjs_auth");
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log("🗑️   Cleared .wwebjs_auth — fresh Chrome profile");
    }
  } catch (err) {
    console.warn("Could not clear .wwebjs_auth:", err);
  }
}

function createClient(): Client {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
      ],
    },
  });
}

function scheduleReinit() {
  if (reinitTimer) return;
  reinitTimer = setTimeout(() => {
    reinitTimer = null;
    console.log("🔄  WhatsApp reinitializing...");
    startClient();
  }, 5000);
}

function startClient() {
  ready = false;
  latestQR = null;
  nukeAuthData();
  client = createClient();

  client.on("qr", (qr) => {
    latestQR = qr;
    console.log("\n📱  WhatsApp QR Code — scan via https://<your-app>/qr\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("ready", () => {
    ready = true;
    latestQR = null;
    console.log("✅  WhatsApp connected! OTP messages ready.\n");
  });

  client.on("disconnected", (reason) => {
    ready = false;
    console.log(`⚠️   WhatsApp disconnected (${reason}). Will retry in 5s...`);
    scheduleReinit();
  });

  client.initialize().catch((err) => {
    console.error("WhatsApp init error:", (err as Error).message);
    scheduleReinit();
  });
}

process.on("SIGTERM", () => client?.destroy().catch(() => {}));
process.on("exit",    () => client?.destroy().catch(() => {}));

export function initWhatsApp() {
  startClient();
}

export async function sendOTP(phone: string, otp: string): Promise<boolean> {
  if (!client || !ready) {
    console.log(`\n📱  [WhatsApp not ready] OTP for ${phone}:  ${otp}\n`);
    return false;
  }

  const chatId = `91${phone}@c.us`;
  const msg =
    `🥛 *Milk Management System*\n\n` +
    `Your login verification code is:\n\n` +
    `🔑  *${otp}*\n\n` +
    `⏳ Valid for 10 minutes only.\n` +
    `🚫 Do not share this code with anyone.`;

  try {
    await client.sendMessage(chatId, msg);
    console.log(`✅  OTP sent via WhatsApp to ${phone}`);
    return true;
  } catch (err: any) {
    if (err?.message?.includes("detached") || err?.message?.includes("Session closed")) {
      ready = false;
      scheduleReinit();
    }
    console.log(`\n📱  Fallback OTP for ${phone}:  ${otp}\n`);
    return false;
  }
}
