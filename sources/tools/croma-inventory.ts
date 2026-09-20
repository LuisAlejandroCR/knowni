// croma-inventory.ts: regenerates the Colombian endpoint inventory from Croma's public
// /catalog. Provider metadata only — it sends no subject data and stores no response about a
// person.

import { writeFileSync } from "node:fs";

const CATALOG_URL = "https://api.croma.run/catalog";
const OUT = new URL("../test/fixtures/croma/catalog-co.json", import.meta.url);

interface CatalogEndpoint {
  readonly id: string;
  readonly path: string;
  readonly country: string;
  readonly source: string;
  readonly required?: readonly string[];
  readonly rate_limit?: string;
  readonly served_from?: string;
  readonly docs_url?: string;
}

const response = await fetch(CATALOG_URL);
if (!response.ok) throw new Error(`catalog returned ${response.status}`);
const payload = (await response.json()) as { data: { endpoints: CatalogEndpoint[] } };

// Kept fields only: what an adapter needs to call the route and what an
// operator needs to budget it. Descriptions and examples stay upstream.
const endpoints = payload.data.endpoints
  .filter((endpoint) => endpoint.country === "Colombia")
  .map((endpoint) => ({
    id: endpoint.id,
    path: endpoint.path,
    source: endpoint.source,
    required: endpoint.required ?? [],
    rateLimit: endpoint.rate_limit ?? null,
    servedFrom: endpoint.served_from ?? null,
    docsUrl: endpoint.docs_url ?? null,
  }))
  .sort((a, b) => a.path.localeCompare(b.path));

writeFileSync(
  OUT,
  `${JSON.stringify({ retrievedAt: new Date().toISOString().slice(0, 10), source: CATALOG_URL, endpoints }, null, 2)}\n`,
);
console.log(`wrote ${endpoints.length} Colombian endpoints`);
