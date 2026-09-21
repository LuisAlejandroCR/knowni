// index.tsx: screen 01 — credentials the subject holds, not a public identity.
// No balance, no network selector, no crypto wallet furniture.

import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Badge, Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { color, type } from "../src/theme.ts";

export default function Home() {
  return (
    <Screen>
      <TopBar left={<Brand />} right={<Badge>Mi espacio</Badge>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>Tú decides qué compartes</Label>
        <Title>Demuestra más.{"\n"}Revela menos.</Title>
        <Body>Demuestra que calificas para firmar, sin decir quién eres.</Body>
        <Card tone="deep">
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "#dcedb0", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Text style={{ fontSize: 32, color: color.deep }}>✓</Text>
          </View>
          <Text style={{ ...type.label, color: "#ccdbce" }}>TUS CREDENCIALES</Text>
          <Text style={{ fontSize: 23, fontWeight: "700", color: "#fff", marginTop: 4 }}>Respuestas bajo{"\n"}tu control.</Text>
          <Text style={{ ...type.body, color: "#ccdbce", marginTop: 8 }}>Revisa cada solicitud antes de responder.</Text>
        </Card>
        <Row icon={<Text>↗</Text>} title="Una solicitud pendiente" scope="Compraventa de vehículo · Demo" trailing={<Text>›</Text>} />
        <Note>La contraparte pide respuestas.{"\n"}No una copia de tu cédula.</Note>
      </ScrollView>
      <Footer>
        <Link href="/solicitud" asChild>
          <Button>Revisar solicitud →</Button>
        </Link>
      </Footer>
      <DemoStamp />
    </Screen>
  );
}
