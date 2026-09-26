// espacio.tsx: what the wallet holds right now, in plain language.
// Reached from "Mi espacio", which used to be a label that did nothing.

import { ScrollView } from "react-native";
import { Card, Label, Row, Screen, TabBar, TopBar, Title } from "../src/components.tsx";
import { useFlow } from "../src/domain/flow.ts";
import { ISSUER_URL } from "../src/domain/issuer-client.ts";
import { PREDICATE_LABEL, answerText } from "../src/domain/session.ts";

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
      </ScrollView>
      <TabBar />
    </Screen>
  );
}
