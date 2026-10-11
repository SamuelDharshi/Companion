import { useState } from "react";
import { TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Body,
  Card,
  Divider,
  ErrorNote,
  Field,
  Proof,
  Screen,
  SecondaryButton,
  Small,
  Title,
  TrustButton,
  styles as ui,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { t } from "@/i18n/strings";
import { useFamily } from "@/hooks/useThunai";
import { SessionExpiredError, sendMoney } from "@/actions/money";
import SessionPrompt from "@/ui/SessionPrompt";
import { useDeviceState } from "@/state/store";
import type { Address } from "viem";

/**
 * Sending money.
 *
 * "What's this for?" is required, and that is a product decision rather than a form
 * validation one. It is the strongest signal the classifier gets, and a person made to
 * type "immigration bond for ICE officer" occasionally hears what they are saying.
 *
 * The payee can be chosen from the family's schedule, which pays straight through, or
 * entered fresh, which will open a hold. Both paths are shown plainly so there is no
 * surprise about which one is about to happen.
 */
export default function Send() {
  const router = useRouter();
  const device = useDeviceState();
  const { data: family } = useFamily(device.familyId);

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const lang = device.lang;
  const scheduled = family?.payees.filter((payee) => payee.scheduled) ?? [];
  const willPayThrough = scheduled.some((payee) => payee.address.toLowerCase() === to.toLowerCase());

  async function send() {
    if (!device.familyId) return;
    if (!to.trim()) {
      setError("Who is this going to?");
      return;
    }
    const amountUsd = Number(amount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      setError("How much?");
      return;
    }
    if (!memo.trim()) {
      setError(t("whatsThisForRequired", lang));
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const result = await sendMoney({
        familyId: device.familyId,
        to: to.trim() as Address,
        amountUsd,
        memo: memo.trim(),
        callDurationMinutes: minutes ? Number(minutes) : undefined,
      });

      if (result.held) {
        router.replace(`/hold/${result.holdId}`);
      } else {
        router.replace("/student");
      }
    } catch (cause) {
      // An expired signing session is normal, not an error: ask for Face ID and go again.
      if (cause instanceof SessionExpiredError) setExpired(true);
      else setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t("sendTitle", lang)}</Title>

      {expired ? <SessionPrompt onRenewed={() => setExpired(false)} /> : null}

      <Card>
        <Field label={t("toWhom", lang)}>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="Paste who it's going to"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            style={ui.input}
            editable={!busy}
          />
        </Field>

        {scheduled.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Small>Already approved by {family?.guardianName ?? "Kavya"}:</Small>
            {scheduled.map((payee) => (
              <SecondaryButton
                key={payee.address}
                label={payee.name}
                onPress={() => setTo(payee.address)}
              />
            ))}
          </View>
        ) : null}

        <Divider />

        <Field label={t("amount", lang)}>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.inkFaint}
            style={ui.input}
            editable={!busy}
          />
        </Field>
      </Card>

      <Card>
        <Field label={t("whatsThisFor", lang)} hint={t("whatsThisForHint", lang)}>
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="Rent for November"
            placeholderTextColor={colors.inkFaint}
            multiline
            style={[ui.input, { minHeight: 84, textAlignVertical: "top", paddingTop: space.md }]}
            editable={!busy}
          />
        </Field>

        <Field label={t("onACall", lang)} hint={t("onACallHint", lang)}>
          <TextInput
            value={minutes}
            onChangeText={setMinutes}
            keyboardType="number-pad"
            placeholder="Minutes, if you are"
            placeholderTextColor={colors.inkFaint}
            style={ui.input}
            editable={!busy}
          />
        </Field>
      </Card>

      {/* Say what is about to happen before it happens. */}
      <Card tone={willPayThrough ? { bg: colors.arrivedSoft } : { bg: colors.heldSoft }}>
        <Body>
          {willPayThrough
            ? `This one pays straight through. ${family?.guardianName ?? "Kavya"} already approved it.`
            : `This is someone new, so we will hold it and ask ${family?.guardianName ?? "Kavya"} first.`}
        </Body>
      </Card>

      <TrustButton label={t("sendNow", lang)} onPress={send} busy={busy} />
      {error ? <ErrorNote message={error} /> : null}

      <SecondaryButton label={t("cancel", lang)} onPress={() => router.back()} />
      <Proof>Available: {family?.balanceLabel ?? "—"}</Proof>
    </Screen>
  );
}
