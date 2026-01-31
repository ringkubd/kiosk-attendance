import { Buffer } from "buffer";

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return Buffer.from(bytes).toString("base64");
}

function utf8ToBytes(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  return Buffer.from(text, "utf8");
}

async function deriveKeyBytes(secret: string): Promise<ArrayBuffer | null> {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (!cryptoObj?.subtle) return null;
  const secretBytes = utf8ToBytes(secret);
  return cryptoObj.subtle.digest("SHA-256", secretBytes);
}

function getRandomIv(length: number): Uint8Array | null {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (!cryptoObj?.getRandomValues) return null;
  const iv = new Uint8Array(length);
  cryptoObj.getRandomValues(iv);
  return iv;
}

export async function encryptEmbeddingsPayload(
  payload: string,
  secret?: string | null,
): Promise<string> {
  if (!secret) {
    return `v0:${toBase64(utf8ToBytes(payload))}`;
  }

  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (!cryptoObj?.subtle) {
    return `v0:${toBase64(utf8ToBytes(payload))}`;
  }

  const keyBytes = await deriveKeyBytes(secret);
  const iv = getRandomIv(12);
  if (!keyBytes || !iv) {
    return `v0:${toBase64(utf8ToBytes(payload))}`;
  }

  const key = await cryptoObj.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const ciphertext = await cryptoObj.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    utf8ToBytes(payload),
  );

  return `v1:${toBase64(iv)}:${toBase64(ciphertext)}`;
}
