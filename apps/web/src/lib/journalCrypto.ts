const encoder = new TextEncoder();
const decoder = new TextDecoder();

const AAD = encoder.encode("vichar-private-diary-v1");
export const JOURNAL_KDF_ITERATIONS = 600_000;

export interface JournalVaultRecord {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  wrapIv: string;
  wrappedKey: string;
}

export interface EncryptedJournalValue {
  version: 1;
  algorithm: "AES-256-GCM";
  iv: string;
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveWrappingKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password.normalize("NFKC")),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createJournalVault(
  password: string,
): Promise<{ vault: JournalVaultRecord; diaryKey: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const rawDiaryKey = crypto.getRandomValues(new Uint8Array(32));
  const wrappingKey = await deriveWrappingKey(password, salt, JOURNAL_KDF_ITERATIONS);
  const wrappedKey = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: wrapIv, additionalData: AAD, tagLength: 128 },
    wrappingKey,
    rawDiaryKey,
  );
  const diaryKey = await crypto.subtle.importKey(
    "raw",
    rawDiaryKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  rawDiaryKey.fill(0);
  return {
    diaryKey,
    vault: {
      version: 1,
      kdf: "PBKDF2-SHA256",
      iterations: JOURNAL_KDF_ITERATIONS,
      salt: bytesToBase64(salt),
      wrapIv: bytesToBase64(wrapIv),
      wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
    },
  };
}

export async function unlockJournalVault(
  password: string,
  vault: JournalVaultRecord,
): Promise<CryptoKey> {
  if (vault.version !== 1 || vault.kdf !== "PBKDF2-SHA256") {
    throw new Error("Unsupported diary encryption format");
  }
  const salt = base64ToBytes(vault.salt);
  const wrappingKey = await deriveWrappingKey(password, salt, vault.iterations);
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(vault.wrapIv),
        additionalData: AAD,
        tagLength: 128,
      },
      wrappingKey,
      base64ToBytes(vault.wrappedKey),
    ),
  );
  if (raw.byteLength !== 32) throw new Error("Invalid diary key");
  const diaryKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  raw.fill(0);
  return diaryKey;
}

export async function encryptJournalValue<T>(
  diaryKey: CryptoKey,
  value: T,
): Promise<EncryptedJournalValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: AAD, tagLength: 128 },
    diaryKey,
    encoder.encode(JSON.stringify(value)),
  );
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptJournalValue<T>(
  diaryKey: CryptoKey,
  encrypted: EncryptedJournalValue,
): Promise<T> {
  if (encrypted.version !== 1 || encrypted.algorithm !== "AES-256-GCM") {
    throw new Error("Unsupported diary entry format");
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(encrypted.iv),
      additionalData: AAD,
      tagLength: 128,
    },
    diaryKey,
    base64ToBytes(encrypted.ciphertext),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export function serializeEncryptedValue(value: EncryptedJournalValue): string {
  return JSON.stringify(value);
}

export function parseEncryptedValue(value: string): EncryptedJournalValue {
  const parsed = JSON.parse(value) as EncryptedJournalValue;
  if (!parsed || parsed.version !== 1 || parsed.algorithm !== "AES-256-GCM") {
    throw new Error("Invalid encrypted diary value");
  }
  return parsed;
}
