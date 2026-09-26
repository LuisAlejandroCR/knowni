// celebration.ts: when finishing the journey earns confetti and a haptic tap.
// Only when a source answered with evidence: an all-"sin respuesta" outcome is
// not a success, and celebrating it would say the opposite of the screen.

import type { AttestedAnswer } from "@knowni/attestation";

export function shouldCelebrate(answers: readonly AttestedAnswer[] | undefined): boolean {
  return (answers ?? []).some((answer) => answer.value !== "unavailable");
}
