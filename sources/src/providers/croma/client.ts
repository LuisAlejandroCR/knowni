// client.ts: the HTTP client for Croma, the government-data API. Speaks the documented
// contract — 200, 202 + job polling, 502 upstream — and never throws, never lets a raw payload
// cross.

import type { SourceFailureReason } from "../../types.ts";

export const CROMA_BASE_URL = "https://api.croma.run";

// The server is asked to hold the connection open; the contract documents
// Prefer: wait=55, and a 202 is still possible within it.
const PREFER_WAIT_SECONDS = 55;

// A hung job must not hang the app: polling stops at a count, not at a
// promise from the upstream.
const DEFAULT_MAX_POLLS = 10;
const DEFAULT_POLL_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 60_000;
// A 502 from a live upstream (Rama Judicial) is worth retrying; a wall of
// retries against a registry that is down is not.
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 500;

export interface CromaTelemetry {
  readonly path: string;
  readonly status: number;
  readonly attempt: number;
  readonly rateLimit?: {
    readonly limit?: string;
    readonly remaining?: string;
    readonly reset?: string;
  };
}

export interface CromaClientOptions {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  // Injected so the whole client is testable without a network, which is
  // the only way its failure paths get exercised at all.
  readonly fetchImpl?: typeof fetch;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly observe?: (event: CromaTelemetry) => void;
  readonly maxPolls?: number;
  readonly pollIntervalMs?: number;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly backoffMs?: number;
  // The caller's own budget. When it aborts, the client stops: the request in
  // flight is cancelled, no retry is scheduled and no poll waits its turn.
  // Without it a deadline above only stops the *waiting* — the retries went on
  // spending calls on an answer nobody would read. See D-41.
  readonly signal?: AbortSignal;
}

export type CromaOutcome =
  | { readonly status: "data"; readonly data: unknown }
  | { readonly status: "degraded"; readonly reason: SourceFailureReason };

export interface CromaClient {
  call(path: string, body: Record<string, unknown>): Promise<CromaOutcome>;
}

const degrade = (reason: SourceFailureReason): CromaOutcome => ({ status: "degraded", reason });

const TERMINAL = new Set(["completed", "failed", "canceled", "expired"]);

function rateLimitOf(response: Response): CromaTelemetry["rateLimit"] {
  const limit = response.headers.get("X-RateLimit-Limit") ?? undefined;
  const remaining = response.headers.get("X-RateLimit-Remaining") ?? undefined;
  const reset = response.headers.get("X-RateLimit-Reset") ?? undefined;
  if (limit === undefined && remaining === undefined && reset === undefined) return undefined;
  return { limit, remaining, reset };
}

// Retry-After wins over our own interval, in the initial 202 and in every
// poll: the upstream knows its own recovery better than a constant does.
function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header === null) return undefined;
  const seconds = Number(header.trim());
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}

