import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as ExpoCrypto from 'expo-crypto';

/** AES-256-GCM via audited @noble/ciphers. Randomness comes from the OS CSPRNG (expo-crypto). */
export const randomBytes = (n: number): Uint8Array => ExpoCrypto.getRandomBytes(n);


export function encryptJson(keyHex: string, value: unknown): string {
  const nonce = randomBytes(12);
  const ct = gcm(hexToBytes(keyHex), nonce).encrypt(utf8ToBytes(JSON.stringify(value)));
  return 'v1:' + bytesToHex(nonce) + ':' + bytesToBase64(ct);
}

export function decryptJson<T>(keyHex: string, blob: string): T {
  const [v, nonceHex, b64] = blob.split(':');
  if (v !== 'v1') throw new Error('Unknown data format');
  const pt = gcm(hexToBytes(keyHex), hexToBytes(nonceHex)).decrypt(base64ToBytes(b64));
  return JSON.parse(bytesToUtf8(pt)) as T;
}

export const newKeyHex = () => bytesToHex(randomBytes(32));

/** Passcode verifier: PBKDF2-HMAC-SHA256, 50k iterations (the verifier itself sits in Keystore-backed storage), 16-byte salt. */
export async function hashPasscode(passcode: string, saltHex = bytesToHex(randomBytes(16))): Promise<string> {
  const dk = await pbkdf2Async(sha256, utf8ToBytes(passcode), hexToBytes(saltHex), { c: 50_000, dkLen: 32 });
  return `pbkdf2$50000$${saltHex}$${bytesToHex(dk)}`;
}

export async function verifyPasscode(passcode: string, stored: string): Promise<boolean> {
  const [, , salt, expected] = stored.split('$');
  const got = (await hashPasscode(passcode, salt)).split('$')[3];
  let diff = got.length ^ expected.length;
  for (let i = 0; i < Math.min(got.length, expected.length); i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bytesToBase64(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=');
  }
  return out;
}
function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out[o++] = (n >> 16) & 255;
    if (i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (i + 3 < clean.length) out[o++] = n & 255;
  }
  return out;
}
