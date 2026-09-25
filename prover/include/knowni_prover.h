// knowni_prover.h: the C interface of the native prover, for Swift.
// knowni_prove takes the witness input as JSON and the zkey path, and returns
// JSON: {"proof","publicSignals"} or {"error"}. Free it with knowni_free_string.

#ifndef KNOWNI_PROVER_H
#define KNOWNI_PROVER_H

char *knowni_prove(const char *input_json, const char *zkey_path);
void knowni_free_string(char *s);

#endif
