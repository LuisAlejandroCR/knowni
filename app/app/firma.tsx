// firma.tsx: a real device signature on testnet — email code, the Cavos
// Stellar wallet, and 1 XLM paid to itself. A bench for the physical-device
// run, outside the journey; the transaction hash on screen is the evidence.

import { useRef, useState } from "react";
import { Linking, ScrollView, Text, TextInput } from "react-native";
import { getRandomBytes } from "expo-crypto";
import { Body, Button, Card, DemoStamp, Footer, Note, Row, Screen, TabBar, Title, TopBar } from "../src/components.tsx";
import { connectCavos, createCavosAuth } from "../src/cavos-bridge.ts";
import { explorerUrl, fundOnTestnet, selfPaymentTerms } from "../src/domain/self-payment.ts";
import { payQuote, type PaymentResult } from "../src/domain/stellar-payment.ts";
import { cavosConfigured, createCavosWallet } from "../src/domain/wallet-cavos.ts";
import { balancesOf, type Balance, type PayerWalletPort } from "../src/domain/wallet-port.ts";

const REASON: Record<Extract<PaymentResult, { status: "failed" }>["reason"], string> = {
  quote_expired: "El pago venció antes de firmarse.",
  invalid_terms: "Los términos del pago no se pudieron construir.",
  wallet_not_connected: "La wallet no está conectada.",
  account_not_found: "La cuenta no existe en testnet todavía: fondéala primero.",
  wallet_rejected: "La wallet no firmó, o su firma no es de esta cuenta sobre esta transacción.",
  horizon_rejected: "Horizon rechazó la transacción firmada.",
  unreachable: "No se pudo hablar con Horizon.",
};

type Step = "email" | "code" | "wallet";

// What went wrong, in the kit's own words: a device run cannot debug "failed".
const detail = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default function Firma() {
  return cavosConfigured() ? <CavosSigner /> : <NotConfigured />;
}

function NotConfigured() {
  return (
    <Screen>
      <TopBar title="Firma real" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Title>Falta la llave{"\n"}de Cavos.</Title>
        <Body>Esta build no trae EXPO_PUBLIC_CAVOS_APP_ID. Los pasos están en docs/wallets.md.</Body>
      </ScrollView>
      <DemoStamp>STELLAR TESTNET</DemoStamp>
      <TabBar />
    </Screen>
  );
}

function CavosSigner() {
  const auth = useRef(createCavosAuth()).current;
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [wallet, setWallet] = useState<PayerWalletPort | undefined>();
  const [account, setAccount] = useState<string | undefined>();
  const [balances, setBalances] = useState<readonly Balance[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [result, setResult] = useState<PaymentResult | undefined>();

  // One busy flag and one message for every step, so no two calls overlap.
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(undefined);
    try {
      await action();
    } catch (error) {
      setMessage(detail(error));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await auth.sendOtp(email.trim());
      setStep("code");
    });

  const verify = () =>
    run(async () => {
      const identity = await auth.verifyOtp(email.trim(), code.trim());
      const port = createCavosWallet(await connectCavos(identity, auth));
      const connected = await port.connect();
      setWallet(port);
      setAccount(connected);
      setStep("wallet");
      if (connected !== undefined) setBalances(await balancesOf(connected));
    });

  const fund = () =>
    run(async () => {
      if (account === undefined) return;
      if (!(await fundOnTestnet(account))) setMessage("Friendbot no fondeó la cuenta. Intenta de nuevo en un minuto.");
      setBalances(await balancesOf(account));
    });

  const pay = () =>
    run(async () => {
      if (account === undefined || wallet === undefined) return;
      setResult(undefined);
      const nowUnix = Math.floor(Date.now() / 1000);
      setResult(
        await payQuote({ terms: selfPaymentTerms(account, getRandomBytes(32)), expiresAt: nowUnix + 120, wallet }),
      );
      setBalances(await balancesOf(account));
    });

  const funded = balances.length > 0;

  return (
    <Screen>
      <TopBar title="Firma real" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Title>Cavos firma{"\n"}en testnet.</Title>
        <Body>
          Entra con un código por correo, obtén tu wallet Stellar y págate 1 XLM a ti mismo. La llave vive en este
          teléfono; la app comprueba la firma antes de enviarla y el hash es la evidencia.
        </Body>
        {step !== "wallet" && (
          <TextInput
            value={step === "email" ? email : code}
            onChangeText={step === "email" ? setEmail : setCode}
            placeholder={step === "email" ? "tu@correo.com" : "Código de 6 dígitos"}
            keyboardType={step === "email" ? "email-address" : "number-pad"}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ borderWidth: 1, borderColor: "#c9cfc2", borderRadius: 12, padding: 14, marginTop: 16, fontSize: 16 }}
          />
        )}
        {account !== undefined && (
          <>
            <Row title="Cuenta" scope={account} />
            {funded ? (
              balances.map((balance) => <Row key={balance.asset} title={balance.asset} scope={balance.amount} />)
            ) : (
              <Row title="Saldo" scope="Sin fondos en testnet: fondéala primero" />
            )}
          </>
        )}
        {message !== undefined && (
          <Card tone="amber">
            <Text>{message}</Text>
          </Card>
        )}
        {result?.status === "paid" && (
          <Card tone="deep">
            <Text>Pagado y aceptado por la red.</Text>
            <Text onPress={() => void Linking.openURL(explorerUrl(result.txHash))}>{result.txHash}</Text>
          </Card>
        )}
        {result?.status === "failed" && (
          <Card tone="amber">
            <Text>{REASON[result.reason]}</Text>
          </Card>
        )}
        <Note>Testnet: el XLM no tiene valor. Pase o falle, anota una fila en docs/verificacion.md.</Note>
      </ScrollView>
      <Footer>
        {step === "email" && (
          <Button onPress={() => void sendCode()} disabled={busy || email.trim() === ""}>
            {busy ? "Enviando…" : "Enviarme un código"}
          </Button>
        )}
        {step === "code" && (
          <Button onPress={() => void verify()} disabled={busy || code.trim() === ""}>
            {busy ? "Abriendo…" : "Entrar"}
          </Button>
        )}
        {step === "wallet" && !funded && (
          <Button onPress={() => void fund()} disabled={busy}>{busy ? "Fondeando…" : "Fondear con Friendbot"}</Button>
        )}
        {step === "wallet" && funded && (
          <Button onPress={() => void pay()} disabled={busy}>{busy ? "Firmando…" : "Pagarme 1 XLM"}</Button>
        )}
      </Footer>
      <DemoStamp>STELLAR TESTNET</DemoStamp>
      <TabBar />
    </Screen>
  );
}
