// lib.mjs — the API contract registry, as pure data.
//
// This repository records, for the Soroban RPC that Pi Network exposes, three
// separate things that are routinely confused with each other:
//
//   1. the DOCUMENTED contract   — what the published Soroban RPC spec says;
//   2. the MEASURED contract     — what this endpoint actually returned, on a date,
//                                  at a node/protocol version;
//   3. the DRIFT between them    — where (2) departed from (1).
//
// Every field below is one of:
//   - DOCUMENTED (an official URL says so),
//   - MEASURED   (a command in this repository reproduced it),
//   - not-claimed (out of scope, and marked as such).
//
// Nothing here is a claim about the future. Every measurement is scoped to the
// endpoint and version it was taken at, and carries the date it was taken — with
// the explicit warning that a date is not evidence and a re-run is.

// ---------------------------------------------------------------------------
// 1. Claim kinds and forbidden claims — the honesty contract
// ---------------------------------------------------------------------------

export const CLAIM_KINDS = [
  { id: "documented", meaning: "stated by an official source, cited by URL" },
  { id: "measured", meaning: "reproduced by a command in this repo against the recorded endpoint and version" },
  { id: "derived", meaning: "arises from applying a stated rule to measured facts; the rule is written down" },
  { id: "not-claimed", meaning: "explicitly out of scope; no assertion is made" },
];

/** Phrases this repository must never assert. The test suite fails if it does. */
export const FORBIDDEN_CLAIMS = [
  "the API will always",
  "this method always works",
  "guaranteed compatible",
  "forever stable",
  "the spec is wrong",
  "Pi is broken",
  "Pi approved",
  "we are first",
  "the official registry",
  "canonical source",
];

/** The single most important non-claim. */
export const FUTURE_NOT_CLAIMED =
  "This registry records what was MEASURED on a date at a version. It does not claim any method, field, type or error code will behave the same tomorrow. A recorded row is a history entry, not a promise.";

/** The second most important non-claim: this is not the authoritative source. */
export const AUTHORITY_NOT_CLAIMED =
  "This registry is NOT an official Pi Network document and NOT the authoritative API reference. It is a third-party record of measurements. Where an official specification exists, the official specification governs.";

// ---------------------------------------------------------------------------
// 2. The recorded scope — everything below is scoped to exactly this
// ---------------------------------------------------------------------------

export const REGISTRY_SCOPE = {
  endpoint: "https://rpc.testnet.minepi.com",
  networkPassphrase: "Pi Testnet",
  measuredAt: "2026-10-19",
  /** What the date means, and what it does not. */
  measuredAtMeaning:
    "the date these rows were recorded; it is NOT evidence they still hold — re-run `--conformance` to re-measure",
  nodeVersion: "28.0.1",
  commitHash: "273f19e4fcb183b568948bd2b810abfe87150a9c",
  protocolVersion: 28,
  /** Soroban RPC protocol, as declared by the node. */
  rpcProtocol: "Soroban JSON-RPC 2.0",
  /** Mainnet is deliberately out of scope. */
  mainnetNote:
    "rpc.mainnet.minepi.com is NOT REACHABLE (measured HTTP 503), so no Mainnet rows exist and none are inferred",
};

/**
 * The types of scope a row can carry. There is deliberately no "universal" kind:
 * a row measured here says nothing about another endpoint or another version.
 */
export const ROW_SCOPES = [
  { id: "endpoint-scoped", meaning: "measured at REGISTRY_SCOPE.endpoint only" },
  { id: "version-scoped", meaning: "measured at REGISTRY_SCOPE.nodeVersion only" },
  { id: "protocol-scoped", meaning: "measured under protocol REGISTRY_SCOPE.protocolVersion only" },
];

// ---------------------------------------------------------------------------
// 3. Field types, as they appear ON THE WIRE
// ---------------------------------------------------------------------------
//
// These are the JSON primitive types actually observed. They are recorded
// separately from field NAMES because a schema that says "number" where the wire
// says "string" is wrong and will break a client that trusts it.

export const WIRE_TYPES = ["string", "number", "boolean", "object", "array", "null"];

/** A field row: name + observed wire type + a note when the type is surprising. */
const f = (name, type, note = null) => ({ name, type, note });
/** Every field is scoped and dated like the rest of the registry. */
const scoped = (rows) => rows.map((r) => ({ ...r, scope: "version-scoped", measuredAt: REGISTRY_SCOPE.measuredAt }));

