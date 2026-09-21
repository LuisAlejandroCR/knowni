// revision.tsx: screen 05 — what the counterparty receives, and what it does not.
// The withheld list is the product explaining itself by showing, which is the
// screen the whole design exists for.

import { Link, router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { ANSWERS, REQUEST, WITHHELD } from "../src/fixtures.ts";
import { color, type as typography } from "../src/theme.ts";

export default function Revision() {
  return (
    <Screen>
      <TopBar left={<Pressable onPress={() => router.back()}><Text>←</Text></Pressable>} title="Antes de compartir" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>03 / Revisa tu respuesta</Label>
        <Title>Esto es lo que{"\n"}recibirán.</Title>
        <Body>{`${REQUEST.counterparty}\nSolo para esta ${REQUEST.purposeLabel.toLowerCase()}.`}</Body>
        <Card>
          {ANSWERS.map((answer) => (
            <Row key={answer.answer} icon={<Text>✓</Text>} title={answer.answer} scope={answer.scope} />
          ))}
        </Card>
        <Label>Fuera de la respuesta objetivo</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 8 }}>
          {WITHHELD.map((item) => (
            <Text
              key={item}
              style={{
                ...typography.small,
                color: "#5a685d",
                borderWidth: 1,
                borderColor: color.line,
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}
            >
              {item}
            </Text>
          ))}
        </View>
        <Note>Este resultado no autoriza la firma del contrato ni sustituye sus requisitos legales.</Note>
      </ScrollView>
      <Footer>
        <Link href="/acuse" asChild>
          <Button>Compartir respuesta de demo →</Button>
        </Link>
      </Footer>
      <DemoStamp>ENVÍO REAL BLOQUEADO HASTA CERRAR PRIVACIDAD</DemoStamp>
    </Screen>
  );
}
