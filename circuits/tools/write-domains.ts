// write-domains.ts: prints circuits/domains.circom on stdout, for the curve named
// on the command line. CI pipes it into a diff against the committed file; a
// contributor who changes a domain string runs it and commits what comes out.
//
//   node --experimental-strip-types circuits/tools/write-domains.ts [bls12381]
//
// A domain is a SHA-256 digest reduced into the field, so the element differs
// per curve: the BN254 file compiled with `-p bls12381` gives every hash a
// domain core never uses on that curve.

import { BLS12_381_PRIME, BN254_PRIME } from "./poseidon-params.ts";
import { domainsCircom } from "./domains.ts";

const bls = process.argv[2] === "bls12381";
process.stdout.write(domainsCircom(bls ? BLS12_381_PRIME : BN254_PRIME));
