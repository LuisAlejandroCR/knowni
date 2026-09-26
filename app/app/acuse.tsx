// acuse.tsx: screen 06 — the answer was sent, and that is not a signature.
// Sending is not signing and not eligibility; the copy says both, because a
// screen that lets someone believe otherwise is the failure.

import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, Text, View } from "react-native";
import { BackButton, Body, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TabBar, Title, TopBar } from "../src/components.tsx";
import { color, type as typography } from "../src/theme.ts";
import { useFlow } from "../src/domain/flow.ts";
import { counterpartyLabel, purposeLabel } from "../src/domain/purpose.ts";
import { shouldCelebrate } from "../src/domain/celebration.ts";
import { Confetti } from "../src/confetti.tsx";
import { successTap } from "../src/haptics.ts";
import { useEffect } from "react";
import { formatDateTime } from "../src/domain/datetime.ts";

export default function Acuse() {
  const flow = useFlow();
  const celebrate = shouldCelebrate(flow.answers);
  // Once, on arrival: the journey ended with at least one answer backed by evidence.
  useEffect(() => {
    if (celebrate) void successTap();
  }, [celebrate]);
  const time = formatDateTime(flow.sharedAt);
  return (
    <Screen>
      <TopBar left={<BackButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ height: 85, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: color.limeSoft, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-9deg" }] }}>
            <View style={{ transform: [{ rotate: "9deg" }] }}>
              <Ionicons name="paper-plane" size={38} color={color.deep} />
            </View>
          </View>
        </View>
        <Title>Respuesta enviada.{"\n"}Tú conservas{"\n"}el control.</Title>
        <Body>La respuesta va firmada por el emisor. Solo sirve para esta solicitud.</Body>
        <Card>
          <Label>Destino</Label>
          <Text style={{ ...typography.heading, color: color.ink }}>{counterpartyLabel(flow.request.purpose)}</Text>
          <Row title={purposeLabel(flow.request.purpose)} scope="Finalidad" />
          <Row title={`Compartida · ${time}`} scope="Hora en que la compartiste" trailing="✓" />
        </Card>
        <Note>Enviar una respuesta no significa que hayas firmado un contrato.</Note>
        <Body>
          Una nueva solicitud necesita tu aprobación. Una respuesta ya recibida no se puede retirar
          de la memoria del destinatario.
        </Body>
      </ScrollView>
      <Footer>
        <Link href="/" asChild>
          <Button>Volver al inicio</Button>
        </Link>
        <Link href="/espacio" asChild>
          <Button tone="secondary">Ver en mi historial</Button>
        </Link>
        <Link href="/verificador" asChild>
          <Button tone="secondary">{`Ver lado del ${counterpartyLabel(flow.request.purpose).toLowerCase()} →`}</Button>
        </Link>
      </Footer>
      {celebrate ? <Confetti /> : null}
      <TabBar />
    </Screen>
  );
}
