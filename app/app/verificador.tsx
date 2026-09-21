// verificador.tsx: screen 07 — the counterparty's side, with no dossier.
// Integrity, scope and freshness. A revocation copy carries the hour it was
// read, because "offline" never means "up to date".

import { Link } from "expo-router";
import { ScrollView, Text } from "react-native";
import { Badge, Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { REQUEST, VERIFIER_CHECKS } from "../src/fixtures.ts";
import { type as typography } from "../src/theme.ts";

export default function Verificador() {
  return (
    <Screen>
      <TopBar left={<Brand />} right={<Badge>Verificador</Badge>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>{REQUEST.purposeLabel}</Label>
        <Title>Respuestas{"\n"}verificadas.</Title>
        <Body>Resultado de ejemplo. Sin expediente personal en esta vista.</Body>
        <Card tone="deep">
          <Text style={{ ...typography.label, color: "#ccdbce" }}>VERIFICACIÓN OBJETIVO</Text>
          <Text style={{ fontSize: 23, fontWeight: "700", color: "#fff", marginTop: 4 }}>4 respuestas.{"\n"}Un propósito.</Text>
          <Text style={{ ...typography.small, color: "#ccdbce", marginTop: 8 }}>No es una autorización legal para firmar.</Text>
        </Card>
        {VERIFIER_CHECKS.map((check) => (
          <Row key={check.title} icon={<Text>{check.state === "done" ? "✓" : "◷"}</Text>} title={check.title} scope={check.note} />
        ))}
        <Note>Conocer la fecha de consulta importa. “Sin red” no significa “estado actualizado”.</Note>
        <Row title="Detalle técnico" scope="Anclaje opcional · no requerido para validar" trailing={<Text>›</Text>} />
      </ScrollView>
      <Footer>
        <Link href="/revision" asChild>
          <Button>Ver respuestas y alcance</Button>
        </Link>
      </Footer>
      <DemoStamp>DISEÑO OBJETIVO · NO ES VERIFICACIÓN ZK</DemoStamp>
    </Screen>
  );
}
