import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/theme";
import { loadDeviceState } from "@/state/store";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800" +
  "&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";

/**
 * Web only: load the two typefaces the theme names (Bricolage Grotesque for headings, Plus
 * Jakarta Sans for the rest). Done here rather than in a +html file because Expo's
 * single-page web output serves its own HTML shell. Native builds ignore this and use the
 * platform fonts until the font files are bundled.
 */
if (typeof document !== "undefined" && !document.getElementById("thunai-fonts")) {
  const link = document.createElement("link");
  link.id = "thunai-fonts";
  link.rel = "stylesheet";
  link.href = FONTS_URL;
  document.head.appendChild(link);
}

/**
 * Root layout.
 *
 * Deliberately thin: no navigation chrome, no tab bar, no headers. Both roles see one
 * screen at a time, because the guardian's version has to be usable by someone who has
 * never navigated an app before.
 */
export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadDeviceState().finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: "fade",
        }}
      />
    </SafeAreaProvider>
  );
}
