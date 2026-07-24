/**
 * secureStore.js
 * ----------------------------------------------------------------------------
 * Stores sensitive credentials (Delta API key/secret, AI provider key) on disk
 * in ENCRYPTED form only. Nothing here is ever sent to the frontend — the
 * frontend only ever receives a boolean "isConfigured" status.
 *
 * Encryption: AES-256-GCM
 * Key derivation: scrypt(masterPassphrase, salt) -> 32 byte key
 * File format: base64(salt).base64(iv).base64(authTag).base64(ciphertext)
 * ----------------------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "secure-config.enc");

const ALGO = "aes-256-gcm";

function getPassphrase() {
  const pass = process.env.MASTER_ENCRYPTION_PASSPHRASE;
  if (!pass || pass === "change-this-to-a-long-random-string") {
    console.warn(
      "[secureStore] WARNING: Using a placeholder MASTER_ENCRYPTION_PASSPHRASE. " +
        "Set a strong random value in your .env before storing real API keys."
    );
  }
  return pass || "insecure-default-passphrase-please-change";
}

function deriveKey(salt) {
  return crypto.scryptSync(getPassphrase(), salt, 32);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Reads and decrypts the store. Returns {} if it doesn't exist yet. */
function readStore() {
  if (!fs.existsSync(STORE_FILE)) return {};
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8").trim();
    const [saltB64, ivB64, tagB64, dataB64] = raw.split(".");
    const salt = Buffer.from(saltB64, "base64");
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");

    const key = deriveKey(salt);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8"));
  } catch (err) {
    console.error("[secureStore] Failed to read/decrypt store:", err.message);
    return {};
  }
}

/** Encrypts and writes the store to disk. */
function writeStore(obj) {
  ensureDataDir();
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(salt);

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const serialized = [
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");

  fs.writeFileSync(STORE_FILE, serialized, { mode: 0o600 });
}

/** Merge-update a subset of keys (e.g. just "delta" or just "ai") without wiping the rest. */
function update(partial) {
  const current = readStore();
  const next = { ...current, ...partial };
  writeStore(next);
  return next;
}

function get() {
  return readStore();
}

module.exports = { get, update };
