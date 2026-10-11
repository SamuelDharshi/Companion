import { useState } from "react";
import { Body, Card, ErrorNote, Small, TrustButton } from "@/ui/components";
import { colors } from "@/theme";
import { restoreFromPasskey } from "@/actions/onboarding";
import { useDeviceState } from "@/state/store";

/**
 * "Tap Face ID to continue."
 *
 * After Face ID, routine actions (paying an approved payee, adding money from home) sign with no
 * prompt for 15 minutes. When that window ends the next one needs a fresh Face ID, which is not an
 * error, so this says so plainly and offers the one tap that fixes it. Anything the family has to
 * decide, such as stopping a payment or lifting a pause, asks for Face ID every single time
 * regardless of this window.
 */
export default function SessionPrompt({ onRenewed }: { onRenewed?: () => void }) {
  const device = useDeviceState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function renew() {
    if (!device.role) return;
    setBusy(true);
    setError(undefined);
    try {
      await restoreFromPasskey(device.role);
      onRenewed?.();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone={{ bg: colors.trustSoft, accent: colors.trust }}>
      <Body>Tap Face ID to continue</Body>
      <Small>Your 15-minute signing window ended. One Face ID starts a new one.</Small>
      <TrustButton label="Face ID" subtitle="Starts a new 15-minute window" onPress={renew} busy={busy} />
      {error ? <ErrorNote message={error} /> : null}
    </Card>
  );
}
