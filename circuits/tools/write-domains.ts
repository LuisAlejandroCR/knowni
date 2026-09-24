// write-domains.ts: prints circuits/domains.circom on stdout.
// CI pipes it into a diff against the committed file; a contributor who
// changes a domain string runs it and commits what comes out.

import { BN254_PRIME } from "./poseidon-params.ts";
import { domainsCircom } from "./domains.ts";

process.stdout.write(domainsCircom(BN254_PRIME));
