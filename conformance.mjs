// conformance.mjs — the conformance engine. Pure and offline.
//
// It takes LIVE responses (captured by the CLI) and the RECORDED rows, and
// produces a conformance report: which checks still pass, which have moved, and
// which could not be evaluated. It never contacts the network itself, so it can
// be exercised entirely with synthetic inputs in the test suite.
//
// The distinction that matters:
//   pass  — the endpoint still matches the recorded row
//   fail  — the endpoint MOVED; the row is stale and must be updated
//   error — the check could not run; NO conclusion is drawn either way

import {
  CONFORMANCE_CHECKS,
  CONFORMANCE_VERDICTS,
  BLOCKING_CONFORMANCE_VERDICTS,
  REGISTRY_SCOPE,
  DRIFT_ENTRIES,
} from "./lib.mjs";

/** A tiny helper so a check reads as a question, not a pile of conditionals. */
const all = (conds) => conds.every(Boolean);

/**
 * Evaluate ONE check against a bundle of live responses.
 * `live` is a map: { getHealth, getNetwork, getVersionInfo, getFeeStats,
 *                    simulateTransactionInvalid, getTransactionUnknown,
 *                    getLedgerEntriesEmpty, getContractDataAbsent, getEvents }
 * Each entry is the JSON-RPC body (or an { error } marker when the transport
 * itself failed). A missing entry means the check cannot be evaluated.
 */
