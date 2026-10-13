import { useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Body,
  Card,
  ErrorNote,
  Pill,
  Screen,
  SecondaryButton,
  Small,
  Title,
  TrustButton,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { addSosDetail, freezeEverything, videoCallUrl } from "@/actions/money";
import type { DemandKind } from "@/api/client";
import { useDeviceState } from "@/state/store";
import { api } from "@/api/client";
import { useFamily } from "@/hooks/useThunai";

/**
 * Silent SOS.
 *
 * One tap on the home screen lands here, and the work starts at once: the family is frozen
 * onchain and the parent is paged. It never needs a second tap, because the person using
 * it may be on a call with someone watching.
 *
 * It does not depend on how the scammer wants to be paid. A gift card, a Zelle transfer or
 * a wire never touches Companion, and no app can block those. What every one of those scams
 * needs is a victim who is alone, and this is the one tap that ends that.
 */
const DEMANDS: { kind: DemandKind; label: string }[] = [
  { kind: "gift_card", label: "Gift cards" },
  { kind: "zelle", label: "Zelle or bank transfer" },
  { kind: "wire", label: "Wire" },
  { kind: "crypto", label: "Crypto" },
  { kind: "other", label: "Something else" },
];

export default function Sos() {
  const router = useRouter();
  const device = useDeviceState();
  const { data: family } = useFamily(device.familyId);

  const started = useRef(false);
  const [state, setState] = useState<"sending" | "sent" | "failed">("sending");
  const [room, setRoom] = useState<string | undefined>();
  const [demand, setDemand] = useState<DemandKind | undefined>();
  const [error, setError] = useState<string | undefined>();

  const guardianName = family?.guardianName ?? "your family";

  async function raise() {
    if (!device.familyId) return;
    setState("sending");
    setError(undefined);
    try {
      // Already paused (a second tap, or an SOS raised earlier): the family has been told, so don't sign another freeze.
      const current = await api.family(device.familyId).catch(() => undefined);
      if (current?.frozen) {
        setRoom(current.sos?.room);
        setState("sent");
        return;
      }
      const result = await freezeEverything(device.familyId, "sos");
      setRoom(result.room);
      setState("sent");
    } catch (cause) {
      setError((cause as Error).message);
      setState("failed");
    }
  }

  // Fire once on arrival. The ref stops a re-render from sending a second alarm.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void raise();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function tell(kind: DemandKind) {
    if (!device.familyId || demand) return;
    setDemand(kind);
    try {
      await addSosDetail(device.familyId, kind);
    } catch {
      // Optional extra. The alarm already went out, so a failure here is not worth showing.
    }
  }

  const callRoom = room ?? family?.sos?.room;

  if (state === "sending") {
    return (
      <Screen>
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Title>Telling {guardianName}…</Title>
          <Body muted>This takes a second.</Body>
        </View>
      </Screen>
    );
  }

  if (state === "failed") {
    return (
      <Screen>
        <View style={{ gap: space.sm, marginTop: space.xl }}>
          <Title>That did not go through</Title>
          <Body muted>Call or message {guardianName} yourself, right now. Then try again.</Body>
        </View>
        {error ? <ErrorNote message={error} /> : null}
        <TrustButton label="Try again" onPress={() => void raise()} />
        <SecondaryButton label="Back" onPress={() => router.replace("/student")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card tone={{ bg: colors.trustSoft, accent: colors.trust }}>
        <Pill label="Your family has been told" tone="trust" icon="✓" />
        <Title>You can hang up.</Title>
        <Body muted>
          Real officers never ask for payment by phone, gift card or crypto. {guardianName} knows and
          can see this.
        </Body>
        <Small>Your money in the app is paused. Only {guardianName}&apos;s Face ID can lift it.</Small>
      </Card>

      {callRoom ? (
        <TrustButton
          label={`Video call ${guardianName}`}
          subtitle="Opens a private call"
          onPress={() => void Linking.openURL(videoCallUrl(callRoom))}
        />
      ) : null}

      <Card>
        <Body>What are they asking for?</Body>
        <Small>Optional. It helps {guardianName} know what to say.</Small>
        {demand ? (
          <Small muted={false}>Thanks. We have told {guardianName}.</Small>
        ) : (
          <View style={{ gap: space.sm }}>
            {DEMANDS.map((d) => (
              <SecondaryButton key={d.kind} label={d.label} onPress={() => void tell(d.kind)} />
            ))}
          </View>
        )}
      </Card>

      <SecondaryButton label="Done" onPress={() => router.replace("/student")} />
    </Screen>
  );
}
