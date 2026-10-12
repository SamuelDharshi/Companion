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

console.log("config.yaml against Envio's own JSON schema");
// The schema ships inside the pinned envio package, so this checks the config against exactly the version Envio Cloud
// builds with. It is what catches a v2-style config (`networks` instead of `chains`) before a hosted build fails on it.
{
  const { default: Ajv2020 } = await import("ajv/dist/2020.js");
  const envioDir = join(root, "indexer", "node_modules", "envio");
  const envioSchema = JSON.parse(readFileSync(join(envioDir, "evm.schema.json"), "utf8"));
  const envioVersion = JSON.parse(readFileSync(join(envioDir, "package.json"), "utf8")).version;
  const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false, logger: false }).compile(envioSchema);
  if (validate(config)) ok(`valid for envio ${envioVersion}`);
  else {
    for (const e of validate.errors ?? []) {
      const extra = e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : "";
      fail(`config.yaml${e.instancePath || ""}: ${e.message}${extra}`);
    }
  }
}

console.log("\nEvent signatures in config.yaml vs the compiled ABI");

const networks = config.chains ?? [];
if (networks.length !== 1) fail(`expected exactly one chain, found ${networks.length}`);
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
const registered = new Set(
  [...handlers.matchAll(/indexer\.onEvent\(\{\s*contract:\s*"(\w+)",\s*event:\s*"(\w+)"\s*\}/g)].map((m) => `${m[1]}.${m[2]}`),
);
for (const key of declaredEvents) {
  if (registered.has(key)) ok(`${key} (indexer.onEvent)`);
  else fail(`${key} is declared in config.yaml but has no handler`);
}

console.log("\nEvery handler targets a declared event");
for (const key of registered) {
  if (!declaredEvents.has(key)) fail(`handler ${key} is not declared in config.yaml`);
}
if (failures === 0) ok("no orphaned handlers");

console.log("\nEnvio 3 conventions");
if (/from\s+"generated"/.test(handlers)) fail('handlers import from "generated", which Envio 3 removed; import from "envio"');
else ok('handlers import from "envio"');
if (/\.\w+\.handler\(/.test(handlers)) fail("a v2-style `Contract.Event.handler(` registration remains");
else ok("every handler is registered with indexer.onEvent");
if (handlers.includes("event.transaction.hash")) {
  const fields = config.field_selection?.transaction_fields ?? [];
  if (fields.includes("hash")) ok("the transaction hash is selected (Envio 3 leaves it empty otherwise)");
  else fail("handlers read event.transaction.hash but field_selection.transaction_fields does not include hash");
}
const indexerPkg = JSON.parse(readFileSync(join(root, "indexer", "package.json"), "utf8"));
if (indexerPkg.type === "module") ok('indexer/package.json has "type": "module"');
else fail('indexer/package.json needs "type": "module" for Envio 3');

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
        "\x1b[90mEnvio runs `envio codegen` itself when it builds; locally that needs Linux, macOS or WSL 2.\x1b[0m\n"
    : `\n\x1b[31m${failures} problem(s) found.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
