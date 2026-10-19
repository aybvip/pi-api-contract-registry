# Pi API Contract Registry

A **read-only, zero-dependency** record of what Pi Network's Soroban RPC
**actually returns** — method by method, field by field, with the **wire type**
each field really uses — alongside where that departs from what a
spec-following client expects.

> **Plainly:** API documentation tells you what a method *should* return. This
> registry records what `https://rpc.testnet.minepi.com` **did** return on a
> dated run, at a stated node and protocol version — and then lists the places
> where a client that trusts the documentation will break:
>
> - `getHealth` returns close **times as strings** (`"1792446605"`), not numbers;
> - `getFeeStats` returns fee **figures as strings** (`"100000"`) while its
>   sibling `ledgerCount` is a **number**;
> - `simulateTransaction` reports a **failure inside a success envelope** — HTTP
>   `200` with the message in `result.error`;
> - `getTransaction` reports an unknown hash as `status: "NOT_FOUND"` at HTTP
>   `200`, with `events` as an **object** (`{}`) rather than an array;
> - `getLedgerEntries` treats an **empty key list as a server error** (`-32603`);
> - `getContractData`, which appears in widely-copied sample code, **does not
>   exist here** (`-32601`).

Every one of those is a recorded measurement with the exact observed value, not
an opinion about the API.

## What this is, and what it is not

| | |
|---|---|
| **Is** | a dated record of measured request/response shapes for this endpoint |
| **Is** | a list of **drift** entries: where observed behaviour departs from client expectation, with the impact stated |
| **Is** | **re-measurable**: `--conformance` re-runs every check live and reports `pass` / `fail` / `error` |
| **Is not** | the official or authoritative API reference — where an official spec exists, that spec governs |
| **Is not** | a claim that any row will hold tomorrow — a row is a measurement, not a promise |
| **Is not** | a claim that an observed departure is a **bug** — drift is recorded, not judged |
| **Is not** | a Mainnet record — no public Soroban RPC exists there (measured HTTP 503) |

## The three concepts, kept apart

| Concept | What it means |
|---|---|
| **Documented contract** | what a published specification says |
| **Measured contract** | what this endpoint actually returned, on a date, at a version |
| **Drift** | where the measured contract departs from what a client expects |

This repository records all three and **never presents the measured contract as
the documented one**.

## Measured on 2026-10-19

Against `https://rpc.testnet.minepi.com` — node `28.0.1`, protocol `28`:

| | |
|---|---|
| Network passphrase | `"Pi Testnet"` |
| Methods recorded | **10** (9 supported, 1 absent) |
| Drift entries | **9** (3 high, 4 medium, 2 low) |
| Live conformance | **`pass=10 fail=0 error=0`**, exit `0` |
| Retention window (from `getHealth`) | `120960` ledgers — matching the independent measurement in `pi-soroban-events` |

## Every row is scoped

There are exactly three scopes, and **no "universal" scope** exists:

| Scope | Meaning |
|---|---|
| `endpoint-scoped` | true at this endpoint only |
| `version-scoped` | true at node `28.0.1` only |
| `protocol-scoped` | true under protocol `28` only |

A row without a scope would claim to be true of all Pi RPC forever. No
measurement can support that, so no such row exists.

## Usage

```bash
# the recorded registry, with wire types and drift
node registry-cli.mjs --registry
node registry-cli.mjs --registry --json

# only the drift entries
node registry-cli.mjs --drift

# re-measure every recorded row LIVE (reads only; never signs or submits)
node registry-cli.mjs --conformance
node registry-cli.mjs --conformance --json

# every non-claim
node registry-cli.mjs --boundaries
node registry-cli.mjs --help
```

Exit codes for `--conformance`: `0` every check passed, `1` any check **failed**
(the endpoint moved), `2` any check could not be evaluated. A run in which any
check did not pass sets `publishable` to `false` — so a stale row cannot be
published as current.

### Prove it yourself

```bash
# the recorded rows still match the live endpoint
node registry-cli.mjs --conformance

# an unreachable endpoint yields ERRORS, never FAILS
node registry-cli.mjs --conformance --rpc http://127.0.0.1:1
```

The second command is the point of the three-verdict design: when nothing is
observed, nothing is claimed — not a pass, not a fail.

## Documents

| Document | Contents |
|---|---|
| [`docs/CONTRACT-REGISTRY.md`](docs/CONTRACT-REGISTRY.md) | what a row records, wire types, and the three scopes |
| [`docs/DRIFT.md`](docs/DRIFT.md) | every observed departure from expectation, with its impact |
| [`docs/CONFORMANCE.md`](docs/CONFORMANCE.md) | re-measuring the rows: pass / fail / error and `publishable` |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | D1–D9, including what was declined and why |
| [`docs/SOURCES.md`](docs/SOURCES.md) | official documentation and measured RPC facts |
| [`docs/VERIFICATION.md`](docs/VERIFICATION.md) | exact commands and their observed output |
| [`docs/INDEX.md`](docs/INDEX.md) | index of everything |

## Not claimed

- That this is the official or authoritative API reference.
- That any method, field, type or error code will behave the same tomorrow.
- That a row holds at another endpoint or another version.
- That an observed departure from a specification is a bug.
- That a `pass` covers methods or fields not in the check list.
- That an `error` is a `fail` — it is the absence of information.
- Anything about Mainnet.
- That Pi Network has adopted, reviewed, or endorsed this.

## Relationship to `pi-contract-simulator`

`pi-contract-simulator` first recorded the **RPC surface** (which methods exist)
and a version-scoped claim model. This repository extends that surface into full
**request/response schemas with wire types**, and adds **drift** entries and a
live **conformance** re-measurement. The surface itself is a second measurement
of the same endpoint, taken independently.

## Tests

```bash
node test/registry.test.mjs
```

465 offline checks, no network. They cover the registry's data shape, the scope
rules, the wire types, every drift entry, the honesty guard, doc/link integrity —
and, crucially, a **synthetic moved endpoint** that proves the conformance engine
reports `fail` and refuses to publish, plus an **all-transport-error** bundle that
proves an unreachable endpoint reports `error`, never `fail`. A conformance tool
that cannot fail attests nothing; the suite demonstrates both directions.

## License

MIT. Read-only. No keys. No writes. No submissions.
