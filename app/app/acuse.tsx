// acuse.tsx: screen 06 — the answer was sent, and that is not a signature.
// Sending is not signing and not eligibility; the copy says both, because a
// screen that lets someone believe otherwise is the failure.

import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Badge, Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { REQUEST } from "../src/fixtures.ts";
import { color, type as typography } from "../src/theme.ts";

export default function Acuse() {
  return (
    <Screen>
      <TopBar left={<Brand />} right={<Badge>Demo</Badge>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ height: 85, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 80, height: 80, borderRadius: 26, backgroundColor: color.limeSoft, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-9deg" }] }}>
            <Text style={{ fontSize: 42, color: "#244e40", transform: [{ rotate: "9deg" }] }}>↗</Text>
          </View>
        </View>
        <Title>Respuesta enviada.{"\n"}Tú conservas{"\n"}el control.</Title>
        <Body>En el recorrido real, esta confirmación requiere un acuse de recepción.</Body>
        <Card>
          <Label>Destino</Label>
          <Text style={typography.heading}>{REQUEST.counterparty}</Text>
          <Row title={REQUEST.purposeLabel} scope="Finalidad" />
          <Row title="Recibida · 9:41" scope="Estado del ejemplo" trailing={<Text>✓</Text>} />
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
      <DemoStamp>ACUSE SIMULADO · DATOS DE DEMOSTRACIÓN</DemoStamp>
    </Screen>
  );
}
