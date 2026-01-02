import crypto from "crypto";

const AES_KEY_B64 = (process.env.AES_KEY_BASE64 || "").trim();
const AES_KEY = AES_KEY_B64 ? Buffer.from(AES_KEY_B64, "base64") : null;

export function encryptAESGCM(plaintext) {
  if (!AES_KEY) return { error: "AES key missing" };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { alg: "aes-256-gcm", iv: iv.toString("base64"), tag: tag.toString("base64"), data: enc.toString("base64") };
}

export function decryptAESGCM(payload) {
  if (!AES_KEY) throw new Error("AES key missing");
  if (!payload || payload.error) throw new Error("Encrypted payload missing");
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return out.toString("utf8");
}

export function randomPassword(len = 18) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*_-+=?";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}
