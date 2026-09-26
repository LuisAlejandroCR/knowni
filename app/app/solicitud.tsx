// solicitud.tsx: screen 02 — who is asking, what for, and until when.
// The subject reads the request before answering; a question they cannot read
// is a question they cannot refuse.

import { Link, router } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { BackButton, Badge, Body, Button, Callout, Card, DemoStamp, Footer, Label, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { REQUEST } from "../src/fixtures.ts";
import { counterpartyLabel, purposeLabel } from "../src/domain/purpose.ts";
import { decline, useFlow } from "../src/domain/flow.ts";
import { expiryText } from "../src/domain/expiry.ts";
import { useNowUnix } from "../src/use-now.ts";
import { type as typography } from "../src/theme.ts";

export default function Solicitud() {
  const session = useFlow();
  const now = useNowUnix();
  // The signed expiry is checked again here: a request read at launch can run out on screen.
  const expired = now >= session.request.expiresAt;

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
            <Badge>{`⏱ ${expiryText(session.request.expiresAt, now)}`}</Badge>
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
        {expired ? (
          <Callout tone="warning" title="Esta solicitud venció">
            Ya no se puede responder. Pide a la contraparte que envíe una nueva.
          </Callout>
        ) : null}
      </ScrollView>
      <Footer>
        <Link href="/consentimiento" asChild>
          <Button disabled={expired}>{expired ? "Solicitud vencida" : "Continuar"}</Button>
        </Link>
        <Button
          tone="secondary"
          onPress={() =>
            Alert.alert("¿Rechazar la solicitud?", "No se consultará ni se enviará nada.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Rechazar",
                style: "destructive",
                onPress: () => {
                  decline();
                  router.replace("/");
                },
              },
            ])
          }
        >
          Rechazar solicitud
        </Button>
      </Footer>
      <DemoStamp>SOLICITUD FIRMADA Y VERIFICADA EN EL DISPOSITIVO</DemoStamp>
    </Screen>
  );
}
