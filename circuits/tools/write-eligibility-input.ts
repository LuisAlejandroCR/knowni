// write-eligibility-input.ts: prints the witness input for eligibility.circom on
// the curve named on the command line.
//
//   node --experimental-strip-types circuits/tools/write-eligibility-input.ts [bls12381] > input.json

import { eligibilityFixture } from "./eligibility-fixture.ts";

const curve = process.argv[2] === "bls12381" ? "bls12381" : "bn128";
process.stdout.write(`${JSON.stringify(eligibilityFixture(curve).input)}\n`);
