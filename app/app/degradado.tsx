// degradado.tsx: screen 08 — a missing answer is not a judgement.
// A source that did not respond produces "falta una respuesta", never "no
// cumple": a technical failure must not read as a verdict about a person.

import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TabBar, Title, TopBar } from "../src/components.tsx";
import { DEGRADED } from "../src/fixtures.ts";
import { answerText, PREDICATE_LABEL, RETRYABLE_STATES, sourceStateText } from "../src/domain/session.ts";
import { useFlow } from "../src/domain/flow.ts";
import { color, type as typography } from "../src/theme.ts";

export default function Degradado() {
  // The missing answers are read from the verified envelope, not invented for
  // the screen: "unavailable" is what the issuer signed, and it is not "false".
  const flow = useFlow();
  const missing = (flow.answers ?? []).filter((answer) => answer.value === "unavailable");
  const answered = (flow.answers ?? []).filter((answer) => answer.value !== "unavailable");
  // Why each one is missing, as the issuer said it beside the signed answers.
  // Without this the screen can only say "sin respuesta" to every cause, which
  // is the conflation A7 refuses.
  const stateOf = (predicate: string) =>
    flow.sourceStates.find((entry) => entry.predicate === predicate)?.state;
  const retryable = flow.sourceStates.some(
    (entry) => entry.state !== "answered" && RETRYABLE_STATES.includes(entry.state),
  );

  return (
    <Screen>
      <TopBar title="Estado de la consulta" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "#ffe4ad", alignItems: "center", justifyContent: "center", marginTop: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 32, fontWeight: "800", color: color.amberInk }}>!</Text>
        </View>
        <Label>Puedes continuar después</Label>
        <Title>Falta una respuesta.{"\n"}No es un rechazo.</Title>
        <Body>La fuente del vehículo no respondió. No sabemos el resultado.</Body>
        <Card tone="amber">
          {missing.length === 0 ? (
            <Row icon="!" title={DEGRADED.source} scope={DEGRADED.note} />
          ) : (
            missing.map((answer) => {
              const state = stateOf(answer.predicate);
              return (
                <Row
                  key={answer.predicate}
                  icon="!"
                  title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
                  scope={state === undefined ? answer.doesNotEstimate : sourceStateText(state)}
                />
              );
            })
          )}
          <Text style={{ ...typography.small, color: color.amberInk, marginTop: 8 }}>{DEGRADED.explanation}</Text>
        </Card>
        {answered.length === 0 ? null : <Label>Lo que sí se obtuvo</Label>}
        {answered.length === 0 ? null : (
          <Card>
            {answered.map((answer) => (
              <Row
                key={answer.predicate}
                icon="✓"
                title={PREDICATE_LABEL[answer.predicate] ?? answer.predicate}
                scope="Se conserva si sigue vigente"
              />
            ))}
          </Card>
        )}
        <Note>No enviaremos una respuesta completa mientras falte evidencia requerida.</Note>
      </ScrollView>
      <Footer>
        {retryable ? (
          <Link href="/emision" asChild>
            <Button>Reintentar fuente pendiente</Button>
          </Link>
        ) : null}
        <Link href="/" asChild>
          <Button tone="secondary">Volver después</Button>
        </Link>
      </Footer>
      <DemoStamp>ESTADO FIRMADO POR EL EMISOR · UNAVAILABLE ≠ FALSE</DemoStamp>
      <TabBar />
    </Screen>
  );
}
