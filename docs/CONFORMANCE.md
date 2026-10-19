# Conformance

`--conformance` re-measures every recorded row **live** and reports whether the
endpoint still matches what this repository recorded.

## Three verdicts, and they must never be conflated

| Verdict | Meaning | What a caller may do |
|---|---|---|
| `pass` | the live endpoint still matches the recorded row | may cite the row, with its scope and date |
| `fail` | the endpoint **moved**; the row is now stale | **must not** cite the row; must update it with the fresh reading |
| `error` | the check **could not be evaluated** | **no conclusion either way** — not a pass, not a fail |

The distinction between `fail` and `error` is the whole point. A `fail` is a
**finding** — the node changed. An `error` means the endpoint was unreachable or
returned an unexpected shape, so *nothing is known*. Treating an `error` as a
pass would publish a conclusion built on no measurement; treating it as a `fail`
would report a change that was never observed.

## `publishable`

The report carries a single boolean, `publishable`, which is `true` **only** when
every check passed. Any `fail` or `error` sets it `false`. A tool that could only
ever say "pass" would not be a conformance tool; this one is deliberately harder
to satisfy.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | every check passed — the recorded rows still match |
| `1` | at least one check **failed** — the endpoint moved |
| `2` | at least one check could not be evaluated |

## The checks

| id | method | the question |
|---|---|---|
| `C-HEALTH-1` | `getHealth` | is the retention window still returned, and still `120960`? |
| `C-NET-1` | `getNetwork` | is the passphrase still `"Pi Testnet"` and protocol still `28`? |
| `C-VER-1` | `getVersionInfo` | is the node still `28.0.1`? |
| `C-TYP-1` | `getHealth` | are the close times still **strings**, not numbers? |
| `C-TYP-2` | `getFeeStats` | are the fee figures still **strings** and `ledgerCount` still a **number**? |
| `C-ERR-1` | `simulateTransaction` | does an invalid transaction still fail **inside** `result.error` at HTTP `200`? |
| `C-ERR-2` | `getContractData` | is `getContractData` still **absent** (`-32601`)? |
| `C-ERR-3` | `getLedgerEntries` | is an empty key list still `-32603`? |
| `C-TX-1` | `getTransaction` | is an unknown hash still `NOT_FOUND` inside a **success** envelope? |
| `C-EVT-1` | `getEvents` | is a full page still capped at **100**? |

## Measured

A full run on **2026-10-19** against `https://rpc.testnet.minepi.com` reported
**`pass=10 fail=0 error=0`**, exit `0`. The recorded rows matched the live
endpoint on every check.

The test suite additionally proves the engine can **fail**: it feeds a synthetic
bundle in which the version changed, the retention window changed, a formerly
absent method is now present, and a wire type changed — and asserts that the
affected checks report `fail` and `publishable` becomes `false`. A tool that
cannot fail cannot attest.

## What a conformance run does NOT prove

- That the endpoint will match tomorrow — only that it matched during this run.
- That a `pass` covers methods or fields not in the check list.
- That a `fail` breaks your application — it means the recorded row is stale, not
  that anything is broken.
- That an `error` is a `fail` — it is not; it is the absence of information.
