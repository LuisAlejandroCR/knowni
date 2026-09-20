// gateway-credits.ts: reads the Vercel AI Gateway credit meter and enforces a
// spend ceiling. Jev is a development tool here, so its bill is checked from
// the repository instead of from a dashboard nobody opens.
//
// Run:  node --experimental-strip-types sources/tools/gateway-credits.ts [--max-used <usd>]

const CREDITS_URL = "https://ai-gateway.vercel.sh/v1/credits";

// Verified against the gateway on 2026-09-20: `typesafe-ai/jev` bills
// $0.000000042 per input token and nothing on output, because an evaluation
// model returns a decision rather than text.
export const JEV_INPUT_USD_PER_TOKEN = 0.000_000_042;

export interface Credits {
  readonly balanceUsd: number;
  readonly usedUsd: number;
}

// The two numbers arrive as strings. Parsing them here rather than at the
// call site means a gateway that starts returning something else fails once,
// loudly, instead of turning a budget check into NaN comparisons that pass.
export function parseCredits(payload: unknown): Credits | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const record = payload as Record<string, unknown>;
  const balanceUsd = Number(record.balance);
  const usedUsd = Number(record.total_used);
  if (!Number.isFinite(balanceUsd) || !Number.isFinite(usedUsd)) return undefined;
  return { balanceUsd, usedUsd };
}

// What a run of N evaluations of roughly M tokens costs, so a batch can be
// priced before it is launched rather than explained afterwards.
export function estimateUsd(calls: number, tokensPerCall: number): number {
  return calls * tokensPerCall * JEV_INPUT_USD_PER_TOKEN;
}

// The ceiling is a hard stop, not a warning: over it, the caller degrades
// and makes no request at all. Same rule the Croma client follows when it
// has no key — an absent budget is not a reason to throw.
export function withinBudget(credits: Credits, maxUsedUsd: number): boolean {
  return credits.usedUsd <= maxUsedUsd && credits.balanceUsd > 0;
}

export async function readCredits(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<Credits | undefined> {
  try {
    const response = await fetchImpl(CREDITS_URL, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!response.ok) return undefined;
    return parseCredits(await response.json());
  } catch {
    return undefined;
  }
}

// Only runs when invoked directly, so the functions above stay importable
// from a test without anyone's key being read. Compared as file URLs because
// argv[1] is a Windows path here and a POSIX one in CI.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  const apiKey = process.env.JEV_VERCEL_API_KEY ?? "";
  if (apiKey === "") {
    console.error("JEV_VERCEL_API_KEY is not set. It lives in .env.local, which is gitignored.");
    process.exit(2);
  }

  const flag = process.argv.indexOf("--max-used");
  const maxUsedUsd = flag === -1 ? Number.POSITIVE_INFINITY : Number(process.argv[flag + 1]);

  const credits = await readCredits(apiKey);
  if (credits === undefined) {
    console.error("the gateway did not answer with a readable credit balance");
    process.exit(2);
  }

  // The key itself is never printed, here or anywhere else.
  console.log(`balance $${credits.balanceUsd.toFixed(4)}  used $${credits.usedUsd.toFixed(4)}`);
  console.log(`1000 evaluations of 1k tokens would cost $${estimateUsd(1000, 1000).toFixed(4)}`);

  if (!withinBudget(credits, maxUsedUsd)) {
    console.error(`over the ceiling of $${maxUsedUsd}: stop spending before running anything else`);
    process.exit(1);
  }
}
