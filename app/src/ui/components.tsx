import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, LAYOUT, radius, shadow, space, type as type_ } from "@/theme";

/**
 * The shared pieces every screen is built from.
 *
 * Two of them carry product meaning rather than styling:
 *
 *   `TrustButton` is the only purple button in the app. It is used where a passkey acts
 *   and nowhere else, so purple always means a real family member authorised something.
 *
 *   `FamilyThread` is the brand: a thin purple line joining the two avatars, which pulses
 *   whenever the guardian acts. It is the family link, made visible, and it appears on
 *   every screen for both roles.
 */

export function Screen({
  children,
  scroll = true,
  tint = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  tint?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = (
    <View
      style={[
        styles.column,
        { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl },
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.screen, tint && { backgroundColor: colors.bgTint }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

export function Card({
  children,
  style,
  tone,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: { bg: string; accent?: string };
}) {
  return (
    <View
      style={[
        styles.card,
        tone && { backgroundColor: tone.bg },
        tone?.accent && { borderColor: tone.accent, borderWidth: 1 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type_.title, { color: colors.ink }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type_.heading, { color: colors.ink }, style]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[type_.body, { color: muted ? colors.inkMuted : colors.ink }, style]}>
      {children}
    </Text>
  );
}

export function Small({
  children,
  muted = true,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[type_.small, { color: muted ? colors.inkMuted : colors.ink }, style]}>
      {children}
    </Text>
  );
}

/** Receipt numbers, latency, block height. Mono, and only here. */
export function Proof({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type_.proof, { color: colors.inkFaint }, style]}>{children}</Text>;
}

export function Amount({
  children,
  small,
  color = colors.ink,
}: {
  children: React.ReactNode;
  small?: boolean;
  color?: string;
}) {
  return <Text style={[small ? type_.amountSmall : type_.amount, { color }]}>{children}</Text>;
}

/**
 * The guardian's button. The only purple one in the app.
 *
 * Every use of this means a passkey is about to be asked for, so the colour is a promise
 * to the user rather than a theme choice.
 */
export function TrustButton({
  label,
  onPress,
  busy,
  disabled,
  subtitle,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  subtitle?: string;
}) {
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(busy) }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.trustButton,
        shadow.trust as ViewStyle,
        pressed && { transform: [{ scale: 0.985 }] },
        inactive && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.onTrust} />
      ) : (
        <>
          <Text style={[type_.bodyStrong, { color: colors.onTrust, fontSize: 17 }]}>{label}</Text>
          {subtitle ? (
            <Text style={[type_.small, { color: colors.onTrust, opacity: 0.75, marginTop: 2 }]}>
              {subtitle}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  busy,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const inactive = busy || disabled;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.secondaryButton,
        danger && { borderColor: colors.scam, backgroundColor: colors.scamSoft },
        pressed && { opacity: 0.75 },
        inactive && { opacity: 0.5 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={[type_.bodyStrong, { color: danger ? colors.scamInk : colors.ink }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: "neutral" | "arrived" | "held" | "scam" | "trust";
  icon?: string;
}) {
  const palette = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkMuted },
    arrived: { bg: colors.arrivedSoft, fg: colors.arrivedInk },
    held: { bg: colors.heldSoft, fg: colors.heldInk },
    scam: { bg: colors.scamSoft, fg: colors.scamInk },
    trust: { bg: colors.trustSoft, fg: colors.trustInk },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[type_.label, { color: palette.fg }]}>
        {icon ? `${icon}  ` : ""}
        {label}
      </Text>
    </View>
  );
}

/** An avatar. Real family photos would go here; initials stand in until then. */
export function Avatar({
  name,
  size = 44,
  tone = "neutral",
}: {
  name: string;
  size?: number;
  tone?: "neutral" | "trust";
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tone === "trust" ? colors.trustSoft : colors.surfaceMuted,
        },
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.4,
          fontWeight: "700",
          color: tone === "trust" ? colors.trustInk : colors.inkMuted,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

/**
 * The thread: the brand motif.
 *
 * A thin purple line joining the student and the guardian. It pulses whenever the
 * guardian acts, which is the one moment the family link is doing visible work. On every
 * screen, for both roles, because the architecture *is* the family.
 */
export function FamilyThread({
  studentName,
  guardianName,
  pulse = false,
  caption,
}: {
  studentName: string;
  guardianName: string;
  pulse?: boolean;
  caption?: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pulse) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, progress]);

  const threadOpacity = pulse
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
    : 0.45;
  const threadHeight = pulse ? progress.interpolate({ inputRange: [0, 1], outputRange: [1.5, 3] }) : 1.5;

  return (
    <View style={styles.thread}>
      <View style={styles.threadRow}>
        <Avatar name={studentName} size={40} />
        <View style={styles.threadLineWrap}>
          <Animated.View
            style={[styles.threadLine, { opacity: threadOpacity, height: threadHeight }]}
          />
        </View>
        <Avatar name={guardianName} size={40} tone="trust" />
      </View>
      {caption ? (
        <Text style={[type_.small, { color: colors.inkMuted, marginTop: space.sm }]}>{caption}</Text>
      ) : null}
    </View>
  );
}

/** A "Signed by" seal. Purple, because a passkey produced it. */
export function TrustSeal({ label, detail }: { label: string; detail?: string }) {
  return (
    <View style={styles.seal}>
      <View style={styles.sealDot} />
      <View style={{ flex: 1 }}>
        <Text style={[type_.label, { color: colors.trustInk }]}>{label}</Text>
        {detail ? <Proof style={{ marginTop: 2 }}>{detail}</Proof> : null}
      </View>
    </View>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type_.label, { color: colors.inkMuted }]}>{label}</Text>
      {children}
      {hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <View style={styles.errorNote}>
      <Text style={[type_.small, { color: colors.scamInk }]}>{message}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1, alignItems: "center" },
  column: {
    width: "100%",
    maxWidth: LAYOUT.maxWidth,
    paddingHorizontal: LAYOUT.gutter,
    gap: space.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
    ...(shadow.card as object),
  },
  trustButton: {
    backgroundColor: colors.trust,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: space.md,
  },
  avatar: { alignItems: "center", justifyContent: "center" },
  thread: { alignItems: "center", gap: space.xs },
  threadRow: { flexDirection: "row", alignItems: "center", width: "100%" },
  threadLineWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.md },
  threadLine: { width: "100%", backgroundColor: colors.trust, borderRadius: 2 },
  seal: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: colors.trustSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  sealDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.trust },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: space.sm },
  errorNote: {
    backgroundColor: colors.scamSoft,
    borderRadius: radius.md,
    padding: space.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    fontSize: 17,
    color: colors.ink,
    minHeight: 52,
  },
});
