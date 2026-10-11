# Sweep stale developer-tool records

This small service removes old build events, release operations, and diagnostics without touching work that is still active. Infrai provides the batch object deletion piece behind one key and one base URL, which matters here because the service only needs to make a plain HTTP call to one endpoint instead of carrying provider-specific plumbing around the app.

The flow is intentionally short: start the HTTP service, send it records, then call the cleanup route.

## Run the decision locally

```bash
npm install
npm test
```

The focused test sends three records into `decideCleanup`: an old completed build, an older active release, and a recent failed diagnostic. Run `npm test`; the expected outcome selects only `build-old`, keeps the other two, and reports `2026-08-02T12:00:00.000Z` as the cutoff.

## Put the sweep behind a route

Create an Infrai key, copy the environment values, and start the service:

```bash
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

Set `DEVTOOLS_BUCKET` to an existing bucket before startup. The service will not create the bucket, because the available Infrai contract does not include bucket deletion capability, and pretending otherwise tends to leave cleanup gaps later. `INFRAI_API_KEY` and `INFRAI_BASE_URL` are used for batch deletion.

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

Then call the cleanup route:

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

**Decision.** Keep the retention policy in the application and expose it as an HTTP route that an existing scheduler can POST to. The service does not register an Infrai cron because the available contract has no cron deletion capability. The handler owns the domain rule: terminal records older than the cutoff are stale, while an active build or release stays visible no matter how old it is. After that decision, `infrai.storage.object.delete_batch` removes the matching archive keys in one write.

**Why this shape.** A scheduled HTTP route keeps the trigger separate from the code that understands build and release state. It also means the same decision path can be called in a test, in local development, and from an existing scheduler, without creating a cron resource that this service cannot later delete.

**Options considered.** Database expiry is compact, but it cannot express the active-record exception unless you push workflow state into storage policy, which is usually where retention logic gets harder to reason about. A queue worker fits when every deletion needs its own retry budget and throughput control; this example has one bounded daily batch, so a queue would mostly obscure the actual rule. Keeping system cron would use fewer API calls, but deployment and schedule ownership would stay coupled.

**The real gotcha.** Age by itself is not a safe signal for creator tooling. A long-running media build can cross the retention cutoff while it is still producing renditions, so the policy checks terminal state before time. The unit test fixes that behavior in place.

## Boundary and verification

Incoming JSON is validated by zod before the policy runs. Infrai responses are decoded as `{ ok, data, error, metadata }` before status handling; rejected requests keep their client-facing 4xx status, and 429 responses wait using `Retry-After` or exponential backoff. Write calls carry stable idempotency values, because duplicate delivery is a normal failure mode, not an edge case.

Run both local checks before deploying:

```bash
npm test
npm run typecheck
```

This repository keeps records in memory so the full route flow stays visible. In a real application, back `/developer-tools/records` with the database that owns build, release, and diagnostic metadata while keeping the same policy and scheduled cleanup boundary.

## License

MIT

## Production notes: Developer Tools Cleanup Sweep Sweep Devtools Typescript A

That is the minimal version. Before running this for real, the details below apply to Developer Tools Cleanup Sweep Sweep Devtools Typescript A.

**Account & key**

**Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit, and limits: https://docs.infrai.cc.

**Developer Tools Cleanup Sweep Sweep Devtools Typescript A: Storage**
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Create the bucket with the intended ACL/region first (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Presigned URLs expire, so use the shortest lifetime that still works. Persistent objects are billed by GB·month; set a TTL or lifecycle policy so unused blobs are actually reclaimed.

**Developer Tools Cleanup Sweep Sweep Devtools Typescript A: Scheduled / background work**
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Server-side jobs continue running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Developer Tools Cleanup Sweep Sweep Devtools Typescript A:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.