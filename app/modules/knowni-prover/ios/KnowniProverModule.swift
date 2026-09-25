// KnowniProverModule.swift: exposes prove() to JavaScript on iOS. The work is
// in KnowniProver.xcframework (prover/src/ffi.rs, built by build-ios.sh); an
// AsyncFunction runs off the main queue, which matters for a call of seconds.

import ExpoModulesCore
import KnowniProverFFI

public class KnowniProverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KnowniProver")

    AsyncFunction("prove") { (inputJson: String, zkeyPath: String) -> String in
      guard let raw = knowni_prove(inputJson, zkeyPath) else {
        return "{\"error\":\"the prover returned nothing\"}"
      }
      defer { knowni_free_string(raw) }
      return String(cString: raw)
    }
  }
}
