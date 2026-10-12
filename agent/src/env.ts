import { z } from "zod";
import { loadRootEnv } from "./load-env";

/**
 * Agent environment.
 *
 * Everything optional here degrades gracefully on purpose: no Anthropic key means the
 * deterministic classifier, no VAPID keys means WhatsApp-only paging. The agent explains
 * and connects; it never decides, so a missing value can slow the save but cannot unsafe
 * it.
 */
const schema = z.object({
  /** `AGENT_PORT` in the shared .env, so it cannot collide with the relayer's PORT. */
  AGENT_PORT: z.coerce.number().default(8788),
  HOST: z.string().default("0.0.0.0"),

  MONAD_RPC_URL: z.string().url().default("https://testnet-rpc.monad.xyz"),
  /**
   * The keeper key. Pays gas for `runAllowance` and `expireHold`, both of which any
   * stranger is allowed to call, so this key carries no authority over family money.
   */
  AGENT_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "AGENT_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key"),

  /** Alchemy's Monad testnet RPC, used as a failover when MONAD_RPC_URL errors. A secret: .env only. */
  ALCHEMY_RPC_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  /**
   * The signing key Alchemy gives a webhook. /alchemy/webhook answers only a body signed with it, and does not
   * answer at all (503) when this is unset.
   */
  ALCHEMY_WEBHOOK_SIGNING_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),

  THUNAI_VAULT_ADDRESS: z.string().optional(),
  SCAM_SIGNALS_ADDRESS: z.string().optional(),

  /** Gates the dev endpoints (`/classify`, `/keeper/tick`). Unset means they do not exist. */
  DEV_ADMIN_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  /** Shared with the relayer. The webhooks below answer only a caller that holds it. */
  INTERNAL_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),

  /** Where the relayer listens, for reading push subscriptions and family names. */
  RELAYER_URL: z.string().url().default("http://localhost:8787"),

  /** Classifier. An empty key forces the deterministic fallback. */
  ANTHROPIC_API_KEY: z.string().optional(),
  CLASSIFIER_MODEL: z.string().default("claude-opus-5-5"),
  CLASSIFIER_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  CLASSIFIER_TIMEOUT_MS: z.coerce.number().default(12_000),

  /** Web Push. Generate a pair with `npx web-push generate-vapid-keys`. */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:team@thunai.app"),
  EXPO_PUSH_URL: z.string().url().default("https://exp.host/--/api/v2/push/send"),

  /** Used to build the deep link in a notification. */
  APP_URL: z.string().default("http://localhost:8081"),

  /** How often the keeper sweeps for due allowances and timed-out holds. */
  KEEPER_INTERVAL_MS: z.coerce.number().default(60_000),
  KEEPER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),

  /**
   * Who drives the keeper's two jobs (run due allowances, expire unanswered holds).
   * `keeper` is this process's own timer. `cre` hands the schedule to a Chainlink CRE workflow, which reads the chain
   * and calls /cre/apply here; this process then keeps its own timer only as a standby, used when no CRE call has
   * arrived for CRE_GRACE_MS, so a stopped workflow can never leave an allowance unsent or a hold unexpired.
   */
  ORCHESTRATOR: z.enum(["keeper", "cre"]).default("keeper"),
  /** The secret the CRE workflow presents. Unset means /cre/* does not answer at all. */
  CRE_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
  CRE_GRACE_MS: z.coerce.number().default(300_000),

  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(): Env {
  loadRootEnv();
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid agent environment:\n");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    console.error("\nSee .env.example for what each value is for.");
    process.exit(1);
  }
  return parsed.data;
}