export function evaluateCheck(check, live) {
  const need = (k) => live[k] !== undefined && live[k] !== null;
  const body = (k) => live[k];
  const res = (k) => body(k)?.result;
  const err = (k) => body(k)?.error;

  // A transport error means NOTHING was observed for this method. Every check
  // must report `error` — never `fail` — because a `fail` claims the endpoint
  // moved, and an unreachable endpoint moved nothing observable.
  const captKeys = (() => {
    switch (check.id) {
      case "C-HEALTH-1": case "C-TYP-1": return ["getHealth"];
      case "C-NET-1": return ["getNetwork"];
      case "C-VER-1": return ["getVersionInfo"];
      case "C-TYP-2": return ["getFeeStats"];
      case "C-ERR-1": return ["simulateTransactionInvalid"];
      case "C-ERR-2": return ["getContractDataAbsent"];
      case "C-ERR-3": return ["getLedgerEntriesEmpty"];
      case "C-TX-1": return ["getTransactionUnknown"];
      case "C-EVT-1": return ["getEvents"];
      default: return [];
    }
  })();
  for (const k of captKeys) {
    if (need(k) && body(k)?.transportError) {
      return verdict(check, "error", `(transport) ${body(k).transportError}`, "the endpoint could not be contacted, so NO conclusion is drawn");
    }
  }

  try {
    switch (check.id) {
      case "C-HEALTH-1": {
        if (!need("getHealth")) return unevaluated(check, "getHealth was not captured");
        const r = res("getHealth");
        if (typeof r?.ledgerRetentionWindow !== "number") {
          return verdict(check, "error", "ledgerRetentionWindow is not a number", "the field is absent or mistyped; no conclusion drawn");
        }
        const ok = r.ledgerRetentionWindow === 120960;
        return ok
          ? verdict(check, "pass", `ledgerRetentionWindow=${r.ledgerRetentionWindow}`, "still 120960 (matches the recorded row)")
          : verdict(check, "fail", `ledgerRetentionWindow=${r.ledgerRetentionWindow}`, `MOVED: recorded 120960, now ${r.ledgerRetentionWindow}`);
      }
      case "C-NET-1": {
        if (!need("getNetwork")) return unevaluated(check, "getNetwork was not captured");
        const r = res("getNetwork");
        const ok = r?.passphrase === "Pi Testnet" && r?.protocolVersion === 28;
        return ok
          ? verdict(check, "pass", `passphrase="${r.passphrase}" protocol=${r.protocolVersion}`, "matches the recorded row")
          : verdict(check, "fail", `passphrase="${r?.passphrase}" protocol=${r?.protocolVersion}`, "MOVED: recorded passphrase \"Pi Testnet\" / protocol 28");
      }
      case "C-VER-1": {
        if (!need("getVersionInfo")) return unevaluated(check, "getVersionInfo was not captured");
        const r = res("getVersionInfo");
        const ok = r?.version === "28.0.1";
        return ok
          ? verdict(check, "pass", `version=${r.version}`, "matches the recorded row")
          : verdict(check, "fail", `version=${r?.version}`, `MOVED: recorded 28.0.1, now ${r?.version} — every version-scoped row is now stale`);
      }
      case "C-TYP-1": {
        if (!need("getHealth")) return unevaluated(check, "getHealth was not captured");
        const r = res("getHealth");
        const ok = typeof r?.latestLedgerCloseTime === "string" && typeof r?.oldestLedgerCloseTime === "string";
        return ok
          ? verdict(check, "pass", "close times are strings", "matches the recorded row")
          : verdict(check, "fail", `types: latest=${typeof r?.latestLedgerCloseTime} oldest=${typeof r?.oldestLedgerCloseTime}`, "MOVED: recorded both as strings; a numeric type would break a client that parses them as strings");
      }
      case "C-TYP-2": {
        if (!need("getFeeStats")) return unevaluated(check, "getFeeStats was not captured");
        const r = res("getFeeStats");
        const fee = r?.sorobanInclusionFee;
        const ok = typeof fee?.p50 === "string" && typeof fee?.transactionCount === "string" && typeof fee?.ledgerCount === "number";
        return ok
          ? verdict(check, "pass", `p50=${typeof fee.p50} transactionCount=${typeof fee.transactionCount} ledgerCount=${typeof fee.ledgerCount}`, "matches the recorded row (figures string, ledgerCount number)")
          : verdict(check, "fail", `p50=${typeof fee?.p50} transactionCount=${typeof fee?.transactionCount} ledgerCount=${typeof fee?.ledgerCount}`, "MOVED: recorded figures as strings and ledgerCount as a number");
      }
      case "C-ERR-1": {
        if (!need("simulateTransactionInvalid")) return unevaluated(check, "simulateTransaction was not captured");
        const b = body("simulateTransactionInvalid");
        // A success envelope has NO jsonrpc-level error key at all (undefined, not null).
        const ok = !b?.error && typeof res("simulateTransactionInvalid")?.error === "string";
        return ok
          ? verdict(check, "pass", `result.error="${res("simulateTransactionInvalid").error}"`, "still a SUCCESS envelope carrying the failure (matches the recorded row)")
          : verdict(check, "fail", `jsonRpcError=${JSON.stringify(err("simulateTransactionInvalid"))}`, "MOVED: recorded an invalid transaction failing INSIDE result.error with HTTP 200");
      }
      case "C-ERR-2": {
        if (!need("getContractDataAbsent")) return unevaluated(check, "getContractData was not captured");
        const code = err("getContractDataAbsent")?.code;
        const ok = code === -32601;
        return ok
          ? verdict(check, "pass", "error code -32601", "still absent (matches the recorded row)")
          : verdict(check, "fail", `error code ${code}`, "MOVED: recorded -32601 method not found; a different code means the method may now exist");
      }
      case "C-ERR-3": {
        if (!need("getLedgerEntriesEmpty")) return unevaluated(check, "getLedgerEntries(keys:[]) was not captured");
        const code = err("getLedgerEntriesEmpty")?.code;
        const ok = code === -32603;
        return ok
          ? verdict(check, "pass", "error code -32603", "still an error for an empty key list (matches the recorded row)")
          : verdict(check, "fail", `error code ${code}`, "MOVED: recorded -32603 for an empty key list");
      }
      case "C-TX-1": {
        if (!need("getTransactionUnknown")) return unevaluated(check, "getTransaction was not captured");
        const r = res("getTransactionUnknown");
        const ok = r?.status === "NOT_FOUND" && !err("getTransactionUnknown");
        return ok
          ? verdict(check, "pass", 'status="NOT_FOUND"', "still a success envelope carrying NOT_FOUND (matches the recorded row)")
          : verdict(check, "fail", `status=${r?.status} jsonRpcError=${JSON.stringify(err("getTransactionUnknown"))}`, "MOVED: recorded NOT_FOUND inside a success envelope");
      }
      case "C-EVT-1": {
        if (!need("getEvents")) return unevaluated(check, "getEvents was not captured");
        const r = res("getEvents");
        const n = Array.isArray(r?.events) ? r.events.length : null;
        const ok = n === 100;
        return ok
          ? verdict(check, "pass", `${n} events`, "a full page is still capped at 100")
          : verdict(check, "fail", `${n} events`, "MOVED: recorded a 100-event cap for a full page");
      }
      default:
        return verdict(check, "error", "unknown check id", "this build does not implement the check; no conclusion drawn");
    }
  } catch (e) {
    return verdict(check, "error", `threw: ${e.message}`, "no conclusion drawn");
  }
}

