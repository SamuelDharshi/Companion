import webpush from "web-push";
import { formatUsd, HOLD_REASON, type Classification } from "@thunai/shared";

/**
 * Breaking the isolation.
 *
 * The scam only works while the student is alone on the call, so this is the part of the
 * product that has to be fast and has to be redundant. Every channel is tried:
 *
 *   - Web Push to the guardian's installed app (instant, works on a locked phone),
 *   - Expo push for the native builds,
 *   - a pre-filled WhatsApp deep link as a human-readable backstop, because a parent in
 *     Chennai will see WhatsApp even if notifications are muted.
 *
 * None of it is load-bearing for safety: if every channel fails, the hold still stands
 * and still expires back to the student. Paging makes the save fast; the contract makes
 * it safe.
 */

export type PushTarget = {
  familyId: string;
  role: "student" | "guardian";
  endpoint: string;
  keys?: { p256dh: string; auth: string };
  expoPushToken?: string;
};

export type AlertPayload = {
  familyId: string;
  holdId: string;
  amount: bigint;
  payeeName?: string;
  reason: number;
  classification: Classification;
  studentName: string;
  /** Minutes the student says they have been on a call, when known. */
  callDurationMinutes?: number;
};

export type PagerOptions = {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject: string;
  expoPushUrl: string;
  appUrl: string;
  log: { info: (...a: any[]) => void; warn: (...a: any[]) => void };
};

export class Pager {
  private readonly webPushReady: boolean;

  constructor(private readonly options: PagerOptions) {
    this.webPushReady = Boolean(options.vapidPublicKey && options.vapidPrivateKey);
    if (this.webPushReady) {
      webpush.setVapidDetails(
        options.vapidSubject,
        options.vapidPublicKey!,
        options.vapidPrivateKey!,
      );
    } else {
      options.log.warn("VAPID keys not set: web push disabled, WhatsApp link still available");
    }
  }

  /**
   * The alert the guardian actually sees.
   *
   * English first, with the Tamil underneath, so the same message works for a parent who
   * reads either. The amount and the student's name lead, because that is what makes a
   * parent pick up the phone.
   */
  buildAlert(payload: AlertPayload) {
    const amount = formatUsd(payload.amount);
    const payee = payload.payeeName ?? "someone new";
    const title = `${payload.studentName} needs you`;

    const lines = [
      `${payload.studentName} is trying to send ${amount} to ${payee}.`,
      payload.classification.explanation_en,
    ];
    if (payload.callDurationMinutes != null) {
      lines.push(`They have been on a call for ${payload.callDurationMinutes} minutes.`);
    }
    if (payload.reason === HOLD_REASON.NETWORK_FLAG) {
      lines.push("Another Companion family has already reported this payee.");
    }

    return {
      title,
      titleTa: `${payload.studentName} உங்கள் உதவி தேவை`,
      body: lines.join(" "),
      bodyTa: `${payload.studentName} ${amount} அனுப்ப முயல்கிறார். ${payload.classification.explanation_ta}`,
      /** Deep link straight to the decision, so it is one tap from the notification. */
      url: `${this.options.appUrl}/hold/${payload.holdId}`,
      amount,
      holdId: payload.holdId,
      familyId: payload.familyId,
      scriptId: payload.classification.scriptId,
      /** Reassurance that makes "Stop it" the easy choice. */
      footer: "Not sure? Stop it. The money goes straight back.",
    };
  }

  /** A pre-filled WhatsApp message, as the backstop channel. */
  whatsAppLink(alert: ReturnType<Pager["buildAlert"]>, phone?: string): string {
    const text = `${alert.title}: ${alert.body}\n\nOpen Companion to stop it: ${alert.url}`;
    const base = phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(text)}`;
  }

  /** Pushes to every registered device for a family. Failures are logged, never thrown. */
  async page(targets: PushTarget[], alert: ReturnType<Pager["buildAlert"]>): Promise<number> {
    const payload = JSON.stringify(alert);

    const results = await Promise.allSettled(
      targets.map(async (target) => {
        if (target.expoPushToken) return this.sendExpo(target.expoPushToken, alert);
        if (!this.webPushReady || !target.keys) {
          throw new Error("no usable push channel for this device");
        }
        return webpush.sendNotification(
          { endpoint: target.endpoint, keys: target.keys },
          payload,
          { TTL: 1800, urgency: "high" },
        );
      }),
    );

    const delivered = results.filter((r) => r.status === "fulfilled").length;
    for (const result of results) {
      if (result.status === "rejected") {
        this.options.log.warn({ err: String(result.reason) }, "a push target failed");
      }
    }
    this.options.log.info(
      { delivered, attempted: targets.length, holdId: alert.holdId },
      "guardian paged",
    );
    return delivered;
  }

  private async sendExpo(token: string, alert: ReturnType<Pager["buildAlert"]>) {
    const response = await fetch(this.options.expoPushUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to: token,
        title: alert.title,
        body: alert.body,
        sound: "default",
        priority: "high",
        // Interruption level so it breaks through a silenced phone at 8:30am in Chennai.
        data: { url: alert.url, holdId: alert.holdId, familyId: alert.familyId },
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`expo push ${response.status}`);
  }
}
