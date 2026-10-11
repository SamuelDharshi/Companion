import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  TrustSeal,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { t } from "@/i18n/strings";
import { freezeEverything, proveLiveness } from "@/actions/money";
import { useDeviceState } from "@/state/store";
import { useFamily } from "@/hooks/useThunai";

/**
 * "Kavya is checking on you."
 *
 * One tap proves the phone is in Arjun's hands right now. A cloned voice cannot produce
 * this, which is the entire claim: *a voice can be cloned, a passkey cannot*.
 *
 * The second button is the duress option. If he is being watched or coerced, it looks like
 * an ordinary secondary action but signs with the `thunai/duress` key and freezes every
 * outflow instead. It holds no funds, so handing it over costs nothing, and only Kavya's
 * passkey can lift the freeze.
 */
export default function Check() {
  const router = useRouter();
  const device = useDeviceState();
  const params = useLocalSearchParams<{ nonce?: string }>();
  const { data: family } = useFamily(device.familyId);

  const [busy, setBusy] = useState<"prove" | "duress" | undefined>();
  const [proved, setProved] = useState<number | undefined>();
  const [frozen, setFrozen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const lang = device.lang;
  const nonce = params.nonce ?? (family && family.checkNonce !== "0" ? family.checkNonce : undefined);

  async function prove() {
    if (!device.familyId || !nonce) return;
    setBusy("prove");
    setError(undefined);
    try {
      const result = await proveLiveness({ familyId: device.familyId, nonce });
      setProved(result.latencyMs);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function duress() {
    if (!device.familyId) return;
    setBusy("duress");
    setError(undefined);
    try {
      await freezeEverything(device.familyId);
      setFrozen(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  if (frozen) {
    return (
      <Screen>
        <Card tone={{ bg: colors.trustSoft, accent: colors.trust }}>
          <Title>Everything is paused.</Title>
          <Body muted>
            No money can leave until {family?.guardianName ?? "Kavya"} unlocks it with her
            Face ID. We have told her.
          </Body>
        </Card>
        <SecondaryButton label={t("done", lang)} onPress={() => router.replace("/student")} />
      </Screen>
    );
  }

  if (proved !== undefined) {
    return (
      <Screen>
        <Card tone={{ bg: colors.arrivedSoft, accent: colors.arrived }}>
          <Title>Done. {family?.guardianName ?? "Kavya"} can see it was you.</Title>
          <TrustSeal label="Signed on your phone" detail={`${(proved / 1000).toFixed(1)}s · verified onchain`} />
        </Card>
        <SecondaryButton label={t("done", lang)} onPress={() => router.replace("/student")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Title>{t("checkRequestTitle", lang)}</Title>
        <Body muted>{t("checkRequestBody", lang)}</Body>
      </View>

      {!nonce ? (
        <Card>
          <Body>Nothing is waiting for you right now.</Body>
          <SecondaryButton label={t("back", lang)} onPress={() => router.replace("/student")} />
        </Card>
      ) : (
        <>
          <TrustButton
            label={t("faceId", lang)}
            subtitle="Shows it's really you, right now"
            onPress={prove}
            busy={busy === "prove"}
          />

          {/*
            The duress path. Phrased so it reads as an ordinary option on a shoulder-surfed
            screen, while actually freezing every outflow.
          */}
          <SecondaryButton
            label={t("imNotSafe", lang)}
            onPress={duress}
            busy={busy === "duress"}
            danger
          />
          <Small>
            Use that if someone is making you do this. It stops all money immediately and
            tells your family, without telling them anything on this screen.
          </Small>
        </>
      )}

      {error ? <ErrorNote message={error} /> : null}
      <Proof>A voice on a call can be copied. This cannot.</Proof>
    </Screen>
  );
}
