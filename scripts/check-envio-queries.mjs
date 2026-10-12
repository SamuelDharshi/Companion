#!/usr/bin/env node
/**
 * Sends every GraphQL query the app and site use to the deployed Envio indexer and reports any the indexer rejects.
 * Read-only. Run: ENVIO_GRAPHQL_URL=<endpoint> pnpm check:envio
 */
import * as Q from "../packages/shared/src/queries.ts";

const endpoint = process.env.ENVIO_GRAPHQL_URL;
if (!endpoint) {
  console.error("Set ENVIO_GRAPHQL_URL to the indexer's GraphQL endpoint.");
  process.exit(1);
}
const variables = { familyId: "1", holdId: "1", handleHash: "0x" + "0".repeat(64) };
let failed = 0;
for (const [name, query] of Object.entries(Q)) {
  if (typeof query !== "string" || !query.includes("query")) continue;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Send only the variables this query declares: the indexer rejects any extra ones.
    body: JSON.stringify({
      query,
      variables: Object.fromEntries(Object.entries(variables).filter(([key]) => query.includes(`$${key}`))),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.errors?.length) {
    failed++;
    console.log(`  FAIL ${name}: ${JSON.stringify(body.errors ?? response.status).slice(0, 300)}`);
  } else {
    console.log(`  ok   ${name}`);
  }
}
process.exit(failed ? 1 : 0);
