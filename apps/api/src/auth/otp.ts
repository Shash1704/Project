import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { keys, valkey } from '@pulse/db';
import { env } from '../env';

const OTP_TTL_SEC = 10 * 60;
const MAX_ATTEMPTS = 5;

const hashCode = (email: string, code: string) =>
  createHash('sha256').update(`${email}:${code}:${env.JWT_SECRET}`).digest('hex');

export const emailLoginEnabled = () => !!env.RESEND_API_KEY;

/** Generate a 6-digit code, keep only its hash in Valkey (TTL 10 min), and email it. */
export async function issueOtp(email: string): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await valkey()
    .multi()
    .hset(keys.otp(email), { hash: hashCode(email, code), attempts: '0' })
    .expire(keys.otp(email), OTP_TTL_SEC)
    .exec();
  await sendOtpEmail(email, code);
}

/** Single-use; locks after 5 wrong attempts. */
export async function checkOtp(email: string, code: string): Promise<boolean> {
  const key = keys.otp(email);
  const rec = await valkey().hgetall(key);
  if (!rec.hash) return false;
  if (Number(rec.attempts) >= MAX_ATTEMPTS) {
    await valkey().del(key);
    return false;
  }
  const a = Buffer.from(rec.hash, 'hex');
  const b = Buffer.from(hashCode(email, code), 'hex');
  if (a.length === b.length && timingSafeEqual(a, b)) {
    await valkey().del(key);
    return true;
  }
  await valkey().hincrby(key, 'attempts', 1);
  return false;
}

async function sendOtpEmail(to: string, code: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to,
      subject: `${code} is your Pulse code`,
      text: `Your Pulse sign-in code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this email.`,
      html: `<div style="font-family:system-ui,sans-serif;background:#F8EFC8;padding:32px;border-radius:32px;color:#0B0B0B">
        <p style="margin:0 0 8px">Your Pulse sign-in code</p>
        <p style="font-size:40px;font-weight:600;letter-spacing:8px;margin:0">${code}</p>
        <p style="margin:16px 0 0;opacity:.7">Expires in 10 minutes. If you didn't ask for it, ignore this email.</p></div>`,
    }),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
}
