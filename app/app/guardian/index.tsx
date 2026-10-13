import { useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { formatUsd } from "@thunai/shared";
import {
  Amount,
  Body,
  Card,
  ErrorNote,
  FamilyThread,
  Pill,
  Screen,
  SecondaryButton,
  Small,
  Title,
  TrustButton,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { t } from "@/i18n/strings";
import { useFamily } from "@/hooks/useThunai";
import { SessionExpiredError, requestCheck, sendMoneyNow, videoCallUrl } from "@/actions/money";
import { useDeviceState } from "@/state/store";
import AlertsCard from "@/ui/AlertsCard";
import LatencyCard from "@/ui/LatencyCard";
import SessionPrompt from "@/ui/SessionPrompt";

/**
 * Kavya's home. Deliberately tiny.
 *
 * Three states and no more: all good, something needs you, or a check is out. The big
 * purple button is "Check on Arjun", because the thing a parent reaches for after a
 * frightening phone call is proof that her child is actually there.
 *
 * The language toggle was removed: the app is English only. The details link is here, not in a
 * settings screen she will never open.
 */
export default function GuardianHome() {
  const router = useRouter();
  const device = useDeviceState();
  const { data: family, error, refresh } = useFamily(device.familyId);

  const [busy, setBusy] = useState<"check" | "send" | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [expired, setExpired] = useState(false);
  const [note, setNote] = useState<string | undefined>();

  const lang = device.lang;
  const studentName = family?.studentName ?? "your child";
  const guardianName = family?.guardianName ?? "Kavya";

  const openHold = family?.openHolds?.[0];
  const checkPending = family ? family.checkNonce !== "0" : false;

  // Anything waiting takes over the screen. She should never have to go looking for it.
  useEffect(() => {
    if (openHold) router.push(`/hold/${openHold}`);
  }, [openHold, router]);

  async function onCheck() {
    if (!device.familyId) return;
    setBusy("check");
    setActionError(undefined);
    try {
      const { nonce } = await requestCheck(device.familyId);
      router.push({ pathname: "/guardian/check", params: { nonce } });
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function onSend() {
    if (!device.familyId || !family) return;
    // The vault refuses deposits while the family is paused, so say why instead of sending a doomed request.
    if (family.frozen) {
      setActionError(`Money is paused because ${studentName} pressed SOS. Tap "Lift the pause" below first, then send.`);
      return;
    }
    setBusy("send");
    setActionError(undefined);
    try {
      const weekly = family.env.weeklyAmount !== "0" ? Number(family.env.weeklyAmount) / 1e6 : 150;
      const result = await sendMoneyNow({ familyId: device.familyId, amountUsd: weekly });
      setNote(`Sent. It arrived in ${(result.latencyMs / 1000).toFixed(1)}s.`);
      refresh();
    } catch (cause) {
      if (cause instanceof SessionExpiredError) setExpired(true);
      else setActionError((cause as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <Screen tint>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Small muted={false} style={{ color: colors.trustText, fontWeight: "600" }}>
          {t("appName", "en")}
        </Small>
        <View style={{ flexDirection: "row", gap: space.lg }}>
          <Pressable onPress={() => router.push("/details")} hitSlop={12}>
            <Small>{t("details", lang)}</Small>
          </Pressable>
        </View>
      </View>

      {/* The status pill: the one thing she reads first. */}
      <Card
        tone={
          checkPending
            ? { bg: colors.heldSoft, accent: colors.held }
            : { bg: colors.arrivedSoft, accent: colors.arrived }
        }
      >
        <Title>{checkPending ? t("checkingOnStudent", "en", { name: studentName }) : t("allGood", "en")}</Title>
        <Body muted>
          {checkPending
            ? t("noReplyYet", lang)
            : t("allGoodSub", lang, { name: studentName })}
        </Body>
      </Card>

      <Card>
        <FamilyThread
          studentName={studentName}
          guardianName={guardianName}
          pulse={checkPending}
          caption={
            family && family.balance !== "0"
              ? `${studentName} has ${family.balanceLabel} available`
              : undefined
          }
        />
      </Card>

      <AlertsCard />

      {/* The main action. Purple, because her passkey is about to be used. */}
      <TrustButton
        label={t("checkOnStudent", "en", { name: studentName })}
        onPress={onCheck}
        busy={busy === "check"}
      />
      <Small>
        {t("provesItsReallyThem", lang, { name: studentName })}
      </Small>
      <Small>Got a call saying {studentName} is in trouble? Check first. Do not send money to anyone until it shows a signature.</Small>

      <Card>
        <Small>{t("weeklyAmount", lang)}</Small>
        <Amount small>
          {family && family.env.weeklyAmount !== "0"
            ? formatUsd(BigInt(family.env.weeklyAmount))
            : "—"}
        </Amount>
        {family?.allowanceDue ? <Pill label="Sending now" tone="arrived" icon="↑" /> : null}
        <SecondaryButton
          label={t("sendMoneyNow", "en")}
          onPress={onSend}
          busy={busy === "send"}
        />
        {note ? <Small muted={false}>{note}</Small> : null}
      </Card>

      <LatencyCard />

      {family?.frozen ? (
        <Card tone={{ bg: colors.trustSoft, accent: colors.trust }}>
          <Body>{family.sos ? `${studentName} pressed SOS. Someone is demanding money from him.` : t("heldFrozen", lang)}</Body>
          {family.sos ? (
            <SecondaryButton
              label={`Video call ${studentName} now`}
              onPress={() => void Linking.openURL(videoCallUrl(family.sos!.room))}
            />
          ) : null}
          <SecondaryButton label="Lift the pause" onPress={() => router.push("/guardian/frozen")} />
        </Card>
      ) : null}

      {expired ? <SessionPrompt onRenewed={() => setExpired(false)} /> : null}
      {actionError ? <ErrorNote message={actionError} /> : null}
      {error ? <Small>{error}</Small> : null}

      <SecondaryButton label={t("familiesProtected", lang)} onPress={() => router.push("/network")} />
    </Screen>
  );
}
