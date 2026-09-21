// consentimiento.tsx: screen 03 — consulting is not sharing.
// Nothing is pre-selected: a consent the subject did not tick is a consent
// they did not give, and the button says so until they do.

import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { Body, Button, Card, DemoStamp, Footer, Label, Note, Row, Screen, TopBar, Title } from "../src/components.tsx";
import { CONSENTS } from "../src/fixtures.ts";

export default function Consentimiento() {
  const [granted, setGranted] = useState<readonly string[]>([]);
  const all = granted.length === CONSENTS.length;

  return (
    <Screen>
      <TopBar left={<Pressable onPress={() => router.back()}><Text>←</Text></Pressable>} title="Tu autorización" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Label>02 / Obtén tus credenciales</Label>
        <Title>Consultar no es{"\n"}compartir.</Title>
        <Body>
          El emisor y su proveedor reciben los datos necesarios para consultar. El comprador no
          consulta las fuentes.
        </Body>
        <Card>
          {CONSENTS.map((consent) => {
            const on = granted.includes(consent.source);
            return (
              <Pressable
                key={consent.source}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() =>
                  setGranted((current) =>
                    on ? current.filter((s) => s !== consent.source) : [...current, consent.source],
                  )
                }
              >
                <Row icon={<Text>{on ? "✓" : "□"}</Text>} title={consent.source} scope={consent.needs} />
              </Pressable>
            );
          })}
        </Card>
        <Note>Solo para esta emisión y finalidad.{"\n"}Sin fotos de tu documento.</Note>
      </ScrollView>
      <Footer>
        {all ? (
          <Link href="/emision" asChild>
            <Button>Autorizar y consultar</Button>
          </Link>
        ) : (
          <Button disabled>Selecciona qué autorizas</Button>
        )}
      </Footer>
      <DemoStamp>CONSENTIMIENTOS SIN PRESELECCIONAR</DemoStamp>
    </Screen>
  );
}
