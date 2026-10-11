import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SCAM_SCRIPT, SCAM_SCRIPT_NAME, type ClassifierInput, type Classification } from "@thunai/shared";

/**
 * The scam-script classifier.
 *
 * HARD RULE, and the most important line in this service: the model never moves or
 * releases money. By the time this function runs, the contract has already opened the
 * hold on deterministic rules, the funds are already in escrow, and the guardian's
 * passkey is the only thing that can release them. All this does is put a name and two
 * sentences on what is happening, so Kavya can decide in seconds instead of minutes.
 *
 * It therefore also has to fail soft: if the API key is missing, the request times out,
 * or the model returns something unparseable, the family still gets a usable alert from
 * the deterministic fallback below. A classifier outage must never degrade the rescue.
 */

const ClassificationSchema = z.object({
  scriptId: z
    .number()
    .int()
    .min(0)
    .max(5)
    .describe(
      "0 unknown, 1 fake immigration officer, 2 digital arrest, 3 voice-clone arrest, 4 job/task scam, 5 investment scam",
    ),
  confidence: z.number().min(0).max(1).describe("How certain the label is, 0 to 1"),
  explanation_en: z
    .string()
    .describe("One or two short sentences for the parent, in plain English. No jargon."),
  explanation_ta: z.string().describe("The same explanation in natural, spoken Tamil."),
  familyQuestionSuggested: z
    .string()
    .describe("One question only the real family could answer, to help confirm identity."),
});

const SYSTEM_PROMPT = `You help a parent in India decide, in seconds, whether a payment their child is making abroad is a scam.

The payment is ALREADY on hold. You are not deciding anything and you cannot move money. Your only job is to name the likely scam script and explain it in words a worried parent understands.

The scam scripts you can label:
1 FAKE_IMMIGRATION_OFFICER - a caller claims to be ICE, USCIS, police or an immigration officer, quotes real visa or SEVIS details, and demands a "bond" or "fine" now.
2 DIGITAL_ARREST - the victim is kept on a long call, told they are under investigation, and told not to contact anyone.
3 VOICE_CLONE_ARREST - a cloned voice of a family member claims to be arrested or in an accident and needs money immediately.
4 JOB_TASK - a fake job, internship or "task" scheme that asks the victim to pay or forward money.
5 INVESTMENT - a too-good-to-be-true trading, crypto or investment return.
0 UNKNOWN - nothing matches, or there is not enough to go on.

Strong signals: urgency, secrecy ("don't tell anyone"), a brand-new payee, an amount far above the usual allowance, a long call in progress, late-night or early-morning hours, and words like bond, fine, clearance, custody, warrant, SEVIS, gift card.

Rules for your writing:
- Address the parent, not the student.
- Two short sentences at most per language. No technical words, no crypto words.
- The Tamil must read like a person speaking, not a translation.
- Never state as fact that it IS a scam. Say what it looks like.
- If the signals are weak, say so and use a low confidence. An honest "this may be fine" is more useful than a false alarm.
- The family question must be something a scammer could not know: a shared memory, a nickname, a household detail. Never a password, and never anything guessable from social media.`;

export type ClassifierOptions = {
  apiKey?: string;
  model: string;
  /** Lower effort keeps a one-shot label fast; raise it if labels look sloppy. */
  effort: "low" | "medium" | "high";
  timeoutMs: number;
};

export class Classifier {
  private readonly client: Anthropic | undefined;

  constructor(private readonly options: ClassifierOptions) {
    // The SDK also resolves ANTHROPIC_API_KEY and `ant auth login` profiles on its own,
    // so an explicitly empty key is the only reason to stay offline.
    this.client = options.apiKey === "" ? undefined : new Anthropic({ apiKey: options.apiKey });
  }

  get enabled(): boolean {
    return this.client !== undefined;
  }

