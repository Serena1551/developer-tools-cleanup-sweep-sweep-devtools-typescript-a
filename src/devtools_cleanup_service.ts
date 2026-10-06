import { createHash } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import {
  decideCleanup,
  developerRecordSchema,
  type DeveloperRecord,
} from "./cleanup_policy.js";
import { InfraiError, infraiFromEnvironment } from "./infrai_client.js";

const cleanupRequestSchema = z.object({
  requestedAt: z.string().datetime().optional(),
});
const recordRequestSchema = z.object({ records: z.array(developerRecordSchema) });

const port = Number(process.env.PORT ?? 3000);
const bucket = process.env.DEVTOOLS_BUCKET ?? "creator-devtools-archives";
const retentionDays = Number(process.env.RETENTION_DAYS ?? 30);
const infrai = infraiFromEnvironment();
let records: DeveloperRecord[] = [];

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString("utf8") || "{}";
    const body: unknown = JSON.parse(rawBody);

    if (request.url === "/developer-tools/records") {
      const input = recordRequestSchema.parse(body);
      records = input.records;
      sendJson(response, 202, { accepted: records.length });
      return;
    }

    if (request.url !== "/internal/devtools/cleanup") {
      sendJson(response, 404, { error: "route_not_found" });
      return;
    }

    const input = cleanupRequestSchema.parse(body);
    const now = input.requestedAt ? new Date(input.requestedAt) : new Date();
    const decision = decideCleanup(records, now, retentionDays);
    const keys = decision.stale.map((record) => record.objectKey);

    if (keys.length > 0) {
      const idempotencyKey = createHash("sha256")
        .update(`${bucket}:${decision.cutoff}:${keys.sort().join(",")}`)
        .digest("hex");
      await infrai.storage.object.delete_batch(bucket, {
        keys,
        idempotency_key: idempotencyKey,
      });
    }
    records = decision.retained;

    sendJson(response, 200, {
      cutoff: decision.cutoff,
      deleted: decision.stale.map(({ id, kind, objectKey }) => ({ id, kind, objectKey })),
      retainedCount: decision.retained.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      sendJson(response, 400, { error: "invalid_cleanup_request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.detail });
      return;
    }
    sendJson(response, 500, { error: "cleanup_failed" });
  }
});

server.listen(port, () => {
  console.log(`Developer-tools cleanup listening on http://localhost:${port}`);
});
