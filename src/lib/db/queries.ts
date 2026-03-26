import { db, schema } from "./index";
import { eq, desc, like, or, and, sql, gt, isNull, isNotNull } from "drizzle-orm";
import type { RankMode, Category, TimeWindow } from "../types";
import { TIME_WINDOW_HOURS } from "../types";

const { items, clusters, signals, entities, alerts, bookmarks, userPreferences, sources: sourcesTable, sourceFetchLog } = schema;

// ─── Items ──────────────────────────────────────────────────────────

export interface ItemQueryOptions {
  mode?: RankMode;
  category?: Category;
  company?: string;
  isOpenSource?: boolean;
  search?: string;
  minImportance?: number;
  limit?: number;
  offset?: number;
  bookmarkedOnly?: boolean;
  includeDemo?: boolean;
  timeWindow?: TimeWindow;
  paperDepth?: "general" | "intermediate" | "advanced";
}

/**
 * Freshness-boosted ranking score used in SQL.
 * Very aggressive: items older than 7 days get a harsh penalty.
 * Items with null dates are heavily penalized.
 */
const freshnessBoostedScore = sql`(
  COALESCE(${items.compositeScore}, 50) * (
    CASE
      WHEN ${items.publishedAt} IS NULL THEN 0.25
      WHEN julianday('now') - julianday(${items.publishedAt}) < 0.042 THEN 2.0
      WHEN julianday('now') - julianday(${items.publishedAt}) < 0.25 THEN 1.8
      WHEN julianday('now') - julianday(${items.publishedAt}) < 0.5 THEN 1.6
      WHEN julianday('now') - julianday(${items.publishedAt}) < 1 THEN 1.4
      WHEN julianday('now') - julianday(${items.publishedAt}) < 2 THEN 1.2
      WHEN julianday('now') - julianday(${items.publishedAt}) < 3 THEN 1.0
      WHEN julianday('now') - julianday(${items.publishedAt}) < 5 THEN 0.7
      WHEN julianday('now') - julianday(${items.publishedAt}) < 7 THEN 0.5
      WHEN julianday('now') - julianday(${items.publishedAt}) < 14 THEN 0.3
      WHEN julianday('now') - julianday(${items.publishedAt}) < 30 THEN 0.15
      ELSE 0.05
    END
  )
  * CASE WHEN ${items.duplicateOf} IS NOT NULL THEN 0.2 ELSE 1.0 END
  * CASE WHEN ${items.isPrimarySource} = 1 THEN 1.1 ELSE 1.0 END
  * CASE WHEN ${items.dateConfidence} = 'unknown' THEN 0.4
         WHEN ${items.dateConfidence} = 'estimated' THEN 0.7
         ELSE 1.0 END
  * (0.6 + 0.4 * COALESCE(${items.realWorldRelevance}, 50) / 100.0)
)`;

/**
 * Build a time-window SQL condition. Defaults to 3 days for main feeds.
 */
function timeWindowCondition(tw: TimeWindow) {
  if (tw === "all") return undefined;
  const hours = TIME_WINDOW_HOURS[tw];
  // Use COALESCE to check published_at first, then discovered_at
  return sql`(
    COALESCE(${items.publishedAt}, ${items.discoveredAt}) >= datetime('now', '-${sql.raw(String(hours))} hours')
  )`;
}

