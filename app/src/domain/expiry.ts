// expiry.ts: how long a request has left, in the words a person reads.
// The request carries its own signed expiry; the screen counts down from that
// instead of repeating a fixed "10 min" that stays true forever.

export function expiryText(expiresAt: number, nowUnix: number): string {
  const left = expiresAt - nowUnix;
  if (left <= 0) return "Venció";
  if (left < 60) return "Vence en menos de 1 min";
  return `Vence en ${Math.ceil(left / 60)} min`;
}
