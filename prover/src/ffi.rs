// ffi.rs: the one call the phone makes — input JSON, zkey path and the zkey's
// pinned SHA-256 in, a JSON answer out — as C for iOS and JNI for Android. The
// answer is {"proof","publicSignals"} or {"error","code"}; nothing panics across.

use crate::{to_snarkjs, Prover};
use serde_json::{json, Value};
use std::{
    ffi::{c_char, CStr, CString},
    sync::Mutex,
};

/// The zkey is tens of megabytes; reading it per proof would dominate the
/// time. One key is kept, by path, and replaced when another is asked for.
static LOADED: Mutex<Option<(String, Prover)>> = Mutex::new(None);

/// A key file whose digest is not the pinned one. The caller can delete it and
/// fetch it again; no other error is fixed by that.
pub const ZKEY_MISMATCH: &str = "zkey_mismatch";

/// The whole call, as JSON in and JSON out.
pub fn prove_json(input_json: &str, zkey_path: &str, zkey_sha256: &str) -> String {
    let answer = std::panic::catch_unwind(|| prove_value(input_json, zkey_path, zkey_sha256))
        .unwrap_or_else(|_| Err(anyhow::anyhow!("the prover panicked")));
    match answer {
        Ok(value) => value.to_string(),
        Err(error) => {
            let code = if error.downcast_ref::<Mismatch>().is_some() { ZKEY_MISMATCH } else { "prover_error" };
            json!({ "error": error.to_string(), "code": code }).to_string()
        }
    }
}

#[derive(Debug)]
struct Mismatch;

impl std::fmt::Display for Mismatch {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str("the proving key is not the pinned one")
    }
}

impl std::error::Error for Mismatch {}

/// The digest of the whole file, checked before the key is parsed: a key that
/// is not the pinned one proves statements the contract refuses — or, if both
/// were swapped, statements it should never have accepted.
fn check_digest(zkey_path: &str, expected_hex: &str) -> anyhow::Result<()> {
    use sha2::{Digest, Sha256};
    let mut file = std::fs::File::open(zkey_path).map_err(|e| anyhow::anyhow!("opening {zkey_path}: {e}"))?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    let actual: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
    if actual != expected_hex.to_ascii_lowercase() {
        return Err(Mismatch.into());
    }
    Ok(())
}

fn prove_value(input_json: &str, zkey_path: &str, zkey_sha256: &str) -> anyhow::Result<Value> {
    let mut loaded = LOADED.lock().map_err(|_| anyhow::anyhow!("the prover lock is poisoned"))?;
    let key = format!("{zkey_path}#{zkey_sha256}");
    if loaded.as_ref().map(|(k, _)| k.as_str()) != Some(key.as_str()) {
        *loaded = None;
        check_digest(zkey_path, zkey_sha256)?;
        *loaded = Some((key, Prover::load(zkey_path)?));
    }
    let Some((_, prover)) = loaded.as_ref() else {
        anyhow::bail!("no proving key loaded");
    };
    let proved = prover.prove(input_json)?;
    anyhow::ensure!(prover.verify(&proved)?, "the proof does not verify against its own key");
    let (proof, public) = to_snarkjs(&proved);
    Ok(json!({ "proof": proof, "publicSignals": public }))
}


/// # Safety
/// All three arguments must be valid NUL-terminated UTF-8 strings. The result
/// must be released with `knowni_free_string`.
#[no_mangle]
pub unsafe extern "C" fn knowni_prove(
    input_json: *const c_char,
    zkey_path: *const c_char,
    zkey_sha256: *const c_char,
) -> *mut c_char {
    let read = |p: *const c_char| (!p.is_null()).then(|| CStr::from_ptr(p).to_str().ok()).flatten();
    let answer = match (read(input_json), read(zkey_path), read(zkey_sha256)) {
        (Some(input), Some(zkey), Some(digest)) => prove_json(input, zkey, digest),
        _ => json!({ "error": "the arguments are not UTF-8 strings", "code": "prover_error" }).to_string(),
    };
    CString::new(answer).map(CString::into_raw).unwrap_or(std::ptr::null_mut())
}

/// # Safety
/// `s` must come from `knowni_prove` and be released once.
#[no_mangle]
pub unsafe extern "C" fn knowni_free_string(s: *mut c_char) {
    if !s.is_null() {
        drop(CString::from_raw(s));
    }
}

#[cfg(target_os = "android")]
mod android {
    use jni::{
        objects::{JClass, JString},
        sys::jstring,
        JNIEnv,
    };

    /// `expo.modules.knowniprover.KnowniProverModule.nativeProve`.
    #[no_mangle]
    pub extern "system" fn Java_expo_modules_knowniprover_KnowniProverModule_nativeProve(
        mut env: JNIEnv,
        _class: JClass,
        input_json: JString,
        zkey_path: JString,
        zkey_sha256: JString,
    ) -> jstring {
        let mut read = |s: &JString| env.get_string(s).map(String::from).ok();
        let answer = match (read(&input_json), read(&zkey_path), read(&zkey_sha256)) {
            (Some(input), Some(zkey), Some(digest)) => super::prove_json(&input, &zkey, &digest),
            _ => serde_json::json!({ "error": "the arguments are not strings", "code": "prover_error" }).to_string(),
        };
        env.new_string(answer).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_zkey_is_an_error_answer_not_a_crash() {
        let answer: Value = serde_json::from_str(&prove_json("{}", "/no/such.zkey", "00")).unwrap();
        assert!(answer["error"].as_str().unwrap().contains("/no/such.zkey"));
        assert_eq!(answer["code"], "prover_error");
    }

    #[test]
    fn the_c_entry_point_refuses_null_arguments() {
        unsafe {
            let raw = knowni_prove(std::ptr::null(), std::ptr::null(), std::ptr::null());
            let answer = CStr::from_ptr(raw).to_str().unwrap().to_string();
            knowni_free_string(raw);
            assert!(answer.contains("error"));
        }
    }
}
