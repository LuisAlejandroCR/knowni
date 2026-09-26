// emision.tsx: screen 04 — the consultation in progress, per source.
// No invented percentage: the issuer answers once, and until it does the
// screen says exactly that.

import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Note, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { useFlow } from "../src/domain/flow.ts";
import { PREDICATE_LABEL, answerText } from "../src/domain/session.ts";
import { sourceLabel } from "../src/domain/sources.ts";

export default function Emision() {
  const flow = useFlow();

  // The review screen is where a person decides; this one is a wait, so it
  // hands over as soon as there is something to decide about.
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
              icon={<Text>{flow.busy ? "◌" : "✓"}</Text>}
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
                icon={<Text>{answer.value === "unavailable" ? "!" : "✓"}</Text>}
                title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
              />
            ))}
          </Card>
        )}
        <Note>Si una fuente no responde, verás “Sin respuesta”, nunca “No cumple”.</Note>
      </ScrollView>
      <Footer>
        <Button disabled={flow.busy} onPress={() => router.replace("/revision")}>
          {flow.busy ? "Esperando al emisor…" : "Ver revisión →"}
        </Button>
      </Footer>
      <DemoStamp>EMISIÓN REAL · LAS RESPUESTAS SE VERIFICAN EN ESTE TELÉFONO</DemoStamp>
    </Screen>
  );
}
