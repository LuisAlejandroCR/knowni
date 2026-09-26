// solicitud.tsx: screen 02 — who is asking, what for, and until when.
// The subject reads the request before answering; a question they cannot read
// is a question they cannot refuse.

import { Link, router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { BackButton, Badge, Body, Button, Card, DemoStamp, Footer, Label, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { REQUEST } from "../src/fixtures.ts";
import { counterpartyLabel, purposeLabel } from "../src/domain/purpose.ts";
import { useFlow } from "../src/domain/flow.ts";
import { type as typography } from "../src/theme.ts";

export default function Solicitud() {
  const session = useFlow();

  // A request that did not verify is not shown as a question: the screen says
  // what happened and offers no way to answer it.
  if (session.requestState.status === "refused") {
    return (
      <Screen>
        <TopBar left={<BackButton />} title="Solicitud" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
          <Label>No se puede responder</Label>
          <Title>Esta solicitud{"\n"}no es válida.</Title>
          <Body>{session.requestState.explanation}</Body>
        </ScrollView>
        <Footer>
          <Link href="/" asChild>
            <Button>Volver</Button>
          </Link>
        </Footer>
        <DemoStamp>SOLICITUD VERIFICADA EN EL DISPOSITIVO</DemoStamp>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Nueva solicitud" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Steps current={1} />
        <Title>¿Qué necesitan{"\n"}saber de ti?</Title>
        <Card>
          <Text style={{ ...typography.heading }}>{counterpartyLabel(session.request.purpose)}</Text>
          <Row title={purposeLabel(session.request.purpose)} scope="Finalidad" />
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <Badge>{`⏱ Vence en ${REQUEST.expiresInMinutes} min`}</Badge>
          </View>
        </Card>
        <Label>Te preguntan</Label>
        <Card>
          {REQUEST.questions.map((question, index) => (
            <Row
              key={question.title}
              icon={String(index + 1).padStart(2, "0")}
              title={question.title}
              scope={question.scope}
            />
          ))}
        </Card>
      </ScrollView>
      <Footer>
        <Link href="/consentimiento" asChild>
          <Button>Continuar</Button>
        </Link>
        <Link href="/" asChild>
          <Button tone="secondary">Rechazar solicitud</Button>
        </Link>
      </Footer>
      <DemoStamp>SOLICITUD FIRMADA Y VERIFICADA EN EL DISPOSITIVO</DemoStamp>
    </Screen>
  );
}
