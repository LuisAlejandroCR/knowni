// revision.tsx: screen 05 — what the counterparty receives, and what it does not.
// The withheld list is the product explaining itself by showing, which is the
// screen the whole design exists for.

import { Link, router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { REQUEST, WITHHELD } from "../src/fixtures.ts";
import { answerText, PREDICATE_LABEL } from "../src/domain/session.ts";
import { useFlow } from "../src/domain/flow.ts";
import { color, type as typography } from "../src/theme.ts";

export default function Revision() {
  const { answers } = useFlow();

  // No verified answers means nothing to show. A screen that renders what it
  // could not check is a screen that can be lied to.
  if (answers === undefined) {
    return (
      <Screen>
        <TopBar title="Antes de compartir" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
          <Title>No pudimos{"\n"}verificar la respuesta.</Title>
          <Body>No se enviará nada. Pide una solicitud nueva.</Body>
        </ScrollView>
        <Footer>
          <Link href="/" asChild>
            <Button>Volver</Button>
          </Link>
        </Footer>
        <DemoStamp>NADA SE COMPARTE SIN VERIFICAR</DemoStamp>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar left={<Pressable onPress={() => router.back()}><Text>←</Text></Pressable>} title="Antes de compartir" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Steps current={4} />
        <Title>Esto es lo que{"\n"}recibirán.</Title>
        <Body>{`${REQUEST.counterparty}\nSolo para esta ${REQUEST.purposeLabel.toLowerCase()}.`}</Body>
        <Card>
          {answers.map((answer) => (
            <Row
              key={answer.predicate}
              icon={<Text>{answer.value === "unavailable" ? "!" : "✓"}</Text>}
              title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
              scope={answer.doesNotEstimate}
            />
          ))}
        </Card>
        <Label>Fuera de la respuesta objetivo</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 8 }}>
          {WITHHELD.map((item) => (
            <Text
              key={item}
              style={{
                ...typography.small,
                color: "#5a685d",
                borderWidth: 1,
                borderColor: color.line,
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}
            >
              {item}
            </Text>
          ))}
        </View>
        <Note>Este resultado no autoriza la firma del contrato ni sustituye sus requisitos legales.</Note>
      </ScrollView>
      <Footer>
        <Link href="/acuse" asChild>
          <Button>Compartir con la contraparte de prueba →</Button>
        </Link>
      </Footer>
      <DemoStamp>RESPUESTAS FIRMADAS Y VERIFICADAS · ENVÍO REAL BLOQUEADO</DemoStamp>
    </Screen>
  );
}
