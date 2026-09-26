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