// ---------------------------------------------------------------------------
// 4. The method registry — request schema, response schema, and observed shape
// ---------------------------------------------------------------------------
//
// `documented`  what the official Soroban RPC spec names for this method
// `measured`    the observed result fields, their wire types, and a live example
// `notes`       anything a client must know that the field list alone hides
// `drift`       where the observed shape departs from what a spec-following
//               client would assume — recorded, never editorialised

export const METHODS = [
  {
    name: "getHealth",
    documented: "health of the node: status and the ledger window it retains",
    params: {},
    measured: scoped([
      f("status", "string", 'observed "healthy"'),
      f("latestLedger", "number"),
      f("latestLedgerCloseTime", "string", "Unix seconds as a STRING, not a number"),
      f("oldestLedger", "number"),
      f("oldestLedgerCloseTime", "string", "Unix seconds as a STRING"),
      f("ledgerRetentionWindow", "number", "observed 120960, matching the retention measured independently in pi-soroban-events"),
    ]),
    notes: [
      "This is the cheapest way to learn the retention window; it agreed with the independently measured 120960 ledgers.",
      "Times arrive as strings of Unix seconds, not ISO strings and not numbers.",
    ],
    drift: [],
    example: { status: "healthy", latestLedger: 27257182, latestLedgerCloseTime: "1792446615", oldestLedger: 27136223, oldestLedgerCloseTime: "1791841820", ledgerRetentionWindow: 120960 },
  },
  {
    name: "getNetwork",
    documented: "the network passphrase and protocol version",
    params: {},
    measured: scoped([
      f("passphrase", "string", 'observed "Pi Testnet"'),
      f("protocolVersion", "number", "observed 28"),
    ]),
    notes: [
      "The passphrase is the value a client must use to build a transaction for THIS network; it is how the network identifies itself.",
      "It does not identify which node answered — only which network.",
    ],
    drift: [],
    example: { passphrase: "Pi Testnet", protocolVersion: 28 },
  },
  {
    name: "getLatestLedger",
    documented: "the most recent closed ledger",
    params: {},
    measured: scoped([
      f("id", "string", "64 hex chars: the ledger hash, usable as a header XDR anchor"),
      f("protocolVersion", "number"),
      f("sequence", "number", "the ledger number"),
      f("closeTime", "string", "Unix seconds as a STRING"),
      f("headerXdr", "string", "base64 XDR"),
      f("metadataXdr", "string", "base64 XDR"),
    ]),
    notes: [
      "`id` is the ledger HASH, not the sequence number — a frequent source of confusion.",
      "`sequence` is the value to use for startLedger in getEvents.",
    ],
    drift: [],
    example: { id: "34627272477313a9…", protocolVersion: 28, sequence: 27257180, closeTime: "1792446605", headerXdr: "AAAAHJT1iS6Y…", metadataXdr: "AAAAAgAAAAA0…" },
  },
  {
    name: "getVersionInfo",
    documented: "the node software version",
    params: {},
    measured: scoped([
      f("version", "string", 'observed "28.0.1"'),
      f("commitHash", "string", "40 hex chars"),
      f("buildTimestamp", "string", 'observed "2026-09-16T13:30:54" — an ISO-like local timestamp, WITHOUT a timezone'),
      f("captiveCoreVersion", "string", 'observed "v28.0.1"'),
      f("protocolVersion", "number"),
    ]),
    notes: [
      "This is what makes every other row version-scoped: a change here invalidates them.",
      "`buildTimestamp` carries no timezone suffix, so it is not a well-defined instant by itself.",
    ],
    drift: [
      {
        id: "D-VER-1",
        what: "buildTimestamp is an ISO-like string with no timezone designator",
        expected: "a spec-following client would assume an unambiguous instant, e.g. a Z-suffixed RFC 3339 timestamp",
        observed: '"2026-09-16T13:30:54"',
        impact: "the instant is ambiguous by up to a day; do not compare it across timezones",
        severity: "low",
      },
    ],
    example: { version: "28.0.1", commitHash: "273f19e4fcb183b568948bd2b810abfe87150a9c", buildTimestamp: "2026-09-16T13:30:54", captiveCoreVersion: "v28.0.1", protocolVersion: 28 },
  },
  {
    name: "getFeeStats",
    documented: "recent inclusion-fee statistics for classic and Soroban transactions",
    params: {},
    measured: scoped([
      f("sorobanInclusionFee", "object", "observed over 50 ledgers"),
      f("inclusionFee", "object", "observed over 10 ledgers — a DIFFERENT window than sorobanInclusionFee"),
      f("latestLedger", "number"),
    ]),
    notes: [
      "The two fee objects are computed over different ledger counts (ledgerCount 50 vs 10 in this reading), so their percentiles are not directly comparable.",
      "Every fee figure is a STRING, not a number, while ledgerCount and latestLedger are numbers.",
    ],
    drift: [
      {
        id: "D-FEE-1",
        what: "numeric fee fields are returned as JSON strings",
        expected: "a client parsing JSON would expect numbers for max/min/mode/percentiles",
        observed: 'e.g. "max":"100000", "p50":"100000", "transactionCount":"13" while ledgerCount is the number 10',
        impact: "a client that does arithmetic without parsing will concatenate strings; a schema in a generated client will mistype these",
        severity: "medium",
      },
      {
        id: "D-FEE-2",
        what: "the two fee objects cover different ledger counts",
        expected: "homogeneous statistics over one stated window",
        observed: "sorobanInclusionFee.ledgerCount=50, inclusionFee.ledgerCount=10 in the same response",
        impact: "cross-comparing percentiles between the two objects compares different populations",
        severity: "low",
      },
    ],
    example: { sorobanInclusionFee: { max: "100000", min: "100000", mode: "100000", p50: "100000", transactionCount: "13", ledgerCount: 50 }, inclusionFee: { max: "100000", min: "100000", mode: "100000", p50: "100000", transactionCount: "15", ledgerCount: 10 }, latestLedger: 27257180 },
  },
  {
    name: "getEvents",
    documented: "events emitted within a bounded ledger window",
    params: { startLedger: "number", endLedger: "number (EXCLUSIVE)", filters: "array", limit: "number (ignored)" },
    measured: scoped([
      f("events", "array"),
      f("cursor", "string", "a resume token that this endpoint does NOT honour"),
      f("latestLedger", "number"),
      f("oldestLedger", "number"),
      f("latestLedgerCloseTime", "string"),
      f("oldestLedgerCloseTime", "string"),
    ]),
    notes: [
      "endLedger is EXCLUSIVE: [L, L] returns 0 events; [L, L+1] returns ledger L.",
      "The response caps at 100 events and the returned `cursor` cannot continue the page on this endpoint.",
      "A ledger with no events is legitimate; it is measured in pi-event-integrity.",
    ],
    eventFields: scoped([
      f("type", "string", 'observed "contract"'),
      f("ledger", "number"),
      f("ledgerClosedAt", "string", "an ISO 8601 Z-suffixed timestamp, unlike the Unix-second strings elsewhere on this endpoint"),
      f("contractId", "string", "56 chars, starts with C"),
      f("id", "string", "the global ordering key, form {TOID}-{index}"),
      f("operationIndex", "number"),
      f("transactionIndex", "number"),
      f("txHash", "string", "64 hex chars"),
      f("inSuccessfulContractCall", "boolean"),
      f("topic", "array", "base64 XDR segments"),
      f("value", "string", "base64 XDR"),
    ]),
    drift: [
      {
        id: "D-EVT-1",
        what: "timestamps use two different encodings on the same endpoint",
        expected: "one convention across the API",
        observed: 'event.ledgerClosedAt is ISO 8601 ("2026-10-19T21:48:25Z") while getEvents.result.latestLedgerCloseTime is Unix-seconds-as-string ("1792446605")',
        impact: "a client that parses one will mis-parse the other; the two must be handled differently",
        severity: "medium",
      },
    ],
    example: { events: [{ type: "contract", ledger: 27257160, ledgerClosedAt: "2026-10-19T21:48:25Z", contractId: "CDG6Z…", id: "0117068610781839360-0000000000", operationIndex: 0, transactionIndex: 0, txHash: "4bb7a046…", inSuccessfulContractCall: true, topic: ["AAAADwAAAANmZWUA", "AAAAEgAAAAAA…"], value: "AAAACgAAAAAAAAAAAAAAAAABhqA=" }], cursor: "0117068692386217984-0000000000", latestLedger: 27257180, oldestLedger: 27136221 },
  },
  {
    name: "simulateTransaction",
    documented: "simulate a transaction without submitting it",
    params: { transaction: "base64 TransactionEnvelope XDR" },
    measured: scoped([
      f("error", "string", "present when the transaction could not be simulated"),
      f("latestLedger", "number"),
    ]),
    notes: [
      "A simulation FAILURE arrives INSIDE result.error, not as a JSON-RPC error: HTTP 200 with a populated result.",
      "`latestLedger` is 0 in the failure shape, so it cannot be used to scope the failure.",
      "This repository does not build valid transactions; it records the SHAPE of the failure, not a successful simulation.",
    ],
    drift: [
      {
        id: "D-SIM-1",
        what: "a failure is not a JSON-RPC error",
        expected: "a transport-level error a client would catch as a thrown exception",
        observed: 'HTTP 200, JSON-RPC `result` present, `result.error` = "Could not unmarshal transaction", and result.latestLedger = 0',
        impact: "a client keying off HTTP status or a JSON-RPC error will treat a failed simulation as a success and read a missing result",
        severity: "high",
      },
    ],
    example: { error: "Could not unmarshal transaction", latestLedger: 0 },
  },
  {
    name: "getTransaction",
    documented: "the status and result of a previously submitted transaction",
    params: { hash: "64 hex chars (32 bytes)" },
    measured: scoped([
      f("latestLedger", "number"),
      f("latestLedgerCloseTime", "string"),
      f("oldestLedger", "number"),
      f("oldestLedgerCloseTime", "string"),
      f("status", "string", 'observed "NOT_FOUND" for an unknown hash'),
      f("txHash", "string"),
      f("applicationOrder", "number"),
      f("feeBump", "boolean"),
      f("events", "object", "an EMPTY OBJECT on NOT_FOUND, not an empty array"),
      f("ledger", "number"),
      f("createdAt", "string", 'observed "0"'),
    ]),
    notes: [
      "An unknown hash is a SUCCESSFUL call: HTTP 200, result.status = NOT_FOUND. This is not an error.",
      "`events` is typed as a JSON object in the NOT_FOUND shape but is an array in the success shape — the wire type changes with status.",
    ],
    drift: [
      {
        id: "D-TX-1",
        what: "the type of `events` depends on `status`",
        expected: "a stable field type across all statuses",
        observed: "NOT_FOUND returns events as {} (object); a successful transaction returns events as an array",
        impact: "a client that reads result.events.length unconditionally will fail on NOT_FOUND",
        severity: "high",
      },
      {
        id: "D-TX-2",
        what: "NOT_FOUND is signalled inside a success envelope",
        expected: "either an error, or a status a client checks before reading other fields",
        observed: "HTTP 200 with status NOT_FOUND and several fields set to zero/empty placeholders",
        impact: "fields like ledger=0 and createdAt=\"0\" are placeholders, not data; using them is a bug",
        severity: "medium",
      },
    ],
    example: { latestLedger: 27257183, status: "NOT_FOUND", txHash: "0000…0000", applicationOrder: 0, feeBump: false, events: {}, ledger: 0, createdAt: "0" },
  },
  {
    name: "getLedgerEntries",
    documented: "read ledger entries by key",
    params: { keys: "array of base64 LedgerKey XDR (must be non-empty)" },
    measured: scoped([
      f("entries", "array", "the read entries (not reached in the empty-keys probe)"),
      f("latestLedger", "number"),
    ]),
    notes: [
      "An EMPTY key array is an ERROR, not an empty result: -32603 with no JSON-RPC code for 'not found'.",
      "This repository measured only the empty-keys and absent-method shapes; the populated read shape is recorded as not-claimed here and is exercised in pi-contract-simulator.",
    ],
    drift: [
      {
        id: "D-ENT-1",
        what: "an empty key list is a server error",
        expected: "an empty result set, or a client-side validation error",
        observed: 'JSON-RPC error -32603, message "could not query captive core: no keys specified in request"',
        impact: "a client that maps empty input to an empty response will instead receive a -32603 error and may report data loss",
        severity: "medium",
      },
    ],
    example: { error: { code: -32603, message: "could not query captive core: no keys specified in request" } },
  },
  {
    name: "getContractData",
    documented: "an older method for reading contract data; superseded by getLedgerEntries on Soroban RPC",
    params: { contractId: "string" },
    measured: [],
    notes: [
      "NOT PRESENT on this endpoint at this version: JSON-RPC error -32601 (method not found).",
      "A client following an older tutorial that calls this will fail here and must use getLedgerEntries instead.",
    ],
    drift: [
      {
        id: "D-CON-1",
        what: "a documented-in-the-wild method does not exist on this endpoint",
        expected: "the method to exist because it appears in tutorials and older tooling",
        observed: "JSON-RPC error -32601, message \"method not found\"",
        impact: "older sample code copied from the internet fails with an unhelpful error; the replacement is getLedgerEntries",
        severity: "high",
      },
    ],
    absent: true,
    example: { error: { code: -32601, message: "method not found" } },
  },
];