export async function getItems(opts: ItemQueryOptions = {}) {
  const conditions = [];

  // Exclude demo data by default
  if (!opts.includeDemo) {
    conditions.push(eq(items.isDemo, false));
  }

  // Exclude items marked as duplicates from main views
  conditions.push(isNull(items.duplicateOf));

  // Time window — default to 3 days for "latest", 7 days for other modes
  const defaultWindow: TimeWindow = opts.mode === "latest" ? "3d"
    : (opts.mode === "important" || opts.mode === "novel") ? "7d"
    : "all";
  const tw = opts.timeWindow ?? defaultWindow;
  const twCond = timeWindowCondition(tw);
  if (twCond) conditions.push(twCond);

  if (opts.category) {
    conditions.push(eq(items.category, opts.category));
  }
  if (opts.company) {
    conditions.push(eq(items.company, opts.company));
  }
  if (opts.isOpenSource !== undefined) {
    conditions.push(eq(items.isOpenSource, opts.isOpenSource));
  }
  if (opts.minImportance) {
    conditions.push(sql`${items.importanceScore} >= ${opts.minImportance}`);
  }
  if (opts.bookmarkedOnly) {
    conditions.push(eq(items.isBookmarked, true));
  }
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        like(items.title, term),
        like(items.summary, term),
        like(items.content, term),
        like(items.tags, term),
        like(items.company, term)
      )
    );
  }

  if (opts.mode === "opensource") {
    conditions.push(
      or(eq(items.isOpenSource, true), eq(items.category, "opensource"))
    );
  }
  if (opts.mode === "research") {
    conditions.push(eq(items.category, "research"));
    // In research mode, only show items that passed research feed filter
    conditions.push(
      or(eq(items.showInResearchFeed, true), isNull(items.showInResearchFeed))
    );
    // Optional depth filter for research mode
    if (opts.paperDepth) {
      conditions.push(eq(items.paperDepth, opts.paperDepth));
    }
  }

  // In non-research modes, filter out low-value papers from the main feed
  // Also treat arXiv items in non-research categories as research for filtering
  if (opts.mode !== "research" && opts.mode !== "opensource") {
    conditions.push(
      or(
        // Non-research, non-arXiv items always pass
        and(
          sql`${items.category} != 'research'`,
          sql`${items.source} NOT LIKE 'arxiv%'`
        ),
        // Research or arXiv items must have showInMainFeed=true
        eq(items.showInMainFeed, true),
        // Backwards compat for items before paper scoring
        and(isNull(items.showInMainFeed), sql`${items.source} NOT LIKE 'arxiv%'`)
      )
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Mode-specific ordering
  let orderBy;
  switch (opts.mode) {
    case "latest":
      // Chronological, but items with real published dates first.
      // Items without publishedAt are pushed to the bottom.
      orderBy = [
        desc(sql`CASE WHEN ${items.publishedAt} IS NOT NULL THEN 1 ELSE 0 END`),
        desc(sql`COALESCE(${items.publishedAt}, ${items.discoveredAt})`),
        desc(items.compositeScore),
      ];
      break;
    case "important":
      orderBy = [desc(freshnessBoostedScore)];
      break;
    case "novel":
      orderBy = [desc(sql`(${items.noveltyScore} * ${freshnessBoostedScore} / COALESCE(${items.compositeScore}, 50))`), desc(items.publishedAt)];
      break;
    case "impactful":
      orderBy = [desc(sql`(${items.impactScore} * ${freshnessBoostedScore} / COALESCE(${items.compositeScore}, 50))`), desc(freshnessBoostedScore)];
      break;
    case "underrated":
      orderBy = [desc(sql`(${items.noveltyScore} * 0.6 + (100 - COALESCE(${items.importanceScore}, 50)) * 0.4) * CASE WHEN julianday('now') - julianday(COALESCE(${items.publishedAt}, ${items.discoveredAt})) < 7 THEN 1.0 ELSE 0.3 END`), desc(items.publishedAt)];
      break;
    case "opensource":
    case "research":
      orderBy = [desc(freshnessBoostedScore), desc(items.publishedAt)];
      break;
    default:
      orderBy = [desc(freshnessBoostedScore), desc(items.publishedAt)];
  }

  const requestedLimit = opts.limit ?? 50;

  // In non-research modes, cap research items at ~20% of results.
  // Fetch extra to ensure we have enough non-research items after capping.
  const needsCap = opts.mode !== "research" && opts.mode !== "opensource";
  const fetchLimit = needsCap ? requestedLimit * 2 : requestedLimit;

  const rows = await db
    .select()
    .from(items)
    .where(where)
    .orderBy(...orderBy)
    .limit(fetchLimit)
    .offset(opts.offset ?? 0)
    .all();

  if (!needsCap) return rows.slice(0, requestedLimit);

  // Interleave: allow at most maxResearch research items in the result
  const maxResearch = Math.max(3, Math.floor(requestedLimit * 0.15));
  let researchCount = 0;
  const result: typeof rows = [];

  for (const row of rows) {
    if (result.length >= requestedLimit) break;
    // Cap research-category items (arXiv model/tool items that passed the filter are allowed)
    if (row.category === "research") {
      if (researchCount >= maxResearch) continue;
      researchCount++;
    }
    result.push(row);
  }

  return result;
}

export async function getItemById(id: string) {
  return await db.select().from(items).where(eq(items.id, id)).get();
}

export async function getItemsByCluster(clusterId: string) {
  return await db
    .select()
    .from(items)
    .where(eq(items.clusterId, clusterId))
    .orderBy(desc(items.publishedAt))
    .all();
}

export async function toggleBookmark(itemId: string) {
  const item = await getItemById(itemId);
  if (!item) return null;
  await db.update(items)
    .set({ isBookmarked: !item.isBookmarked })
    .where(eq(items.id, itemId))
    .run();
  return { ...item, isBookmarked: !item.isBookmarked };
}

export async function markAsRead(itemId: string) {
  await db.update(items)
    .set({ isRead: true })
    .where(eq(items.id, itemId))
    .run();
}

// ─── Clusters ───────────────────────────────────────────────────────

export async function getClusters(limit = 20) {
  return await db
    .select()
    .from(clusters)
    .orderBy(desc(clusters.lastUpdated))
    .limit(limit)
    .all();
}

export async function getClusterById(id: string) {
  return await db.select().from(clusters).where(eq(clusters.id, id)).get();
}

export async function getTrendingClusters(limit = 10, includeDemo = false) {
  const conditions = includeDemo ? undefined : eq(clusters.isDemo, false);
  return await db
    .select()
    .from(clusters)
    .where(conditions)
    .orderBy(desc(clusters.trendVelocity))
    .limit(limit)
    .all();
}

// ─── Signals ────────────────────────────────────────────────────────

export async function getActiveSignals(limit = 10, includeDemo = false) {
  const conditions = includeDemo
    ? eq(signals.isActive, true)
    : and(eq(signals.isActive, true), eq(signals.isDemo, false));
  return await db
    .select()
    .from(signals)
    .where(conditions)
    .orderBy(desc(signals.strength))
    .limit(limit)
    .all();
}

// ─── Entities ───────────────────────────────────────────────────────

export async function getTopEntities(type?: string, limit = 20) {
  const conditions = type ? eq(entities.type, type) : undefined;
  return await db
    .select()
    .from(entities)
    .where(conditions)
    .orderBy(desc(entities.mentionCount))
    .limit(limit)
    .all();
}

export async function getEntityById(id: string) {
  return await db.select().from(entities).where(eq(entities.id, id)).get();
}

// ─── Alerts ─────────────────────────────────────────────────────────

export async function getAlerts(unreadOnly = false, limit = 20, includeDemo = false) {
  const conditions = [];
  if (!includeDemo) conditions.push(eq(alerts.isDemo, false));
  if (unreadOnly) conditions.push(eq(alerts.isRead, false));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return await db
    .select()
    .from(alerts)
    .where(where)
    .orderBy(desc(alerts.createdAt))
    .limit(limit)
    .all();
}

export async function getUnreadAlertCount(includeDemo = false) {
  const conditions = [eq(alerts.isRead, false)];
  if (!includeDemo) conditions.push(eq(alerts.isDemo, false));
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(and(...conditions))
    .get();
  return result?.count ?? 0;
}

export async function markAlertRead(alertId: string) {
  await db.update(alerts)
    .set({ isRead: true })
    .where(eq(alerts.id, alertId))
    .run();
}

// ─── Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats(includeDemo = false) {
  const demoFilter = includeDemo ? undefined : eq(items.isDemo, false);

  const totalItems = (await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(demoFilter)
    .get())?.count ?? 0;

  const todayItems = (await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(includeDemo
      ? sql`COALESCE(${items.publishedAt}, ${items.discoveredAt}) >= datetime('now', '-24 hours')`
      : and(eq(items.isDemo, false), sql`COALESCE(${items.publishedAt}, ${items.discoveredAt}) >= datetime('now', '-24 hours')`)
    )
    .get())?.count ?? 0;

  const last3dItems = (await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(includeDemo
      ? sql`COALESCE(${items.publishedAt}, ${items.discoveredAt}) >= datetime('now', '-72 hours')`
      : and(eq(items.isDemo, false), sql`COALESCE(${items.publishedAt}, ${items.discoveredAt}) >= datetime('now', '-72 hours')`)
    )
    .get())?.count ?? 0;

  const activeSignalCount = (await db
    .select({ count: sql<number>`count(*)` })
    .from(signals)
    .where(includeDemo
      ? eq(signals.isActive, true)
      : and(eq(signals.isActive, true), eq(signals.isDemo, false))
    )
    .get())?.count ?? 0;

  const unreadAlerts = await getUnreadAlertCount(includeDemo);

  const categoryCounts = await db
    .select({
      category: items.category,
      count: sql<number>`count(*)`,
    })
    .from(items)
    .where(demoFilter)
    .groupBy(items.category)
    .all();

  const demoItemCount = (await db
    .select({ count: sql<number>`count(*)` })
    .from(items)
    .where(eq(items.isDemo, true))
    .get())?.count ?? 0;

  return {
    totalItems,
    todayItems,
    last3dItems,
    activeSignalCount,
    unreadAlerts,
    categoryCounts,
    demoItemCount,
  };
}

