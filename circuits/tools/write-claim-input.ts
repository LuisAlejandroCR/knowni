// write-claim-input.ts: prints the witness input for circuits/test/income_main.circom.
//
//   node --experimental-strip-types circuits/tools/write-claim-input.ts > input.json

import { incomeInput } from "./claim-fixture.ts";

process.stdout.write(`${JSON.stringify(incomeInput())}\n`);
