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
      nativeProve(inputJson, zkeyPath, zkeySha256)
    }
  }

  companion object {
    init {
      System.loadLibrary("knowni_prover")
    }

    @JvmStatic
    external fun nativeProve(inputJson: String, zkeyPath: String, zkeySha256: String): String
  }
}
