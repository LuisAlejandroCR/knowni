// ffi.rs: the one call the phone makes — input JSON and zkey path in, a JSON
// answer out — as a C function for iOS and a JNI function for Android. The
// answer is {"proof","publicSignals"} or {"error"}; nothing here panics across.

use crate::{to_snarkjs, Prover};
use serde_json::{json, Value};
use std::{
    ffi::{c_char, CStr, CString},
    sync::Mutex,
};

/// The zkey is tens of megabytes; reading it per proof would dominate the
/// time. One key is kept, by path, and replaced when another is asked for.
static LOADED: Mutex<Option<(String, Prover)>> = Mutex::new(None);

/// The whole call, as JSON in and JSON out.
pub fn prove_json(input_json: &str, zkey_path: &str) -> String {
    let answer = std::panic::catch_unwind(|| prove_value(input_json, zkey_path))
        .unwrap_or_else(|_| Err(anyhow::anyhow!("the prover panicked")));
    match answer {
        Ok(value) => value.to_string(),
        Err(error) => json!({ "error": error.to_string() }).to_string(),
    }
}

fn prove_value(input_json: &str, zkey_path: &str) -> anyhow::Result<Value> {
    let mut loaded = LOADED.lock().map_err(|_| anyhow::anyhow!("the prover lock is poisoned"))?;
    if loaded.as_ref().map(|(path, _)| path.as_str()) != Some(zkey_path) {
        *loaded = Some((zkey_path.to_string(), Prover::load(zkey_path)?));
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
/// Both arguments must be valid NUL-terminated UTF-8 strings. The result must
/// be released with `knowni_free_string`.
#[no_mangle]
pub unsafe extern "C" fn knowni_prove(input_json: *const c_char, zkey_path: *const c_char) -> *mut c_char {
    let read = |p: *const c_char| (!p.is_null()).then(|| CStr::from_ptr(p).to_str().ok()).flatten();
    let answer = match (read(input_json), read(zkey_path)) {
        (Some(input), Some(zkey)) => prove_json(input, zkey),
        _ => json!({ "error": "the arguments are not UTF-8 strings" }).to_string(),
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
    ) -> jstring {
        let mut read = |s: &JString| env.get_string(s).map(String::from).ok();
        let answer = match (read(&input_json), read(&zkey_path)) {
            (Some(input), Some(zkey)) => super::prove_json(&input, &zkey),
            _ => serde_json::json!({ "error": "the arguments are not strings" }).to_string(),
        };
        env.new_string(answer).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_zkey_is_an_error_answer_not_a_crash() {
        let answer: Value = serde_json::from_str(&prove_json("{}", "/no/such.zkey")).unwrap();
        assert!(answer["error"].as_str().unwrap().contains("/no/such.zkey"));
    }

    #[test]
    fn the_c_entry_point_refuses_null_arguments() {
        unsafe {
            let raw = knowni_prove(std::ptr::null(), std::ptr::null());
            let answer = CStr::from_ptr(raw).to_str().unwrap().to_string();
            knowni_free_string(raw);
            assert!(answer.contains("error"));
        }
    }
}
