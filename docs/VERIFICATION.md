# Verification

Every figure quoted in this repository can be reproduced with the commands below.
The dates and outputs are what was actually observed, not expected values.

## 0. Tests (offline, no network)

```bash
node test/registry.test.mjs
```

Expected: `pass: 465  fail: 0`.

The suite is offline and clock-independent. It includes a synthetic bundle in
which the endpoint has **moved**, and asserts the conformance engine reports
`fail` and sets `publishable` to `false` — so the engine's ability to fail is
proven, not assumed.

## 1. The recorded registry

```bash
node registry-cli.mjs --registry
```

Observed on 2026-10-19: the scope block, then **10 methods** (9 supported, 1
absent) and **9 drift entries**, each field printed with its measured wire type.

```bash
node registry-cli.mjs --registry --json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);console.log('methods',j.methods.length,'drift',j.drift.length,'scope',j.registryScope.endpoint)})"
```

Observed: `methods 10 drift 9 scope https://rpc.testnet.minepi.com`.

## 2. The drift view

```bash
node registry-cli.mjs --drift
```

Observed: 9 entries grouped by severity, each with `what`, `expected`,
`observed`, and `impact`, and the line stating a departure is recorded as
*"neither correct nor incorrect"*.

## 3. Live conformance — the recorded rows still match

```bash
node registry-cli.mjs --conformance
```

Observed on 2026-10-19 (exit `0`):

```
  [PASS] C-HEALTH-1 getHealth
         observed: ledgerRetentionWindow=120960
  [PASS] C-NET-1    getNetwork
         observed: passphrase="Pi Testnet" protocol=28
  [PASS] C-VER-1    getVersionInfo
         observed: version=28.0.1
  [PASS] C-TYP-1    getHealth
         observed: close times are strings
  [PASS] C-TYP-2    getFeeStats
         observed: p50=string transactionCount=string ledgerCount=number
  [PASS] C-ERR-1    simulateTransaction
         observed: result.error="Could not unmarshal transaction"
  [PASS] C-ERR-2    getContractData
         observed: error code -32601
  [PASS] C-ERR-3    getLedgerEntries
         observed: error code -32603
  [PASS] C-TX-1     getTransaction
         observed: status="NOT_FOUND"
  [PASS] C-EVT-1    getEvents
         observed: 100 events

  pass=10  fail=0  error=0
  publishable: yes — all checks match
```

## 4. The measured shapes the registry records

These are the raw reading, reproduced here so the rows can be checked against
them.

### `getHealth` — close times are strings

```bash
node registry-cli.mjs --conformance --json | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const r=JSON.parse(s).report;console.log(JSON.stringify(r.results.find(x=>x.id==='C-TYP-1'),null,2))})"
```

Observed: `"close times are strings"` — `latestLedgerCloseTime` and
`oldestLedgerCloseTime` are JSON **strings**, not numbers.

### `getFeeStats` — figures are strings, `ledgerCount` is a number

Observed in the same run: `p50=string transactionCount=string ledgerCount=number`.
This is drift `D-FEE-1`.

### `simulateTransaction` — a failure inside a success envelope

Observed: HTTP `200`, no JSON-RPC error, and `result.error =
"Could not unmarshal transaction"`. This is drift `D-SIM-1`.

### `getTransaction` — an unknown hash is `NOT_FOUND`, not an error

Observed: HTTP `200`, `result.status = "NOT_FOUND"`, `result.events = {}` (an
**object**), `ledger = 0`, `createdAt = "0"`. Drifts `D-TX-1` and `D-TX-2`.

### `getContractData` — absent

Observed: JSON-RPC error `-32601`, `"method not found"`. Drift `D-CON-1`.

### `getLedgerEntries` — an empty key list is an error

Observed: JSON-RPC error `-32603`,
`"could not query captive core: no keys specified in request"`. Drift `D-ENT-1`.

## 5. Invalid input

```bash
node registry-cli.mjs --conformance --rpc http://127.0.0.1:1
```

Observed: every check reports `ERR`, `pass=0 fail=0 error=10`, and exit `2`.
An unreachable endpoint produces **errors**, never `fail` — because nothing was
observed. This is the distinction `CONFORMANCE.md` relies on.

> An early build reported `fail=9 error=1` here, because a check that compared an
> error *code* saw `undefined ≠ -32603` and concluded "moved". That was a defect,
> not a finding: nothing had been observed to move. The engine now treats a
> transport error as unevaluable before any comparison. See `DECISIONS.md` D6.

## 6. Repository self-check

```bash
node registry-cli.mjs --boundaries
```

Lists every boundary and restates the authority and future non-claims. The test
suite additionally scans every Markdown file for forbidden-claim phrases and
fails if one is asserted rather than quoted or negated.

## Reproducing against a moved endpoint

Node versions, protocol versions, and behaviour change. If a later
`--conformance` run shows a `fail`, that is the intended behaviour: the recorded
row is stale, and this repository says so rather than silently serving an old
reading. Update the row **with** the new measurement, including the new
`measuredAt` and version, and if the shape moved, add or amend a drift entry.

## 7. Commit attribution

This repository's commits are authored with the project account's own address
(`86422631+aybvip@users.noreply.github.com`), so GitHub attributes them to this
account and not to whoever happens to own another email. Check it against the
published repository:

```bash
git log --format="%ae" | sort -u
```

Expected: one email. The rule is recorded because GitHub attributes a commit to
the account that **owns the author email**, not to whoever authenticated the
push.
