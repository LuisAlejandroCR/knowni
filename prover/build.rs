// build.rs: transpiles the circuit's witness generator (circom's WASM) to C and
// links it, so the witness is computed natively on any target, curve included.
// The directory holding eligibility.wasm comes from KNOWNI_WITNESS_WASM_DIR.

fn main() {
    let dir = std::env::var("KNOWNI_WITNESS_WASM_DIR")
        .expect("set KNOWNI_WITNESS_WASM_DIR to the folder with eligibility.wasm (circuits/tools/groth16.sh writes it)");
    println!("cargo:rerun-if-env-changed=KNOWNI_WITNESS_WASM_DIR");
    println!("cargo:rerun-if-changed={dir}");
    rust_witness::transpile::transpile_wasm(dir);
}
