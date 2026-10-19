# Drift

A **drift entry** records a place where the observed behaviour departs from what
a spec-following client would expect. Each entry states four things:

| Field | Meaning |
|---|---|
| `what` | the departure, in one line |
| `expected` | what a client following the specification would assume |
| `observed` | the exact value or shape this endpoint actually returned |
| `impact` | what breaks if a client trusts the expectation |
| `severity` | `low` / `medium` / `high` |

## What this repository does NOT do with drift

It does **not** call a drift entry a bug. The phrase *"the spec is wrong"* and
*"Pi is broken"* are **forbidden claims** in this repository. A drift entry is a
recorded observation with a stated impact; whether it is a defect is a judgement
this project is not positioned to make, and does not make.

It also does **not** claim the drift is permanent. Every entry is
`version-scoped` and dated. A later run may show it gone — which is itself a
finding, not a correction.

## The recorded entries

Measured 2026-10-19 at node `28.0.1`, protocol `28`.

### High severity

| id | method | what |
|---|---|---|
| `D-SIM-1` | `simulateTransaction` | A simulation **failure** is not a JSON-RPC error: HTTP `200`, a `result` object, and the message inside `result.error`. A client keying off HTTP status or a JSON-RPC error treats a failed simulation as a success. |
| `D-TX-1` | `getTransaction` | The type of `result.events` **depends on `status`**: `NOT_FOUND` returns an empty **object** `{}`, a successful transaction returns an **array**. Code that reads `result.events.length` unconditionally fails on `NOT_FOUND`. |
| `D-CON-1` | `getContractData` | A method that appears in widely-copied older sample code **does not exist** here: `-32601`, method not found. The replacement is `getLedgerEntries`. |

### Medium severity

| id | method | what |
|---|---|---|
| `D-FEE-1` | `getFeeStats` | Numeric fee figures arrive as **strings** (`"100000"`), while their sibling `ledgerCount` arrives as a **number**. Arithmetic without parsing concatenates strings; a generated client mistypes them. |
| `D-EVT-1` | `getEvents` | Timestamps use **two encodings on the same endpoint**: `event.ledgerClosedAt` is ISO 8601 (`"2026-10-19T21:48:25Z"`) while `result.latestLedgerCloseTime` is Unix-seconds-as-string (`"1792446605"`). |
| `D-ENT-1` | `getLedgerEntries` | An **empty key list is a server error** (`-32603`), not an empty result. A client that maps empty input to an empty response receives an error instead. |
| `D-TX-2` | `getTransaction` | `NOT_FOUND` is signalled **inside a success envelope**, with placeholder fields (`ledger: 0`, `createdAt: "0"`). Using those placeholders as data is a bug the API invites. |

### Low severity

| id | method | what |
|---|---|---|
| `D-VER-1` | `getVersionInfo` | `buildTimestamp` is an ISO-like string with **no timezone designator** (`"2026-09-16T13:30:54"`), so the instant it names is ambiguous. |
| `D-FEE-2` | `getFeeStats` | The two fee objects cover **different ledger counts** in the same response (`ledgerCount` 50 vs 10), so their percentiles are not directly comparable. |

## Why record drift at all

Because a client that reads only the happy path silently mis-handles every one of
the rows above. The value of the registry is not that it lists methods — a
specification lists methods. It is that it records **where the wire and the
expectation part ways**, with the exact observed value, so a developer can defend
against it before it breaks something.
