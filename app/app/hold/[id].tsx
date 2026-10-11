import { useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { HOLD_REASON, HOLD_STATUS, formatAgo, formatCountdown, handleHash } from "@thunai/shared";
import {
  Amount,
  Body,
  Card,
  Divider,
  ErrorNote,
  FamilyThread,
  Heading,
  Pill,
  Proof,
  Screen,
  SecondaryButton,
  Small,
  Title,
  TrustButton,
  TrustSeal,
} from "@/ui/components";
import { colors, reasonTone, space } from "@/theme";
import { scriptName, t, type StringKey } from "@/i18n/strings";
import { useAsync, useCountdown, useFamily, useHold, useHoldBrief } from "@/hooks/useThunai";
import { loadEvidence } from "@/network";
import { reportPayee, resolveHold } from "@/actions/money";
import { useDeviceState } from "@/state/store";

/**
 * The hold screen: the moment the product exists for.
 *
 * One route, two very different jobs:
 *
 *   Arjun sees reassurance. The money is safe, his family has been asked, and it comes
 *   back by itself if nobody answers. He is given nothing to decide, because under
 *   pressure from a scammer any button he can press is a button he can be made to press.
 *
 *   Kavya sees a decision. Two buttons, the scam named in plain words, and the line that
 *   makes stopping it easy: "Not sure? Stop it. He gets his money back."
 */
export default function HoldScreen() {
  const router = useRouter();
  const device = useDeviceState();
  const params = useLocalSearchParams<{ id?: string }>();
  const holdId = params.id;

  const { data: hold, error, refresh } = useHold(holdId);
  // The network's evidence: from the Envio indexer when it is connected, otherwise the contract's own
  // counter that the relayer already put on the hold. Either way it is the contract's number.
  const { data: evidence } = useAsync(
    async () =>
      hold
        ? loadEvidence(handleHash(hold.to), { count: hold.networkFlagCount, lastAt: hold.networkLastAt })
        : undefined,
    [hold?.to, hold?.networkFlagCount],
  );
  const { data: brief } = useHoldBrief(holdId);
  const { data: family } = useFamily(device.familyId);

  const secondsLeft = useCountdown(hold ? Number(hold.releaseAt) : undefined);
  const [busy, setBusy] = useState<"stop" | "allow" | "report" | undefined>();
  const [actionError, setActionError] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<{ released: boolean; seconds: number } | undefined>();
  const [reported, setReported] = useState(false);

  const lang = device.lang;
  const isGuardian = device.role === "guardian";
  const studentName = family?.studentName ?? "your child";
  const payee = hold?.payeeName ?? "someone new";
  const settled = hold ? hold.status !== HOLD_STATUS.OPEN : false;

  async function decide(release: boolean) {
    if (!hold || !device.familyId) return;
    setBusy(release ? "allow" : "stop");
    setActionError(undefined);
    try {
      const result = await resolveHold({
        familyId: device.familyId,
        holdId: hold.holdId,
        release,
      });
      setOutcome({ released: release, seconds: result.secondsToResolve });
      refresh();
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  /** Only offered after a cancel, because only a cancelled hold can back a report. */
  async function report() {
    if (!hold || !device.familyId) return;
    setBusy("report");
    setActionError(undefined);
    try {
      await reportPayee({
        familyId: device.familyId,
        holdId: hold.holdId,
        payee: hold.to,
        scriptId: brief?.classification.scriptId ?? 0,
      });
      setReported(true);
    } catch (cause) {
      setActionError((cause as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  if (error) {
    return (
      <Screen>
        <ErrorNote message={error} />
        <SecondaryButton label={t("back", lang)} onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  if (!hold) {
    return (
      <Screen>
        <Small>{t("loading", lang)}</Small>
      </Screen>
    );
  }

  const tone = reasonTone(hold.reason);

  // ---------------------------------------------------- already decided

  if (settled || outcome) {
    const cancelled =
      outcome?.released === false ||
      hold.status === HOLD_STATUS.CANCELLED ||
      hold.status === HOLD_STATUS.EXPIRED;
    const expired = hold.status === HOLD_STATUS.EXPIRED;

    return (
      <Screen>
        <Card tone={{ bg: cancelled ? colors.arrivedSoft : colors.surfaceMuted }}>
          <Title>
            {expired
              ? t("noOneAnswered", lang)
              : cancelled
                ? t("guardianStoppedThis", lang, { amount: hold.amountLabel })
                : t("guardianAllowedThis", lang)}
          </Title>
          {outcome ? (
            <TrustSeal
              label={t("signedBy", lang, { name: family?.guardianName ?? "Kavya" })}
              detail={`decided in ${outcome.seconds}s · verified onchain`}
            />
          ) : null}
        </Card>

        {/* The network step. Available only because a guardian actually cancelled. */}
        {isGuardian && cancelled && !expired ? (
          <Card>
            <Heading>{t("reportThisPayee", lang)}</Heading>
            <Body muted>{t("reportThisPayeeBody", lang)}</Body>
            {reported ? (
              <Pill label={t("reportSent", lang)} tone="trust" icon="✓" />
            ) : (
              <TrustButton
                label={t("reportThisPayee", lang)}
                onPress={report}
                busy={busy === "report"}
              />
            )}
          </Card>
        ) : null}

        {actionError ? <ErrorNote message={actionError} /> : null}
        <SecondaryButton
          label={t("done", lang)}
          onPress={() => router.replace(isGuardian ? "/guardian" : "/student")}
        />
      </Screen>
    );
  }

  // ------------------------------------------------------------- open

  return (
    <Screen>
      <Card tone={{ bg: tone.bg, accent: tone.accent }}>
        <Small muted={false} style={{ color: tone.fg }}>
          {isGuardian
            ? t("studentNeedsYou", lang, { name: studentName })
            : t("heldForSafety", lang, { amount: "" }).replace(":", "")}
        </Small>
        <Amount color={tone.fg}>{hold.amountLabel}</Amount>

        {isGuardian ? (
          <>
            <Body>
              {t("tryingToSend", "en", {
                name: studentName,
                amount: hold.amountLabel,
                memo: brief?.memo ?? "",
              })}
            </Body>
          </>
        ) : (
          <Body>{t(reasonKey(hold.reason), lang)}</Body>
        )}
      </Card>

      {/* What the agent read in the situation. Absent is fine: the hold stands anyway. */}
      {brief ? (
        <Card>
          <Heading>
            {t("looksLikeScam", lang, {
              script: scriptName(brief.classification.scriptId, lang),
            })}
          </Heading>
          <Body muted>
            {brief.classification.explanation_en}
          </Body>
          {brief.callDurationMinutes ? (
            <Small>
              {t("onCallForMinutes", lang, {
                name: studentName,
                minutes: brief.callDurationMinutes,
              })}
            </Small>
          ) : null}
          <Proof>
            Labelled by {brief.classifierSource === "model" ? "Companion's agent" : "Companion's rules"} ·
            the hold was opened by the contract before this ran
          </Proof>
        </Card>
      ) : null}

      {/* The network's evidence, when there is any. */}
      {(evidence?.count ?? hold.networkFlagCount) > 0 ? (
        <Card tone={{ bg: colors.scamSoft, accent: colors.scam }}>
          <Body>
            {t("familiesReportedThis", lang, {
              count: evidence?.count ?? hold.networkFlagCount,
              ago: (evidence?.lastAt ?? hold.networkLastAt) ? formatAgo(evidence?.lastAt ?? hold.networkLastAt) : "recently",
            })}
          </Body>
        </Card>
      ) : null}

      {isGuardian ? (
        <>
          <TrustButton
            label={t("stopIt", "en")}
            subtitle={t("faceId", lang)}
            onPress={() => decide(false)}
            busy={busy === "stop"}
          />
          <SecondaryButton
            label={t("allowIt", "en")}
            onPress={() => decide(true)}
            busy={busy === "allow"}
          />
          <Small muted={false} style={{ textAlign: "center" }}>
            {t("notSureStopIt", lang, { name: studentName })}
          </Small>
        </>
      ) : (
        <Card>
          <Pill
            label={`${t("guardianReviewing", lang)}  ${formatCountdown(secondsLeft)}`}
            tone="held"
            icon="⏳"
          />
          <Body muted>{t("heldWeAskedGuardian", lang)}</Body>
          <Divider />
          <Small>{t("realOfficersNever", lang)}</Small>
          <Small muted={false}>{t("moneyComesBackAutomatically", lang)}</Small>
        </Card>
      )}

      <Card>
        <FamilyThread
          studentName={studentName}
          guardianName={family?.guardianName ?? "Kavya"}
          pulse
        />
      </Card>

      {actionError ? <ErrorNote message={actionError} /> : null}

      <Proof>
        {t("receiptNumber", lang)} #{hold.holdId} · held {formatAgo(Number(hold.openedAt))} · {hold.reasonName}
      </Proof>
    </Screen>
  );
}

/** The one sentence that explains why this stopped, in the student's words. */
function reasonKey(reason: number): StringKey {
  switch (reason) {
    case HOLD_REASON.OVER_CAP:
      return "heldOverCap";
    case HOLD_REASON.NETWORK_FLAG:
      return "heldNetworkFlag";
    case HOLD_REASON.CHECK_PENDING:
      return "heldCheckPending";
    case HOLD_REASON.FROZEN:
      return "heldFrozen";
    default:
      return "heldNewPayee";
  }
}
