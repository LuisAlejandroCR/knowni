// emision.tsx: screen 04 — progress per source, never a percentage.
// A bar filled with an invented number is a number the screen cannot stand
// behind, so each source reports its own state and nothing is averaged.

import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { ISSUANCE, type SourceState } from "../src/fixtures.ts";

const MARK: Record<SourceState, string> = { done: "✓", waiting: "◌", pending: "·", unavailable: "!" };

export default function Emision() {
  return (
    <Screen>
      <TopBar title="Preparando credenciales" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ alignItems: "center" }}>
          <Title>Una consulta.{"\n"}Solo lo necesario.</Title>
          <Body>Aún no compartimos una respuesta con el comprador.</Body>
        </View>
        <Card>
          {ISSUANCE.map((step) => (
            <Row key={step.source} icon={<Text>{MARK[step.state]}</Text>} title={step.source} scope={step.note} />
          ))}
        </Card>
        <Note>Si una fuente no responde, verás “Sin respuesta”, nunca “No cumple”.</Note>
      </ScrollView>
      <Footer>
        <Link href="/revision" asChild>
          <Button>Ver revisión →</Button>
        </Link>
        <Link href="/degradado" asChild>
          <Button tone="secondary">Ver qué pasa si una fuente falla →</Button>
        </Link>
      </Footer>
      <DemoStamp>ESTADO SIMULADO · SIN CONSULTAS REALES</DemoStamp>
    </Screen>
  );
}