export const method = (name) => METHODS.find((m) => m.name === name) ?? null;
export const supportedMethods = () => METHODS.filter((m) => !m.absent).map((m) => m.name);
export const absentMethods = () => METHODS.filter((m) => m.absent).map((m) => m.name);

// ---------------------------------------------------------------------------
// 5. Drift — collected, so a client can see every departure in one place
// ---------------------------------------------------------------------------

export const DRIFT_ENTRIES = METHODS.flatMap((m) =>
  (m.drift ?? []).map((d) => ({ ...d, method: m.name, scope: "version-scoped", measuredAt: REGISTRY_SCOPE.measuredAt }))
);

export const DRIFT_SEVERITIES = ["low", "medium", "high"];

// ---------------------------------------------------------------------------
// 6. Conformance checks — what a live run re-measures
// ---------------------------------------------------------------------------
//
// Each check is a pure predicate over a live response. A check PASSES when the
// endpoint still matches the recorded row, and FAILS when it has moved. A
// failure is a FINDING (the node changed), not a bug in this repository.

export const CONFORMANCE_CHECKS = [
  {
    id: "C-HEALTH-1",
    method: "getHealth",
    question: "does getHealth still return a retention window, and is it still 120960?",
    kind: "measured",
  },
  { id: "C-NET-1", method: "getNetwork", question: "is the passphrase still \"Pi Testnet\" and protocol still 28?", kind: "measured" },
  { id: "C-VER-1", method: "getVersionInfo", question: "is the node still version 28.0.1?", kind: "measured" },
  { id: "C-TYP-1", method: "getHealth", question: "are the close times still STRINGS, not numbers?", kind: "measured" },
  { id: "C-TYP-2", method: "getFeeStats", question: "are the fee figures still STRINGS and ledgerCount still a number?", kind: "measured" },
  { id: "C-ERR-1", method: "simulateTransaction", question: "does an invalid transaction still fail INSIDE result.error (HTTP 200)?", kind: "measured" },
  { id: "C-ERR-2", method: "getContractData", question: "is getContractData still absent (-32601)?", kind: "measured" },
  { id: "C-ERR-3", method: "getLedgerEntries", question: "is an empty key list still -32603?", kind: "measured" },
  { id: "C-TX-1", method: "getTransaction", question: "is an unknown hash still NOT_FOUND inside a success envelope?", kind: "measured" },
  { id: "C-EVT-1", method: "getEvents", question: "is a full page still capped at 100 and still uncontinuable via cursor?", kind: "measured" },
];

