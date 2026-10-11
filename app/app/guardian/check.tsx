import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Body,
  Card,
  FamilyThread,
  Pill,
  Proof,
  Screen,
  SecondaryButton,
  Small,
  Title,
  TrustSeal,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { t } from "@/i18n/strings";
import { useFamily } from "@/hooks/useThunai";
import { useDeviceState } from "@/state/store";

/**
 * The check result, on Kavya's phone.
 *
 * This is woah #2 from the demo: a cloned voice says her son has been arrested, she taps
 * Check, and a second later his real phone answers with a signature the contract verified.
 *
 * The honest caveat is on screen, not buried: this proves the phone is in his hands, not
 * that he is safe. So it also tells her to call him on video. Overclaiming here would be
 * the single most harmful thing the product could do.
 */
export default function GuardianCheck() {
  const router = useRouter();
  const device = useDeviceState();
  const params = useLocalSearchParams<{ nonce?: string }>();
  const { data: family } = useFamily(device.familyId);

  const [waitedSeconds, setWaited] = useState(0);

  const lang = device.lang;
  const studentName = family?.studentName ?? "your child";
  // The contract clears the nonce the instant the student answers.
  const answered = family ? family.checkNonce === "0" : false;

  useEffect(() => {
    if (answered) return;
    const timer = setInterval(() => setWaited((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [answered]);

  return (
    <Screen tint>
      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Title>
          {answered
            ? t("signedOnTheirPhone", "en", { name: studentName, ago: "just now" })
            : t("checkingOnStudent", "en", { name: studentName })}
        </Title>
      </View>

      <Card
        tone={
          answered
            ? { bg: colors.arrivedSoft, accent: colors.arrived }
            : { bg: colors.heldSoft, accent: colors.held }
        }
      >
        {answered ? (
          <>
            <TrustSeal label="Signed on his own phone" detail="verified onchain" />
            <Body>{t("provesItsReallyThem", "en", { name: studentName })}</Body>
          </>
        ) : (
          <>
            <Pill label={`Waiting · ${waitedSeconds}s`} tone="held" icon="⏳" />
            <Body muted>We have asked {studentName} to tap his phone.</Body>
            {waitedSeconds > 120 ? <Body>{t("noReplyYet", lang)}</Body> : null}
          </>
        )}
      </Card>

      <Card>
        <FamilyThread
          studentName={studentName}
          guardianName={family?.guardianName ?? "Kavya"}
          pulse={!answered}
        />
      </Card>

      {/*
        The parent's side. A caller who says "your son is arrested" wants money from her bank,
        which never touches this app. This is the one place we can protect it: until his own
        phone has signed, the voice on the line is not proof of anything.
      */}
      {!answered ? (
        <Card tone={{ bg: colors.heldSoft, accent: colors.held }}>
          <Body>Do not send money to anyone until this shows a signature.</Body>
          <Small>That includes bank transfers, gift cards and crypto. A cloned voice can ask for any of them.</Small>
        </Card>
      ) : null}

      {/* The caveat, given equal weight to the good news. */}
      {answered ? (
        <Card>
          <Body muted>{t("doesNotProveSafe", "en")}</Body>
        </Card>
      ) : null}

      <SecondaryButton label={t("done", lang)} onPress={() => router.replace("/guardian")} />
      <Proof>A voice on a call can be copied. A passkey cannot.</Proof>
    </Screen>
  );
}
