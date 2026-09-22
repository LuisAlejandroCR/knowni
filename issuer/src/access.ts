// access.ts: who may call /issue, and how often. Independent of payment — a
// paid request without a valid key is still refused, closing the gap where
// anyone with the URL could spend Croma's quota for free. See docs/memoria.md D-31.

export interface AccessPolicy {
  // One key per relying party. A key that is not in this set is not a caller
  // this service recognizes, paid or not.
  readonly keys: ReadonlySet<string>;
}

export type AccessFailure = "missing_key" | "unknown_key" | "rate_limited";

export type AccessCheck =
  | { readonly status: "allowed" }
  | { readonly status: "refused"; readonly reason: AccessFailure };

// Per-key request budget. A leaked or shared key still can't run the Croma
// quota to zero on its own — it is throttled, not just identified.
export interface RequestQuota {
  consume(key: string, nowUnix: number): boolean;
}

export const DEFAULT_MAX_PER_MINUTE = 20;

export function createMemoryRequestQuota(maxPerMinute: number = DEFAULT_MAX_PER_MINUTE): RequestQuota {
  const windows = new Map<string, { readonly windowStart: number; count: number }>();
  return {
    consume(key, nowUnix) {
      const windowStart = Math.floor(nowUnix / 60);
      const window = windows.get(key);
      if (window === undefined || window.windowStart !== windowStart) {
        windows.set(key, { windowStart, count: 1 });
        return true;
      }
      if (window.count >= maxPerMinute) return false;
      window.count += 1;
      return true;
    },
  };
}

export function checkAccess(
  key: string | undefined,
  policy: AccessPolicy,
  quota: RequestQuota,
  nowUnix: number,
): AccessCheck {
  if (key === undefined || key === "") return { status: "refused", reason: "missing_key" };
  if (!policy.keys.has(key)) return { status: "refused", reason: "unknown_key" };
  if (!quota.consume(key, nowUnix)) return { status: "refused", reason: "rate_limited" };
  return { status: "allowed" };
}