  async classify(input: ClassifierInput): Promise<Classification & { source: "model" | "rules" }> {
    if (!this.client) return { ...ruleBasedClassification(input), source: "rules" };

    try {
      const response = await this.client.messages.parse(
        {
          model: this.options.model,
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          output_config: {
            effort: this.options.effort,
            format: zodOutputFormat(ClassificationSchema),
          },
          messages: [{ role: "user", content: describeSituation(input) }],
        },
        { timeout: this.options.timeoutMs },
      );

      // `parsed_output` is null when the model could not satisfy the schema.
      const parsed = response.parsed_output;
      if (!parsed) return { ...ruleBasedClassification(input), source: "rules" };

      return { ...parsed, source: "model" };
    } catch (error) {
      // Any failure here is a reason to fall back, never a reason to fail the alert.
      if (error instanceof Anthropic.APIError) {
        console.warn(`classifier API error ${error.status}: ${error.message}`);
      } else {
        console.warn(`classifier unavailable: ${(error as Error).message}`);
      }
      return { ...ruleBasedClassification(input), source: "rules" };
    }
  }
}

/** The facts the contract and the app already know, written out for the model. */
function describeSituation(input: ClassifierInput): string {
  const lines = [
    `The student is trying to send $${input.amountUsd.toLocaleString("en-US")}.`,
    `They wrote this reason: "${input.memo || "(they left it blank)"}"`,
    input.payeeIsNew
      ? "The payee is brand new: nobody in the family has approved them before."
      : "The payee is already on the family's approved schedule.",
    `That is about ${input.amountVsUsual.toFixed(1)}x their usual weekly allowance.`,
    `It is ${input.localHour}:00 where the student is.`,
  ];
  if (input.networkFlagCount > 0) {
    lines.push(
      `${input.networkFlagCount} other Companion ${
        input.networkFlagCount === 1 ? "family has" : "families have"
      } already reported this same payee as a scam.`,
    );
  }
  if (input.callDurationMinutes != null) {
    lines.push(`The student says they have been on a phone call for ${input.callDurationMinutes} minutes.`);
  }
  return lines.join("\n");
}

/**
 * Deterministic fallback.
 *
 * Deliberately simple and keyword-driven. It exists so the demo, and more importantly a
 * real family, still gets a named script and a readable sentence when the model is
 * unreachable. Its confidence is capped below the model's, and the app shows the source,
 * so a rule-based guess is never presented as more than it is.
 */
export function ruleBasedClassification(input: ClassifierInput): Classification {
  const memo = input.memo.toLowerCase();
  const has = (...words: string[]) => words.some((w) => memo.includes(w));

  let scriptId: number = SCAM_SCRIPT.UNKNOWN;
  let confidence = 0.3;

  if (has("ice", "immigration", "sevis", "visa", "bond", "deport", "uscis", "officer")) {
    scriptId = SCAM_SCRIPT.FAKE_IMMIGRATION_OFFICER;
    confidence = 0.75;
  } else if (has("arrest", "custody", "warrant", "police", "case", "fir", "cbi")) {
    scriptId = SCAM_SCRIPT.DIGITAL_ARREST;
    confidence = 0.7;
  } else if (has("accident", "hospital", "kidnap", "emergency bail")) {
    scriptId = SCAM_SCRIPT.VOICE_CLONE_ARREST;
    confidence = 0.6;
  } else if (has("job", "task", "internship", "commission", "registration fee")) {
    scriptId = SCAM_SCRIPT.JOB_TASK;
    confidence = 0.6;
  } else if (has("invest", "trading", "crypto", "profit", "returns", "doubling")) {
    scriptId = SCAM_SCRIPT.INVESTMENT;
    confidence = 0.6;
  }

  // Context can raise an unknown to a suspicion on its own.
  const lateNight = input.localHour >= 22 || input.localHour <= 5;
  const unusuallyLarge = input.amountVsUsual >= 5;
  if (scriptId === SCAM_SCRIPT.UNKNOWN && input.payeeIsNew && (lateNight || unusuallyLarge)) {
    confidence = 0.45;
  }
  if (input.networkFlagCount > 0) {
    confidence = Math.min(0.9, confidence + 0.2);
  }

  const amount = `$${input.amountUsd.toLocaleString("en-US")}`;
  const reasons: string[] = [];
  if (input.payeeIsNew) reasons.push("this is someone new");
  if (unusuallyLarge) reasons.push("the amount is much larger than usual");
  if (lateNight) reasons.push("it is the middle of the night there");
  if (input.networkFlagCount > 0) {
    reasons.push(
      `${input.networkFlagCount} other ${input.networkFlagCount === 1 ? "family has" : "families have"} reported this number`,
    );
  }
  const because = reasons.length > 0 ? joinList(reasons) : "it is outside the usual pattern";

  const named =
    scriptId === SCAM_SCRIPT.FAKE_IMMIGRATION_OFFICER
      ? "the fake officer scam"
      : scriptId === SCAM_SCRIPT.DIGITAL_ARREST
        ? "the digital arrest scam"
        : scriptId === SCAM_SCRIPT.VOICE_CLONE_ARREST
          ? "a cloned-voice emergency scam"
          : scriptId === SCAM_SCRIPT.JOB_TASK
            ? "a fake job or task scam"
            : scriptId === SCAM_SCRIPT.INVESTMENT
              ? "a fake investment scam"
              : null;

  const explanation_en = named
    ? `This looks like ${named}: ${because}. ${adviceFor(scriptId)}`
    : `We held ${amount} because ${because}. It may be fine, but we wanted you to see it first.`;

  const explanation_ta = named
    ? `இது ${tamilScriptName(scriptId)} போல் தெரிகிறது. ${tamilAdviceFor(scriptId)}`
    : `${amount} தற்காலிகமாக நிறுத்தப்பட்டுள்ளது. வழக்கத்திற்கு மாறாக இருப்பதால் உங்களை முதலில் கேட்கிறோம்.`;

  return {
    scriptId,
    confidence,
    explanation_en,
    explanation_ta,
    familyQuestionSuggested:
      "Ask something only family would know, like what you cooked together last Deepavali.",
  };
}

