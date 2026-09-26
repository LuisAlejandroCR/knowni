// emision.tsx: screen 04 — the consultation in progress, per source.
// No invented percentage: the issuer answers once, and until it does the
// screen says exactly that.

import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Body, Button, Callout, Spinner, Card, DemoStamp, Footer, Note, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { useFlow } from "../src/domain/flow.ts";
import { PREDICATE_LABEL, answerText } from "../src/domain/session.ts";
import { sourceLabel } from "../src/domain/sources.ts";

const SLOW_AFTER_S = 20;

export default function Emision() {
  const flow = useFlow();

  // The review screen is where a person decides; this one is a wait, so it
  // hands over as soon as there is something to decide about.
  // Seconds spent waiting, so a slow source reads as slow rather than stuck.
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    if (!flow.busy) return;
    setWaited(0);
    const started = Date.now();
    const timer = setInterval(() => setWaited(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [flow.busy]);

  useEffect(() => {
    if (flow.step === "review") router.replace("/revision");
    if (flow.step === "consent" && flow.error !== undefined) router.replace("/consentimiento");
  }, [flow.step, flow.error]);

  return (
    <Screen>
      <TopBar title="Consultando" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Steps current={3} />
        <View style={{ alignItems: "center" }}>
          <Title>Una consulta.{"\n"}Solo lo necesario.</Title>
          <Body>Aún no compartimos nada con la contraparte.</Body>
        </View>
        <Card>
          {flow.consented.map((source) => (
            <Row
              key={source}
              icon={flow.busy ? <Spinner /> : "✓"}
              title={sourceLabel(source)}
              scope={flow.busy ? "Consultando" : "Consulta terminada"}
            />
          ))}
        </Card>
        {flow.answers === undefined ? null : (
          <Card>
            {flow.answers.map((answer) => (
              <Row
                key={answer.predicate}
                icon={answer.value === "unavailable" ? "!" : "✓"}
                title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
              />
            ))}
          </Card>
        )}
        {flow.busy && waited >= SLOW_AFTER_S ? (
          <Callout tone="warning" title="Está tardando más de lo normal">
            Algunas fuentes públicas responden lento. Puedes esperar aquí; no se comparte nada mientras tanto.
          </Callout>
        ) : null}
        <Note>Si una fuente no responde, verás “Sin respuesta”, nunca “No cumple”.</Note>
      </ScrollView>
      <Footer>
        <Button disabled={flow.busy} loading={flow.busy} onPress={() => router.replace("/revision")}>
          {flow.busy ? `Esperando al emisor… ${waited} s` : "Ver revisión →"}
        </Button>
      </Footer>
      <DemoStamp>EMISIÓN REAL · LAS RESPUESTAS SE VERIFICAN EN ESTE TELÉFONO</DemoStamp>
    </Screen>
  );
}
