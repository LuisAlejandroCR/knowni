// otp.ts: the six-digit email code, cleaned as it is typed or pasted.
// A paste often carries spaces or a dash; a complete code is the signal to
// sign in without making the person also tap "Entrar".

export const OTP_LENGTH = 6;

export function cleanOtp(text: string): string {
  return text.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function otpComplete(code: string): boolean {
  return code.length === OTP_LENGTH;
}

// A new code can be asked for 30 s after the last one was sent: long enough
// for the email to arrive, short enough that a lost one is not a dead end.
export const RESEND_AFTER_MS = 30_000;

export function resendWaitSeconds(sentAt: number | undefined, now: number): number {
  if (sentAt === undefined) return 0;
  return Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000));
}

// Enough of an address to be worth sending a code to: something@something.tld.
// The server has the last word; this only keeps an obvious typo off the network.
export function looksLikeEmail(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
}
