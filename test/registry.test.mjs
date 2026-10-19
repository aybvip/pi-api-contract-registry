// registry.test.mjs — invariant tests. Offline: no network, no clock dependence.
//
// They cover the registry's data shape, the honesty guard, the drift records,
// and — most importantly — that the conformance engine correctly distinguishes
// "still matches" from "moved" from "could not be evaluated", using synthetic
// live responses. A tool that can only ever say PASS is not a conformance tool.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CLAIM_KINDS, FORBIDDEN_CLAIMS, FUTURE_NOT_CLAIMED, AUTHORITY_NOT_CLAIMED,
  REGISTRY_SCOPE, ROW_SCOPES, WIRE_TYPES, METHODS, method, supportedMethods, absentMethods,
  DRIFT_ENTRIES, DRIFT_SEVERITIES, CONFORMANCE_CHECKS, CONFORMANCE_VERDICTS,
  BLOCKING_CONFORMANCE_VERDICTS, BOUNDARIES,
} from "../lib.mjs";
import { evaluateCheck, buildConformanceReport, renderConformance, toJSON as conformanceJSON } from "../conformance.mjs";
import { renderRegistry, renderDrift, renderBoundaries, toJSON as registryJSON, REGISTRY_DISCLAIMER } from "../render.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else { fail++; failures.push(label); } };
const eq = (a, b, label) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A === B) pass++; else { fail++; failures.push(`${label}\n    expected: ${B}\n    actual:   ${A}`); } };
const includes = (hay, needle, label) => ok(String(hay).includes(needle), `${label} (looking for "${needle}")`);

// --- the honesty contract ----------------------------------------------------
eq(CLAIM_KINDS.length, 4, "four claim kinds");
ok(CLAIM_KINDS.some((c) => c.id === "measured"), "measured is a claim kind");
ok(CLAIM_KINDS.some((c) => c.id === "documented"), "documented is a claim kind");
ok(CLAIM_KINDS.some((c) => c.id === "not-claimed"), "not-claimed is a claim kind");
includes(FUTURE_NOT_CLAIMED, "does not claim", "the future non-claim is stated");
includes(AUTHORITY_NOT_CLAIMED, "NOT an official", "the authority non-claim is stated");
ok(FORBIDDEN_CLAIMS.some((c) => /will always|always works/i.test(c)), "forbids a forever claim");
ok(FORBIDDEN_CLAIMS.some((c) => /official registry|canonical source/i.test(c)), "forbids claiming to be the authority");
ok(FORBIDDEN_CLAIMS.some((c) => /spec is wrong|Pi is broken/i.test(c)), "forbids editorialising a drift as a fault");

// --- scope -------------------------------------------------------------------
includes(REGISTRY_SCOPE.endpoint, "rpc.testnet.minepi.com", "endpoint recorded");
eq(REGISTRY_SCOPE.networkPassphrase, "Pi Testnet", "network passphrase recorded");
eq(REGISTRY_SCOPE.protocolVersion, 28, "protocol version recorded");
eq(REGISTRY_SCOPE.nodeVersion, "28.0.1", "node version recorded");
ok(REGISTRY_SCOPE.measuredAt === "2026-10-19", "the measurement date is recorded");
includes(REGISTRY_SCOPE.measuredAtMeaning, "NOT evidence", "the date meaning warns it is not evidence");
ok(/NOT REACHABLE/.test(REGISTRY_SCOPE.mainnetNote), "mainnet is marked unreachable");
eq(ROW_SCOPES.length, 3, "three row scopes");
ok(!ROW_SCOPES.some((s) => /universal|always|global/i.test(s.id)), "there is NO 'universal' scope");

