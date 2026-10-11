import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { PasskeyCredentialMetadata } from "@category-labs/mera";
import type { Address } from "viem";
import type { Role } from "@thunai/shared";
import type { Lang } from "@/i18n/strings";
import { sessionHolder, type ActiveSession } from "@/mera/account";

/**
 * App state.
 *
 * The rule here is the stateless promise: clearing storage must lose nothing that matters.
 * So what gets persisted is only convenience — which role this device is, the language
 * chosen, the credential id to skip the account picker, the family's encrypted notes
 * blob. Every one of those is either recoverable from chain or useless on its own.
 *
 * Never persisted: a PRF output, a private key, a signing session, or any decrypted
 * note. Those live in memory for the life of the session and nowhere else.
 */

const KEY = "thunai.device.v1";

export type DeviceState = {
  role?: Role;
  familyId?: string;
  /** Held by the student while waiting for the guardian to accept. */
  inviteCode?: string;
  /** Lets a restore target the right passkey instead of showing a picker. */
  credential?: PasskeyCredentialMetadata;
  address?: Address;
  duressAddress?: Address;
  lang: Lang;
  /** The notes vault, encrypted. Safe at rest: it opens only with the family's passkey. */
  /** Set once the guardian has signed an envelope, so onboarding is not offered twice. */
  envelopeSet?: boolean;
  onboardedAt?: number;
};

const DEFAULT_STATE: DeviceState = { lang: "en" };

let state: DeviceState = { ...DEFAULT_STATE };
let loaded = false;
const listeners = new Set<(s: DeviceState) => void>();

function emit() {
  for (const listener of listeners) listener(state);
}

export async function loadDeviceState(): Promise<DeviceState> {
  if (loaded) return state;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...DEFAULT_STATE, ...(JSON.parse(raw) as DeviceState) };
  } catch {
    // A corrupt or unavailable store is the same as a fresh device, which is a state the
    // app is designed to recover from anyway.
    state = { ...DEFAULT_STATE };
  }
  loaded = true;
  emit();
  return state;
}

export async function setDeviceState(patch: Partial<DeviceState>): Promise<DeviceState> {
  state = { ...state, ...patch };
  emit();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Persisting is a nicety; the app still works for this session without it.
  }
  return state;
}

export function getDeviceState(): DeviceState {
  return state;
}

/** The stateless test, as a button. Wipes the device and keeps nothing. */
export async function forgetThisDevice(): Promise<void> {
  sessionHolder.end();
  state = { ...DEFAULT_STATE };
  emit();
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* nothing to remove */
  }
}

export function useDeviceState(): DeviceState {
  const [current, setCurrent] = useState<DeviceState>(state);
  useEffect(() => {
    listeners.add(setCurrent);
    void loadDeviceState();
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}

/** The live signing session, for the "Session active · 14 min" line. */
export function useSession(): { session: ActiveSession | undefined; msRemaining: number } {
  const [session, setSession] = useState<ActiveSession | undefined>(sessionHolder.active);
  const [msRemaining, setMsRemaining] = useState(sessionHolder.msRemaining);

  useEffect(() => {
    const unsubscribe = sessionHolder.subscribe(setSession);
    const timer = setInterval(() => {
      setSession(sessionHolder.active);
      setMsRemaining(sessionHolder.msRemaining);
    }, 1000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return { session, msRemaining };
}
