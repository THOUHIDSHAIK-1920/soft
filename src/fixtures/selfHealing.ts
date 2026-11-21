import fs from 'fs';
import path from 'path';
import { Locator, Page } from '@playwright/test';
import { CONFIG, PATHS, ensureDir, readJsonSafe, writeJson } from '../config';
import { ElementSnapshot, HealingEvent } from '../types';

export type SnapshotStore = Record<string, ElementSnapshot & { pageContext?: string }>;

const HEALING_JSONL = path.join(PATHS.reportsDir, '.healing-events.jsonl');

function loadSnapshotStore(): SnapshotStore {
  return readJsonSafe<SnapshotStore>(PATHS.domSnapshotsJson, {});
}

function saveSnapshotEntry(key: string, snapshot: ElementSnapshot & { pageContext?: string }): void {
  // Persist clean baseline snapshots only when NOT in locator-change mode
  if (CONFIG.locatorChange) return;
  ensureDir(PATHS.reportsDir);
  const shardPath = path.join(PATHS.reportsDir, `.snapshots-${process.pid}.json`);
  const shard = readJsonSafe<SnapshotStore>(shardPath, {});
  shard[key] = snapshot;
  writeJson(shardPath, shard);

  // Also best-effort merge into main dom-snapshots.json for immediate single-worker visibility
  try {
    const existing = loadSnapshotStore();
    existing[key] = snapshot;
    writeJson(PATHS.domSnapshotsJson, existing);
  } catch {
    // Worker shard will still be merged in customReporter.onEnd()
  }
}

export function mergeWorkerSnapshots(): SnapshotStore {
  ensureDir(PATHS.reportsDir);
  const merged = loadSnapshotStore();
  const files = fs.readdirSync(PATHS.reportsDir).filter((f) => f.startsWith('.snapshots-') && f.endsWith('.json'));
  for (const file of files) {
    const full = path.join(PATHS.reportsDir, file);
    const shard = readJsonSafe<SnapshotStore>(full, {});
    Object.assign(merged, shard);
    try {
      fs.unlinkSync(full);
    } catch {
      // ignore cleanup race
    }
  }
  if (Object.keys(merged).length > 0) {
    writeJson(PATHS.domSnapshotsJson, merged);
  }
  return merged;
}

export function appendHealingEvent(event: HealingEvent): void {
  ensureDir(PATHS.reportsDir);
  fs.appendFileSync(HEALING_JSONL, `${JSON.stringify(event)}\n`, 'utf-8');
}

export function consolidateHealingEvents(): HealingEvent[] {
  ensureDir(PATHS.reportsDir);
  const events: HealingEvent[] = [];
  if (fs.existsSync(HEALING_JSONL)) {
    const lines = fs.readFileSync(HEALING_JSONL, 'utf-8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      try {
        events.push(JSON.parse(line) as HealingEvent);
      } catch {
        // ignore malformed line
      }
    }
  }
  writeJson(PATHS.healingJson, events);
  return events;
}

export function clearHealingTempLog(): void {
  ensureDir(PATHS.reportsDir);
  if (fs.existsSync(HEALING_JSONL)) {
    try {
      fs.unlinkSync(HEALING_JSONL);
    } catch {
      // ignore
    }
  }
}

export class SelfHealingEngine {
  private readonly page: Page;
  private readonly testTitle: string;
  private readonly healedCache = new Map<string, string>();
  public readonly sessionEvents: HealingEvent[] = [];

  constructor(page: Page, testTitle: string) {
    this.page = page;
    this.testTitle = testTitle;
  }

  private async getCurrentPageContext(): Promise<string> {
    try {
      return await this.page.evaluate(() => {
        const sec = document.querySelector('[data-page]');
        return sec ? sec.getAttribute('data-page') || '' : '';
      });
    } catch {
      return '';
    }
  }

