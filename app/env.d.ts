/// <reference types="expo/types" />

/**
 * Expo inlines `EXPO_PUBLIC_*` variables at build time, so they are readable in the
 * client bundle. Only non-secret values belong here: anything in this list ships to
 * every device.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_RELAYER_URL?: string;
    EXPO_PUBLIC_AGENT_URL?: string;
    EXPO_PUBLIC_INDEXER_URL?: string;
    EXPO_PUBLIC_RP_ID?: string;
  }
}

declare const process: { env: NodeJS.ProcessEnv };
