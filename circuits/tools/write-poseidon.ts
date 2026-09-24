// write-poseidon.ts: emits circuits/poseidon_knowni.circom on stdout.
// circomlib ships Poseidon constants derived for BN254 and an optimised
// template that consumes them. Compiling that against another field silently
// reinterprets those constants, so this repository generates its own — with
// the generator that reproduces circomlib's BN254 values — and its own
// template, in the plain form the paper describes.
//
// Regenerate with:
//   node --experimental-strip-types circuits/tools/write-poseidon.ts \
//     > circuits/poseidon_knowni.circom
//   node --experimental-strip-types circuits/tools/write-poseidon.ts bls12381 \
//     > circuits/poseidon_knowni_bls12381.circom

import { BLS12_381_PRIME, BN254_PRIME, circomlibSpec, parameters } from "@knowni/core";

/// Every arity the circuits actually instantiate. Generating the rest would be
/// thousands of constants nobody hashes with.
const ARITIES = [2, 3, 10, 11];

/// The curve to derive for. BN254 is what circomlib's own constants are for,
/// so it is the one whose output can be checked against somebody else's; and
/// BLS12-381 is the one Stellar verifies. Pass `bls12381` for the second.
const CURVE = process.argv[2] === "bls12381" ? "bls12381" : "bn128";
const PRIME = CURVE === "bls12381" ? BLS12_381_PRIME : BN254_PRIME;
const BITS = CURVE === "bls12381" ? 255 : 254;

function template(inputs: number): string {
  const spec = circomlibSpec(PRIME, BITS, inputs + 1);
  const { constants, mds } = parameters(spec);
  const t = spec.width;
  const rounds = spec.fullRounds + spec.partialRounds;

  const lines: string[] = [];
  lines.push(`// ${inputs} inputs, state width ${t}, ${spec.fullRounds} full and ${spec.partialRounds} partial rounds.`);
  lines.push(`function POSEIDON_KNOWNI_C_${inputs}() {`);
  lines.push("    return [");
  lines.push(constants.map((value) => `        0x${value.toString(16)}`).join(",\n"));
  lines.push("    ];");
  lines.push("}");
  lines.push(`function POSEIDON_KNOWNI_M_${inputs}() {`);
  lines.push("    return [");
  lines.push(
    mds.map((row) => `        [${row.map((value) => `0x${value.toString(16)}`).join(", ")}]`).join(",\n"),
  );
  lines.push("    ];");
  lines.push("}");
  lines.push(`template PoseidonKnowni${inputs}() {`);
  lines.push(`    signal input inputs[${inputs}];`);
  lines.push("    signal output out;");
  lines.push("");
  lines.push(`    var C[${constants.length}] = POSEIDON_KNOWNI_C_${inputs}();`);
  lines.push(`    var M[${t}][${t}] = POSEIDON_KNOWNI_M_${inputs}();`);
  lines.push("");
  lines.push("    // The constants are vars, not signals: a signal times a signal is a");
  lines.push("    // quadratic term and the mix would stop being one constraint per cell.");
  lines.push(`    signal state[${rounds + 1}][${t}];`);
  lines.push(`    signal added[${rounds}][${t}];`);
  lines.push(`    signal squared[${rounds}][${t}];`);
  lines.push(`    signal quartic[${rounds}][${t}];`);
  lines.push(`    signal sboxed[${rounds}][${t}];`);
  lines.push("");
  lines.push("    // The extra cell starts at zero: circomlib's arrangement, and the one");
  lines.push("    // core/src/poseidon.ts mirrors.");
  lines.push("    state[0][0] <== 0;");
  lines.push(`    for (var i = 1; i < ${t}; i++) {`);
  lines.push("        state[0][i] <== inputs[i - 1];");
  lines.push("    }");
  lines.push("");
  lines.push(`    for (var r = 0; r < ${rounds}; r++) {`);
  lines.push(`        for (var i = 0; i < ${t}; i++) {`);
  lines.push(`            added[r][i] <== state[r][i] + C[r * ${t} + i];`);
  lines.push("        }");
  lines.push("        // A partial round raises only the first cell. That is what makes");
  lines.push("        // Poseidon affordable, and one character away from another hash.");
  lines.push(`        for (var i = 0; i < ${t}; i++) {`);
  lines.push(`            if (i == 0 || (r < ${spec.fullRounds / 2} || r >= ${spec.fullRounds / 2 + spec.partialRounds})) {`);
  lines.push("                squared[r][i] <== added[r][i] * added[r][i];");
  lines.push("                quartic[r][i] <== squared[r][i] * squared[r][i];");
  lines.push("                sboxed[r][i] <== quartic[r][i] * added[r][i];");
  lines.push("            } else {");
  lines.push("                squared[r][i] <== 0;");
  lines.push("                quartic[r][i] <== 0;");
  lines.push("                sboxed[r][i] <== added[r][i];");
  lines.push("            }");
  lines.push("        }");
  lines.push(`        for (var i = 0; i < ${t}; i++) {`);
  lines.push("            var lc = 0;");
  lines.push(`            for (var j = 0; j < ${t}; j++) {`);
  lines.push("                lc += M[i][j] * sboxed[r][j];");
  lines.push("            }");
  lines.push("            state[r + 1][i] <== lc;");
  lines.push("        }");
  lines.push("    }");
  lines.push("");
  lines.push(`    out <== state[${rounds}][0];`);
  lines.push("}");
  return lines.join("\n");
}

const preamble = `// poseidon_knowni${CURVE === "bls12381" ? "_bls12381" : ""}.circom: Poseidon with constants derived for ${CURVE}.
// GENERATED by circuits/tools/write-poseidon.ts. Do not edit: CI regenerates it
// and refuses a file that drifted.
//
// Why not circomlib's: its constants are derived for BN254's field and its
// template is the optimised form built around them. Compiled against another
// field they are still *some* constants, so nothing complains and the result is
// a permutation nobody analysed. See docs/memoria.md D-51.

pragma circom 2.1.6;
`;

process.stdout.write([preamble, ...ARITIES.map(template), ""].join("\n"));
