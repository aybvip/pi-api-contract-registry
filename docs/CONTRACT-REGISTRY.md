# Contract registry

This document is the reference for the registry itself: what a row is, what it
records, and what bounds it.

## 1. Three things that are routinely confused

| | What it is | Where it comes from |
|---|---|---|
| **Documented contract** | what a published specification says a method names, returns, or rejects | an official URL |
| **Measured contract** | what this endpoint **actually returned**, on a date, at a version | a command in this repository |
| **Drift** | where the measured contract departed from what a spec-following client expects | the comparison of the two |

This repository records all three, and **never presents the measured contract as
the documented one**. Where an official specification exists, the specification
governs; the measurement describes one endpoint at one version on one date.

## 2. What one row records

A **method row** carries:

| Field | Meaning |
|---|---|
| `name` | the JSON-RPC method name |
| `documented` | what the method is for, in one line |
| `params` | the request parameters, with types |
| `measured` | the response fields actually observed, with **wire types** |
| `notes` | what a client must know that the field list alone hides |
| `drift` | observed departures from what a client expects, each with an impact |
| `absent` | `true` when the method does **not exist** at this version |

A **field row** carries a `name`, a `type`, an optional `note`, and — like every
other row — a `scope` and a `measuredAt` date.

### Wire types are recorded as the wire spells them

The type recorded for a field is the **JSON primitive type observed**, not the
type a client "should" get. When those differ, the difference is the point:

- `getHealth.latestLedgerCloseTime` is a **string** (Unix seconds as text), not a
  number;
- `getFeeStats.sorobanInclusionFee.p50` is a **string**, while its sibling
  `ledgerCount` is a **number**;
- `getTransaction.events` is an **object** in the `NOT_FOUND` shape and an array
  in the success shape.

A generated client built from a guessed schema will mistype all three. Recording
the wire type is what prevents that.

## 3. Every row is scoped

There are exactly three scopes, and **no "universal" scope** exists:

| Scope | Meaning |
|---|---|
| `endpoint-scoped` | true at this endpoint only; another endpoint may differ |
| `version-scoped` | true at node `28.0.1` only; an upgrade may invalidate it |
| `protocol-scoped` | true under protocol `28` only |

A row without a scope would be a claim about all Pi RPC forever, which no
measurement can support. So no such row exists.

## 4. The measurement has a date, and the date is not evidence

`REGISTRY_SCOPE.measuredAt` records when the rows were taken. It is deliberately
accompanied by a warning: **a date is not evidence, a re-run is.** That is what
[`CONFORMANCE.md`](CONFORMANCE.md) and the `--conformance` command exist for.

## 5. The registry is not the authority

This is a third-party record. It is not an official Pi Network document and not
the authoritative API reference. Its value is that every row is **reproducible**
and **dated**, so a reader can re-measure and see for themselves.

## 6. Not claimed

- That any method, field, type or error code will behave the same tomorrow.
- That a row holds at another endpoint or another version.
- That an observed departure from a specification is a fault; drift is recorded,
  not judged.
- That this is the official or authoritative reference.
