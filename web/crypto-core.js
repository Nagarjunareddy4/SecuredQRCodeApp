const te = new TextEncoder();
const td = new TextDecoder();

export const WEB_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;

function bytesToBase64Url(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function concatBytes(...parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS, usages = ["encrypt", "decrypt"]) {
  const material = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveKey", "deriveBits"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function encryptPayload(plainBytes, password, meta = {}) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes));

  const envelope = {
    v: WEB_VERSION,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iter: PBKDF2_ITERATIONS,
    salt: bytesToBase64Url(salt),
    iv: bytesToBase64Url(iv),
    type: meta.type || "text",
    name: meta.name || "secureqr.txt",
    mime: meta.mime || "text/plain;charset=utf-8",
    data: bytesToBase64Url(cipher),
  };
  return `SQR1.${bytesToBase64Url(te.encode(JSON.stringify(envelope)))}`;
}

export async function decryptPayload(payload, password) {
  if (!payload) throw new Error("Empty QR payload.");
  if (payload.startsWith("SQR1.")) return decryptWebPayload(payload, password);
  return decryptLegacyV1(payload, password);
}

async function decryptWebPayload(payload, password) {
  let envelope;
  try { envelope = JSON.parse(td.decode(base64UrlToBytes(payload.slice(5)))); }
  catch { throw new Error("Invalid SecureQR v2 payload."); }
  if (envelope.v !== WEB_VERSION || envelope.alg !== "AES-256-GCM") throw new Error("Unsupported SecureQR payload version.");
  const salt = base64UrlToBytes(envelope.salt);
  const iv = base64UrlToBytes(envelope.iv);
  const cipher = base64UrlToBytes(envelope.data);
  const key = await deriveKey(password, salt, envelope.iter);
  let plain;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher)); }
  catch { throw new Error("Unable to decrypt. Check the password or QR payload."); }
  return { bytes: plain, type: envelope.type, name: envelope.name, mime: envelope.mime, version: "SQR1" };
}

// Backward compatibility with the original Python application:
// outer base64 = salt(16 bytes) + Fernet token; PBKDF2-SHA256 at 100,000 iterations.
async function decryptLegacyV1(payload, password) {
  let packed;
  try { packed = base64UrlToBytes(payload); } catch { throw new Error("Invalid QR payload."); }
  if (packed.length < 17) throw new Error("Invalid legacy payload.");

  const salt = packed.slice(0, 16);
  let tokenBytes = packed.slice(16);
  const keyMaterial = await crypto.subtle.importKey("raw", te.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, keyMaterial, 256));
  const signingKey = derived.slice(0, 16);
  const encryptionKey = derived.slice(16, 32);

  // Fernet token is base64url(text) produced by cryptography.Fernet.
  try {
    tokenBytes = base64UrlToBytes(td.decode(tokenBytes));
  } catch {
    throw new Error("Invalid legacy Fernet payload.");
  }
  if (tokenBytes.length < 1 + 8 + 16 + 16 + 32 || tokenBytes[0] !== 0x80) throw new Error("Unsupported legacy QR format.");

  const signedPart = tokenBytes.slice(0, -32);
  const suppliedHmac = tokenBytes.slice(-32);
  const hmacKey = await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", hmacKey, suppliedHmac, signedPart);
  if (!valid) throw new Error("Unable to decrypt. Check the password or QR payload.");

  const iv = tokenBytes.slice(9, 25);
  const ciphertext = tokenBytes.slice(25, -32);
  const aesKey = await crypto.subtle.importKey("raw", encryptionKey, { name: "AES-CBC" }, false, ["decrypt"]);
  let plain;
  try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv }, aesKey, ciphertext)); }
  catch { throw new Error("Legacy payload could not be decrypted."); }
  return { bytes: plain, type: "legacy", name: "legacy-content", mime: "application/octet-stream", version: "legacy" };
}

export function bytesToText(bytes) { return td.decode(bytes); }
export function bytesFromText(text) { return te.encode(text); }
export function byteLength(text) { return te.encode(text).length; }
