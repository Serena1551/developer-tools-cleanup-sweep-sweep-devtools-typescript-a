import assert from "node:assert/strict";
import test from "node:test";
import { decideCleanup, type DeveloperRecord } from "../src/cleanup_policy.js";

test("removes expired terminal records but keeps active and recent creator-tool records", () => {
  const records: DeveloperRecord[] = [
    {
      id: "build-old",
      kind: "build_event",
      state: "complete",
      occurredAt: "2026-06-01T12:00:00.000Z",
      objectKey: "builds/build-old.json",
    },
    {
      id: "release-active",
      kind: "release_operation",
      state: "active",
      occurredAt: "2026-05-01T12:00:00.000Z",
      objectKey: "releases/release-active.json",
    },
    {
      id: "diagnostic-recent",
      kind: "diagnostic",
      state: "failed",
      occurredAt: "2026-08-25T12:00:00.000Z",
      objectKey: "diagnostics/diagnostic-recent.json",
    },
  ];

  const result = decideCleanup(records, new Date("2026-09-01T12:00:00.000Z"), 30);

  assert.deepEqual(result.stale.map((record) => record.id), ["build-old"]);
  assert.deepEqual(
    result.retained.map((record) => record.id),
    ["release-active", "diagnostic-recent"],
  );
  assert.equal(result.cutoff, "2026-08-02T12:00:00.000Z");
});
