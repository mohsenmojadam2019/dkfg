import { WebsiteMonitor } from "./monitor.js";

const INTERVAL_MS = 60_000;
const monitor = new WebsiteMonitor();
let stopping = false;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function shutdown(): Promise<void> {
  if (stopping) return;
  stopping = true;
  await monitor.stop();
  process.exit(0);
}

process.once("SIGINT", () => {
  void shutdown();
});

process.once("SIGTERM", () => {
  void shutdown();
});

async function main(): Promise<void> {
  await monitor.start();

  while (!stopping) {
    const cycleStartedAt = Date.now();
    await monitor.runCycle();

    if (stopping) break;

    const nextMinute = Math.ceil((cycleStartedAt + 1) / INTERVAL_MS) * INTERVAL_MS;
    const waitMs = Math.max(1_000, nextMinute - Date.now());
    await sleep(waitMs);
  }
}

main().catch(() => {
  process.exit(1);
});