// --- methods -----------------------------------------------------------------
ok(METHODS.length >= 10, "at least ten methods recorded");
ok(supportedMethods().includes("getHealth"), "getHealth is supported");
ok(supportedMethods().includes("getEvents"), "getEvents is supported");
ok(absentMethods().includes("getContractData"), "getContractData is recorded as absent");
eq(method("getContractData").absent, true, "getContractData is flagged absent");
eq(method("getHealth").absent, undefined, "getHealth is not flagged absent");
eq(method("no-such-method"), null, "an unknown method name returns null");

// every recorded field has a name, a valid wire type, and a scope
for (const m of METHODS) {
  for (const fl of m.measured) {
    ok(typeof fl.name === "string" && fl.name.length > 0, `${m.name}: a measured field has a name`);
    ok(WIRE_TYPES.includes(fl.type), `${m.name}.${fl.name}: wire type "${fl.type}" is valid`);
    eq(fl.scope, "version-scoped", `${m.name}.${fl.name}: the field is version-scoped`);
    eq(fl.measuredAt, "2026-10-19", `${m.name}.${fl.name}: the field is dated`);
  }
  ok(Array.isArray(m.notes), `${m.name}: notes is an array`);
  ok(Array.isArray(m.drift), `${m.name}: drift is an array`);
}
for (const fl of method("getEvents").eventFields) {
  ok(WIRE_TYPES.includes(fl.type), `getEvents event field ${fl.name}: valid wire type`);
}

// the specific measured surprises must be RECORDED, not smoothed over
eq(method("getHealth").measured.find((f) => f.name === "latestLedgerCloseTime").type, "string", "getHealth close time is recorded as a STRING");
eq(method("getHealth").measured.find((f) => f.name === "ledgerRetentionWindow").type, "number", "retention window is recorded as a number");
eq(method("getNetwork").measured.find((f) => f.name === "passphrase").type, "string", "passphrase is a string");
eq(method("getFeeStats").measured.find((f) => f.name === "sorobanInclusionFee").type, "object", "sorobanInclusionFee is an object");
eq(method("getTransaction").measured.find((f) => f.name === "events").type, "object", "getTransaction.events is recorded as an OBJECT (the NOT_FOUND shape)");
eq(method("getEvents").eventFields.find((f) => f.name === "ledgerClosedAt").type, "string", "ledgerClosedAt is a string");
eq(method("getEvents").eventFields.find((f) => f.name === "inSuccessfulContractCall").type, "boolean", "inSuccessfulContractCall is a boolean");

// --- drift -------------------------------------------------------------------
ok(DRIFT_ENTRIES.length >= 8, "at least eight drift entries recorded");
for (const d of DRIFT_ENTRIES) {
  ok(typeof d.id === "string" && d.id.length > 0, "a drift entry has an id");
  ok(DRIFT_SEVERITIES.includes(d.severity), `drift ${d.id}: severity is valid`);
  ok(typeof d.what === "string" && d.what.length > 0, `drift ${d.id}: what is stated`);
  ok(typeof d.expected === "string" && d.expected.length > 0, `drift ${d.id}: expected is stated`);
  ok(typeof d.observed === "string" && d.observed.length > 0, `drift ${d.id}: observed is stated`);
  ok(typeof d.impact === "string" && d.impact.length > 0, `drift ${d.id}: impact is stated`);
  ok(typeof d.method === "string", `drift ${d.id}: the method is attached`);
  eq(d.scope, "version-scoped", `drift ${d.id}: the entry is version-scoped`);
}
ok(DRIFT_ENTRIES.some((d) => d.id === "D-FEE-1"), "the string-typed fee figures are recorded as drift");
ok(DRIFT_ENTRIES.some((d) => d.id === "D-SIM-1"), "the failure-inside-result shape is recorded as drift");
ok(DRIFT_ENTRIES.some((d) => d.id === "D-CON-1"), "the absent getContractData is recorded as drift");
ok(DRIFT_ENTRIES.some((d) => d.id === "D-TX-1"), "the status-dependent events type is recorded as drift");
ok(DRIFT_ENTRIES.some((d) => d.severity === "high"), "at least one high-severity drift exists");
ok(DRIFT_ENTRIES.some((d) => d.severity === "medium"), "at least one medium-severity drift exists");