// ─── Source Health ───────────────────────────────────────────────────

export async function getSourceHealth() {
  const sources_list = await db.select().from(sourcesTable).all();
  return Promise.all(sources_list.map(async (source) => {
    const itemCount = (await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(eq(items.source, source.id))
      .get())?.count ?? 0;

    const liveItemCount = (await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(eq(items.source, source.id), eq(items.isDemo, false)))
      .get())?.count ?? 0;

    const recentItemCount = (await db
      .select({ count: sql<number>`count(*)` })
      .from(items)
      .where(and(
        eq(items.source, source.id),
        eq(items.isDemo, false),
        sql`COALESCE(${items.publishedAt}, ${items.discoveredAt}) >= datetime('now', '-72 hours')`
      ))
      .get())?.count ?? 0;

    const avgFreshnessResult = await db
      .select({ avg: sql<number>`AVG(${items.freshnessScore})` })
      .from(items)
      .where(and(eq(items.source, source.id), eq(items.isDemo, false)))
      .get();

    const oldestLiveItem = await db
      .select({ publishedAt: items.publishedAt })
      .from(items)
      .where(and(eq(items.source, source.id), eq(items.isDemo, false)))
      .orderBy(items.publishedAt)
      .limit(1)
      .get();

    const newestLiveItem = await db
      .select({ publishedAt: items.publishedAt })
      .from(items)
      .where(and(eq(items.source, source.id), eq(items.isDemo, false)))
      .orderBy(desc(items.publishedAt))
      .limit(1)
      .get();

    // Get recent fetch logs
    const recentLogs = await db
      .select()
      .from(sourceFetchLog)
      .where(eq(sourceFetchLog.sourceId, source.id))
      .orderBy(desc(sourceFetchLog.fetchedAt))
      .limit(5)
      .all();

    return {
      ...source,
      itemCount,
      liveItemCount,
      recentItemCount,
      avgFreshness: avgFreshnessResult?.avg ?? null,
      oldestItem: oldestLiveItem?.publishedAt ?? null,
      newestItem: newestLiveItem?.publishedAt ?? null,
      recentLogs,
    };
  }));
}