/** "a, b and c" — a list a worried parent can read in one pass. */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The one sentence of advice that actually fits the script.
 *
 * The "real officers never ask for payment" line is true and useful for an impersonation
 * scam and simply wrong for a fake investment, so each script gets its own.
 */
function adviceFor(scriptId: number): string {
  switch (scriptId) {
    case SCAM_SCRIPT.FAKE_IMMIGRATION_OFFICER:
    case SCAM_SCRIPT.DIGITAL_ARREST:
      return "Real officers never ask for payment by phone, gift card or transfer.";
    case SCAM_SCRIPT.VOICE_CLONE_ARREST:
      return "A voice on a call can be copied. Use Check on Arjun, and call back on a number you already have.";
    case SCAM_SCRIPT.JOB_TASK:
      return "A real job never asks you to pay to start, or to forward money for someone else.";
    case SCAM_SCRIPT.INVESTMENT:
      return "Guaranteed or unusually high returns are the oldest sign of a fake investment.";
    default:
      return "It may be fine, but we wanted you to see it first.";
  }
}

/** The Tamil counterpart of `adviceFor`, so each script gets the advice that fits it. */
function tamilAdviceFor(scriptId: number): string {
  switch (scriptId) {
    case SCAM_SCRIPT.FAKE_IMMIGRATION_OFFICER:
    case SCAM_SCRIPT.DIGITAL_ARREST:
      return "உண்மையான அதிகாரிகள் ஒருபோதும் தொலைபேசியில் பணம் கேட்க மாட்டார்கள்.";
    case SCAM_SCRIPT.VOICE_CLONE_ARREST:
      return "குரலை நகல் எடுக்க முடியும். உங்களுக்குத் தெரிந்த எண்ணில் திரும்ப அழைக்கவும்.";
    case SCAM_SCRIPT.JOB_TASK:
      return "உண்மையான வேலை, சேர்வதற்கு முன் பணம் கேட்காது.";
    case SCAM_SCRIPT.INVESTMENT:
      return "உறுதியான அதிக லாபம் என்பது மோசடியின் முதல் அறிகுறி.";
    default:
      return "வழக்கத்திற்கு மாறாக இருப்பதால் உங்களை முதலில் கேட்கிறோம்.";
  }
}

function tamilScriptName(scriptId: number): string {
  switch (scriptId) {
    case SCAM_SCRIPT.FAKE_IMMIGRATION_OFFICER:
      return "போலி அதிகாரி மோசடி";
    case SCAM_SCRIPT.DIGITAL_ARREST:
      return "டிஜிட்டல் கைது மோசடி";
    case SCAM_SCRIPT.VOICE_CLONE_ARREST:
      return "குரல் நகல் மோசடி";
    case SCAM_SCRIPT.JOB_TASK:
      return "போலி வேலை மோசடி";
    case SCAM_SCRIPT.INVESTMENT:
      return "போலி முதலீட்டு மோசடி";
    default:
      return "மோசடி";
  }
}