// --- conformance: the three verdicts, with synthetic live responses ----------
// A "matching" bundle must produce all-pass; a moved bundle must produce fails.
const matching = {
  getHealth: { result: { status: "healthy", latestLedger: 100, latestLedgerCloseTime: "1792446695", oldestLedger: 1, oldestLedgerCloseTime: "1791841900", ledgerRetentionWindow: 120960 } },
  getNetwork: { result: { passphrase: "Pi Testnet", protocolVersion: 28 } },
  getVersionInfo: { result: { version: "28.0.1", protocolVersion: 28 } },
  getFeeStats: { result: { sorobanInclusionFee: { p50: "100000", transactionCount: "13", ledgerCount: 50 }, latestLedger: 100 } },
  simulateTransactionInvalid: { result: { error: "Could not unmarshal transaction", latestLedger: 0 } },
  getTransactionUnknown: { result: { status: "NOT_FOUND", events: {}, ledger: 0, createdAt: "0" } },
  getLedgerEntriesEmpty: { error: { code: -32603, message: "no keys specified in request" } },
  getContractDataAbsent: { error: { code: -32601, message: "method not found" } },
  getEvents: { result: { events: new Array(100).fill({}), cursor: "x", latestLedger: 100 } },
};

{
  const report = buildConformanceReport(matching, { measuredAt: "2026-10-19T00:00:00Z" });
  eq(report.counts.pass, CONFORMANCE_CHECKS.length, "a matching bundle passes every check");
  eq(report.counts.fail, 0, "a matching bundle has no failures");
  eq(report.counts.error, 0, "a matching bundle has no errors");
  eq(report.publishable, true, "a matching bundle is publishable");
  ok(/still matches/i.test(report.note), "the matching note says it matches");
  eq(report.results.length, CONFORMANCE_CHECKS.length, "every check is reported");
  for (const r of report.results) {
    ok(CONFORMANCE_VERDICTS[r.verdict] !== undefined, `result ${r.id}: verdict is a known kind`);
    ok(typeof r.observed === "string", `result ${r.id}: an observed value is reported`);
    ok(typeof r.detail === "string", `result ${r.id}: a detail is reported`);
  }
}

// A moved endpoint: version changed, retention changed, method now present.
{
  const moved = structuredClone(matching);
  moved.getVersionInfo.result.version = "29.0.0";
  moved.getHealth.result.ledgerRetentionWindow = 99999;
  moved.getContractDataAbsent = { result: { contractDataXdr: "AAAA" } }; // now present
  const report = buildConformanceReport(moved, { measuredAt: "later" });
  eq(report.counts.fail >= 3, true, "a moved endpoint fails the affected checks");
  eq(report.publishable, false, "a moved endpoint is NOT publishable");
  ok(!/still matches/i.test(report.note), "the moved note does not claim a match");
  ok(report.results.find((r) => r.id === "C-VER-1").verdict === "fail", "the version change is a fail");
  ok(report.results.find((r) => r.id === "C-HEALTH-1").verdict === "fail", "the retention change is a fail");
  ok(report.results.find((r) => r.id === "C-ERR-2").verdict === "fail", "a now-present method is a fail");
}

// An unevaluable run: the endpoint was unreachable, so nothing is known.
{
  const report = buildConformanceReport({}, { measuredAt: "later" });
  eq(report.counts.error, CONFORMANCE_CHECKS.length, "an empty capture yields all errors");
  eq(report.counts.pass, 0, "an empty capture yields no passes");
  eq(report.publishable, false, "an unevaluable run is NOT publishable");
  for (const r of report.results) eq(r.verdict, "error", `${r.id}: an uncaptured check is an error`);
}

