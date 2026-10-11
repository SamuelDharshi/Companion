import { useEffect, useState } from "react";
import { TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Body,
  Card,
  ErrorNote,
  Field,
  Screen,
  Small,
  Title,
  TrustButton,
  styles as ui,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { t } from "@/i18n/strings";
import { api } from "@/api/client";
import { acceptAsGuardian } from "@/actions/onboarding";
import { passkeySupport } from "@/config";
import { setDeviceState, useDeviceState } from "@/state/store";

/**
 * Kavya's only setup screen.
 *
 * Larger type, one button. The design brief is that a parent who has
 * never installed an app should finish this without being talked through it, so there is
 * exactly one decision on the screen and no way to get it wrong.
 */
export default function Accept() {
  const router = useRouter();
  const device = useDeviceState();
  const params = useLocalSearchParams<{ code?: string }>();

  const [code, setCode] = useState(params.code ?? "");
  const [name, setName] = useState("");
  const [studentName, setStudentName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const support = passkeySupport();

  // Resolve the link so the screen can say the child's name rather than "a student".
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void api
      .invite(code)
      .then((invite) => {
        if (cancelled) return;
        setStudentName(invite.studentName);
        if (invite.familyId) {
          // Already set up: this is a returning guardian, not a new invite.
          setError("This family is already set up. Tap Face ID on the Companion home screen.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("This invite link is not valid.");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function accept() {
    setBusy(true);
    setError(undefined);
    try {
      const result = await acceptAsGuardian(code.trim(), name.trim() || "Kavya");
      await setDeviceState({ lang: device.lang });
      router.replace({ pathname: "/onboard/envelope", params: { familyId: result.familyId } });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const who = studentName ?? "Your child";

  return (
    <Screen tint>
      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Title>{t("acceptInviteTitle", "en", { name: who })}</Title>
      </View>

      <Card>
        <Body muted>{t("acceptInviteBody", "en")}</Body>
      </Card>

      {!params.code ? (
        <Card>
          <Field label="Invite code" hint="From the WhatsApp link your child sent.">
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Paste the code"
              placeholderTextColor={colors.inkFaint}
              autoCapitalize="none"
              style={ui.input}
              editable={!busy}
            />
          </Field>
        </Card>
      ) : null}

      <Card>
        <Field label={t("yourName", "en")}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Kavya"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="words"
            style={ui.input}
            editable={!busy}
          />
        </Field>

        <TrustButton
          label={t("acceptWithFaceId", "en")}
          onPress={accept}
          busy={busy}
          disabled={!code.trim() || !support.supported}
        />
        <Small>
          {t("acceptInviteBody", "en")} Nothing else to fill in.
        </Small>
      </Card>

      {!support.supported ? <ErrorNote message={support.reason!} /> : null}
      {error ? <ErrorNote message={error} /> : null}
    </Screen>
  );
}
