# Sources

Every claim in this repository is one of: **documented** (an official URL says
so), **measured** (a command here reproduced it), or **not-claimed**.

## Official documentation

| Source | Used for |
|---|---|
| [Stellar Soroban RPC reference](https://developers.stellar.org/docs/data/apis/rpc/api-reference) | the method names and parameters this registry checks against |
| [Stellar Soroban RPC methods](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods) | per-method request/response documentation |
| [Pi Network developer documentation](https://developers.minepi.com/) | the Pi-specific network context (Testnet passphrase, Testnet RPC endpoint) |

Where this repository's measured behaviour differs from the official
documentation, the difference is recorded as a **drift entry** and the official
documentation is **cited**, not overridden. If a specification and a measurement
disagree, the measurement describes one endpoint at one version; it does not
redefine the specification.

## Measured RPC facts

All measured on **2026-10-19** against `https://rpc.testnet.minepi.com`
(node `28.0.1`, protocol `28`, commit `273f19e4fcb1…`), by the read-only commands
in [`VERIFICATION.md`](VERIFICATION.md):

| Fact | Value |
|---|---|
| Network passphrase | `"Pi Testnet"` |
| Node version | `28.0.1` |
| Protocol version | `28` |
| Retention window (from `getHealth`) | `120960` ledgers |
| Supported methods measured | **9** |
| Absent method measured | **1** (`getContractData`, `-32601`) |
| `getEvents` page cap | **100** events |
| `getHealth` close-time type | **string** (Unix seconds as text) |
| `getFeeStats` figure type | **string** (`"100000"`), while `ledgerCount` is a number |
| `simulateTransaction` failure shape | inside `result.error` at HTTP `200` |
| `getTransaction` unknown-hash shape | `status: "NOT_FOUND"` at HTTP `200`, `events` an object |
| `getLedgerEntries` empty-keys shape | JSON-RPC error `-32603` |
| Mainnet Soroban RPC | **NOT REACHABLE** (HTTP 503) |

## Repositories this one builds on

| Repository | Role |
|---|---|
| [`pi-contract-simulator`](https://github.com/aybvip/pi-contract-simulator) | first recorded the RPC surface and its version-scoped claim model; this registry extends that surface into full request/response schemas and drift |
| [`pi-soroban-events`](https://github.com/aybvip/pi-soroban-events) | measured the `getEvents` limits and the 120 960-ledger retention independently of this repository, giving a second source for both |
| [`pi-gap-index`](https://github.com/aybvip/pi-gap-index) | records measured gaps with an RFC-ready reference spec; this registry covers interface contracts, a different axis |

## Nothing third-party, nothing unofficial

No unofficial mirror, fork, blog post, or scraped page is used as a source. If a
claim cannot be traced to an official URL or a command in this repository, it is
not made.

## Not claimed

This repository does **not** claim to be the authoritative API reference, and
does **not** claim that Pi Network has reviewed, adopted or endorsed it. Adoption
is `not-claimed`.
