// knowni-prove.rs: proves an eligibility input natively and writes proof.json
// and public.json in snarkjs's shape, for snarkjs to verify independently.
//
//   knowni-prove <input.json> <eligibility.zkey> <out-dir>

use std::{fs, path::Path, time::Instant};

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [input, zkey, out] = args.as_slice() else {
        anyhow::bail!("usage: knowni-prove <input.json> <eligibility.zkey> <out-dir>");
    };

    let prover = knowni_prover::Prover::load(zkey)?;
    let start = Instant::now();
    let proved = prover.prove(&fs::read_to_string(input)?)?;
    eprintln!("proved natively in {} ms", start.elapsed().as_millis());
    anyhow::ensure!(prover.verify(&proved)?, "arkworks rejects its own proof");

    let (body, public) = knowni_prover::to_snarkjs(&proved);
    fs::create_dir_all(out)?;
    fs::write(Path::new(out).join("proof.json"), serde_json::to_string_pretty(&body)?)?;
    fs::write(Path::new(out).join("public.json"), serde_json::to_string_pretty(&public)?)?;
    Ok(())
}
