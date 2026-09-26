// firma.tsx: a real device signature on testnet — email code, the Cavos
// Stellar wallet, and 1 XLM paid to itself. A bench for the physical-device
// run, outside the journey; the transaction hash on screen is the evidence.

import { useEffect, useRef, useState } from "react";
import { Keyboard, Linking, Platform, RefreshControl, ScrollView, TextInput } from "react-native";
import { cleanOtp, otpComplete, resendWaitSeconds } from "../src/domain/otp.ts";
import { getRandomBytes } from "expo-crypto";
import { Body, Button, Callout, Card, Label, Steps, DemoStamp, Footer, KEYBOARD_DONE, KeyboardDone, Note, Row, Screen, TabBar, Title, TopBar } from "../src/components.tsx";
import { color } from "../src/theme.ts";
import { canCopy, copyText } from "../src/clipboard.ts";
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
// A Stellar address is 56 characters; the ends are what a person compares.
const shortAddress = (address: string): string => `${address.slice(0, 6)}…${address.slice(-6)}`;
const accountUrl = (address: string): string => `https://stellar.expert/explorer/testnet/account/${address}`;

const STEP_TITLE: Record<Step, string> = {
  email: "Entra con\ntu correo.",
  code: "Revisa tu\ncorreo.",
  wallet: "Tu wallet\nde prueba.",
};

const detail = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export default function Firma() {
  return cavosConfigured() ? <CavosSigner /> : <NotConfigured />;
}

function NotConfigured() {
  return (
    <Screen>
      <TopBar title="Wallet" />
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
  const [copied, setCopied] = useState(false);
  const [balances, setBalances] = useState<readonly Balance[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [result, setResult] = useState<PaymentResult | undefined>();
  const [sentAt, setSentAt] = useState<number | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const wait = resendWaitSeconds(sentAt, now);

  // Tick once a second only while the resend countdown is running.
  useEffect(() => {
    if (wait === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [wait]);

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
      setSentAt(Date.now());
      setNow(Date.now());
      setCode("");
      setStep("code");
    });

  const verify = (entered: string = code) =>
    run(async () => {
      const identity = await auth.verifyOtp(email.trim(), entered);
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

  // Pull down to re-read the balance: the network moves while the screen sits still.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (account === undefined) return;
    setRefreshing(true);
    try {
      setBalances(await balancesOf(account));
    } finally {
      setRefreshing(false);
    }
  };

  const funded = balances.length > 0;

  return (
    <Screen>
      <TopBar title="Wallet" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24 }}
        refreshControl={
          account === undefined ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={color.deep} />
          )
        }
      >
        <Steps
          names={["Correo", "Código", "Fondos", "Pago"]}
          current={step === "email" ? 1 : step === "code" ? 2 : funded ? 4 : 3}
        />
        <Title>{STEP_TITLE[step]}</Title>
        <Body>
          {step === "email"
            ? "Te enviamos un código de 6 dígitos. Sin contraseñas: la llave de tu wallet vive en este teléfono."
            : step === "code"
              ? `Lo enviamos a ${email.trim()}. Pégalo o escríbelo: entras en cuanto esté completo.`
              : "Tu wallet Stellar de prueba. Fondéala y págate 1 XLM: el hash de la transacción es la evidencia."}
        </Body>
        {step === "wallet" ? null : <Label>{step === "email" ? "Correo electrónico" : "Código"}</Label>}
        {step !== "wallet" && (
          <TextInput
            value={step === "email" ? email : code}
            onChangeText={
              step === "email"
                ? setEmail
                : (text) => {
                    const next = cleanOtp(text);
                    setCode(next);
                    // A complete code signs in by itself: pasting it is the intent.
                    if (otpComplete(next) && !busy) {
                      Keyboard.dismiss();
                      void verify(next);
                    }
                  }
            }
            textContentType={step === "email" ? "emailAddress" : "oneTimeCode"}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            inputAccessoryViewID={Platform.OS === "ios" ? KEYBOARD_DONE : undefined}
            placeholder={step === "email" ? "tu@correo.com" : "••••••"}
            accessibilityLabel={step === "email" ? "Correo electrónico" : "Código de 6 dígitos"}
            autoFocus
            keyboardType={step === "email" ? "email-address" : "number-pad"}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={color.inkFaint}
            style={[
              { borderWidth: 1, borderColor: color.line, backgroundColor: color.card, borderRadius: 14, padding: 14, minHeight: 52, fontSize: 17, color: color.ink },
              step === "code" && { fontSize: 28, letterSpacing: 12, textAlign: "center", fontWeight: "700" },
            ]}
          />
        )}
        <KeyboardDone />
        {account !== undefined && (
          <>
            <Label>Tu wallet</Label>
            <Card>
              <Row
                icon="◎"
                title="Cuenta"
                scope={shortAddress(account)}
                trailing="↗"
                onPress={() => void Linking.openURL(accountUrl(account))}
              />
              {canCopy() ? (
                <Button tone="secondary" onPress={() => void copyText(account).then((ok) => setCopied(ok))}>
                  {copied ? "✓ Dirección copiada" : "Copiar dirección"}
                </Button>
              ) : null}
              {funded ? (
                balances.map((balance) => <Row key={balance.asset} icon="✓" title={`${balance.amount} ${balance.asset}`} scope="Saldo" />)
              ) : (
                <Row icon="!" title="Sin fondos" scope="Fondéala en testnet primero" />
              )}
            </Card>
          </>
        )}
        {message !== undefined && (
          <Callout tone="warning" title={message} />
        )}
        {result?.status === "paid" && (
          <Callout
            tone="success"
            title="Pagado y aceptado por la red."
            onPressText={() => void Linking.openURL(explorerUrl(result.txHash))}
          >
            {result.txHash}
          </Callout>
        )}
        {result?.status === "failed" && (
          <Callout tone="warning" title={REASON[result.reason]} />
        )}
        <Note>Red de prueba: el XLM aquí no tiene valor real.</Note>
      </ScrollView>
      <Footer>
        {step === "email" && (
          <Button onPress={() => void sendCode()} disabled={busy || email.trim() === ""} loading={busy}>
            {busy ? "Enviando…" : "Enviarme un código"}
          </Button>
        )}
        {step === "code" && (
          <Button onPress={() => void verify()} disabled={busy || !otpComplete(code)} loading={busy}>
            {busy ? "Abriendo…" : "Entrar"}
          </Button>
        )}
        {step === "code" && (
          <Button tone="secondary" onPress={() => void sendCode()} disabled={busy || wait > 0}>
            {wait > 0 ? `Pedir otro código en ${wait} s` : "Pedir otro código"}
          </Button>
        )}
        {step === "code" && (
          <Button tone="secondary" onPress={() => setStep("email")} disabled={busy}>
            Cambiar correo
          </Button>
        )}
        {step === "wallet" && !funded && (
          <Button onPress={() => void fund()} disabled={busy} loading={busy}>{busy ? "Fondeando…" : "Fondear con Friendbot"}</Button>
        )}
        {step === "wallet" && funded && (
          <Button onPress={() => void pay()} disabled={busy} loading={busy}>{busy ? "Firmando…" : "Pagarme 1 XLM"}</Button>
        )}
      </Footer>
      <DemoStamp>STELLAR TESTNET</DemoStamp>
      <TabBar />
    </Screen>
  );
}
