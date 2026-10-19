// registry-cli.mjs — the CLI. Read-only. It never signs or submits anything.
//
//   node registry-cli.mjs --registry            print the recorded registry
//   node registry-cli.mjs --registry --json     the registry as JSON
//   node registry-cli.mjs --drift               only the drift entries
//   node registry-cli.mjs --conformance         re-measure every check LIVE
//   node registry-cli.mjs --conformance --json  the conformance report as JSON
//   node registry-cli.mjs --boundaries          every non-claim
//   node registry-cli.mjs --help
//
// `--conformance` is the only mode that touches the network, and it only READS:
// every call is a plain JSON-RPC request. Nothing is built, signed or submitted.

import { renderRegistry, renderDrift, renderBoundaries, toJSON as registryJSON, REGISTRY_DISCLAIMER } from "./render.mjs";
import { buildConformanceReport, renderConformance, toJSON as conformanceJSON } from "./conformance.mjs";
import { REGISTRY_SCOPE } from "./lib.mjs";

const args = process.argv.slice(2);
const has = (k) => args.includes(k);
const after = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] ?? null : null);

const RPC_URL = after("--rpc") ?? REGISTRY_SCOPE.endpoint;
const TIMEOUT_MS = Math.max(1000, Number(after("--timeout")) || 15000);

/** One JSON-RPC call. Returns { result } | { error } | { transportError }. */
async function rpc(method, params = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    const body = await res.json();
    return body; // { jsonrpc, id, result } or { jsonrpc, id, error }
  } catch (e) {
    return { transportError: e.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Capture every response the conformance checks need, each in a guarded way. */
async function captureLive() {
  const live = {};
  const guard = async (key, fn) => {
    try {
      live[key] = await fn();
    } catch (e) {
      live[key] = { transportError: e.message };
    }
  };

  await guard("getHealth", () => rpc("getHealth"));
  await guard("getNetwork", () => rpc("getNetwork"));
  await guard("getVersionInfo", () => rpc("getVersionInfo"));
  await guard("getFeeStats", () => rpc("getFeeStats"));
  await guard("simulateTransactionInvalid", () => rpc("simulateTransaction", { transaction: "AAAAAgAAAAB=" }));
  await guard("getTransactionUnknown", () => rpc("getTransaction", { hash: "0".repeat(64) }));
  await guard("getLedgerEntriesEmpty", () => rpc("getLedgerEntries", { keys: [] }));
  await guard("getContractDataAbsent", () => rpc("getContractData", { contractId: "C" + "0".repeat(55) }));

  // getEvents needs a live latest ledger
  await guard("getEvents", async () => {
    const h = await rpc("getHealth");
    if (h?.transportError) return { transportError: `getHealth: ${h.transportError}` };
    const latest = Number(h?.result?.latestLedger);
    if (!Number.isFinite(latest)) return { transportError: "no latestLedger from getHealth" };
    return rpc("getEvents", { startLedger: latest - 50, endLedger: latest, filters: [], limit: 100 });
  });

  return live;
}

function usage() {
  console.log(
    [
      "pi-api-contract-registry — a dated record of measured API behaviour and its drift",
      "",
      "  node registry-cli.mjs --registry              the recorded registry",
      "  node registry-cli.mjs --registry --json       the registry as JSON",
      "  node registry-cli.mjs --drift                 only the drift entries",
      "  node registry-cli.mjs --conformance           re-measure every check LIVE (reads only)",
      "  node registry-cli.mjs --conformance --json    the conformance report as JSON",
      "  node registry-cli.mjs --boundaries            every non-claim",
      "",
      "  --rpc <url>       override the endpoint (default: the recorded one)",
      "  --timeout <ms>    per-request timeout (default 15000)",
      "",
      "Exit codes:",
      "  0  every conformance check still matches the recorded rows",
      "  1  at least one check FAILED (the endpoint moved; rows are stale)",
      "  2  at least one check could not be evaluated (no conclusion drawn)",
      "",
      "This tool never builds, signs or submits a transaction. It records SHAPES.",
    ].join("\n")
  );
}

if (args.length === 0 || has("--help") || has("-h")) usage();
else if (has("--boundaries")) console.log(renderBoundaries());
else if (has("--drift")) console.log(renderDrift());
else if (has("--registry")) console.log(has("--json") ? registryJSON() : renderRegistry());
else if (has("--conformance")) {
  const live = await captureLive();
  const report = buildConformanceReport(live);
  console.log(has("--json") ? conformanceJSON(report) : renderConformance(report));
  if (report.counts.error > 0) process.exitCode = 2;
  else if (report.counts.fail > 0) process.exitCode = 1;
  else process.exitCode = 0;
} else usage();
