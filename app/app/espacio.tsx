// espacio.tsx: what the wallet holds right now, in plain language.
// Reached from "Mi espacio", which used to be a label that did nothing.

import { router } from "expo-router";
import { Alert, ScrollView } from "react-native";
import { Button, Card, Label, Row, Screen, TabBar, TopBar, Title } from "../src/components.tsx";
import { reset, useFlow } from "../src/domain/flow.ts";
import { ISSUER_URL } from "../src/domain/issuer-client.ts";
import { PREDICATE_LABEL, answerText } from "../src/domain/session.ts";
import { counterpartyLabel, purposeLabel } from "../src/domain/purpose.ts";
import { formatDateTime } from "../src/domain/datetime.ts";

export default function Espacio() {
  const flow = useFlow();

  return (
    <Screen>
      <TopBar title="Mi espacio" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Title>Lo que tienes{"\n"}ahora mismo.</Title>
        <Label>Respuestas emitidas</Label>
        <Card>
          {flow.answers === undefined ? (
            <Row icon="□" title="Todavía ninguna" scope="Se emiten cuando autorizas una consulta." />
          ) : (
            flow.answers.map((answer) => (
              <Row
                key={answer.predicate}
                title={`${PREDICATE_LABEL[answer.predicate] ?? answer.predicate}: ${answerText(answer)}`}
                scope={answer.doesNotEstimate}
              />
            ))
          )}
        </Card>
        <Label>{`Historial · ${flow.history.length}`}</Label>
        <Card>
          {flow.history.length === 0 ? (
            <Row icon="□" title="Sin actividad todavía" scope="Aquí verás cada solicitud que compartas o rechaces." />
          ) : (
            flow.history.map((entry) => (
              <Row
                key={`${entry.outcome}-${entry.at}`}
                icon={entry.outcome === "shared" ? "✓" : "✕"}
                title={`${entry.outcome === "shared" ? "Compartiste con" : "Rechazaste a"} ${counterpartyLabel(entry.purpose).toLowerCase()}`}
                scope={`${purposeLabel(entry.purpose)} · ${formatDateTime(entry.at)}`}
              />
            ))
          )}
        </Card>
        <Label>Emisor</Label>
        <Card>
          <Row
            icon={flow.issuer === undefined ? "!" : "✓"}
            title={flow.issuer === undefined ? "Sin conectar" : "Conectado"}
            scope={ISSUER_URL.replace(/^https?:\/\//, "")}
          />
        </Card>
        <Label>Lo que nunca sale de aquí</Label>
        <Card>
          <Row icon="🔒" title="Tu documento y tu placa" scope="Se envían solo al emisor que autorizas, nunca a la contraparte" />
        </Card>
        <Button
          tone="secondary"
          onPress={() =>
            Alert.alert(
              "¿Borrar y empezar de nuevo?",
              "Se borran de este teléfono las respuestas, tu documento y tu placa, y llega una solicitud nueva. El historial se conserva. Lo que ya compartiste no se puede retirar.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar",
                  style: "destructive",
                  onPress: () => {
                    reset();
                    router.replace("/");
                  },
                },
              ],
            )
          }
        >
          Borrar y empezar de nuevo
        </Button>
      </ScrollView>
      <TabBar />
    </Screen>
  );
}