function verdict(check, v, observed, detail) {
  return { id: check.id, method: check.method, question: check.question, verdict: v, observed, detail };
}
function unevaluated(check, why) {
  return verdict(check, "error", "(not captured)", why);
}

/**
 * Run every check and summarise. `publishable` is false when any check failed or
 * errored — so a caller cannot build a fresh conclusion on a broken run.
 */
export function buildConformanceReport(live, { measuredAt = null } = {}) {
  const results = CONFORMANCE_CHECKS.map((c) => evaluateCheck(c, live));
  const counts = { pass: 0, fail: 0, error: 0 };
  for (const r of results) counts[r.verdict]++;
  const blocking = results.filter((r) => BLOCKING_CONFORMANCE_VERDICTS.includes(r.verdict));
  return {
    scope: { ...REGISTRY_SCOPE },
    measuredAt: measuredAt ?? new Date().toISOString(),
    recordedAt: REGISTRY_SCOPE.measuredAt,
    results,
    counts,
    publishable: blocking.length === 0,
    driftCount: DRIFT_ENTRIES.length,
    note:
      blocking.length === 0
        ? "Every check still matches the recorded rows for this run."
        : `${blocking.length} check(s) did not pass; the affected rows are stale and must be updated WITH a fresh reading before any conclusion is drawn.`,
    disclaimer: CONFORMANCE_VERDICTS,
  };
}

/** A one-line-per-check text rendering, for a terminal. */
export function renderConformance(report) {
  const L = [];
  L.push("=== PI API CONTRACT REGISTRY — conformance re-measurement ===");
  L.push("");
  L.push(`  endpoint:  ${report.scope.endpoint}`);
  L.push(`  network:   ${report.scope.networkPassphrase}`);
  L.push(`  recorded:  ${report.recordedAt} at node ${report.scope.nodeVersion} (protocol ${report.scope.protocolVersion})`);
  L.push(`  re-measured: ${report.measuredAt}`);
  L.push("");
  for (const r of report.results) {
    const mark = r.verdict === "pass" ? "PASS" : r.verdict === "fail" ? "FAIL" : "ERR ";
    L.push(`  [${mark}] ${r.id.padEnd(10)} ${r.method}`);
    L.push(`         observed: ${r.observed}`);
    L.push(`         ${r.detail}`);
  }
  L.push("");
  L.push(`  pass=${report.counts.pass}  fail=${report.counts.fail}  error=${report.counts.error}`);
  L.push(`  publishable: ${report.publishable ? "yes — all checks match" : "NO — a run with a failure cannot support a fresh conclusion"}`);
  L.push("");
  L.push("  -- DISCLAIMER --");
  L.push(`  ${report.note}`);
  for (const v of Object.values(report.disclaimer)) L.push(`  - ${v.id}: ${v.meaning}`);
  return L.join("\n");
}

/** JSON form, for piping. */
export function toJSON(report) {
  return JSON.stringify({ tool: "pi-api-contract-registry", mode: "conformance", report }, null, 2);
}
