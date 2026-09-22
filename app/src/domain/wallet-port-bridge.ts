// wallet-port-bridge.ts: the shape the Privy hooks are reduced to.
// Lives apart from the adapter and from the hooks so both sides can import it
// without dragging React into a Node test.

export interface PrivyBridge {
  loginWithPasskey(): Promise<boolean>;
  // Privy's extended-chains wallet for `chainType: "stellar"`.
  stellarAddress(): Promise<string | undefined>;
  createStellarWallet(): Promise<string | undefined>;
  // `0x`-prefixed hash in, `0x`-prefixed signature out.
  signRawHash(address: string, hashHex: string): Promise<string | undefined>;
  logout(): Promise<void>;
}