  private async captureElementSnapshot(locator: Locator, primarySelector: string): Promise<ElementSnapshot | null> {
    try {
      return await locator.first().evaluate((el: Element, sel: string) => {
        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) {
          if (attr.name !== 'class' && attr.name !== 'id' && attr.name !== 'style') {
            attrs[attr.name] = attr.value;
          }
        }
        const pathParts: string[] = [];
        let curr: Element | null = el.parentElement;
        while (curr && curr.tagName.toLowerCase() !== 'html') {
          pathParts.unshift(curr.tagName.toLowerCase());
          curr = curr.parentElement;
        }
        const siblings: string[] = [];
        if (el.parentElement) {
          for (const child of Array.from(el.parentElement.children)) {
            if (child !== el) {
              const sibText = (child.textContent || '').trim().slice(0, 30);
              siblings.push(`${child.tagName.toLowerCase()}:${sibText}`);
            }
          }
        }
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          classes: Array.from(el.classList),
          text: (el.textContent || '').trim().slice(0, 120),
          attributes: attrs,
          parentPath: pathParts.join(' > '),
          siblings: siblings.slice(0, 6),
          selector: sel,
        };
      }, primarySelector);
    } catch {
      return null;
    }
  }

  private async extractLiveCandidates(): Promise<ElementSnapshot[]> {
    return this.page.evaluate(() => {
      const selectorQuery =
        'button, input, select, textarea, a, form, h1, h2, h3, p, strong, article, [role="alert"], [role="status"], [role="grid"], [data-testid], [id]';
      const nodes = Array.from(document.querySelectorAll(selectorQuery));
      const seen = new Set<Element>();
      const results: Array<{
        tag: string;
        id: string;
        classes: string[];
        text: string;
        attributes: Record<string, string>;
        parentPath: string;
        siblings: string[];
        selector: string;
      }> = [];

      for (const el of nodes) {
        if (seen.has(el)) continue;
        seen.add(el);
        const tag = el.tagName.toLowerCase();
        if (tag === 'html' || tag === 'body' || tag === 'head' || tag === 'script' || tag === 'main') continue;

        const attrs: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) {
          if (attr.name !== 'class' && attr.name !== 'id' && attr.name !== 'style') {
            attrs[attr.name] = attr.value;
          }
        }

        const pathParts: string[] = [];
        let curr: Element | null = el.parentElement;
        while (curr && curr.tagName.toLowerCase() !== 'html') {
          pathParts.unshift(curr.tagName.toLowerCase());
          curr = curr.parentElement;
        }

        const siblings: string[] = [];
        if (el.parentElement) {
          for (const child of Array.from(el.parentElement.children)) {
            if (child !== el) {
              const sibText = (child.textContent || '').trim().slice(0, 30);
              siblings.push(`${child.tagName.toLowerCase()}:${sibText}`);
            }
          }
        }

        let uniqueSelector = '';
        if (el.id) {
          uniqueSelector = `#${CSS.escape(el.id)}`;
        } else if (el.getAttribute('data-testid')) {
          uniqueSelector = `[data-testid="${el.getAttribute('data-testid')}"]`;
        } else if (el.getAttribute('data-seat')) {
          uniqueSelector = `button[data-seat="${el.getAttribute('data-seat')}"]`;
        } else if (el.getAttribute('aria-label')) {
          uniqueSelector = `${tag}[aria-label="${el.getAttribute('aria-label')}"]`;
        } else {
          const cls = Array.from(el.classList).filter(Boolean).slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('');
          uniqueSelector = cls ? `${tag}${cls}` : tag;
        }

        results.push({
          tag,
          id: el.id || '',
          classes: Array.from(el.classList),
          text: (el.textContent || '').trim().slice(0, 120),
          attributes: attrs,
          parentPath: pathParts.join(' > '),
          siblings: siblings.slice(0, 6),
          selector: uniqueSelector,
        });
      }
      return results;
    });
  }

  /**
   * Resolves a locator with automatic snapshot recording on success
   * and FastAPI ML self-healing on locator failure.
   */
  public async resolve(
    pageName: string,
    logicalName: string,
    primarySelector: string,
    options?: { optional?: boolean; timeoutMs?: number }
  ): Promise<Locator> {
    const key = `${pageName}::${logicalName}`;
    const quickTimeout = options?.timeoutMs ?? (CONFIG.locatorChange ? 650 : 2500);

    // 1. Try primary locator first
    const primaryLoc = this.page.locator(primarySelector).first();
    try {
      await primaryLoc.waitFor({ state: 'attached', timeout: quickTimeout });
      const snap = await this.captureElementSnapshot(primaryLoc, primarySelector);
      const pageContext = await this.getCurrentPageContext();
      if (snap) {
        saveSnapshotEntry(key, { ...snap, pageContext });
      }
      return primaryLoc;
    } catch {
      // Primary locator failed — proceed to self-healing if enabled
    }

    if (!CONFIG.healingEnabled) {
      return primaryLoc;
    }

    // Check per-session healed cache first
    const cachedSelector = this.healedCache.get(key);
    if (cachedSelector) {
      const cachedLoc = this.page.locator(cachedSelector).first();
      if ((await cachedLoc.count()) > 0) {
        return cachedLoc;
      }
    }

    const store = loadSnapshotStore();
    const storedSnap = store[key];
    if (!storedSnap) {
      return primaryLoc;
    }

    // Verify we are on the same application view/page before attempting locator healing
    // (Prevents false-positive healing when an app bug redirected to the wrong page!)
    const currentPageCtx = await this.getCurrentPageContext();
    if (storedSnap.pageContext && currentPageCtx && storedSnap.pageContext !== currentPageCtx) {
      return primaryLoc;
    }

    // If checking an optional alert/status element (e.g., error banner or confirmation badge)
    // and no element with that role exists in DOM, it's an app bug (missing UI element), not a locator rename.
    if (options?.optional && (storedSnap.attributes?.role === 'alert' || storedSnap.attributes?.role === 'status')) {
      const roleCount = await this.page.locator(`[role="${storedSnap.attributes.role}"]`).count();
      if (roleCount === 0) {
        return primaryLoc;
      }
    }

    const candidates = await this.extractLiveCandidates();
    if (candidates.length === 0) {
      return primaryLoc;
    }

    try {
      const response = await fetch(`${CONFIG.aiServiceUrl}/heal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldLocator: primarySelector,
          snapshot: storedSnap,
          candidates,
          threshold: CONFIG.healingThreshold,
          clustering: 'agglomerative',
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service /heal returned ${response.status}`);
      }

      const data = (await response.json()) as {
        healed: boolean;
        bestSelector: string | null;
        score: number;
        method?: string;
        clusterId?: number;
      };

      const event: HealingEvent = {
        timestamp: new Date().toISOString(),
        testTitle: this.testTitle,
        pageName,
        logicalName,
        oldLocator: primarySelector,
        newLocator: data.bestSelector,
        score: data.score,
        success: Boolean(data.healed && data.bestSelector),
        method: data.method,
        clusterId: data.clusterId,
      };

      this.sessionEvents.push(event);
      appendHealingEvent(event);

      if (data.healed && data.bestSelector) {
        this.healedCache.set(key, data.bestSelector);
        return this.page.locator(data.bestSelector).first();
      }
    } catch (err) {
      const failedEvent: HealingEvent = {
        timestamp: new Date().toISOString(),
        testTitle: this.testTitle,
        pageName,
        logicalName,
        oldLocator: primarySelector,
        newLocator: null,
        score: 0,
        success: false,
        method: `error:${String(err).slice(0, 60)}`,
      };
      this.sessionEvents.push(failedEvent);
      appendHealingEvent(failedEvent);
    }

    return primaryLoc;
  }

  /**
   * Resolves a collection selector (e.g., all .movie-card items or all .seat-btn elements)
   * using snapshot-backed healing when CSS class names change in locator-change mode.
   */
  public async resolveAll(pageName: string, logicalName: string, primarySelector: string): Promise<Locator> {
    const key = `${pageName}::${logicalName}`;
    const listLoc = this.page.locator(primarySelector);
    if ((await listLoc.count()) > 0) {
      const snap = await this.captureElementSnapshot(listLoc.first(), primarySelector);
      const pageContext = await this.getCurrentPageContext();
      if (snap) {
        saveSnapshotEntry(key, { ...snap, pageContext });
      }
      return listLoc;
    }

    if (!CONFIG.healingEnabled) return listLoc;

    // Resolve first representative element, then derive its class selector for the full collection
    const healedFirst = await this.resolve(pageName, logicalName, primarySelector);
    if ((await healedFirst.count()) > 0) {
      const firstClass = await healedFirst.evaluate((el) => Array.from(el.classList).find((c) => c.includes('v2')) || Array.from(el.classList)[0] || '');
      if (firstClass) {
        return this.page.locator(`.${firstClass}`);
      }
      return healedFirst;
    }

    return listLoc;
  }
}