// A type change alone must be caught (the fee figures becoming numbers).
{
  const retyped = structuredClone(matching);
  retyped.getFeeStats.result.sorobanInclusionFee.p50 = 100000; // number, not string
  const report = buildConformanceReport(retyped, { measuredAt: "later" });
  ok(report.results.find((r) => r.id === "C-TYP-2").verdict === "fail", "a wire-type change is caught");
}

// A transport error is an error, never a pass and never a fail.
{
  const transport = structuredClone(matching);
  transport.getHealth = { transportError: "fetch failed" };
  const r = evaluateCheck(CONFORMANCE_CHECKS.find((c) => c.id === "C-HEALTH-1"), transport);
  eq(r.verdict, "error", "a transport error yields error, not fail");
}

// EVERY check must report error (never fail) when every capture is a transport error.
{
  const dead = {};
  for (const k of ["getHealth", "getNetwork", "getVersionInfo", "getFeeStats", "simulateTransactionInvalid", "getTransactionUnknown", "getLedgerEntriesEmpty", "getContractDataAbsent", "getEvents"]) {
    dead[k] = { transportError: "fetch failed" };
  }
  const report = buildConformanceReport(dead, { measuredAt: "t" });
  eq(report.counts.error, CONFORMANCE_CHECKS.length, "an unreachable endpoint yields error for EVERY check");
  eq(report.counts.fail, 0, "an unreachable endpoint yields NO fails (nothing was observed)");
  eq(report.publishable, false, "an unreachable endpoint is not publishable");
}

// The whole-point check: a check with no owner in the capture is an error.
{
  const missing = { getHealth: matching.getHealth };
  const r = evaluateCheck(CONFORMANCE_CHECKS.find((c) => c.id === "C-NET-1"), missing);
  eq(r.verdict, "error", "an uncaptured method yields error, not pass");
}

eq(BLOCKING_CONFORMANCE_VERDICTS, ["fail", "error"], "fail and error both block a conclusion");

// --- conformance checks are well-formed --------------------------------------
for (const c of CONFORMANCE_CHECKS) {
  ok(typeof c.id === "string" && c.id.length > 0, "a check has an id");
  ok(typeof c.method === "string", `check ${c.id}: has a method`);
  ok(typeof c.question === "string" && c.question.length > 0, `check ${c.id}: is phrased as a question`);
  eq(c.kind, "measured", `check ${c.id}: is a measured check`);
}
ok(CONFORMANCE_CHECKS.some((c) => c.id === "C-ERR-1"), "the simulate-failure check exists");
ok(CONFORMANCE_CHECKS.some((c) => c.id === "C-EVT-1"), "the event-cap check exists");

// --- rendering ---------------------------------------------------------------
const regText = renderRegistry();
includes(regText, "PI API CONTRACT REGISTRY", "the registry renders a title");
includes(regText, REGISTRY_SCOPE.endpoint, "the registry names the endpoint");
includes(regText, "getHealth", "the registry lists methods");
includes(regText, "wire types", "the registry shows wire types");
includes(regText, "DRIFT SUMMARY", "the registry summarises drift");
includes(regText, AUTHORITY_NOT_CLAIMED, "the registry carries the authority non-claim");
includes(regText, FUTURE_NOT_CLAIMED, "the registry carries the future non-claim");

const driftText = renderDrift();
includes(driftText, "observed drift", "the drift view renders");
includes(driftText, "D-FEE-1", "the drift view lists a known entry");
includes(driftText, "neither correct nor incorrect", "the drift view refuses to judge");

const boundText = renderBoundaries();
includes(boundText, "boundaries", "boundaries render");
for (const b of BOUNDARIES) includes(boundText, b, "every boundary is printed");

const confText = renderConformance(buildConformanceReport(matching, { measuredAt: "t" }));
includes(confText, "conformance", "the conformance view renders");
includes(confText, "publishable", "the conformance view states publishability");

