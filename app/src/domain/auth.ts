// auth.ts: the session that guards the wallet, not the sources.
// Passkey first, magic link only to recover, short life, and no password of any
// source ever stored here. See docs/memoria.md D-30.

export type Factor = "passkey" | "magic_link";

export interface Session {
  readonly userId: string;
  readonly factor: Factor;
  readonly deviceId: string;
  readonly startedAt: number;
  readonly expiresAt: number;
}

// Short by design: a wallet session that outlives the errand it was opened for
// is a wallet anybody holding the phone can spend from.
export const SESSION_SECONDS = 900;

export interface AuthPort {
  signInWithPasskey(deviceId: string, nowUnix: number): Promise<Session | undefined>;
  // Recovery only. A person who lost their passkey gets back in; it is not the
  // everyday door, because an inbox is easier to take over than a device.
  recoverWithMagicLink(token: string, deviceId: string, nowUnix: number): Promise<Session | undefined>;
  signOut(): Promise<void>;
}

export function isActive(session: Session | undefined, nowUnix: number): boolean {
  if (session === undefined) return false;
  return nowUnix >= session.startedAt && nowUnix < session.expiresAt;
}

// A session belongs to the device it was opened on. Moving one to another
// phone is the theft this check exists to make useless.
export function boundToDevice(session: Session, deviceId: string): boolean {
  return session.deviceId === deviceId;
}

export interface PrivyAuthBridge {
  loginWithPasskey(): Promise<{ readonly userId: string } | undefined>;
  loginWithEmailCode(token: string): Promise<{ readonly userId: string } | undefined>;
  logout(): Promise<void>;
}

export function createPrivyAuth(bridge: PrivyAuthBridge | undefined): AuthPort {
  const open = (userId: string, factor: Factor, deviceId: string, nowUnix: number): Session => ({
    userId,
    factor,
    deviceId,
    startedAt: nowUnix,
    expiresAt: nowUnix + SESSION_SECONDS,
  });

  return {
    async signInWithPasskey(deviceId, nowUnix) {
      const user = await bridge?.loginWithPasskey();
      return user === undefined ? undefined : open(user.userId, "passkey", deviceId, nowUnix);
    },
    async recoverWithMagicLink(token, deviceId, nowUnix) {
      const user = await bridge?.loginWithEmailCode(token);
      return user === undefined ? undefined : open(user.userId, "magic_link", deviceId, nowUnix);
    },
    async signOut() {
      await bridge?.logout();
    },
  };
}
