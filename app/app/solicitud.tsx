// solicitud.tsx: screen 02 — who is asking, what for, and until when.
// The subject reads the request before answering; a question they cannot read
// is a question they cannot refuse.

import { Link, router } from "expo-router";
import { Pressable, ScrollView, Text } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Label, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { REQUEST } from "../src/fixtures.ts";
import { type as typography } from "../src/theme.ts";

export default function Solicitud() {
  return (
    <Screen>
      <TopBar left={<Pressable onPress={() => router.back()}><Text>←</Text></Pressable>} title="Nueva solicitud" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>01 / Entiende la solicitud</Label>
        <Title>¿Qué necesitan{"\n"}saber de ti?</Title>
        <Card>
          <Text style={{ ...typography.heading }}>{REQUEST.counterparty}</Text>
          <Text style={{ ...typography.small, marginTop: 4 }}>Destinatario de demostración · CO</Text>
          <Row title={REQUEST.purposeLabel} scope="Finalidad" />
          <Body>{`Solicitud de ejemplo · vence en ${REQUEST.expiresInMinutes} min`}</Body>
        </Card>
        {REQUEST.questions.map((question, index) => (
          <Row
            key={question.title}
            icon={<Text>{String(index + 1).padStart(2, "0")}</Text>}
            title={question.title}
            scope={question.scope}
          />
        ))}
      </ScrollView>
      <Footer>
        <Link href="/consentimiento" asChild>
          <Button>Continuar</Button>
        </Link>
        <Link href="/" asChild>
          <Button tone="secondary">Rechazar solicitud</Button>
        </Link>
      </Footer>
      <DemoStamp />
    </Screen>
  );
}
