import { createHash, randomInt } from "node:crypto";

const UID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function createUid(length = 25): string {
  let out = "";
  const max = UID_ALPHABET.length;
  for (let i = 0; i < length; i++) {
    out += UID_ALPHABET[randomInt(max)];
  }
  return out;
}

export function hashUid(uid: string, apiKey2: string): string {
  return createHash("sha256").update(uid + apiKey2).digest("hex");
}
