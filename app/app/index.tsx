// index.tsx: screen 01 — the credentials a subject holds, and the one thing to do next.
// Every control here goes somewhere: a row that looks tappable and is not is a
// broken promise, which is what this screen used to be.

import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TabBar, TopBar, Title } from "../src/components.tsx";
import { useFlow } from "../src/domain/flow.ts";
import { color, type } from "../src/theme.ts";
import { purposeLabel } from "../src/domain/purpose.ts";

export default function Home() {
  const flow = useFlow();
  const valid = flow.requestState.status === "ok";

  return (
    <Screen>
      <TopBar left={<Brand />} />
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
        <Row
          icon={<Text>↗</Text>}
          title={valid ? "Una solicitud pendiente" : "Una solicitud que no verifica"}
          scope={valid ? `${purposeLabel(flow.request.purpose)} · vence en 10 min` : flow.requestState.status === "refused" ? flow.requestState.explanation : ""}
          trailing={<Text>›</Text>}
          onPress={() => router.push("/solicitud")}
        />
        <Note>La contraparte pide respuestas.{"\n"}No una copia de tu cédula.</Note>
      </ScrollView>
      <Footer>
        <Button onPress={() => router.push("/solicitud")}>Revisar solicitud →</Button>
      </Footer>
      <TabBar />
    </Screen>
  );
}