// --- JSON --------------------------------------------------------------------
{
  const j = JSON.parse(registryJSON());
  eq(j.tool, "pi-api-contract-registry", "JSON names the tool");
  eq(j.mode, "registry", "JSON names the mode");
  eq(j.registryScope.endpoint, REGISTRY_SCOPE.endpoint, "JSON carries the scope");
  eq(j.methods.length, METHODS.length, "JSON carries every method");
  eq(j.drift.length, DRIFT_ENTRIES.length, "JSON carries every drift entry");
  ok(Array.isArray(j.disclaimer) && j.disclaimer.length >= 2, "JSON carries the disclaimer");
  ok(j.driftBySeverity.high >= 1, "JSON summarises drift by severity");
}
{
  const j = JSON.parse(conformanceJSON(buildConformanceReport(matching, { measuredAt: "t" })));
  eq(j.mode, "conformance", "the conformance JSON names its mode");
  eq(j.report.publishable, true, "the conformance JSON states publishability");
  eq(j.report.results.length, CONFORMANCE_CHECKS.length, "the conformance JSON carries every result");
}

// --- documents and links -----------------------------------------------------
const docs = [
  "README.md", "llms.txt", "docs/INDEX.md", "docs/CONTRACT-REGISTRY.md", "docs/DRIFT.md",
  "docs/CONFORMANCE.md", "docs/DECISIONS.md", "docs/SOURCES.md", "docs/VERIFICATION.md",
];
for (const d of docs) {
  try { readFileSync(join(root, d), "utf8"); pass++; } catch { fail++; failures.push(`missing doc: ${d}`); }
}

const mdFiles = [];
(function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === ".git" || ent.name === "node_modules") continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (/\.(md|txt)$/.test(ent.name)) mdFiles.push(full);
  }
})(root);
let broken = 0;
for (const f of mdFiles) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)) {
    const rel = m[1].split("#")[0];
    if (!rel) continue;
    try { readFileSync(join(dirname(f), rel), "utf8"); } catch { broken++; failures.push(`broken link in ${f}: ${rel}`); }
  }
}
ok(broken === 0, `no broken relative links (found ${broken})`);

// --- the repository's own prose asserts no forbidden claim -------------------
for (const f of mdFiles) {
  const text = readFileSync(f, "utf8");
  for (const claim of FORBIDDEN_CLAIMS) {
    const re = new RegExp(claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    for (const line of text.split(/\r?\n/)) {
      if (!re.test(line)) continue;
      const negated = /\b(not|never|does not|doesn't|isn't|is not|no|nor|forbidden|cannot|can't|must not)\b/i.test(line);
      const quoted = /forbidden|FORBIDDEN|must not|quoted|quote|avoid/i.test(line);
      if (negated || quoted) continue;
      fail++;
      failures.push(`forbidden claim asserted in ${f}: "${claim}"\n    line: ${line.trim().slice(0, 120)}`);
    }
  }
}

// --- the engine contains no network or execution primitive -------------------
for (const f of ["conformance.mjs", "render.mjs"]) {
  const src = readFileSync(join(root, f), "utf8");
  ok(!/\bfetch\s*\(/.test(src), `${f} performs no network call`);
  ok(!/child_process|execSync|new Function\s*\(/.test(src), `${f} executes nothing`);
}
{
  const src = readFileSync(join(root, "lib.mjs"), "utf8");
  const imports = [...src.matchAll(/^\s*import\s+.+$/gm)].map((m) => m[0].trim());
  eq(imports, [], "lib.mjs imports nothing");
}
{
  const src = readFileSync(join(root, "registry-cli.mjs"), "utf8");
  ok(!/signTransaction|submitTransaction|sendTransaction/.test(src), "the CLI never signs or submits");
}

if (fail) {
  console.error(`\n${fail} FAILURE(S):`);
  for (const f of failures) console.error("  - " + f);
  process.exitCode = 1;
}
console.log(`\npi-api-contract-registry — invariant tests\n  pass: ${pass}\n  fail: ${fail}`);
