// knowni_prover.h: the C interface of the native prover, for Swift.
// knowni_prove takes the witness input as JSON, the zkey path and its pinned
// SHA-256 in hex, and returns
// JSON: {"proof","publicSignals"} or {"error","code"}. Free it with knowni_free_string.

#ifndef KNOWNI_PROVER_H
#define KNOWNI_PROVER_H

char *knowni_prove(const char *input_json, const char *zkey_path, const char *zkey_sha256);
void knowni_free_string(char *s);

#endif
