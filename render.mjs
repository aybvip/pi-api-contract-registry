// render.mjs — render the REGISTRY as a reference document or as JSON.
//
// The registry is data. This turns it into something a developer reads: every
// method, its request parameters, its measured response fields with wire types,
// its notes, its drift entries, and the scope that bounds all of it. The
// non-claims are attached to every rendering, never omitted.

import {
  REGISTRY_SCOPE,
  METHODS,
  DRIFT_ENTRIES,
  DRIFT_SEVERITIES,
  ROW_SCOPES,
  CLAIM_KINDS,
  BOUNDARIES,
  FUTURE_NOT_CLAIMED,
  AUTHORITY_NOT_CLAIMED,
} from "./lib.mjs";

export const REGISTRY_DISCLAIMER = [
  AUTHORITY_NOT_CLAIMED,
  FUTURE_NOT_CLAIMED,
  "A row is a dated measurement at one endpoint and version. A different endpoint or version may differ, and none is inferred.",
];

/** Render the whole registry as a text reference document. */
export function renderRegistry() {
  const L = [];
  L.push("=== PI API CONTRACT REGISTRY ===");
  L.push("");
  L.push("  What this is: a dated record of what this endpoint ACTUALLY returned,");
  L.push("  alongside where that departs from what a spec-following client expects.");
  L.push("");
  L.push("  -- SCOPE (everything below is bounded by this) --");
  L.push(`    endpoint:          ${REGISTRY_SCOPE.endpoint}`);
  L.push(`    network passphrase: ${REGISTRY_SCOPE.networkPassphrase}`);
  L.push(`    measured at:       ${REGISTRY_SCOPE.measuredAt}`);
  L.push(`    node version:      ${REGISTRY_SCOPE.nodeVersion}  (commit ${REGISTRY_SCOPE.commitHash.slice(0, 12)}…)`);
  L.push(`    protocol version:  ${REGISTRY_SCOPE.protocolVersion}`);
  L.push(`    mainnet:           ${REGISTRY_SCOPE.mainnetNote}`);
  L.push("");
  L.push(`  methods recorded: ${METHODS.length}  (supported: ${METHODS.filter((m) => !m.absent).length}, absent: ${METHODS.filter((m) => m.absent).length})`);
  L.push(`  drift entries:    ${DRIFT_ENTRIES.length}`);
  L.push("");

  for (const m of METHODS) {
    L.push("  " + "-".repeat(72));
    L.push(`  ${m.name}${m.absent ? "   [ABSENT at this version]" : ""}`);
    L.push(`    documented: ${m.documented}`);
    const paramKeys = Object.keys(m.params);
    L.push(`    request params: ${paramKeys.length ? paramKeys.map((k) => `${k} (${m.params[k]})`).join(", ") : "(none)"}`);
    if (m.measured.length) {
      L.push("    response fields (measured, wire types):");
      for (const fl of m.measured) {
        L.push(`      ${fl.name.padEnd(26)} ${String(fl.type).padEnd(9)} ${fl.note ?? ""}`.trimEnd());
      }
    } else {
      L.push("    response fields: (none measured — this method is absent)");
    }
    if (m.eventFields) {
      L.push("    event fields (for getEvents.events[]):");
      for (const fl of m.eventFields) {
        L.push(`      ${fl.name.padEnd(26)} ${String(fl.type).padEnd(9)} ${fl.note ?? ""}`.trimEnd());
      }
    }
    if (m.notes.length) {
      L.push("    notes:");
      for (const n of m.notes) L.push(`      - ${n}`);
    }
    if (m.drift?.length) {
      L.push("    drift (observed vs expected):");
      for (const d of m.drift) {
        L.push(`      [${d.id}] severity=${d.severity}`);
        L.push(`        what:     ${d.what}`);
        L.push(`        expected: ${d.expected}`);
        L.push(`        observed: ${d.observed}`);
        L.push(`        impact:   ${d.impact}`);
      }
    }
    L.push("");
  }

  L.push("  " + "-".repeat(72));
  L.push("  -- DRIFT SUMMARY --");
  const bySeverity = { low: 0, medium: 0, high: 0 };
  for (const d of DRIFT_ENTRIES) bySeverity[d.severity] = (bySeverity[d.severity] ?? 0) + 1;
  L.push(`    low=${bySeverity.low}  medium=${bySeverity.medium}  high=${bySeverity.high}`);
  L.push("");
  for (const sev of DRIFT_SEVERITIES) {
    const items = DRIFT_ENTRIES.filter((d) => d.severity === sev);
    if (!items.length) continue;
    L.push(`    ${sev.toUpperCase()}:`);
    for (const d of items) L.push(`      ${d.id.padEnd(10)} ${d.method.padEnd(22)} ${d.what}`);
  }
  L.push("");
  L.push("  -- SCOPES a row can carry --");
  for (const s of ROW_SCOPES) L.push(`    ${s.id}: ${s.meaning}`);
  L.push("");
  L.push("  -- DISCLAIMER --");
  for (const d of REGISTRY_DISCLAIMER) L.push(`  - ${d}`);
  return L.join("\n");
}

/** Render every drift entry on its own, for a focused read. */
export function renderDrift() {
  const L = [];
  L.push("=== PI API CONTRACT REGISTRY — observed drift ===");
  L.push("");
  L.push(`  ${DRIFT_ENTRIES.length} departure(s) recorded between the observed shape and what a spec-following client expects.`);
  L.push("  A departure is RECORDED, not judged: this repository calls it neither correct nor incorrect.");
  L.push("");
  for (const d of DRIFT_ENTRIES) {
    L.push(`  [${d.id}]  ${d.method}   severity=${d.severity}   scope=${d.scope}`);
    L.push(`    what:     ${d.what}`);
    L.push(`    expected: ${d.expected}`);
    L.push(`    observed: ${d.observed}`);
    L.push(`    impact:   ${d.impact}`);
    L.push("");
  }
  L.push("  -- DISCLAIMER --");
  for (const d of REGISTRY_DISCLAIMER) L.push(`  - ${d}`);
  return L.join("\n");
}

export function renderBoundaries() {
  const L = [];
  L.push("=== PI API CONTRACT REGISTRY — boundaries ===");
  L.push("");
  for (const b of BOUNDARIES) L.push(`  - ${b}`);
  L.push("");
  L.push(`  ${AUTHORITY_NOT_CLAIMED}`);
  L.push(`  ${FUTURE_NOT_CLAIMED}`);
  return L.join("\n");
}

/** JSON form of the registry, self-contained: scope, methods, drift, disclaimer. */
export function toJSON() {
  return JSON.stringify(
    {
      tool: "pi-api-contract-registry",
      mode: "registry",
      disclaimer: REGISTRY_DISCLAIMER,
      claimKinds: CLAIM_KINDS,
      scopes: ROW_SCOPES,
      registryScope: REGISTRY_SCOPE,
      methods: METHODS,
      drift: DRIFT_ENTRIES,
      driftBySeverity: DRIFT_ENTRIES.reduce((a, d) => ((a[d.severity] = (a[d.severity] ?? 0) + 1), a), {}),
    },
    null,
    2
  );
}
