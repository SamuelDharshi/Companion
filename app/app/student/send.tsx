import { useEffect, useState } from "react";
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
import { api } from "@/api/client";
import { normalizeContact, toUnits } from "@thunai/shared";
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
 * entered fresh by NAME and PHONE or EMAIL, which will open a hold. Nobody types or sees a
 * blockchain address: the server turns the contact into the person to pay. Both paths are shown
 * plainly so there is no surprise about which one is about to happen.
 */
export default function Send() {
  const router = useRouter();
  const device = useDeviceState();
  const { data: family } = useFamily(device.familyId);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  // The person to pay, once a name and contact have been looked up (or a saved person was tapped).
  const [payee, setPayee] = useState<{ address: Address; label: string; scheduled: boolean } | undefined>();
  const [contactError, setContactError] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const lang = device.lang;
  const scheduled = family?.payees.filter((saved) => saved.scheduled) ?? [];
  const willPayThrough = payee?.scheduled ?? false;

  // Look the person up shortly after they stop typing, so the card below can say "pays straight through" or
  // "we will hold it" before anything is sent. A picked saved person skips this.
  useEffect(() => {
    if (!device.familyId || !name.trim() || !contact.trim()) {
      setContactError(undefined);
      return;
    }
    try {
      normalizeContact(contact);
    } catch (cause) {
      setPayee(undefined);
      setContactError((cause as Error).message);
      return;
    }
    setContactError(undefined);
    const familyId = device.familyId;
    const timer = setTimeout(() => {
      api
        .resolvePayee({ familyId, name: name.trim(), contact })
        .then((found) =>
          setPayee({ address: found.address, label: `${found.name} (${found.contact})`, scheduled: found.scheduled }),
        )
        .catch((cause) => setContactError((cause as Error).message));
    }, 450);
    return () => clearTimeout(timer);
  }, [device.familyId, name, contact]);

  async function send() {
    if (!device.familyId) return;
    if (!payee) {
      setError(contactError ?? "Who is this going to? Add their name and phone number or email.");
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
    // Say it plainly before the contract does: it refuses a payment larger than the balance.
    if (family && toUnits(amountUsd) > BigInt(family.balance)) {
      setError(
        `You have ${family.balanceLabel}. Ask ${family.guardianName ?? "your parent"} to send money first, or send a smaller amount.`,
      );
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      const result = await sendMoney({
        familyId: device.familyId,
        to: payee.address,
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
        {scheduled.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Small>Already approved by {family?.guardianName ?? "Kavya"}:</Small>
            {scheduled.map((saved) => (
              <SecondaryButton
                key={saved.address}
                label={saved.name}
                onPress={() => {
                  setName("");
                  setContact("");
                  setContactError(undefined);
                  setPayee({ address: saved.address, label: saved.name, scheduled: true });
                }}
              />
            ))}
          </View>
        ) : null}

        {payee && !name && !contact ? (
          <Small>Sending to {payee.label}.</Small>
        ) : null}

        <Field label="Someone else: their name">
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setPayee(undefined);
            }}
            placeholder="Ravi Kumar"
            placeholderTextColor={colors.inkFaint}
            style={ui.input}
            editable={!busy}
          />
        </Field>

        <Field
          label="Their phone number or email"
          hint={contactError ?? (payee && (name || contact) ? `Sending to ${payee.label}.` : "With the country code, like +91 98765 43210.")}
        >
          <TextInput
            value={contact}
            onChangeText={(value) => {
              setContact(value);
              setPayee(undefined);
            }}
            placeholder="+91 98765 43210 or name@email.com"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            style={ui.input}
            editable={!busy}
          />
        </Field>

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
