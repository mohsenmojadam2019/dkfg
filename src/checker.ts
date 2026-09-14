import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import type { Browser } from "playwright";
import type { Baseline, CheckResult, CheckStatus, SiteConfig } from "./types.js";

const ERROR_PATTERNS = [
  /internal server error/i,
  /server error/i,
  /application error/i,
  /bad gateway/i,
  /gateway timeout/i,
  /service unavailable/i,
  /something went wrong/i,
  /خطای داخلی سرور/,
  /خطای سرور/,
  /خطایی رخ داده/,
  /سرویس در دسترس نیست/,
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function scrollWholePage(page: import("playwright").Page): Promise<void> {
  const viewport = await page.evaluate(() => window.innerHeight || 800);
  let previousHeight = 0;

  for (let step = 0; step < 60; step += 1) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    if (height <= previousHeight && step > 0) break;
    previousHeight = height;

    const y = Math.min((step + 1) * Math.max(viewport * 0.8, 500), height);
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await sleep(80);

    if (y >= height) {
      await sleep(250);
      const newHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (newHeight <= height) break;
    }
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(250);
}

function looksLikeErrorPage(title: string, text: string): boolean {
  const sample = `${title}\n${text.slice(0, 5000)}`;
  return ERROR_PATTERNS.some((pattern) => pattern.test(sample));
}

function statusFromException(error: unknown): CheckStatus {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timeout")) return "TIMEOUT";
  return "BROWSER_ERROR";
}

export async function checkSite(
  browser: Browser,
  site: SiteConfig,
  baseline?: Baseline,
): Promise<CheckResult> {
  const startedAt = Date.now();
  const context = await browser.newContext({
    userAgent: "BazdidMonitor/1.0 (+website availability monitor)",
    viewport: { width: 1365, height: 768 },
    javaScriptEnabled: true,
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(site.url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    const httpStatus = response?.status() ?? null;
    if (httpStatus === 403 || httpStatus === 429) {
      return emptyResult(site, "BLOCKED", startedAt, httpStatus);
    }
    if (httpStatus === null || httpStatus < 200 || httpStatus >= 400) {
      return emptyResult(site, "HTTP_ERROR", startedAt, httpStatus);
    }

    await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => undefined);
    await sleep(1_500);
    await scrollWholePage(page);
    await sleep(500);

    const snapshot = await page.evaluate(() => {
      const body = document.body;
      const text = body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
      const html = document.documentElement?.outerHTML ?? "";
      return {
        title: document.title?.trim() ?? "",
        text,
        html,
        domElements: document.querySelectorAll("*").length,
      };
    });

    const htmlBytes = Buffer.byteLength(snapshot.html, "utf8");
    const textLength = snapshot.text.length;
    const contentHash = createHash("sha256").update(snapshot.text).digest("hex");

    const absoluteTooSmall =
      textLength < site.minTextChars ||
      htmlBytes < site.minHtmlBytes ||
      snapshot.domElements < site.minDomElements;

    const belowBaseline = Boolean(
      baseline &&
        (textLength < baseline.textLength * site.baselineMinRatio ||
          htmlBytes < baseline.htmlBytes * site.baselineMinRatio),
    );

    const badContent =
      absoluteTooSmall ||
      belowBaseline ||
      snapshot.title.length === 0 ||
      looksLikeErrorPage(snapshot.title, snapshot.text);

    return {
      site: site.name,
      url: site.url,
      status: badContent ? "CONTENT_ERROR" : "UP",
      checkedAt: Date.now(),
      httpStatus,
      loadMs: Date.now() - startedAt,
      title: snapshot.title,
      textLength,
      htmlBytes,
      domElements: snapshot.domElements,
      contentHash,
    };
  } catch (error) {
    return emptyResult(site, statusFromException(error), startedAt, null);
  } finally {
    await context.close().catch(() => undefined);
  }
}

function emptyResult(
  site: SiteConfig,
  status: CheckStatus,
  startedAt: number,
  httpStatus: number | null,
): CheckResult {
  return {
    site: site.name,
    url: site.url,
    status,
    checkedAt: Date.now(),
    httpStatus,
    loadMs: Date.now() - startedAt,
    title: "",
    textLength: 0,
    htmlBytes: 0,
    domElements: 0,
    contentHash: "",
  };
}
