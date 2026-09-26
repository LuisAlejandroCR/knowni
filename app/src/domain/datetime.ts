// datetime.ts: every date a person reads, as dd/mm/yyyy hh:mm on a 24-hour clock.
// Local time of the phone, because that is the clock the person is looking at.

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDateTime(unixSeconds: number | undefined): string {
  if (unixSeconds === undefined) return "—";
  const d = new Date(unixSeconds * 1000);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
