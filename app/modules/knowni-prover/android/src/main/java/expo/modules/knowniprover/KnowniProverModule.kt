// KnowniProverModule.kt: exposes prove() to JavaScript on Android. The work is
// in libknowni_prover.so (prover/src/ffi.rs); an AsyncFunction runs off the UI
// thread, which matters for a call that takes seconds.
package expo.modules.knowniprover

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KnowniProverModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KnowniProver")

    AsyncFunction("prove") { inputJson: String, zkeyPath: String, zkeySha256: String ->
      if (loaded) nativeProve(inputJson, zkeyPath, zkeySha256)
      else """{"error":"libknowni_prover.so is not in this build","code":"unsupported"}"""
    }
  }

  companion object {
    // A build without the .so (prover/tools/build-android.sh not run) must
    // still start: the module answers "unsupported" instead of crashing.
    private val loaded: Boolean = try {
      System.loadLibrary("knowni_prover")
      true
    } catch (_: UnsatisfiedLinkError) {
      false
    }

    @JvmStatic
    external fun nativeProve(inputJson: String, zkeyPath: String, zkeySha256: String): String
  }
}
