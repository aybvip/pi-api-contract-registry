# Index

Everything in this repository, in reading order.

## Start here

| File | What it is |
|---|---|
| [`../README.md`](../README.md) | the registry, its scope, and what is not claimed |
| [`../llms.txt`](../llms.txt) | a compact machine-readable summary |

## The model

| Document | Contents |
|---|---|
| [`CONTRACT-REGISTRY.md`](CONTRACT-REGISTRY.md) | what a row records, wire types, and the three scopes |
| [`DRIFT.md`](DRIFT.md) | every observed departure from expectation, with its impact |
| [`CONFORMANCE.md`](CONFORMANCE.md) | re-measuring the rows: pass / fail / error and `publishable` |

## Discipline

| Document | Contents |
|---|---|
| [`DECISIONS.md`](DECISIONS.md) | D1–D8, including what was declined and why |
| [`SOURCES.md`](SOURCES.md) | official documentation and measured RPC facts |
| [`VERIFICATION.md`](VERIFICATION.md) | exact commands and their observed output |

## Code

| File | Role |
|---|---|
| `lib.mjs` | the registry as pure data: claim kinds, scope, methods, fields, types, drift, conformance checks, boundaries |
| `conformance.mjs` | the conformance engine: evaluate each check, summarise, decide publishability (offline) |
| `render.mjs` | render the registry, the drift view, the boundaries, or the conformance view |
| `registry-cli.mjs` | the CLI: registry, drift, boundaries, live conformance |
| `test/registry.test.mjs` | offline checks, including a proof that the engine can FAIL |

## Boundaries, at a glance

- It is **not** the official or authoritative API reference.
- It does **not** claim a row will still hold tomorrow.
- It does **not** claim a row holds at another endpoint or version.
- It does **not** call an observed departure a bug.
- It does **not** build, sign or submit transactions.
- It does **not** cover Mainnet (no public Soroban RPC; measured HTTP 503).
- It does **not** claim Pi Network has reviewed or endorsed it.
