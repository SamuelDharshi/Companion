import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { formatUsd, HOLD_STATUS } from "@thunai/shared";
import {
  Amount,
  Body,
  Card,
  Divider,
  FamilyThread,
  Heading,
  Pill,
  Screen,
  SecondaryButton,
  Small,
  TrustButton,
} from "@/ui/components";
import { colors, space } from "@/theme";
import AlertsCard from "@/ui/AlertsCard";
import LatencyCard from "@/ui/LatencyCard";
import { t } from "@/i18n/strings";
import { useFamily } from "@/hooks/useThunai";
import { useDeviceState } from "@/state/store";

/**
 * Arjun's home.
 *
 * The balance leads, because that is what he opens the app for. The guardian strip is
 * always visible, not buried in settings: the point of Companion is that the family link is
 * a feature he can see, not a restriction he discovers when something is blocked.
 */
export default function StudentHome() {
  const router = useRouter();
  const device = useDeviceState();
  const { data: family, error } = useFamily(device.familyId);

  // A held payment is the only thing that takes over the screen.
  useEffect(() => {
    if (!family) return;
    const openHold = family.openHolds?.[0];
    if (openHold) router.push(`/hold/${openHold}`);
  }, [family, router]);

  const lang = device.lang;
  const guardianName = family?.guardianName ?? "Kavya";
  const studentName = family?.studentName ?? "You";

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Small muted={false} style={{ color: colors.trustText, fontWeight: "600" }}>
          {t("appName", "en")}
        </Small>
        <Pressable onPress={() => router.push("/details")} hitSlop={12}>
          <Small muted={false} style={{ color: colors.inkMuted }}>
            {t("details", lang)}
          </Small>
        </Pressable>
      </View>

      <Card>
        <Small>{t("balance", lang)}</Small>
        <Amount>{family ? family.balanceLabel : "—"}</Amount>
        {family?.frozen ? (
          <Pill label={t("heldFrozen", lang)} tone="trust" icon="⏸" />
        ) : family?.env.weeklyAmount && family.env.weeklyAmount !== "0" ? (
          <Pill
            label={t("nextFromGuardian", lang, {
              when: nextRunLabel(family.env.nextRunAt),
              amount: formatUsd(BigInt(family.env.weeklyAmount)),
            })}
            tone="arrived"
            icon="↓"
          />
        ) : null}
      </Card>

      <Card>
        <FamilyThread
          studentName={studentName}
          guardianName={guardianName}
          caption={t("guardianIsYourThunai", lang, { name: guardianName })}
        />
      </Card>

      <TrustButton label={t("sendMoney", lang)} onPress={() => router.push("/student/send")} />

      <AlertsCard />

      {family?.payees.some((payee) => payee.scheduled) ? (
        <Card>
          <Heading>Scheduled</Heading>
          {family.payees
            .filter((payee) => payee.scheduled)
            .map((payee) => (
              <View key={payee.address} style={{ gap: 2 }}>
                <Body>{payee.name}</Body>
                <Small>{t("paidAutomatically", lang)}</Small>
              </View>
            ))}
          <Small>These pay straight through, because {guardianName} approved them.</Small>
        </Card>
      ) : null}

      <Card>
        <Heading>{t("activity", lang)}</Heading>
        {error ? (
          <Small>{error}</Small>
        ) : !family ? (
          <Small>{t("loading", lang)}</Small>
        ) : (
          <>
            {family.homeBalance !== "0" ? (
              <>
                <Small>From home, waiting to be sent on</Small>
                <Body>{family.homeBalanceLabel}</Body>
                <Divider />
              </>
            ) : null}
            <Small>{t("noActivityYet", lang)}</Small>
          </>
        )}
      </Card>

      <LatencyCard />

      <SecondaryButton label="Our network" onPress={() => router.push("/network")} />

      {/*
        Silent SOS. One tap, no confirmation screen, because the person pressing it may be on
        a call with someone watching. It pauses the money and tells the family at once.
      */}
      <View style={{ gap: space.xs, marginTop: space.md }}>
        <SecondaryButton label="Someone is asking me for money" onPress={() => router.push("/student/sos")} />
        <Small>Tell your family quietly. Works for gift cards, Zelle and wires too.</Small>
      </View>
    </Screen>
  );
}

/** "Sun" / "today", rather than a date a student has to decode. */
function nextRunLabel(nextRunAt: string): string {
  const seconds = Number(nextRunAt);
  if (!seconds) return "soon";
  const date = new Date(seconds * 1000);
  const now = new Date();
  if (date <= now) return "today";
  const sameWeek = date.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  return sameWeek
    ? date.toLocaleDateString("en-US", { weekday: "short" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
