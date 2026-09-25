// firma.tsx: a real Privy signature on testnet — passkey, Stellar wallet, and
// 1 XLM paid to itself. A bench for the physical-device run, outside the
// journey; the transaction hash on screen is the evidence.

import { useRef, useState } from "react";
import { Linking, ScrollView, Text } from "react-native";
import { getRandomBytes } from "expo-crypto";
import { Body, Button, Card, DemoStamp, Footer, Note, Row, Screen, Title, TopBar } from "../src/components.tsx";
import { usePrivyBridge } from "../src/domain/privy-bridge.tsx";
import type { PrivyBridge } from "../src/domain/wallet-port-bridge.ts";
import { explorerUrl, selfPaymentTerms } from "../src/domain/self-payment.ts";
import { payQuote, type PaymentResult } from "../src/domain/stellar-payment.ts";
import { balancesOf, type Balance, type PayerWalletPort } from "../src/domain/wallet-port.ts";
import { createPrivyWallet, privyConfigured } from "../src/domain/wallet-privy.ts";

const REASON: Record<Extract<PaymentResult, { status: "failed" }>["reason"], string> = {
  quote_expired: "El pago de prueba venció antes de firmarse.",
  invalid_terms: "Los términos del pago no se pudieron construir.",
  wallet_not_connected: "La wallet no está conectada.",
  account_not_found: "La cuenta no existe en testnet todavía: fondéala con Friendbot.",
  wallet_rejected: "La wallet no firmó, o su firma no es de esta cuenta sobre esta transacción.",
  horizon_rejected: "Horizon rechazó la transacción firmada.",
  unreachable: "No se pudo hablar con Horizon.",
};

export default function Firma() {
  return privyConfigured() ? <PrivySigner /> : <NotConfigured />;
}

function NotConfigured() {
  return (
    <Screen>
      <TopBar title="Firma real" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Title>Falta la llave{"\n"}de Privy.</Title>
        <Body>Esta build no trae EXPO_PUBLIC_PRIVY_APP_ID. Los pasos están en docs/wallets.md.</Body>
      </ScrollView>
      <DemoStamp>BANCO DE PRUEBA · TESTNET</DemoStamp>
    </Screen>
  );
}

function PrivySigner() {
  // The hooks hand back new functions on every render � after login, one that
  // sees the user. The wallet lives across renders, so it reads the latest.
  const bridge = usePrivyBridge();
  const latest = useRef<PrivyBridge>(bridge);
  latest.current = bridge;
  const [wallet] = useState<PayerWalletPort>(() =>
    createPrivyWallet({
      loginWithPasskey: () => latest.current.loginWithPasskey(),
      stellarAddress: () => latest.current.stellarAddress(),
      createStellarWallet: () => latest.current.createStellarWallet(),
      signRawHash: (address, hash) => latest.current.signRawHash(address, hash),
      logout: () => latest.current.logout(),
    }),
  );
  const [account, setAccount] = useState<string | undefined>();
  const [balances, setBalances] = useState<readonly Balance[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [result, setResult] = useState<PaymentResult | undefined>();

  const connect = async () => {
    setBusy(true);
    setMessage(undefined);
    try {
      const connected = await wallet.connect();
      setAccount(connected);
      if (connected === undefined) setMessage("La passkey no abrió sesión o Privy no devolvió una wallet Stellar.");
      else setBalances(await balancesOf(connected));
    } catch {
      setMessage("La passkey no abrió sesión. Revisa el dominio y los identificadores en el panel de Privy.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (account === undefined) return;
    setBusy(true);
    setResult(undefined);
    try {
      const nowUnix = Math.floor(Date.now() / 1000);
      const outcome = await payQuote({
        terms: selfPaymentTerms(account, getRandomBytes(32)),
        expiresAt: nowUnix + 120,
        wallet,
      });
      setResult(outcome);
      setBalances(await balancesOf(account));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Firma real" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <Title>Privy firma{"\n"}en testnet.</Title>
        <Body>
          Entra con passkey, obtén tu wallet Stellar y págate 1 XLM a ti mismo. La app comprueba la firma antes de
          enviarla; el hash es la evidencia.
        </Body>
        {account !== undefined && (
          <>
            <Row title="Cuenta" scope={account} />
            {balances.length === 0 ? (
              <Row title="Saldo" scope="Sin fondos en testnet" />
            ) : (
              balances.map((balance) => <Row key={balance.asset} title={balance.asset} scope={balance.amount} />)
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
        {account === undefined ? (
          <Button onPress={connect} disabled={busy}>{busy ? "Abriendo…" : "Entrar con passkey"}</Button>
        ) : (
          <Button onPress={pay} disabled={busy}>{busy ? "Firmando…" : "Pagarme 1 XLM"}</Button>
        )}
      </Footer>
      <DemoStamp>BANCO DE PRUEBA · TESTNET</DemoStamp>
    </Screen>
  );
}
