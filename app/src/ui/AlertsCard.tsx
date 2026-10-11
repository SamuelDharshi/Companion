import { useCallback, useEffect, useState } from "react";
import { Body, Card, ErrorNote, Pill, SecondaryButton, Small } from "@/ui/components";
import { restoreFromPasskey } from "@/actions/onboarding";
import { SessionExpiredError } from "@/mera/account";
import { enablePush, pushState, type PushState } from "@/push";
import { useDeviceState } from "@/state/store";

/**
 * "Get alerts on this phone." A parent who is not looking at the app still has to hear about a
 * held payment, so this is the first thing she sees until it is on. It tells the truth about each
 * case: on an iPhone the app has to be added to the Home Screen first, and a blocked permission
 * can only be undone in the browser's settings.
 */
export default function AlertsCard() {
  const device = useDeviceState();
  const [state, setState] = useState<PushState | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(() => void pushState().then(setState), []);
  useEffect(refresh, [refresh]);

  if (!device.familyId || !device.role || !state) return null;
  if (state === "on") {
    return (
      <Card>
        <Pill label="Alerts are on for this phone" tone="trust" icon="✓" />
      </Card>
    );
  }

  async function turnOn() {
    if (!device.familyId || !device.role) return;
    setBusy(true);
    setError(undefined);
    try {
      try {
        await enablePush(device.familyId, device.role);
      } catch (cause) {
        // The signing session may have run out. One Face ID renews it, then try once more.
        if (!(cause instanceof SessionExpiredError)) throw cause;
        await restoreFromPasskey(device.role);
        await enablePush(device.familyId, device.role);
      }
      refresh();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Body>Get alerts on this phone</Body>
      {state === "needs-install" ? (
        <Small>
          On an iPhone, alerts only work once Companion is added to your Home Screen. Tap Share, then
          &quot;Add to Home Screen&quot;, open it from there, and come back here.
        </Small>
      ) : state === "unsupported" ? (
        <Small>This browser cannot show alerts. You will still get a WhatsApp message with a link.</Small>
      ) : state === "blocked" ? (
        <Small>Alerts are blocked for this site. Turn them on in your browser&apos;s site settings.</Small>
      ) : (
        <>
          <Small>
            So you hear about a held payment even when this app is closed. A WhatsApp message with a link is
            always sent as well.
          </Small>
          <SecondaryButton label="Turn on alerts" onPress={turnOn} busy={busy} />
        </>
      )}
      {error ? <ErrorNote message={error} /> : null}
    </Card>
  );
}
