// bienvenida.tsx: the first thing a new phone sees — what Knowni does, in three
// swipes, before anyone is asked for anything. Shown once; Mi espacio can reopen it.

import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Body, Brand, Button, Footer, Screen, Title, TopBar } from "../src/components.tsx";
import { markOnboardingSeen } from "../src/onboarding.ts";
import { color } from "../src/theme.ts";

const SLIDES = [
  {
    icon: "shield-checkmark",
    title: "Demuestra más.\nRevela menos.",
    body: "Knowni responde por ti a quien te pide requisitos para firmar, sin entregar tu cédula ni tus datos.",
  },
  {
    icon: "eye-off",
    title: "Respuestas,\nno documentos.",
    body: "La contraparte recibe “sí” o “no” a cada pregunta, firmado por el emisor. Nada más.",
  },
  {
    icon: "hand-left",
    title: "Tú decides\ncada vez.",
    body: "Revisas quién pregunta y para qué, eliges qué fuentes se consultan y confirmas antes de compartir.",
  },
] as const;

export default function Bienvenida() {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));

  const finish = () => {
    void markOnboardingSeen().catch(() => undefined);
    router.replace("/");
  };

  return (
    <Screen>
      <TopBar
        left={<Brand />}
        right={
          last ? undefined : (
            <Text accessibilityRole="button" onPress={finish} style={{ color: color.inkSoft, fontWeight: "600", padding: 12 }}>
              Saltar
            </Text>
          )
        }
      />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
        {SLIDES.map((slide) => (
          <View key={slide.icon} style={{ width, paddingHorizontal: 24, justifyContent: "center" }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 28,
                backgroundColor: color.lime,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Ionicons name={slide.icon} size={44} color={color.deep} />
            </View>
            <Title>{slide.title}</Title>
            <Body>{slide.body}</Body>
          </View>
        ))}
      </ScrollView>
      <View
        accessibilityLabel={`Página ${page + 1} de ${SLIDES.length}`}
        style={{ flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 16 }}
      >
        {SLIDES.map((slide, index) => (
          <View
            key={slide.icon}
            style={{
              width: index === page ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: index === page ? color.deep : color.line,
            }}
          />
        ))}
      </View>
      <Footer>
        {last ? <Button onPress={finish}>Empezar</Button> : <Body>Desliza para continuar →</Body>}
      </Footer>
    </Screen>
  );
}
