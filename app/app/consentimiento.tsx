// consentimiento.tsx: screen 03 — what will be consulted, and with what data.
// Nothing is pre-ticked, and the document is typed here because it travels to
// the issuer and to nobody else.

import { router } from "expo-router";
import { Pressable, ScrollView, Text } from "react-native";
import { Body, Button, Card, DemoStamp, Field, Footer, Label, Note, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { setSubject, toggleConsent, useFlow, issue } from "../src/domain/flow.ts";

const SOURCES = [
  { id: "registraduria", title: "Registraduría", needs: "Número de documento" },
  { id: "sicaac", title: "SICAAC · insolvencia", needs: "Número de documento" },
  { id: "listas", title: "Procuraduría, Contraloría y Contaduría", needs: "Número de documento" },
  { id: "vehiculo", title: "RUNT y SIMIT", needs: "Placa y documento del propietario" },
] as const;

export default function Consentimiento() {
  const flow = useFlow();
  const needsPlate = flow.consented.includes("vehiculo");
  const ready =
    flow.consented.length > 0 &&
    flow.subject.documentNumber.length >= 5 &&
    (!needsPlate || flow.subject.plate.length >= 5);

  return (
    <Screen>
      <TopBar left={<Pressable onPress={() => router.back()}><Text>←</Text></Pressable>} title="Tu autorización" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Steps current={2} />
        <Title>Consultar no es{"\n"}compartir.</Title>
        <Body>
          El emisor consulta con estos datos. La contraparte no los recibe y no consulta nada.
        </Body>

        <Card>
          {SOURCES.map((source) => {
            const on = flow.consented.includes(source.id);
            return (
              <Row
                key={source.id}
                icon={<Text>{on ? "✓" : "□"}</Text>}
                title={source.title}
                scope={source.needs}
                onPress={() => toggleConsent(source.id)}
              />
            );
          })}
        </Card>

        <Field
          label="Número de documento"
          value={flow.subject.documentNumber}
          onChangeText={(text) => setSubject({ documentNumber: text.replace(/\D/g, "") })}
          placeholder="1020304050"
          keyboardType="number-pad"
        />
        {needsPlate ? (
          <Field
            label="Placa del vehículo"
            value={flow.subject.plate}
            onChangeText={(text) => setSubject({ plate: text.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
            placeholder="ABC123"
          />
        ) : null}

        {flow.error === undefined ? null : <Note>{flow.error}</Note>}
        <Note>Solo para esta emisión y finalidad. Sin fotos de tu documento.</Note>
      </ScrollView>
      <Footer>
        <Button
          disabled={!ready || flow.busy}
          onPress={() => {
            router.push("/emision");
            void issue();
          }}
        >
          {ready ? "Autorizar y consultar" : "Selecciona qué autorizas"}
        </Button>
      </Footer>
      <DemoStamp>CONSULTA REAL A LAS FUENTES AUTORIZADAS</DemoStamp>
    </Screen>
  );
}
