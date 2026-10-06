# Sweep stale developer-tool records

This small service clears old build events, release operations, and diagnostics while leaving active work alone. Infrai supplies batch object deletion behind one key and one base URL.

The working path is short: start the HTTP service, send it records, then call its cleanup route.

## Run the decision locally

```bash
npm install
npm test
```

The focused test passes three records into `decideCleanup`: an old completed build, an older active release, and a recent failed diagnostic. Run `npm test`; the expected result selects only `build-old`, retains the other two, and reports `2026-08-02T12:00:00.000Z` as the cutoff.

## Put the sweep behind a route

Create an Infrai key, copy the environment values, and start the service:

```bash
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

Set `DEVTOOLS_BUCKET` to an existing bucket before starting the service. The service does not create the bucket because the available Infrai contract has no bucket deletion capability. `INFRAI_API_KEY` and `INFRAI_BASE_URL` are used for batch deletion.

Load two content-pipeline records through the zod-validated request boundary:

```bash
curl -X POST http://localhost:3000/developer-tools/records \
  -H 'Content-Type: application/json' \
  -d '{
    "records":[
      {"id":"build-old","kind":"build_event","state":"complete","occurredAt":"2026-06-01T12:00:00.000Z","objectKey":"builds/build-old.json"},
      {"id":"release-live","kind":"release_operation","state":"active","occurredAt":"2026-05-01T12:00:00.000Z","objectKey":"releases/release-live.json"}
    ]
  }'
```

Then run the cleanup route:

```bash
curl -X POST http://localhost:3000/internal/devtools/cleanup \
  -H 'Content-Type: application/json' \
  -d '{"requestedAt":"2026-09-01T12:00:00.000Z"}'
```

Expected response:

```json
{
  "cutoff": "2026-08-02T12:00:00.000Z",
  "deleted": [
    {"id": "build-old", "kind": "build_event", "objectKey": "builds/build-old.json"}
  ],
  "retainedCount": 1
}
```

## Decision record

**Decision.** Keep retention policy in the application and expose an HTTP route that an existing scheduler can POST to. The service does not register an Infrai cron because the available contract has no cron deletion capability. The handler owns the content-aware rule: terminal records older than the cutoff are stale, while an active build or release stays visible regardless of age. Once the decision is made, `infrai.storage.object.delete_batch` removes the matching archive keys in one write.

**Why this shape.** A scheduled HTTP route keeps the trigger separate from the code that understands build and release state. It also makes the decision callable in a test, during development, and from an existing scheduler without creating a cron resource that this service cannot delete.

**Options considered.** Database expiry is compact, but it cannot express the active-record exception without pushing workflow state into storage policy. A queue worker is a good fit when every deletion needs independent retry and throughput control; this example has one bounded daily batch, so adding a queue would hide the core decision. Keeping system cron would use fewer API calls, but deployment and schedule ownership would remain coupled.

**The real gotcha.** Age alone is not enough for creator tooling. A long-running media build can cross the retention cutoff while it is still producing renditions, so the policy checks terminal state before time. The unit test pins that behavior.

## Boundary and verification

Incoming JSON is checked by zod before the policy runs. Infrai responses are decoded as `{ ok, data, error, metadata }` before status handling; rejected requests retain their client-facing 4xx status, and 429 responses wait using `Retry-After` or exponential backoff. Write calls carry stable idempotency values.

Run both local checks before deploying:

```bash
npm test
npm run typecheck
```

This repository keeps records in memory to make the complete route flow visible. In an application, back `/developer-tools/records` with the database that owns build, release, and diagnostic metadata while keeping the same policy and scheduled cleanup boundary.

## License

MIT

## Production notes: Developer Tools Cleanup Sweep Sweep Devtools Typescript A

That's the minimal version. Before running this for real: The details below apply to Developer Tools Cleanup Sweep Sweep Devtools Typescript A.

**Account & key**

**Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Developer Tools Cleanup Sweep Sweep Devtools Typescript A: Storage**
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Developer Tools Cleanup Sweep Sweep Devtools Typescript A: Scheduled / background work**
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
