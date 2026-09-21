// degradado.tsx: screen 08 — a missing answer is not a judgement.
// A source that did not respond produces "falta una respuesta", never "no
// cumple": a technical failure must not read as a verdict about a person.

import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { DEGRADED } from "../src/fixtures.ts";
import { answerText, PREDICATE_LABEL } from "../src/domain/session.ts";
import { useFlow } from "../src/domain/flow.ts";
import { type as typography } from "../src/theme.ts";

export default function Degradado() {
  // The missing answers are read from the verified envelope, not invented for
  // the screen: "unavailable" is what the issuer signed, and it is not "false".
  const flow = useFlow();
  const missing = (flow.answers ?? []).filter((answer) => answer.value === "unavailable");
  const answered = (flow.answers ?? []).filter((answer) => answer.value !== "unavailable");

  return (
    <Screen>
      <TopBar title="Estado de la consulta" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "#f4dfb4", alignItems: "center", justifyContent: "center", marginTop: 20 }}>
          <Text style={{ fontSize: 32 }}>!</Text>
        </View>
        <Label>Puedes continuar después</Label>
        <Title>Falta una respuesta.{"\n"}No es un rechazo.</Title>
        <Body>La fuente del vehículo no respondió. No sabemos el resultado.</Body>
        <Card tone="amber">
          {missing.length === 0 ? (
            <Row icon={<Text>!</Text>} title={DEGRADED.source} scope={DEGRADED.note} />
          ) : (
            missing.map((answer) => (
              <Row
                key={answer.predicate}
                icon={<Text>!</Text>}
                title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
                scope={answer.doesNotEstimate}
              />
            ))
          )}
          <Text style={{ ...typography.small, marginTop: 8 }}>{DEGRADED.explanation}</Text>
        </Card>
        {answered.map((answer) => (
          <Row
            key={answer.predicate}
            icon={<Text>✓</Text>}
            title={PREDICATE_LABEL[answer.predicate] ?? answer.predicate}
            scope="Se conserva si sigue vigente"
          />
        ))}
        <Note>No enviaremos una respuesta completa mientras falte evidencia requerida.</Note>
      </ScrollView>
      <Footer>
        <Link href="/emision" asChild>
          <Button>Reintentar fuente pendiente</Button>
        </Link>
        <Link href="/" asChild>
          <Button tone="secondary">Volver después</Button>
        </Link>
      </Footer>
      <DemoStamp>ESTADO FIRMADO POR EL EMISOR · UNAVAILABLE ≠ FALSE</DemoStamp>
    </Screen>
  );
}
