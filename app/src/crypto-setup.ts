// crypto-setup.ts: the first import of the app. Randomness, then crypto.subtle.
// @noble reads globalThis.crypto when imported and Cavos checks crypto.subtle when it
// creates keys; both must exist before any chain code loads (D-87).

import "react-native-get-random-values";
import { installEd25519Subtle } from "./domain/ed25519-subtle.ts";

if (!installEd25519Subtle()) console.warn("crypto-setup: crypto.subtle is still missing; Cavos cannot create keys");