// ─── Admin Items View ───────────────────────────────────────────────

export async function getItemsForAdmin(limit = 50) {
  return await db
    .select()
    .from(items)
    .orderBy(desc(items.discoveredAt))
    .limit(limit)
    .all();
}

// ─── User Preferences ──────────────────────────────────────────────

export async function getUserPreferences() {
  return await db.select().from(userPreferences).where(eq(userPreferences.id, "default")).get();
}

export async function updateUserPreferences(prefs: Partial<schema.UserPreferences>) {
  await db.update(userPreferences)
    .set({ ...prefs, updatedAt: new Date().toISOString() })
    .where(eq(userPreferences.id, "default"))
    .run();
}

// ─── Search ─────────────────────────────────────────────────────────

export async function searchItems(query: string, filters?: { category?: string; company?: string; limit?: number }) {
  return await getItems({
    search: query,
    category: filters?.category as Category,
    company: filters?.company,
    limit: filters?.limit ?? 30,
    timeWindow: "all", // Search always searches all time
  });
}

// ─── Companies ──────────────────────────────────────────────────────

export async function getCompanies() {
  return await db
    .select({
      company: items.company,
      count: sql<number>`count(*)`,
    })
    .from(items)
    .where(sql`${items.company} IS NOT NULL`)
    .groupBy(items.company)
    .orderBy(sql`count(*) DESC`)
    .limit(30)
    .all();
}

