import { useEffect } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useDeviceState } from "@/state/store";
import { colors } from "@/theme";

/**
 * The router.
 *
 * One app, two roles, and the role was decided at invite time. A device that has been
 * onboarded goes straight to its own home screen; a fresh one goes to onboarding. A
 * student still waiting on his guardian goes back to the invite screen, because until she
 * accepts there is no family to show.
 */
export default function Index() {
  const device = useDeviceState();
  const router = useRouter();

  useEffect(() => {
    if (device.role === "guardian" && device.familyId) {
      router.replace("/guardian");
      return;
    }
    if (device.role === "student") {
      router.replace(device.familyId ? "/student" : "/onboard/invite");
      return;
    }
    router.replace("/onboard");
  }, [device.role, device.familyId, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.trustText} />
    </View>
  );
}
