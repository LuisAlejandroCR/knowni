// prueba.tsx: proves the eligibility circuit on this phone over example data,
// and says how long it took. A test bench for the physical-device run, not
// part of the verification journey — the stamp says so on screen.

import { useState } from "react";
import { ScrollView } from "react-native";
import { Body, Button, Callout, DemoStamp, Footer, Note, Screen, TabBar, Title, TopBar } from "../src/components.tsx";
import { runDeviceProof, type DeviceProofResult } from "../src/domain/device-proof.ts";
import { createNativeProver } from "../src/domain/prover.ts";
import { ZKEY_URL } from "../src/domain/proving-key.ts";
import { deviceKeyFiles } from "../src/domain/proving-key-files.ts";
import { PROOF_FIXTURE_INPUT, PROOF_FIXTURE_OUTPUTS } from "../src/proof-fixture.ts";
import KnowniProver from "../modules/knowni-prover/index.ts";

const MESSAGE: Record<Exclude<DeviceProofResult["kind"], "proved">, string> = {
  unsupported: "Esta versión no trae el prover nativo (Expo Go o web). Hace falta una build de desarrollo.",
  no_source: "Esta build no sabe de dónde descargar la llave de prueba.",
  download_failed: "No se pudo descargar la llave de prueba (21 MB). Revisa la conexión y vuelve a intentar.",
  wrong_statement: "Se generó una prueba, pero no dice lo que el ejemplo debería decir.",
  failed: "El prover no pudo generar la prueba.",
};

export default function Prueba() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DeviceProofResult | undefined>();

  const run = async () => {
    setBusy(true);
    setResult(undefined);
    try {
      setResult(
        await runDeviceProof(
          createNativeProver(KnowniProver),
          deviceKeyFiles(),
          PROOF_FIXTURE_INPUT,
          PROOF_FIXTURE_OUTPUTS,
          ZKEY_URL,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Prueba en el dispositivo" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Title>Groth16 en{"\n"}este teléfono.</Title>
        <Body>
          Genera y verifica una prueba del circuito de elegibilidad sobre BLS12-381, la curva que Stellar verifica.
          La primera vez descarga la llave de prueba (21 MB).
        </Body>
        {result?.kind === "proved" && (
          <Callout tone="success" title={`Prueba generada y verificada en ${(result.millis / 1000).toFixed(1)} s.`}>
            {`Persona ${result.outputs[0]} · solvencia ${result.outputs[1]} · formalidad ${result.outputs[2]} · sanciones ${result.outputs[3]}`}
          </Callout>
        )}
        {result !== undefined && result.kind !== "proved" && (
          <Callout tone="warning" title={MESSAGE[result.kind]} />
        )}
        <Note>Datos de ejemplo inventados: ninguna persona real detrás. Llave de desarrollo, no de producción.</Note>
      </ScrollView>
      <Footer>
        <Button onPress={run} disabled={busy} loading={busy}>{busy ? "Probando…" : "Generar prueba"}</Button>
      </Footer>
      <DemoStamp>BANCO DE PRUEBA · DATOS DE EJEMPLO</DemoStamp>
      <TabBar />
    </Screen>
  );
}
