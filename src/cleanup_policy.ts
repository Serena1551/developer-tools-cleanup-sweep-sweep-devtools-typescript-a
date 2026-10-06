import { z } from "zod";

export const developerRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["build_event", "release_operation", "diagnostic"]),
  state: z.enum(["complete", "failed", "active"]),
  occurredAt: z.string().datetime(),
  objectKey: z.string().min(1),
});

export type DeveloperRecord = z.infer<typeof developerRecordSchema>;

export type CleanupDecision = {
  stale: DeveloperRecord[];
  retained: DeveloperRecord[];
  cutoff: string;
};

export function decideCleanup(
  records: DeveloperRecord[],
  now: Date,
  retentionDays: number,
): CleanupDecision {
  const cutoffTime = now.getTime() - retentionDays * 24 * 60 * 60 * 1_000;
  const stale = records.filter(
    (record) =>
      record.state !== "active" &&
      new Date(record.occurredAt).getTime() < cutoffTime,
  );
  const staleIds = new Set(stale.map((record) => record.id));

  return {
    stale,
    retained: records.filter((record) => !staleIds.has(record.id)),
    cutoff: new Date(cutoffTime).toISOString(),
  };
}
