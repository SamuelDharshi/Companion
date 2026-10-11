import { useRouter } from "expo-router";
import { View } from "react-native";
import { formatUsd } from "@thunai/shared";
import { loadNetworkStats, type NetworkStatsView } from "@/network";
import {
  Amount,
  Body,
  Card,
  Divider,
  Heading,
  Proof,
  Screen,
  SecondaryButton,
  Small,
  Title,
} from "@/ui/components";
import { space } from "@/theme";
import { t } from "@/i18n/strings";
import { useAsync } from "@/hooks/useThunai";
import { useDeviceState } from "@/state/store";


/**
 * "Families protected": the public counter, and the traction numbers.
 *
 * Every figure comes from the indexer, which derives it from events the contract actually
 * emitted, so anything claimed here can be checked against the chain. The median save
 * time is the number the pitch rests on, and it is a true median rather than a flattering
 * average.
 */
export default function Network() {
  const router = useRouter();
  const device = useDeviceState();
  const lang = device.lang;

  const { data, error, loading } = useAsync<NetworkStatsView>(() => loadNetworkStats(), [], { pollMs: 10_000 });

  return (
    <Screen>
      <Title>{t("familiesProtected", lang)}</Title>

      <Card>
        <Small>{t("familiesProtected", lang)}</Small>
        <Amount>{data ? String(data.families) : loading ? "…" : "—"}</Amount>
        <Body muted>
          Every family that confirms a scam makes the next family&apos;s warning stronger.
        </Body>
      </Card>

      {data && data.scamsStopped !== undefined ? (
        <>
          <Card>
            <Heading>Saves</Heading>
            <Row label="Payments held" value={String(data.holdsOpened)} />
            <Row label="Stopped by a parent" value={String(data.scamsStopped)} />
            <Row label="Returned because nobody answered" value={String(data.holdsExpired)} />
            <Row
              label="Money protected"
              value={formatUsd(BigInt(data.dollarsProtected || "0"))}
            />
            <Divider />
            <Row
              label="Median time to stop one"
              value={data.medianSaveSeconds ? `${data.medianSaveSeconds}s` : "—"}
            />
            <Row
              label="Fastest"
              value={data.fastestSaveSeconds ? `${data.fastestSaveSeconds}s` : "—"}
            />
            <Small>
              Measured from the moment the money stopped to the moment a parent decided.
            </Small>
          </Card>

          <Card>
            <Heading>Allowances</Heading>
            <Row
              label="Delivered"
              value={formatUsd(BigInt(data.dollarsDelivered || "0"))}
            />
            {/* Reported separately, so the Agora claim is never overstated. */}
            <Row label="Settled through Agora" value={String(data.payoutsViaAgora)} />
            <Row label="Settled through the fallback" value={String(data.payoutsFallback)} />
          </Card>

          <Card>
            <Heading>Checks and reports</Heading>
            <Row label="Checks requested" value={String(data.checksRequested)} />
            <Row label="Answered on the child's own phone" value={String(data.checksAnswered)} />
            <Row label="Scam reports filed" value={String(data.reportsFiled)} />
            <Small>
              A report needs a hold a parent actually cancelled, signed with her own Face
              ID, so one report costs one real family.
            </Small>
          </Card>
        </>
      ) : null}

      {data ? (
        <Card>
          <Proof>
            source ·{" "}
            {data.source === "indexer"
              ? "Envio indexer (event history)"
              : "relayer, counting the contracts' own events"}
          </Proof>
          {data.source === "relayer" ? (
            <Small>
              The Envio indexer is not connected, so our relayer counts the contracts&apos; events itself.
              Every number is a count of something the contract emitted. Nothing is estimated.
            </Small>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Card>
          <Small>The counters could not be reached from this device right now. The chain remains the record.</Small>
        </Card>
      ) : null}

      <SecondaryButton label={t("back", lang)} onPress={() => router.back()} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.md }}>
      <Small>{label}</Small>
      <Small muted={false} style={{ fontWeight: "600" }}>
        {value}
      </Small>
    </View>
  );
}
