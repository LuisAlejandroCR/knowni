// verificador.tsx: screen 07 — the counterparty's side, running the real acceptance.
// The revocation state and the policy are switches on screen, because what a
// counterparty does when it cannot confirm is their decision to make in public.

import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Switch, View } from "react-native";
import { BackButton, Badge, Body, Button, Callout, Card, DemoStamp, Footer, Label, Note, Row, Screen, TabBar, Title, TopBar } from "../src/components.tsx";
import { PREDICATE_LABEL, answerText } from "../src/domain/session.ts";
import { useFlow } from "../src/domain/flow.ts";
import { receivedAt, requiredFor, verifyOnDevice, type PolicySetting, type RevocationSetting } from "../src/domain/verifier.ts";
import { color } from "../src/theme.ts";
import { acceptanceStamp, issuerKeyChanged } from "../src/domain/provenance.ts";
import { servedIssuerKey } from "../src/domain/issuer-client.ts";

const REVOCATIONS: readonly RevocationSetting[] = ["live", "stale", "unknown", "revoked"];
const LABEL: Record<RevocationSetting, string> = {
  live: "Vigente",
  stale: "Consulta vieja",
  unknown: "Sin dato",
  revoked: "Revocada",
};

export default function Verificador() {
  const session = useFlow();
  const [revocation, setRevocation] = useState<RevocationSetting>("live");
  const [policy, setPolicy] = useState<PolicySetting>("strict");

  // A new presentation id per combination, so switching a control is a new
  // answer arriving and not a replay of the previous one.
  // Nothing to verify until the issuer has answered: the screen says so
  // instead of running an acceptance over an empty envelope.
  const view = useMemo(
    () =>
      session.results === undefined
        ? undefined
        : verifyOnDevice(
        session.signed,
        session.results,
        `demo-${revocation}-${policy}`,
        revocation,
        policy,
        receivedAt(session.sharedAt, Math.floor(Date.now() / 1000)),
        requiredFor(session.consented),
        issuerKeyChanged(process.env.EXPO_PUBLIC_ISSUER_PUBLIC_KEY, servedIssuerKey(session.issuer)),
      ),
    [session, revocation, policy],
  );

  if (view === undefined) {
    return (
      <Screen>
        <TopBar left={<BackButton />} title="Verificador" right={<Badge>Contraparte</Badge>} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
          <Title>Sin respuestas{"\n"}que verificar.</Title>
          <Body>El titular todavía no ha compartido nada con esta contraparte.</Body>
        </ScrollView>
        <Footer>
          <Link href="/" asChild>
            <Button>Volver</Button>
          </Link>
        </Footer>
        <DemoStamp>ACEPTACIÓN REAL · SIN ENVOLTORIO TODAVÍA</DemoStamp>
        <TabBar />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Verificador" right={<Badge>Contraparte</Badge>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>{session.request.purpose}</Label>
        <Title>{view.headline}</Title>
        <Body>{view.explanation}</Body>

        <Callout
          tone={view.accepted ? "success" : "warning"}
          title={view.accepted ? "Verificado en este dispositivo" : "No aceptado"}
        />
        <Card>
          {session.answers === undefined ? (
            <Row icon="□" title="Sin respuestas verificadas" />
          ) : (
            session.answers.map((answer) => (
              <Row
                key={answer.predicate}
                icon={answer.value === "unavailable" ? "!" : "✓"}
                title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
              />
            ))
          )}
        </Card>

        {view.notes.map((note) => (
          <Note key={note}>{note}</Note>
        ))}

        <Label>Estado de revocación que recibe</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {REVOCATIONS.map((option) => (
            <Badge key={option} selected={revocation === option} onPress={() => setRevocation(option)}>
              {LABEL[option]}
            </Badge>
          ))}
        </View>

        <Row
          title={policy === "strict" ? "Política estricta" : "Política tolerante"}
          scope={policy === "strict" ? "Rechaza lo que no pueda confirmar" : "Acepta y deja constancia"}
          trailing={
            <Switch
              accessibilityLabel="Política estricta"
              value={policy === "strict"}
              onValueChange={(strict) => setPolicy(strict ? "strict" : "tolerant")}
              trackColor={{ true: color.deep, false: color.line }}
              thumbColor={color.card}
            />
          }
        />
        <Note>“Sin red” no significa “estado actualizado”. Una firma válida no prueba vigencia de hoy.</Note>
      </ScrollView>
      <Footer>
        <Link href="/revision" asChild>
          <Button>Ver respuestas y alcance</Button>
        </Link>
      </Footer>
      <DemoStamp>{acceptanceStamp()}</DemoStamp>
      <TabBar />
    </Screen>
  );
}
