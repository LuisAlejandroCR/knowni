// notify.ts: tells the subject an answer is ready, and nothing else.
// A WhatsApp message is read on a lock screen, forwarded and backed up on
// someone else's phone, so it carries no verdict and no counterparty.

export interface Notifier {
  readonly channel: string;
  notify(phoneE164: string, sessionRef: string): Promise<boolean>;
}

// The whole message. No predicate, no answer, no counterparty, no purpose —
// the person opens the app and reads it there, where it is theirs.
export function messageFor(sessionRef: string): string {
  return `Knowni: tu respuesta está lista. Ábrela en la app. Referencia ${sessionRef.slice(0, 8)}`;
}

// Kapso resells Meta's Cloud API, so the message and its limits are Meta's;
// what Kapso adds is the shared inbox and customer-owned numbers.
export interface KapsoOptions {
  readonly apiKey: string;
  readonly phoneNumberId: string;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
}

export function createKapsoNotifier(options: KapsoOptions): Notifier {
  const baseUrl = (options.baseUrl ?? "https://app.kapso.ai/api/v1").replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    channel: "kapso",
    async notify(phoneE164, sessionRef) {
      try {
        const response = await fetchImpl(`${baseUrl}/whatsapp/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": options.apiKey },
          body: JSON.stringify({
            phone_number_id: options.phoneNumberId,
            to: phoneE164,
            type: "text",
            text: { body: messageFor(sessionRef) },
          }),
        });
        return response.ok;
      } catch {
        // A notification that failed is not a verification that failed: the
        // answer is already in the wallet either way.
        return false;
      }
    },
  };
}

// Meta's own Cloud API, for the free test number: five registered recipients,
// no business verification, and no join code for the person receiving it.
export interface MetaOptions {
  readonly accessToken: string;
  readonly phoneNumberId: string;
  readonly apiVersion?: string;
  readonly fetchImpl?: typeof fetch;
}

export function createMetaNotifier(options: MetaOptions): Notifier {
  const version = options.apiVersion ?? "v21.0";
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    channel: "meta",
    async notify(phoneE164, sessionRef) {
      try {
        const response = await fetchImpl(
          `https://graph.facebook.com/${version}/${options.phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.accessToken}`,
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phoneE164,
              type: "text",
              text: { body: messageFor(sessionRef) },
            }),
          },
        );
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

// What runs when no channel is configured: nothing, and it says so rather than
// pretending a message went out.
export const noNotifier: Notifier = {
  channel: "none",
  async notify() {
    return false;
  },
};

export function notifierFromEnv(env: Record<string, string | undefined>): Notifier {
  if (env.KAPSO_API_KEY && env.KAPSO_PHONE_NUMBER_ID) {
    return createKapsoNotifier({
      apiKey: env.KAPSO_API_KEY,
      phoneNumberId: env.KAPSO_PHONE_NUMBER_ID,
      baseUrl: env.KAPSO_BASE_URL,
    });
  }
  if (env.META_WHATSAPP_TOKEN && env.META_PHONE_NUMBER_ID) {
    return createMetaNotifier({
      accessToken: env.META_WHATSAPP_TOKEN,
      phoneNumberId: env.META_PHONE_NUMBER_ID,
    });
  }
  return noNotifier;
}
