import { createHash } from "node:crypto";
import { infraiFromEnvironment } from "./infrai_client.js";

const task = process.env.CLEANUP_TASK_URL;
if (!task) throw new Error("Set CLEANUP_TASK_URL to the public cleanup route URL");

const cronExpr = process.env.CLEANUP_CRON ?? "0 4 * * *";
const infrai = infraiFromEnvironment();
const idempotencyKey = createHash("sha256")
  .update(`${cronExpr}:${task}`)
  .digest("hex");

const job = await infrai.cron.create(
  { cron_expr: cronExpr, task },
  idempotencyKey,
);

console.log(JSON.stringify({ jobId: job.job_id, cronExpr, task }, null, 2));
