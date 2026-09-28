import { Resend } from "resend";

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set. Add it to .env.local before sending email.");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
