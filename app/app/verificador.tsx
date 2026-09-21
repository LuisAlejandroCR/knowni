// verificador.tsx: screen 07 — the counterparty's side, running the real acceptance.
// The revocation state and the policy are switches on screen, because what a
// counterparty does when it cannot confirm is their decision to make in public.

import { Link } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Badge, Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { currentSession, PREDICATE_LABEL, answerText } from "../src/domain/session.ts";
import { verifyOnDevice, type PolicySetting, type RevocationSetting } from "../src/domain/verifier.ts";
import { color, type as typography } from "../src/theme.ts";

const REVOCATIONS: readonly RevocationSetting[] = ["live", "stale", "unknown", "revoked"];
const LABEL: Record<RevocationSetting, string> = {
  live: "Vigente",
  stale: "Consulta vieja",
  unknown: "Sin dato",
  revoked: "Revocada",
};

export default function Verificador() {
  const session = currentSession();
  const [revocation, setRevocation] = useState<RevocationSetting>("live");
  const [policy, setPolicy] = useState<PolicySetting>("strict");

  // A new presentation id per combination, so switching a control is a new
  // answer arriving and not a replay of the previous one.
  const view = useMemo(
    () =>
      verifyOnDevice(
        session.signed,
        session.results,
        `demo-${revocation}-${policy}`,
        revocation,
        policy,
        Math.floor(Date.now() / 1000),
      ),
    [session, revocation, policy],
  );

  return (
    <Screen>
      <TopBar left={<Brand />} right={<Badge>Verificador</Badge>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>{session.request.purpose}</Label>
        <Title>{view.headline}</Title>
        <Body>{view.explanation}</Body>

        <Card tone={view.accepted ? "deep" : "amber"}>
          <Text style={{ ...typography.label, color: view.accepted ? "#ccdbce" : color.amberInk }}>
            {view.accepted ? "VERIFICADO EN ESTE DISPOSITIVO" : "NO ACEPTADO"}
          </Text>
          {session.answers === undefined ? (
            <Text style={{ color: view.accepted ? "#fff" : color.ink, marginTop: 6 }}>Sin respuestas verificadas.</Text>
          ) : (
            session.answers.map((answer) => (
              <Text key={answer.predicate} style={{ color: view.accepted ? "#fff" : color.ink, marginTop: 6 }}>
                {`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
              </Text>
            ))
          )}
        </Card>

        {view.notes.map((note) => (
          <Note key={note}>{note}</Note>
        ))}

        <Label>Estado de revocación que recibe</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {REVOCATIONS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected: revocation === option }}
              onPress={() => setRevocation(option)}
              style={{
                borderWidth: 1,
                borderColor: revocation === option ? color.deep : color.line,
                backgroundColor: revocation === option ? color.limeSoft : "transparent",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 8,
                minHeight: 44,
                justifyContent: "center",
              }}
            >
              <Text style={typography.small}>{LABEL[option]}</Text>
            </Pressable>
          ))}
        </View>

        <Row
          title={policy === "strict" ? "Política estricta" : "Política tolerante"}
          scope={policy === "strict" ? "Rechaza lo que no pueda confirmar" : "Acepta y deja constancia"}
          trailing={
            <Pressable onPress={() => setPolicy(policy === "strict" ? "tolerant" : "strict")} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: "#294c3e", fontWeight: "700" }}>Cambiar</Text>
            </Pressable>
          }
        />
        <Note>“Sin red” no significa “estado actualizado”. Una firma válida no prueba vigencia de hoy.</Note>
      </ScrollView>
      <Footer>
        <Link href="/revision" asChild>
          <Button>Ver respuestas y alcance</Button>
        </Link>
      </Footer>
      <DemoStamp>ACEPTACIÓN REAL · EMISOR Y CONTRAPARTE DE DEMOSTRACIÓN</DemoStamp>
    </Screen>
  );
}
