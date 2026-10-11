import { z } from "zod";
import { loadRootEnv } from "./load-env";

/**
 * Environment, validated once at boot.
 *
 * The relayer is deliberately the least privileged service in the system: it holds MON to
 * pay gas and nothing else. The contract will not let it move family money without the
 * student's signature or the guardian's passkey, so losing this key costs gas, not savings.
 */
const schema = z.object({
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default("0.0.0.0"),

  MONAD_RPC_URL: z.string().url().default("https://testnet-rpc.monad.xyz"),
  /** Pays gas for every sponsored transaction. Holds no spending power. */
  RELAYER_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "RELAYER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key"),

  /** Deployed addresses. Left blank, they are read from contracts/deployments/<chainId>.json. */
  THUNAI_VAULT_ADDRESS: z.string().optional(),
  SCAM_SIGNALS_ADDRESS: z.string().optional(),

  /** Where the agent service listens, so the relayer can hand off a new hold for paging. */
  AGENT_URL: z.string().url().default("http://localhost:8788"),

  /**
   * Gates the dev endpoints (`/fund`). Unset means those endpoints do not exist. Never put this in
   * an EXPO_PUBLIC_ variable: it would ship to every device.
   */
  DEV_ADMIN_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  /**
   * Shared with the agent. The agent's webhooks and the relayer's push-subscription list are only
   * for each other, so each side proves it holds this before the other answers.
   */
  INTERNAL_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  /**
   * Testnet only. Lets a guardian's own signature deposit stand-in money for her family, playing
   * the part of the licensed remittance partner. Off by default, and never on in production.
   */
  TESTNET_PARTNER_STANDIN: z
    .preprocess((v) => (v === "" ? undefined : v), z.enum(["true", "false"]).default("false"))
    .transform((v) => v === "true"),
  PARTNER_MAX_USD: z.coerce.number().default(1000),

  /** The PUBLIC half of the Web Push key pair, so a browser can subscribe. The private half stays with the agent. */
  VAPID_PUBLIC_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),

  /** Comma-separated origins allowed to call the relayer, or `*` in development. */
  CORS_ORIGIN: z.string().default("*"),

  DATA_DIR: z.string().default("./.data"),
  /**
   * Where event counting reads logs from. Blank uses MONAD_RPC_URL. Set it when the main RPC limits `eth_getLogs`
   * to a tiny range (a Quicknode Discover plan allows 5 blocks); the public testnet RPC allows 100.
   */
  LOGS_RPC_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  /** The block the vault was created in, where event counting starts. Blank starts a few hundred blocks back. */
  THUNAI_START_BLOCK: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().default(0)),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  loadRootEnv();
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid relayer environment:\n");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    console.error("\nSee .env.example for what each value is for.");
    process.exit(1);
  }
  return parsed.data;
}
