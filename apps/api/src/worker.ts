import { setTimeout as sleep } from "node:timers/promises";
import { loadConfig } from "./config.js";
import { createApiPlatform } from "./platform.js";

const config = loadConfig();
const platform = createApiPlatform(config);
const pollIntervalMs = parsePositiveInteger(process.env.WORKER_POLL_INTERVAL_MS, 5_000);
const runOnce = process.env.WORKER_RUN_ONCE === "true";
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

console.log(JSON.stringify({
  event: "worker_started",
  database: config.databaseUrl ? "postgres" : "file",
  assetStorage: config.assetStorageProvider,
  aiEnabled: config.aiEnabled,
  pollIntervalMs,
  runOnce
}));

do {
  const job = await platform.jobs.runNext();
  if (job) {
    console.log(JSON.stringify({
      event: "job_processed",
      jobId: job.id,
      kind: job.kind,
      status: job.status
    }));
  }
  const delivery = await platform.notifications.runNext();
  if (delivery) {
    console.log(JSON.stringify({
      event: "notification_delivery_processed",
      deliveryId: delivery.id,
      notificationEvent: delivery.event,
      status: delivery.status,
      attempts: delivery.attempts
    }));
  }
  if (runOnce) {
    break;
  }
  await sleep(pollIntervalMs);
} while (!stopping);

console.log(JSON.stringify({ event: "worker_stopped" }));

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${value}`);
  }
  return parsed;
}
