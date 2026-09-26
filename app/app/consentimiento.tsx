// consentimiento.tsx: screen 03 — what will be consulted, and with what data.
// Nothing is pre-ticked, and the document is typed here because it travels to
// the issuer and to nobody else.

import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { BackButton, Badge, Body, Button, Card, DemoStamp, Field, Footer, Label, Note, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { setConsent, setSubject, toggleConsent, useFlow, issue } from "../src/domain/flow.ts";
import { DOCUMENT_KINDS, cleanDocumentNumber } from "../src/domain/document.ts";
import { MIN_DOCUMENT_LENGTH, MIN_PLATE_LENGTH, consentBlocker } from "../src/domain/consent.ts";

const SOURCES = [
  { id: "registraduria", title: "Registraduría", needs: "Número de documento" },
  { id: "sicaac", title: "SICAAC · insolvencia", needs: "Número de documento" },
  { id: "listas", title: "Procuraduría, Contraloría y Contaduría", needs: "Número de documento" },
  { id: "vehiculo", title: "RUNT y SIMIT", needs: "Placa y documento del propietario" },
] as const;

export default function Consentimiento() {
  const flow = useFlow();
  const numeric = flow.subject.documentKind === "CC" || flow.subject.documentKind === "CE";
  const needsPlate = flow.consented.includes("vehiculo");
  const blocker = consentBlocker({ consented: flow.consented, ...flow.subject });
  const ready = blocker === undefined;
  const allOn = SOURCES.every((source) => flow.consented.includes(source.id));

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Tu autorización" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24 }}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        <Steps current={2} />
        <Title>Consultar no es{"\n"}compartir.</Title>
        <Body>
          El emisor consulta con estos datos. La contraparte no los recibe y no consulta nada.
        </Body>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Label>{`Fuentes · ${flow.consented.length} de ${SOURCES.length}`}</Label>
          <Badge onPress={() => setConsent(allOn ? [] : SOURCES.map((source) => source.id))}>
            {allOn ? "Quitar todas" : "Elegir todas"}
          </Badge>
        </View>
        <Card>
          {SOURCES.map((source) => {
            const on = flow.consented.includes(source.id);
            return (
              <Row
                key={source.id}
                icon={on ? "✓" : "□"}
                title={source.title}
                scope={source.needs}
                checked={on}
                onPress={() => toggleConsent(source.id)}
              />
            );
          })}
        </Card>

        <Label>Tipo de documento</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {DOCUMENT_KINDS.map((kind) => (
            <Badge
              key={kind.id}
              selected={flow.subject.documentKind === kind.id}
              onPress={() =>
                setSubject({
                  documentKind: kind.id,
                  documentNumber: cleanDocumentNumber(kind.id, flow.subject.documentNumber),
                })
              }
            >
              {flow.subject.documentKind === kind.id ? `✓ ${kind.label}` : kind.label}
            </Badge>
          ))}
        </View>
        <Field
          label="Número de documento"
          value={flow.subject.documentNumber}
          onChangeText={(text) => setSubject({ documentNumber: cleanDocumentNumber(flow.subject.documentKind, text) })}
          placeholder={numeric ? "1020304050" : "AB123456"}
          keyboardType={numeric ? "number-pad" : "default"}
          minLength={MIN_DOCUMENT_LENGTH}
        />
        {needsPlate ? (
          <Field
            label="Placa del vehículo"
            value={flow.subject.plate}
            onChangeText={(text) => setSubject({ plate: text.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
            placeholder="ABC123"
            minLength={MIN_PLATE_LENGTH}
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
          {blocker ?? "Autorizar y consultar"}
        </Button>
      </Footer>
      <DemoStamp>CONSULTA REAL A LAS FUENTES AUTORIZADAS</DemoStamp>
    </Screen>
  );
}
