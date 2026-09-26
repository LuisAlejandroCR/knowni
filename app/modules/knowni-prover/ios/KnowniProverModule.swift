// KnowniProverModule.swift: exposes prove() to JavaScript on iOS. The work is
// in KnowniProver.xcframework (prover/src/ffi.rs, built by build-ios.sh); an
// AsyncFunction runs off the main queue, which matters for a call of seconds.
// Without the xcframework (only macOS builds it) the module still compiles and
// answers `unsupported`, which the app already shows as such.

import ExpoModulesCore
#if canImport(KnowniProverFFI)
import KnowniProverFFI
#endif

public class KnowniProverModule: Module {
  public func definition() -> ModuleDefinition {
    Name("KnowniProver")

    AsyncFunction("prove") { (inputJson: String, zkeyPath: String, zkeySha256: String) -> String in
      #if canImport(KnowniProverFFI)
      guard let raw = knowni_prove(inputJson, zkeyPath, zkeySha256) else {
        return "{\"error\":\"the prover returned nothing\"}"
      }
      defer { knowni_free_string(raw) }
      return String(cString: raw)
      #else
      return "{\"error\":\"this build has no native prover\",\"code\":\"unsupported\"}"
      #endif
    }
  }
}
