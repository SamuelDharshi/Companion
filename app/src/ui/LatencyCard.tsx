import { View } from "react-native";
import { Body, Card, Small } from "@/ui/components";
import { colors, space } from "@/theme";
import { useConfig } from "@/hooks/useThunai";
import { useLastLatency } from "@/latency";

/**
 * "How fast." A bank transfer against the confirmation time this phone really measured.
 *
 * The bank figure is a typical range, not a measurement of anyone's transfer. The Companion figure
 * is the receipt time of the last transaction this phone made, and the card says which one. With
 * nothing measured yet it shows a dash rather than a number it has not earned.
 */
export default function LatencyCard() {
  const measured = useLastLatency();
  const { data: config } = useConfig();

  return (
    <Card>
      <Small>How fast</Small>
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Small>A bank transfer</Small>
          <Body>2–3 business days</Body>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Small>Companion</Small>
          <Body style={{ color: measured ? colors.trustText : colors.inkFaint }}>
            {measured ? `${(measured.ms / 1000).toFixed(1)} seconds` : "—"}
          </Body>
        </View>
      </View>
      <Small>
        {measured
          ? `Measured on ${measured.what}. Bank times are typical, not measured.`
          : "Make a payment to see how fast it is. Bank times are typical, not measured."}
      </Small>
      {config && !config.agoraEnabled ? (
        <Small>Settlement: pre-funded fallback while Agora whitelisting is pending.</Small>
      ) : null}
    </Card>
  );
}
