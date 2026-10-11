import { useState } from "react";
import { Linking } from "react-native";
import { useRouter } from "expo-router";
import {
  Body,
  Card,
  ErrorNote,
  Proof,
  Screen,
  SecondaryButton,
  Small,
  Title,
  TrustButton,
} from "@/ui/components";
import { colors } from "@/theme";
import { t } from "@/i18n/strings";
import { unfreeze, videoCallUrl } from "@/actions/money";
import { useDeviceState } from "@/state/store";
import { useFamily } from "@/hooks/useThunai";

/**
 * Lifting a duress freeze.
 *
 * Only the guardian's passkey can do this, verified onchain. That asymmetry is the point:
 * the student can stop everything from a phone someone else is watching, and cannot be
 * made to start it again.
 */
export default function Frozen() {
  const router = useRouter();
  const device = useDeviceState();
  const { data: family, refresh } = useFamily(device.familyId);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const lang = device.lang;
  const studentName = family?.studentName ?? "your child";

  async function lift() {
    if (!device.familyId) return;
    setBusy(true);
    setError(undefined);
    try {
      await unfreeze(device.familyId);
      refresh();
      router.replace("/guardian");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tint>
      <Card tone={{ bg: colors.trustSoft, accent: colors.trust }}>
        <Title>{family?.sos ? `${studentName} pressed SOS` : "Everything is paused"}</Title>
        <Body muted>
          {family?.sos
            ? `Someone is demanding money from him and he may be on a call right now (${new Date(family.sos.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}). `
            : `${studentName} paused all money from his phone. `}
          No payment can leave, including rent, until you lift it.
        </Body>
        {family?.sos?.demand ? (
          <Small muted={false}>He says they are asking for: {family.sos.demand.replace("_", " ")}.</Small>
        ) : null}
      </Card>

      {family?.sos ? (
        <SecondaryButton
          label={`Video call ${studentName} now`}
          onPress={() => void Linking.openURL(videoCallUrl(family.sos!.room))}
        />
      ) : null}

      <Card>
        <Body>Talk to him first, on video if you can.</Body>
        <Small>
          He may have done this because someone was watching his screen. Lifting it is
          safe, but there is no hurry: nothing can be lost while it is paused.
        </Small>
      </Card>

      <TrustButton label="Lift the pause" subtitle={t("faceId", lang)} onPress={lift} busy={busy} />
      {error ? <ErrorNote message={error} /> : null}
      <SecondaryButton label={t("back", lang)} onPress={() => router.back()} />
      <Proof>Only your passkey can lift this. Not ours, and not his.</Proof>
    </Screen>
  );
}
