# Decisions

Each decision records what was chosen, why, and — where something was declined —
why it was declined.

## D1 — Record the measured contract separately from the documented one

**Decision.** Every row states what was **measured**, and the registry never
presents it as what is **documented**. Where an official specification exists,
the specification governs.

**Why.** The two are routinely conflated. A tool that calls its own reading "the
API spec" makes a claim about all Pi RPC forever, which no single-endpoint
measurement can support. Keeping them apart is what makes the registry honest.

## D2 — Record wire types as the wire spells them

**Decision.** A field's recorded type is the **JSON primitive observed**, not the
type it "should" have. Where they differ, a `drift` entry records the difference.

**Why.** Measured: `getHealth.latestLedgerCloseTime` is a **string**, not a
number; `getFeeStats` fee figures are **strings** while `ledgerCount` is a
**number**. A schema that guesses "number" will mistype the field and break a
client generated from it. Recording the observed type is the only way the
registry stays useful.

## D3 — Every row carries a scope, and there is no "universal" scope

**Decision.** A row is `endpoint-scoped`, `version-scoped`, or
`protocol-scoped`. No fourth, universal scope exists.

**Why.** A row without a scope is a claim about every Pi RPC endpoint at every
version forever. No measurement supports that. The absence of a universal scope
is enforced by a test.

## D4 — The measurement date is recorded, and explicitly called not-evidence

**Decision.** `REGISTRY_SCOPE.measuredAt` records the date, and
`measuredAtMeaning` states that the date is **not** evidence the rows still hold.

**Why.** A date invites the reading "this was true then, so it is true now". The
whole point of `--conformance` is that a re-run is the evidence, not the date.

## D5 — Drift is recorded, never judged

**Decision.** A drift entry states `what`, `expected`, `observed`, `impact`, and
`severity`. It never states that the behaviour is a bug, and the phrases *"the
spec is wrong"* and *"Pi is broken"* are **forbidden claims**.

**Why.** Whether an observed departure is a defect is a judgement about intent
and specification this project cannot make from the outside. Recording the exact
observation and its impact is useful and defensible; assigning fault is neither.

## D6 — Conformance has three verdicts, and `error` is not `fail`

**Decision.** A check reports `pass`, `fail`, or `error`. `publishable` is `true`
only when every check passed. Exit `1` on any `fail`, `2` on any `error`.

**Why.** Collapsing `error` into `pass` would publish a conclusion built on no
measurement. Collapsing it into `fail` would report a change never observed.
Keeping three verdicts is what lets a reader trust a `fail` as a genuine finding.

**Refinement (measured).** An unreachable endpoint must yield `error` for **every**
check, never `fail`. An early build reported `fail=9 error=1` against an
unreachable host, because a check that compared a *code* saw `undefined ≠ -32603`
and concluded "moved" — a change that was never observed. The engine now treats a
captured transport error as unevaluable before any comparison, and the test suite
asserts that an all-transport-error bundle yields `error` for every check and
`fail=0`.

## D7 — The test suite proves the engine can FAIL

**Decision.** The suite feeds a synthetic bundle in which the version, the
retention window, a method's presence, and a wire type have all changed, and
asserts that the affected checks report `fail` and `publishable` is `false`.

**Why.** A conformance tool that can only ever say "pass" attests nothing. The
ability to fail must be demonstrated, not assumed.

## D8 — Mainnet, and everything not measured, is `not-claimed`

**Decision.** `rpc.mainnet.minepi.com` is recorded as **NOT REACHABLE**
(measured HTTP 503), and no Mainnet row is inferred. Methods and fields not
measured are left out entirely rather than guessed.

**Why.** Inferring a Mainnet contract from a Testnet measurement would be a claim
without a measurement. Leaving a method out is honest; inventing its shape is
not.

## D9 — No signed output

**Decision.** The conformance report is not signed. A request to sign test
evidence was considered and **declined**.

**Why.** Signing asserts the identity of the signer as an authority. This project
is not an authority over Pi's API and names none. A signed report would imply an
endorsement that does not exist. The report is instead **reproducible**: anyone
can re-run `--conformance` and get their own reading, which is stronger than
trusting a signature from a party with no standing.