// ─── Feed Sections (for homepage) ────────────────────────────────────

export async function getFeedSections(timeWindow: TimeWindow = "3d") {
  const twCond = timeWindowCondition(timeWindow);
  const baseConditions = [
    eq(items.isDemo, false),
    isNull(items.duplicateOf),
  ];
  if (twCond) baseConditions.push(twCond);

  // Helper: run a section query
  const sectionQuery = async (extraConditions: any[], limit: number, orderBy: any[]) => {
    return await db
      .select()
      .from(items)
      .where(and(...baseConditions, ...extraConditions))
      .orderBy(...orderBy)
      .limit(limit)
      .all();
  };

  const byFreshness = [desc(freshnessBoostedScore)];
  const byRecency = [
    desc(sql`CASE WHEN ${items.publishedAt} IS NOT NULL THEN 1 ELSE 0 END`),
    desc(sql`COALESCE(${items.publishedAt}, ${items.discoveredAt})`),
  ];

  // Major AI Releases: model releases + major announcements from official sources
  const releases = await sectionQuery(
    [
      or(eq(items.category, "model"), eq(items.category, "company")),
      sql`${items.source} NOT LIKE 'arxiv%'`,
      sql`COALESCE(${items.realWorldRelevance}, 50) >= 55`,
    ],
    6,
    byFreshness,
  );

  // New Tools & Products
  const tools = await sectionQuery(
    [
      eq(items.category, "tool"),
      sql`${items.source} NOT LIKE 'arxiv%'`,
    ],
    6,
    byFreshness,
  );

  // Open Source Momentum
  const opensource = await sectionQuery(
    [
      or(eq(items.category, "opensource"), eq(items.isOpenSource, true)),
    ],
    5,
    byFreshness,
  );

  // Important Developments (high-scoring non-research)
  const developments = await sectionQuery(
    [
      sql`${items.category} != 'research'`,
      sql`${items.source} NOT LIKE 'arxiv%'`,
      sql`COALESCE(${items.importanceScore}, 50) >= 55`,
    ],
    8,
    byFreshness,
  );

  // Important Research (only main-feed worthy papers)
  const research = await sectionQuery(
    [
      eq(items.category, "research"),
      eq(items.showInMainFeed, true),
      sql`COALESCE(${items.realWorldRelevance}, 50) >= 30`,
    ],
    5,
    byFreshness,
  );

  // Early Signals (novel, recent, lower importance)
  const signals = await sectionQuery(
    [
      sql`COALESCE(${items.noveltyScore}, 50) >= 60`,
      sql`${items.source} NOT LIKE 'arxiv%'`,
    ],
    4,
    [desc(items.noveltyScore), desc(sql`COALESCE(${items.publishedAt}, ${items.discoveredAt})`)],
  );

  return { releases, tools, opensource, developments, research, signals };
}

// ─── Ingestion Stats (for admin) ────────────────────────────────────

export async function getIngestionStats() {
  const sourceStats = await db
    .select({
      source: items.source,
      total: sql<number>`count(*)`,
      withDates: sql<number>`SUM(CASE WHEN ${items.publishedAt} IS NOT NULL THEN 1 ELSE 0 END)`,
      withExactDates: sql<number>`SUM(CASE WHEN ${items.dateConfidence} = 'exact' THEN 1 ELSE 0 END)`,
      avgComposite: sql<number>`AVG(${items.compositeScore})`,
      avgFreshness: sql<number>`AVG(${items.freshnessScore})`,
      primary: sql<number>`SUM(CASE WHEN ${items.isPrimarySource} = 1 THEN 1 ELSE 0 END)`,
      duplicates: sql<number>`SUM(CASE WHEN ${items.duplicateOf} IS NOT NULL THEN 1 ELSE 0 END)`,
    })
    .from(items)
    .where(eq(items.isDemo, false))
    .groupBy(items.source)
    .all();

  const dateConfidenceBreakdown = await db
    .select({
      confidence: items.dateConfidence,
      count: sql<number>`count(*)`,
    })
    .from(items)
    .where(eq(items.isDemo, false))
    .groupBy(items.dateConfidence)
    .all();

  return { sourceStats, dateConfidenceBreakdown };
}
