#!/usr/bin/env node
/**
 * Validates the Envio indexer without running it.
 *
 * `envio codegen` needs Linux, macOS or WSL 2, so on a Windows dev box the indexer would
 * otherwise go unchecked until submission day. The single most error-prone part is the
 * event signatures in config.yaml: one wrong parameter name, a missing `indexed`, or a
 * type written as `uint` instead of `uint256` and that handler silently never fires. So
 * this compares every signature against the compiled ABI, character by character, and
 * also checks that the schema and handlers line up with each other.
 *
 * Run: node scripts/check-indexer.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
const ok = (m) => console.log(`  \x1b[32mok\x1b[0m   ${m}`);
const fail = (m, detail) => {
  failures++;
  console.log(`  \x1b[31mFAIL\x1b[0m ${m}`);
  if (detail) console.log(`        ${detail}`);
};

// ---- load ----
const config = parseYaml(readFileSync(join(root, "indexer", "config.yaml"), "utf8"));
const schema = readFileSync(join(root, "indexer", "schema.graphql"), "utf8");
const handlers = readFileSync(join(root, "indexer", "src", "EventHandlers.ts"), "utf8");

function loadAbi(name) {
  const path = join(root, "contracts", "out", `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8")).abi;
}

/** Renders an ABI event the way Envio's config expects it to be written. */
function abiSignature(event) {
  const params = event.inputs
    .map((i) => `${i.type}${i.indexed ? " indexed" : ""} ${i.name}`)
    .join(", ");
  return `${event.name}(${params})`;
}

/** Collapses whitespace so formatting differences are not reported as mismatches. */
const normalize = (s) => s.replace(/\s+/g, " ").trim();

console.log("Event signatures in config.yaml vs the compiled ABI");

const networks = config.networks ?? [];
if (networks.length !== 1) fail(`expected exactly one network, found ${networks.length}`);
const network = networks[0];
if (network?.id !== 10143) fail(`network id should be Monad testnet 10143, found ${network?.id}`);
else ok("network is Monad testnet (10143)");

const declaredEvents = new Set();

for (const contract of network?.contracts ?? []) {
  const abi = loadAbi(contract.name);
  const abiEvents = new Map(
    abi.filter((e) => e.type === "event").map((e) => [e.name, abiSignature(e)]),
  );

  for (const entry of contract.events ?? []) {
    const signature = typeof entry === "string" ? entry : entry.event;
    const name = signature.slice(0, signature.indexOf("(")).trim();
    declaredEvents.add(`${contract.name}.${name}`);

    const expected = abiEvents.get(name);
    if (!expected) {
      fail(`${contract.name}.${name} is not an event on the contract`);
      continue;
    }
    if (normalize(signature) !== normalize(expected)) {
      fail(`${contract.name}.${name} signature does not match the ABI`, `config:   ${normalize(signature)}\n        abi:      ${normalize(expected)}`);
      continue;
    }
    ok(`${contract.name}.${name}`);
  }

  // An event the contract emits but the indexer ignores is a deliberate choice, so this
  // reports it without failing.
  for (const [name] of abiEvents) {
    if (!declaredEvents.has(`${contract.name}.${name}`)) {
      console.log(`  \x1b[33mnote\x1b[0m ${contract.name}.${name} is emitted but not indexed`);
    }
  }
}

console.log("\nEvery declared event has a handler");
for (const key of declaredEvents) {
  if (handlers.includes(`${key}.handler(`)) ok(`${key}.handler`);
  else fail(`${key} is declared in config.yaml but has no handler`);
}

console.log("\nEvery handler targets a declared event");
for (const match of handlers.matchAll(/^(\w+)\.(\w+)\.handler\(/gm)) {
  const key = `${match[1]}.${match[2]}`;
  if (!declaredEvents.has(key)) fail(`handler ${key} is not declared in config.yaml`);
}
if (failures === 0) ok("no orphaned handlers");

console.log("\nSchema entities referenced by the handlers exist");
const entities = [...schema.matchAll(/^type\s+(\w+)\s*\{/gm)].map((m) => m[1]);
ok(`schema defines: ${entities.join(", ")}`);
for (const match of handlers.matchAll(/context\.(\w+)\.(set|get)\b/g)) {
  const entity = match[1];
  if (!entities.includes(entity)) fail(`handlers use context.${entity} but the schema has no such type`);
}

console.log("\nSchema sanity");
for (const entity of entities) {
  const body = schema.slice(schema.indexOf(`type ${entity} {`));
  const block = body.slice(0, body.indexOf("\n}"));
  if (!/\bid:\s*ID!/.test(block)) fail(`type ${entity} is missing \`id: ID!\``);
}
// A derived field only works when the other side actually holds the relation.
for (const match of schema.matchAll(/(\w+):\s*\[(\w+)!\]!\s*@derivedFrom\(field:\s*"(\w+)"\)/g)) {
  const [, field, target, inverse] = match;
  const targetBlock = schema.slice(schema.indexOf(`type ${target} {`));
  const block = targetBlock.slice(0, targetBlock.indexOf("\n}"));
  if (new RegExp(`\\b${inverse}:\\s*\\w+!`).test(block)) {
    ok(`${field} derives from ${target}.${inverse}`);
  } else {
    fail(`@derivedFrom(field: "${inverse}") but ${target} has no \`${inverse}\` field`);
  }
}
console.log(
  failures === 0
    ? "\n\x1b[32mIndexer config, schema and handlers are consistent with the contracts.\x1b[0m\n" +
        "\x1b[90mRun `pnpm --filter @thunai/indexer codegen` on Linux, macOS or WSL 2 to generate types.\x1b[0m\n"
    : `\n\x1b[31m${failures} problem(s) found.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
