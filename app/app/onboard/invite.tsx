import { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
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
  TrustButton,
} from "@/ui/components";
import { space } from "@/theme";
import { t } from "@/i18n/strings";
import { inviteUrl, pollForGuardian, whatsAppInvite } from "@/actions/onboarding";
import { useDeviceState } from "@/state/store";

/**
 * "Invite Kavya as your Companion."
 *
 * WhatsApp is the channel, not email and not an in-app invite, because that is where a
 * Chennai family actually talks. The link opens straight onto her accept screen, so the
 * only thing she ever does is one Face ID.
 */
export default function Invite() {
  const router = useRouter();
  const device = useDeviceState();
  const [copied, setCopied] = useState(false);

  const code = device.inviteCode;
  const url = code ? inviteUrl(code) : "";

  // Poll until she accepts. That moment is also when the family is created onchain.
  useEffect(() => {
    if (!code || device.familyId) return;
    const timer = setInterval(async () => {
      try {
        const familyId = await pollForGuardian(code);
        if (familyId) router.replace("/student");
      } catch {
        // Offline for a moment: keep waiting rather than showing her son an error.
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [code, device.familyId, router]);

  async function share() {
    if (!code) return;
    const link = whatsAppInvite(code, "Arjun");
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(link, "_blank");
      return;
    }
    await Linking.openURL(link);
  }

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Title>{t("inviteGuardianTitle", device.lang)}</Title>
        <Body muted>{t("inviteGuardianBody", device.lang)}</Body>
      </View>

      <Card>
        <FamilyThread
          studentName="You"
          guardianName="Kavya"
          pulse
          caption={t("waitingForGuardian", device.lang)}
        />
      </Card>

      <Card>
        <TrustButton label={t("shareOnWhatsApp", device.lang)} onPress={share} />
        <SecondaryButton
          label={copied ? "Copied" : t("copyInviteLink", device.lang)}
          onPress={copy}
        />
        <Proof>{url}</Proof>
        <Small>
          She opens it, taps Face ID once, and she is your Companion. She never has to set
          anything up.
        </Small>
      </Card>

      <Card>
        <Pill label="Waiting" tone="held" icon="⏳" />
        <Small>
          Your family is created the moment she accepts. Until then there is nothing to
          protect, so we have not written anything to the blockchain yet.
        </Small>
      </Card>
    </Screen>
  );
}
