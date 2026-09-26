// acuse.tsx: screen 06 — the answer was sent, and that is not a signature.
// Sending is not signing and not eligibility; the copy says both, because a
// screen that lets someone believe otherwise is the failure.

import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { REQUEST } from "../src/fixtures.ts";
import { color, type as typography } from "../src/theme.ts";
import { receiptStamp } from "../src/domain/provenance.ts";
import { useFlow } from "../src/domain/flow.ts";
import { purposeLabel } from "../src/domain/purpose.ts";

export default function Acuse() {
  const flow = useFlow();
  const sharedAt = flow.sharedAt === undefined ? undefined : new Date(flow.sharedAt * 1000);
  const time = sharedAt === undefined ? "—" : `${String(sharedAt.getHours()).padStart(2, "0")}:${String(sharedAt.getMinutes()).padStart(2, "0")}`;
  return (
    <Screen>
      <TopBar left={<Brand />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ height: 85, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: color.limeSoft, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-9deg" }] }}>
            <Text style={{ fontSize: 42, color: "#244e40", transform: [{ rotate: "9deg" }] }}>↗</Text>
          </View>
        </View>
        <Title>Respuesta enviada.{"\n"}Tú conservas{"\n"}el control.</Title>
        <Body>La respuesta va firmada por el emisor. Solo sirve para esta solicitud.</Body>
        <Card>
          <Label>Destino</Label>
          <Text style={typography.heading}>{REQUEST.counterparty}</Text>
          <Row title={purposeLabel(flow.request.purpose)} scope="Finalidad" />
          <Row title={`Compartida · ${time}`} scope="Hora en que la compartiste" trailing={<Text>✓</Text>} />
        </Card>
        <Note>Enviar una respuesta no significa que hayas firmado un contrato.</Note>
        <Body>
          Una nueva solicitud necesita tu aprobación. Una respuesta ya recibida no se puede retirar
          de la memoria del destinatario.
        </Body>
      </ScrollView>
      <Footer>
        <Link href="/" asChild>
          <Button>Volver a mis credenciales</Button>
        </Link>
        <Link href="/verificador" asChild>
          <Button tone="secondary">Ver lado del comprador →</Button>
        </Link>
      </Footer>
      <DemoStamp>{receiptStamp()}</DemoStamp>
    </Screen>
  );
}
