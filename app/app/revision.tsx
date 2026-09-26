// revision.tsx: screen 05 — what the counterparty receives, and what it does not.
// The withheld list is the product explaining itself by showing, which is the
// screen the whole design exists for.

import { Link, router } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { BackButton, Body, Button, Callout, Card, DemoStamp, Footer, Label, Note, Row, Screen, Steps, TopBar, Title } from "../src/components.tsx";
import { REQUEST, WITHHELD } from "../src/fixtures.ts";
import { answerText, PREDICATE_LABEL } from "../src/domain/session.ts";
import { share, useFlow } from "../src/domain/flow.ts";
import { counterpartyLabel, purposeLabel } from "../src/domain/purpose.ts";
import { explorerUrl } from "../src/domain/self-payment.ts";
import { color, type as typography } from "../src/theme.ts";

export default function Revision() {
  const { answers, request, paymentTx } = useFlow();
  const purpose = request.purpose;

  // No verified answers means nothing to show. A screen that renders what it
  // could not check is a screen that can be lied to.
  if (answers === undefined) {
    return (
      <Screen>
        <TopBar title="Antes de compartir" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
          <Title>No pudimos{"\n"}verificar la respuesta.</Title>
          <Body>No se enviará nada. Pide una solicitud nueva.</Body>
        </ScrollView>
        <Footer>
          <Link href="/" asChild>
            <Button>Volver</Button>
          </Link>
        </Footer>
        <DemoStamp>NADA SE COMPARTE SIN VERIFICAR</DemoStamp>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar left={<BackButton />} title="Antes de compartir" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Steps current={4} />
        <Title>Esto es lo que{"\n"}recibirán.</Title>
        <Body>{`${counterpartyLabel(purpose)}\nSolo para: ${purposeLabel(purpose).toLowerCase()}.`}</Body>
        <Label>{`Lo que recibirán · ${answers.length}`}</Label>
        <Card>
          {answers.map((answer) => (
            <Row
              key={answer.predicate}
              icon={answer.value === "unavailable" ? "!" : "✓"}
              title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
              scope={answer.doesNotEstimate}
            />
          ))}
        </Card>
        <Label>{`Lo que no recibirán · ${WITHHELD.length}`}</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 8 }}>
          {WITHHELD.map((item) => (
            <Text
              key={item}
              style={{
                ...typography.small,
                color: "#5a685d",
                textDecorationLine: "line-through",
                backgroundColor: "#f1f3ee",
                borderWidth: 1,
                borderColor: color.line,
                borderRadius: 8,
                paddingHorizontal: 9,
                paddingVertical: 5,
              }}
            >
              {`✕ ${item}`}
            </Text>
          ))}
        </View>
        {paymentTx === undefined ? null : (
          <Callout
            tone="success"
            title="Pagaste esta consulta en Stellar testnet. La contraparte no recibe el pago."
            onPressText={() => void Linking.openURL(explorerUrl(paymentTx))}
          >
            {paymentTx}
          </Callout>
        )}
        <Note>Este resultado no autoriza la firma del contrato ni sustituye sus requisitos legales.</Note>
      </ScrollView>
      <Footer>
        <Button
          onPress={() =>
            // Sharing cannot be taken back, so it asks once, naming who receives it.
            Alert.alert(
              `¿Compartir con ${counterpartyLabel(purpose).toLowerCase()}?`,
              "Recibirán solo estas respuestas. Una vez enviadas no se pueden retirar.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Compartir",
                  onPress: () => {
                    share();
                    router.push("/acuse");
                  },
                },
              ],
            )
          }
        >
          Compartir →
        </Button>
      </Footer>
      <DemoStamp>RESPUESTAS FIRMADAS Y VERIFICADAS · ENVÍO REAL BLOQUEADO</DemoStamp>
    </Screen>
  );
}