export const CONFORMANCE_VERDICTS = {
  pass: { id: "pass", meaning: "the live endpoint still matches the recorded row" },
  fail: { id: "fail", meaning: "the live endpoint moved; the recorded row is now stale and MUST be updated with the new reading" },
  error: { id: "error", meaning: "the check could not be evaluated (endpoint unreachable or shape unexpected); NO conclusion is drawn" },
};

/** A run in which any check did not pass cannot support a fresh conclusion. */
export const BLOCKING_CONFORMANCE_VERDICTS = ["fail", "error"];

// ---------------------------------------------------------------------------
// 7. Boundaries
// ---------------------------------------------------------------------------

export const BOUNDARIES = [
  "It does not claim to be the authoritative or official API reference; where an official spec exists, that spec governs.",
  "It does not claim any row will still hold tomorrow; a row is a dated measurement, re-measured by --conformance.",
  "It does not claim a row measured at one endpoint or version holds at another; every row is scoped.",
  "It does not build, sign or submit transactions; it records the SHAPE of responses, including failure shapes.",
  "It does not assert that an observed departure from a spec is a bug — it records the drift and its impact, and calls it neither correct nor incorrect.",
  "It does not cover Mainnet: no public Soroban RPC exists there (measured HTTP 503).",
  "It does not enumerate every method or field; it records the ones it measured, and marks the rest as not-claimed.",
  "It does not store credentials, keys, or any request that carries one.",
];