async function readJson(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed: unknown = await response.json();
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function jobStatus(payload: Record<string, unknown> | undefined): string | undefined {
  const job = payload?.job;
  if (typeof job !== "object" || job === null) return undefined;
  const status = (job as Record<string, unknown>).status;
  return typeof status === "string" ? status : undefined;
}

function jobStatusUrl(payload: Record<string, unknown> | undefined): string | undefined {
  const job = payload?.job;
  if (typeof job !== "object" || job === null) return undefined;
  const url = (job as Record<string, unknown>).status_url;
  return typeof url === "string" && url !== "" ? url : undefined;
}

export function createCromaClient(options: CromaClientOptions = {}): CromaClient {
  const baseUrl = (options.baseUrl ?? CROMA_BASE_URL).replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const observe = options.observe ?? (() => {});
  const maxPolls = options.maxPolls ?? DEFAULT_MAX_POLLS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const budget = options.signal;
  const spent = () => budget?.aborted === true;

  // A wait that ends when the budget does. `AbortSignal.any` would do this in
  // one line and does not exist on every runtime this package has to run on.
  const waitUnlessSpent = async (ms: number): Promise<void> => {
    if (spent()) return;
    if (budget === undefined) return await sleep(ms);
    let release = () => {};
    const aborted = new Promise<void>((resolve) => {
      const wake = () => resolve();
      release = () => budget.removeEventListener("abort", wake);
      budget.addEventListener("abort", wake, { once: true });
    });
    try {
      await Promise.race([sleep(ms), aborted]);
    } finally {
      release();
    }
  };

  const headers = {
    Authorization: `Bearer ${options.apiKey ?? ""}`,
    "Content-Type": "application/json",
    Prefer: `wait=${PREFER_WAIT_SECONDS}`,
  };

  async function send(
    url: string,
    init: RequestInit,
    path: string,
    attempt: number,
  ): Promise<Response | undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // The caller's budget aborts this request too, so a call in flight when the
    // deadline passes is cancelled instead of finishing into nobody's hands.
    const giveUp = () => controller.abort();
    budget?.addEventListener("abort", giveUp, { once: true });
    try {
      if (spent()) return undefined;
      const response = await fetchImpl(url, { ...init, headers, signal: controller.signal });
      observe({ path, status: response.status, attempt, rateLimit: rateLimitOf(response) });
      return response;
    } catch {
      // Network error, timeout abort or a fetch that rejected: from out here
      // they are indistinguishable, and equally not an answer.
      observe({ path, status: 0, attempt });
      return undefined;
    } finally {
      clearTimeout(timer);
      budget?.removeEventListener("abort", giveUp);
    }
  }

    function outcomeOf(payload: Record<string, unknown> | undefined): CromaOutcome {
    if (payload === undefined || !("data" in payload)) return degrade("invalid_response");
    const data = payload.data;
    if (data === null || data === undefined) return degrade("not_found");
    return { status: "data", data };
  }

  async function poll(statusUrl: string, path: string, firstWaitMs: number): Promise<CromaOutcome> {
    let waitMs = firstWaitMs;
    for (let attempt = 1; attempt <= maxPolls; attempt += 1) {
      await waitUnlessSpent(waitMs);
      if (spent()) return degrade("source_unavailable");
      const response = await send(statusUrl, { method: "GET" }, path, attempt);
      if (response === undefined) return degrade("source_unavailable");
      const payload = await readJson(response);
      const state = jobStatus(payload);
      if (state !== undefined && TERMINAL.has(state)) {
        // A job that ends in anything but `completed` produced no answer,
        // and its reason is upstream text we do not carry.
        return state === "completed" ? outcomeOf(payload) : degrade("source_unavailable");
      }
      waitMs = retryAfterMs(response) ?? pollIntervalMs;
    }
    // The cap is the point: a job that never finishes degrades like any
    // other unavailable source instead of holding the caller forever.
    return degrade("source_unavailable");
  }

  return {
    async call(path: string, body: Record<string, unknown>): Promise<CromaOutcome> {
      // A missing key is a deployment fault, not a fact about the subject —
      // and still must not throw into a verification.
      if (options.apiKey === undefined || options.apiKey === "") return degrade("consent_missing");
      if (fetchImpl === undefined) return degrade("source_unavailable");
      if (spent()) return degrade("source_unavailable");

      const url = `${baseUrl}${path}`;
      const init: RequestInit = { method: "POST", body: JSON.stringify(body) };

      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        const response = await send(url, init, path, attempt);
        if (response === undefined) {
          if (attempt === maxRetries || spent()) return degrade("source_unavailable");
          await waitUnlessSpent(backoffMs * 2 ** (attempt - 1));
          if (spent()) return degrade("source_unavailable");
          continue;
        }

        if (response.status === 200) return outcomeOf(await readJson(response));

        if (response.status === 202) {
          const payload = await readJson(response);
          const statusUrl = jobStatusUrl(payload);
          if (statusUrl === undefined) return degrade("invalid_response");
          return poll(statusUrl, path, retryAfterMs(response) ?? pollIntervalMs);
        }

        if (response.status === 404) return degrade("not_found");
        // Rejected credentials are the operator's problem, never the
        // subject's, and repeating the call cannot fix them.
        if (response.status === 401 || response.status === 403) return degrade("source_unavailable");

        // 429 and 5xx are the retryable band — 502 upstream_error is the one
        // the contract calls out. Everything else we would only repeat.
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable) return degrade("invalid_response");
        if (attempt === maxRetries || spent()) return degrade("source_unavailable");
        await waitUnlessSpent(retryAfterMs(response) ?? backoffMs * 2 ** (attempt - 1));
        if (spent()) return degrade("source_unavailable");
      }

      return degrade("source_unavailable");
    },
  };
}
