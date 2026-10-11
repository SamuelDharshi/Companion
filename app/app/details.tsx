import { useState } from "react";
import { Linking, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { explorerAddressUrl } from "@thunai/shared";
import {
  Body,
  Card,
  Divider,
  ErrorNote,
  Heading,
  Pill,
  Proof,
  Screen,
  SecondaryButton,
  Small,
  Title,
  styles as ui,
} from "@/ui/components";
import { colors, space } from "@/theme";
import { t } from "@/i18n/strings";
import { useConfig, useFamily } from "@/hooks/useThunai";
import { namespaceReport } from "@/mera/account";
import { forgetThisDevice, useDeviceState, useSession } from "@/state/store";
import { api, endpoints } from "@/api/client";
import { rpId } from "@/config";
import { loadFamilyNotes, recordFamilyQuestion } from "@/actions/onboarding";
import SessionPrompt from "@/ui/SessionPrompt";
import { indexerConfigured, loadNetworkStats } from "@/network";
import { useAsync } from "@/hooks/useThunai";


/**
 * Details: everything a curious judge wants and a family never needs.
 *
 * The product rule is that no crypto word reaches a family's screen, so all of it lives
 * behind this one door: the session timer, the three key namespaces, the deployed
 * addresses, whether Agora is really settling, and the stateless test as a button.
 *
 * It is also where the honest claims are written down, in the same words we would use on
 * stage.
 */
export default function Details() {
  const router = useRouter();
  const device = useDeviceState();
  const { session, msRemaining } = useSession();
  const { data: config } = useConfig();
  const { data: family } = useFamily(device.familyId);
  const { data: networkStats } = useAsync(() => loadNetworkStats(), []);
  const { data: agent } = useAsync(() => api.agentIdentity().catch(() => undefined), []);

  const [wiping, setWiping] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Private notes: encrypted with a key from this person's passkey, stored as ciphertext in the vault.
  const [question, setQuestion] = useState("");
  const [notesBusy, setNotesBusy] = useState<"save" | "open" | undefined>();
  const [notesMessage, setNotesMessage] = useState<string | undefined>();
  const [openedQuestion, setOpenedQuestion] = useState<string | undefined>();

  const lang = device.lang;
  const namespaces = device.address
    ? namespaceReport({ address: device.address, duressAddress: device.duressAddress! })
    : [];

  async function saveNotes() {
    if (!question.trim()) return;
    setNotesBusy("save");
    setError(undefined);
    setNotesMessage(undefined);
    try {
      await recordFamilyQuestion(question.trim());
      setQuestion("");
      setNotesMessage("Saved. It is encrypted, and it is not stored on this phone.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setNotesBusy(undefined);
    }
  }

  async function openNotes() {
    setNotesBusy("open");
    setError(undefined);
    setNotesMessage(undefined);
    try {
      const notes = await loadFamilyNotes();
      setOpenedQuestion(notes?.familyQuestion);
      setNotesMessage(notes?.familyQuestion ? undefined : "No notes saved yet.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setNotesBusy(undefined);
    }
  }

  /** The stateless test. Keeps nothing, and one Face ID brings it all back. */
  async function wipe() {
    setWiping(true);
    setError(undefined);
    try {
      await forgetThisDevice();
      router.replace("/onboard");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setWiping(false);
    }
  }

  return (
    <Screen>
      <Title>{t("details", lang)}</Title>

      {/* Scoped prompt-free signing, made visible. */}
      <Card>
        <Heading>Signing</Heading>
        {session ? (
          <Pill
            label={t("sessionActive", lang, { minutes: Math.ceil(msRemaining / 60000) })}
            tone="trust"
            icon="●"
          />
        ) : device.role ? (
          <SessionPrompt />
        ) : (
          <Pill label={t("tapFaceIdToContinue", lang)} tone="neutral" />
        )}
        <Small>
          Inside this window, sending to an already-approved payee needs no Face ID.
          Anything your family has to decide always asks again, every time.
        </Small>
      </Card>

      {device.familyId && device.role ? (
        <Card>
          <Heading>Private family notes</Heading>
          <Small>
            A question only the real family could answer. It is encrypted on this phone with a
            key made from your passkey, then stored as ciphertext in the vault contract. Nobody
            else can read it, and after &quot;Forget this device&quot; one Face ID brings it back, on
            this phone or any other that has your passkey.
          </Small>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="For example: what was our first dog called?"
            style={ui.input}
            editable={!notesBusy}
          />
          <SecondaryButton label="Save with Face ID" onPress={saveNotes} busy={notesBusy === "save"} />
          <SecondaryButton label="Open my notes with Face ID" onPress={openNotes} busy={notesBusy === "open"} />
          {openedQuestion ? <Body>{openedQuestion}</Body> : null}
          {notesMessage ? <Small muted={false}>{notesMessage}</Small> : null}
        </Card>
      ) : null}

      {/* The Many Keys table: one passkey, three independent keys. */}
      <Card>
        <Heading>One passkey, three keys</Heading>
        {namespaces.map((namespace) => (
          <View key={namespace.salt} style={{ gap: 2 }}>
            <Proof>{namespace.salt}</Proof>
            <Small muted={false}>{namespace.derives}</Small>
            <Small>{namespace.work}</Small>
            <Proof>{namespace.value}</Proof>
            <Proof>salt: {namespace.saltSource}</Proof>
            <Divider />
          </View>
        ))}
        <Small>
          Open Companion on a second device, tap Face ID, and the first and third addresses
          come back identical. No key is ever stored anywhere.
        </Small>
      </Card>

      <Card>
        <Heading>Under the hood</Heading>
        {config ? (
          <>
            <Proof>network · {config.chainId === 10143 ? "Monad testnet" : `chain ${config.chainId}`}</Proof>
            <Proof>vault · {config.thunaiVault}</Proof>
            <Proof>network reports · {config.scamSignals}</Proof>
            <Proof>passkeys scoped to · {rpId()}</Proof>
            <Proof>
              public counters ·{" "}
              {networkStats
                ? networkStats.source === "indexer"
                  ? "Envio indexer"
                  : indexerConfigured
                    ? "relayer (indexer not reachable)"
                    : "relayer, reading the contract (no indexer connected)"
                : "…"}
            </Proof>
            {agent ? (
              <Proof>
                agent · #{agent.agentId} on the ERC-8004 registry · {agent.verifiedSaves} verified save
                {agent.verifiedSaves === "1" ? "" : "s"} recorded by families
              </Proof>
            ) : null}
            <Proof>hold evidence · {indexerConfigured ? "Envio indexer, falling back to the contract" : "the contract's own counter"}</Proof>
            <Proof>
              instant receipts ·{" "}
              {config.syncSendSupported === null
                ? "not yet used"
                : config.syncSendSupported
                  ? "eth_sendRawTransactionSync"
                  : "polling (this RPC has no sync send)"}
            </Proof>
            {/* Stated plainly either way: an unsupported claim is worse than no claim. */}
            <Pill
              label={
                config.agoraEnabled
                  ? "Agora Instant Settlement: on"
                  : "Agora Instant Settlement: off (disclosed fallback)"
              }
              tone={config.agoraEnabled ? "arrived" : "neutral"}
            />
            {config.standInTokens ? (
              <Small>
                Testnet stand-in tokens. Real funding would come through a licensed
                remittance partner; nobody buys a token in this flow.
              </Small>
            ) : null}
            <Pressable onPress={() => void Linking.openURL(explorerAddressUrl(config.thunaiVault))}>
              <Small muted={false} style={{ color: colors.trustText }}>
                {t("viewOnExplorer", lang)} →
              </Small>
            </Pressable>
          </>
        ) : (
          <Small>{t("loading", lang)}</Small>
        )}
        <Proof>relayer · {endpoints.relayer}</Proof>
      </Card>

      {family ? (
        <Card>
          <Heading>This family</Heading>
          <Proof>family · #{family.familyId}</Proof>
          <Proof>role · {device.role}</Proof>
          <Proof>available · {family.balanceLabel}</Proof>
          <Proof>from home, not yet sent on · {family.homeBalanceLabel}</Proof>
          <Small>
            Your family&apos;s money sits in the contract, counted to your family alone. No
            company can move it, including us.
          </Small>
        </Card>
      ) : null}

      {/* The claims, in the words we would use on stage. */}
      <Card>
        <Heading>What Companion does and does not do</Heading>
        <Body>Money from home cannot leave Companion in one phone call.</Body>
        <Small>
          It does not protect a bank account or a credit card. Gift cards bought on another
          card bypass Companion entirely. What the hold does is page your family, and once
          nobody is alone on that call, the demand usually fails too.
        </Small>
        <Divider />
        <Body>A hold your family can cancel. The money never left.</Body>
        <Small>Not a clawback. Nothing is ever pulled back from anyone.</Small>
        <Divider />
        <Body>Proof it is really your child&apos;s phone, right now.</Body>
        <Small>Not proof they are safe. A passkey cannot be cloned; a person can be coerced.</Small>
        <Divider />
        <Body>Network reports raise the hold level. They never block on their own.</Body>
        <Small>
          Payees on your family&apos;s signed schedule are never affected. Reported handles
          are hashed, which makes them pseudonymous, not private.
        </Small>
      </Card>

      <Card>
        <Heading>Forget this device</Heading>
        <Small>
          Wipes everything stored here. One Face ID brings back the same accounts, the same
          family and the same history, because none of it was ever kept on a server.
        </Small>
        <SecondaryButton label="Forget this device" onPress={wipe} busy={wiping} danger />
      </Card>

      {error ? <ErrorNote message={error} /> : null}
      <SecondaryButton label={t("back", lang)} onPress={() => router.back()} />
    </Screen>
  );
}
