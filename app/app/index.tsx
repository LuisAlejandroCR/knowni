// index.tsx: screen 01 — the credentials a subject holds, and the one thing to do next.
// Every control here goes somewhere: a row that looks tappable and is not is a
// broken promise, which is what this screen used to be.

import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, Text, View } from "react-native";
import { Body, Brand, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TabBar, TopBar, Title } from "../src/components.tsx";
import { useFlow } from "../src/domain/flow.ts";
import { color, type } from "../src/theme.ts";
import { counterpartyLabel, purposeLabel } from "../src/domain/purpose.ts";
import { formatDateTime } from "../src/domain/datetime.ts";
import { expiryText } from "../src/domain/expiry.ts";
import { useNowUnix } from "../src/use-now.ts";

export default function Home() {
  const flow = useFlow();
  const now = useNowUnix();
  const valid = flow.requestState.status === "ok";
  // Once answered, the request is no longer "pending": home says what was done.
  const shared = flow.sharedAt !== undefined;
  const declined = !shared && flow.declinedAt !== undefined;

  return (
    <Screen>
      <TopBar left={<Brand />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>Tú decides qué compartes</Label>
        <Title>Demuestra más.{"\n"}Revela menos.</Title>
        <Body>Demuestra que calificas para firmar, sin decir quién eres.</Body>
        <Card tone="deep">
          <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: color.lime, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Ionicons name="shield-checkmark" size={32} color={color.deep} />
          </View>
          <Text style={{ ...type.label, color: color.onDeepSoft }}>TUS CREDENCIALES</Text>
          <Text style={{ fontSize: 23, fontWeight: "700", color: color.onDeep, marginTop: 4 }}>Respuestas bajo{"\n"}tu control.</Text>
          <Text style={{ ...type.body, color: color.onDeepSoft, marginTop: 8 }}>Revisa cada solicitud antes de responder.</Text>
        </Card>
        {shared ? (
          <>
            <Label>Compartida</Label>
            <Card>
              <Row
                icon="✓"
                title={`Respondiste a ${counterpartyLabel(flow.request.purpose).toLowerCase()}`}
                scope={`${purposeLabel(flow.request.purpose)} · ${formatDateTime(flow.sharedAt)}`}
                trailing="›"
                onPress={() => router.push("/acuse")}
              />
            </Card>
          </>
        ) : null}
        {declined ? (
          <>
            <Label>Rechazada</Label>
            <Card>
              <Row
                icon="✕"
                title="Rechazaste la solicitud"
                scope={`${purposeLabel(flow.request.purpose)} · no se envió nada`}
                trailing="›"
                onPress={() => router.push("/solicitud")}
              />
            </Card>
          </>
        ) : null}
        {shared || declined ? null : <Label>Pendiente</Label>}
        {shared || declined ? null : (
          <Card>
            <Row
              icon="↗"
              title={valid ? "Una solicitud pendiente" : "Una solicitud que no verifica"}
              scope={valid ? `${purposeLabel(flow.request.purpose)} · ${expiryText(flow.request.expiresAt, now).toLowerCase()}` : flow.requestState.status === "refused" ? flow.requestState.explanation : ""}
              trailing="›"
              onPress={() => router.push("/solicitud")}
            />
          </Card>
        )}
        <Note>La contraparte pide respuestas.{"\n"}No una copia de tu cédula.</Note>
      </ScrollView>
      <Footer>
        {shared ? (
          <Button tone="secondary" onPress={() => router.push("/acuse")}>Ver lo que compartiste</Button>
        ) : (
          <Button onPress={() => router.push("/solicitud")}>{declined ? "Volver a verla" : "Revisar solicitud →"}</Button>
        )}
      </Footer>
      <TabBar />
    </Screen>
  );
}
