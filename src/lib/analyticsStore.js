const ANALYTICS_STORAGE_KEY = "tool_shelf_analytics_v1";

export const STATS_PASSWORD = "zxc123";
export const STATS_SESSION_KEY = "tool_shelf_stats_auth_v1";

const ROUTE_LABELS = {
  home: "工具集首页",
  cutout: "抠图",
  backgroundReplace: "背景替换",
  imageSplit: "图片拆分",
  videoFrame: "视频帧提取",
  stats: "访问统计",
};

const TOOL_LABELS = {
  cutout: "抠图",
  backgroundReplace: "背景替换",
  imageSplit: "图片拆分",
  videoFrame: "视频帧提取",
};

function createEmptyAnalytics() {
  return {
    version: 1,
    homeVisits: 0,
    totalToolClicks: 0,
    routeVisits: {},
    toolClicks: {},
    lastUpdatedAt: null,
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeCounterMap(source, labelMap = {}) {
  if (!isPlainObject(source)) {
    return {};
  }

  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (!isPlainObject(value)) {
      continue;
    }

    const count = Number.isFinite(value.count) ? Math.max(0, Math.round(value.count)) : 0;
    if (count <= 0) {
      continue;
    }

    result[key] = {
      name: typeof value.name === "string" && value.name.trim() ? value.name : labelMap[key] || key,
      count,
      lastAt: typeof value.lastAt === "string" ? value.lastAt : null,
    };
  }

  return result;
}

function normalizeAnalytics(source) {
  const base = createEmptyAnalytics();
  if (!isPlainObject(source)) {
    return base;
  }

  const homeVisits = Number.isFinite(source.homeVisits) ? Math.max(0, Math.round(source.homeVisits)) : 0;
  const totalToolClicks = Number.isFinite(source.totalToolClicks) ? Math.max(0, Math.round(source.totalToolClicks)) : 0;

  return {
    version: 1,
    homeVisits,
    totalToolClicks,
    routeVisits: sanitizeCounterMap(source.routeVisits, ROUTE_LABELS),
    toolClicks: sanitizeCounterMap(source.toolClicks, TOOL_LABELS),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
}

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function saveAnalytics(state) {
  if (!hasStorage()) {
    return state;
  }

  window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(state));
  return state;
}

function withStoredAnalytics(mutator) {
  const current = readAnalyticsSnapshot();
  const next = normalizeAnalytics(mutator(current));
  next.lastUpdatedAt = new Date().toISOString();
  return saveAnalytics(next);
}

export function readAnalyticsSnapshot() {
  if (!hasStorage()) {
    return createEmptyAnalytics();
  }

  try {
    const raw = window.localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) {
      return createEmptyAnalytics();
    }

    return normalizeAnalytics(JSON.parse(raw));
  } catch (error) {
    console.error("读取统计数据失败，已回退为空状态", error);
    return createEmptyAnalytics();
  }
}

export function recordRouteVisit(routeKey, routeName = ROUTE_LABELS[routeKey] || routeKey) {
  return withStoredAnalytics((current) => {
    const next = normalizeAnalytics(current);
    const previous = next.routeVisits[routeKey];

    next.routeVisits[routeKey] = {
      name: routeName,
      count: (previous?.count || 0) + 1,
      lastAt: new Date().toISOString(),
    };

    if (routeKey === "home") {
      next.homeVisits += 1;
    }

    return next;
  });
}

export function recordToolClick(toolKey, toolName = TOOL_LABELS[toolKey] || toolKey) {
  return withStoredAnalytics((current) => {
    const next = normalizeAnalytics(current);
    const previous = next.toolClicks[toolKey];

    next.toolClicks[toolKey] = {
      name: toolName,
      count: (previous?.count || 0) + 1,
      lastAt: new Date().toISOString(),
    };
    next.totalToolClicks += 1;

    return next;
  });
}

export function clearAnalyticsSnapshot() {
  const empty = createEmptyAnalytics();
  empty.lastUpdatedAt = new Date().toISOString();

  if (!hasStorage()) {
    return empty;
  }

  window.localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(empty));
  return empty;
}

export function getRouteLabel(routeKey) {
  return ROUTE_LABELS[routeKey] || routeKey;
}

export function getToolLabel(toolKey) {
  return TOOL_LABELS[toolKey] || toolKey;
}

export function runAnalyticsTests() {
  const normalized = normalizeAnalytics({
    homeVisits: 3.6,
    totalToolClicks: 4.2,
    routeVisits: {
      home: { count: 5.1, name: "" },
      broken: { count: -2, name: "坏数据" },
    },
    toolClicks: {
      cutout: { count: 2, name: "" },
      invalid: "oops",
    },
  });

  return [
    {
      name: "计数归一化",
      pass: normalized.homeVisits === 4 && normalized.totalToolClicks === 4,
      details: `home=${normalized.homeVisits}, clicks=${normalized.totalToolClicks}`,
    },
    {
      name: "路由数据过滤",
      pass: normalized.routeVisits.home?.count === 5 && !normalized.routeVisits.broken,
      details: `routes=${Object.keys(normalized.routeVisits).length}`,
    },
    {
      name: "工具名回填",
      pass: normalized.toolClicks.cutout?.name === "抠图",
      details: normalized.toolClicks.cutout?.name || "missing",
    },
  ];
}
