import { useMemo, useState } from "react";
import { SelfTestCard, StatusCard } from "../components/ImageToolPanels.jsx";
import { sharedToolPageStyles } from "../components/imageToolWorkspaceStyles.js";
import {
  STATS_PASSWORD,
  STATS_SESSION_KEY,
  clearAnalyticsSnapshot,
  getRouteLabel,
  getToolLabel,
  runAnalyticsTests,
} from "../lib/analyticsStore.js";

const styles = {
  ...sharedToolPageStyles,
  page: {
    minHeight: "100vh",
    padding: "32px 24px 48px",
    background:
      "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 28%), radial-gradient(circle at top right, rgba(34,197,94,0.14), transparent 26%), linear-gradient(180deg, #07111f 0%, #020617 62%, #02050b 100%)",
    color: "#e2e8f0",
  },
  shell: {
    width: "min(1220px, 100%)",
    margin: "0 auto",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "28px",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(2,6,23,0.52)",
    color: "#e2e8f0",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
  },
  topHint: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
    gap: "24px",
    marginBottom: "24px",
  },
  heroCard: {
    padding: "32px",
    borderRadius: "30px",
    border: "1px solid rgba(148,163,184,0.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(7,12,24,0.88))",
    boxShadow: "0 24px 80px rgba(0,0,0,0.34)",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(14,165,233,0.14)",
    color: "#7dd3fc",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.04em",
  },
  title: {
    margin: "18px 0 0",
    fontSize: "clamp(34px, 6vw, 56px)",
    lineHeight: 0.96,
    letterSpacing: "-0.05em",
    color: "#f8fafc",
    fontWeight: 800,
  },
  subtitle: {
    margin: "18px 0 0",
    maxWidth: "56ch",
    fontSize: "15px",
    lineHeight: 1.8,
    color: "#cbd5e1",
  },
  chipRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "24px",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "16px",
    background: "rgba(15,23,42,0.88)",
    border: "1px solid rgba(56,189,248,0.14)",
    color: "#e2e8f0",
    fontSize: "14px",
  },
  chipValue: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#f8fafc",
  },
  sideCard: {
    padding: "28px",
    borderRadius: "30px",
    border: "1px solid rgba(148,163,184,0.16)",
    background:
      "linear-gradient(160deg, rgba(34,197,94,0.18), rgba(15,23,42,0.92) 28%, rgba(14,116,144,0.28) 100%)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.34)",
  },
  sideTitle: {
    margin: 0,
    fontSize: "14px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#bbf7d0",
  },
  sideBig: {
    margin: "14px 0 0",
    fontSize: "56px",
    lineHeight: 0.96,
    letterSpacing: "-0.06em",
    fontWeight: 800,
    color: "#f8fafc",
  },
  sideText: {
    margin: "14px 0 0",
    fontSize: "14px",
    lineHeight: 1.8,
    color: "#dbeafe",
  },
  board: {
    display: "grid",
    gap: "24px",
  },
  boardCard: {
    padding: "24px",
    borderRadius: "28px",
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.52)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  },
  boardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  boardTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  boardText: {
    margin: "8px 0 0",
    fontSize: "14px",
    lineHeight: 1.75,
    color: "#94a3b8",
    maxWidth: "62ch",
  },
  panelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },
  metricCard: {
    padding: "18px",
    borderRadius: "20px",
    border: "1px solid #1e293b",
    background: "rgba(2,6,23,0.78)",
  },
  metricLabel: {
    fontSize: "13px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  metricValue: {
    marginTop: "10px",
    fontSize: "32px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#f8fafc",
  },
  metricNote: {
    marginTop: "10px",
    fontSize: "13px",
    lineHeight: 1.7,
    color: "#cbd5e1",
  },
  table: {
    display: "grid",
    gap: "12px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    gap: "16px",
    alignItems: "center",
    padding: "16px 18px",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "rgba(2,6,23,0.78)",
  },
  rowName: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  rowMeta: {
    marginTop: "6px",
    fontSize: "12px",
    lineHeight: 1.7,
    color: "#94a3b8",
  },
  rowCount: {
    fontSize: "24px",
    fontWeight: 800,
    color: "#f8fafc",
    letterSpacing: "-0.04em",
  },
  rowCountLabel: {
    fontSize: "12px",
    color: "#94a3b8",
    textAlign: "right",
  },
  empty: {
    padding: "28px",
    borderRadius: "18px",
    border: "1px dashed #334155",
    background: "rgba(2,6,23,0.78)",
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: 1.8,
    textAlign: "center",
  },
  actionRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  passwordWrap: {
    width: "min(540px, 100%)",
    margin: "64px auto 0",
  },
  passwordCard: {
    padding: "28px",
    borderRadius: "28px",
    border: "1px solid rgba(148,163,184,0.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(7,12,24,0.88))",
    boxShadow: "0 24px 80px rgba(0,0,0,0.34)",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    borderRadius: "16px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    fontSize: "15px",
  },
};

function formatTime(isoString) {
  if (!isoString) {
    return "暂无";
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "暂无";
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
  });
}

function sortCounterMap(map) {
  return Object.entries(map || {}).sort(([, left], [, right]) => {
    if ((right?.count || 0) !== (left?.count || 0)) {
      return (right?.count || 0) - (left?.count || 0);
    }

    return (right?.lastAt || "").localeCompare(left?.lastAt || "");
  });
}

export default function StatsDashboardPage({ homeHref, analytics, onRefreshAnalytics, onClearAnalytics }) {
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
      return false;
    }

    return window.sessionStorage.getItem(STATS_SESSION_KEY) === "ok";
  });
  const [testResults] = useState(() => runAnalyticsTests());

  const routeStats = useMemo(() => {
    return sortCounterMap(analytics?.routeVisits || {}).map(([key, value]) => ({
      key,
      name: value.name || getRouteLabel(key),
      count: value.count || 0,
      lastAt: value.lastAt,
    }));
  }, [analytics]);

  const toolStats = useMemo(() => {
    return sortCounterMap(analytics?.toolClicks || {}).map(([key, value]) => ({
      key,
      name: value.name || getToolLabel(key),
      count: value.count || 0,
      lastAt: value.lastAt,
    }));
  }, [analytics]);

  const hottestTool = toolStats[0];
  const totalRouteVisits = routeStats.reduce((sum, item) => sum + item.count, 0);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (password !== STATS_PASSWORD) {
      setErrorText("密码错误。");
      return;
    }

    if (typeof window !== "undefined" && typeof window.sessionStorage !== "undefined") {
      window.sessionStorage.setItem(STATS_SESSION_KEY, "ok");
    }

    setUnlocked(true);
    setPassword("");
    setErrorText("");
    onRefreshAnalytics?.();
  };

  const handleLogout = () => {
    if (typeof window !== "undefined" && typeof window.sessionStorage !== "undefined") {
      window.sessionStorage.removeItem(STATS_SESSION_KEY);
    }

    setUnlocked(false);
    setPassword("");
    setErrorText("");
  };

  const handleClear = () => {
    if (typeof window !== "undefined" && !window.confirm("确定要清空当前浏览器里的统计数据吗？")) {
      return;
    }

    onClearAnalytics?.(clearAnalyticsSnapshot());
  };

  if (!unlocked) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.topRow}>
            <a href={homeHref} style={styles.backLink}>
              返回工具集
            </a>
            <div style={styles.topHint}>统计页当前是前端本地密码门，仅用于防误入。</div>
          </div>

          <div style={styles.passwordWrap}>
            <div style={styles.passwordCard}>
              <div style={styles.eyebrow}>Password Gate</div>
              <h1 style={styles.title}>访问统计</h1>
              <p style={styles.subtitle}>
                这里展示当前浏览器里的首页访问次数、各功能点击次数和页面访问分布。进入前需要先输入密码。
              </p>

              <form onSubmit={handleSubmit} style={{ ...styles.stackSmall, marginTop: "24px" }}>
                <label style={styles.label}>统计页密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errorText) {
                      setErrorText("");
                    }
                  }}
                  placeholder="请输入密码"
                  style={styles.input}
                />
                {errorText ? <div style={{ ...styles.smallMuted, color: "#fda4af" }}>{errorText}</div> : null}
                <button type="submit" style={styles.primaryButton}>
                  进入统计页
                </button>
              </form>

              <div style={styles.mutedTip}>当前临时密码配置在前端代码里，只适合做简单访问门，不具备真实安全性。</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <a href={homeHref} style={styles.backLink}>
            返回工具集
          </a>
          <div style={styles.actionRow}>
            <button onClick={onRefreshAnalytics} style={styles.secondaryButton}>
              刷新数据
            </button>
            <button onClick={handleClear} style={styles.infoButton}>
              清空统计
            </button>
            <button onClick={handleLogout} style={styles.secondaryButton}>
              退出登录
            </button>
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.heroCard}>
            <div style={styles.eyebrow}>Local Analytics</div>
            <h1 style={styles.title}>访问统计</h1>
            <p style={styles.subtitle}>
              这页展示的是当前浏览器本地统计，不依赖服务端。现在已经记录工具集首页访问、各个功能入口点击，以及不同页面的访问次数。
            </p>
            <div style={styles.chipRow}>
              <div style={styles.chip}>
                <span style={styles.chipValue}>{analytics?.homeVisits || 0}</span>
                首页访问
              </div>
              <div style={styles.chip}>
                <span style={styles.chipValue}>{analytics?.totalToolClicks || 0}</span>
                功能点击
              </div>
              <div style={styles.chip}>
                <span style={styles.chipValue}>{totalRouteVisits}</span>
                页面访问
              </div>
            </div>
          </div>

          <aside style={styles.sideCard}>
            <p style={styles.sideTitle}>最后更新</p>
            <div style={styles.sideBig}>{formatTime(analytics?.lastUpdatedAt)}</div>
            <p style={styles.sideText}>
              {hottestTool
                ? `当前点击最多的是“${hottestTool.name}”，累计 ${hottestTool.count} 次。`
                : "当前还没有功能点击记录。"}
            </p>
          </aside>
        </section>

        <div style={styles.board}>
          <section style={styles.boardCard}>
            <div style={styles.boardHead}>
              <div>
                <h2 style={styles.boardTitle}>概览</h2>
                <p style={styles.boardText}>先看首页访问、功能点击和最近一次记录更新时间。</p>
              </div>
            </div>
            <div style={styles.panelGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>首页访问次数</div>
                <div style={styles.metricValue}>{analytics?.homeVisits || 0}</div>
                <div style={styles.metricNote}>每次进入 `#/` 都会累计一次。</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>功能点击次数</div>
                <div style={styles.metricValue}>{analytics?.totalToolClicks || 0}</div>
                <div style={styles.metricNote}>只统计从首页点击工具卡片进入的行为。</div>
              </div>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>最近记录时间</div>
                <div style={{ ...styles.metricValue, fontSize: "26px", lineHeight: 1.15 }}>{formatTime(analytics?.lastUpdatedAt)}</div>
                <div style={styles.metricNote}>统计数据保存在当前浏览器的 `localStorage`。</div>
              </div>
            </div>
          </section>

          <section style={styles.boardCard}>
            <div style={styles.boardHead}>
              <div>
                <h2 style={styles.boardTitle}>功能点击统计</h2>
                <p style={styles.boardText}>用于看首页里哪个功能入口被点得最多。</p>
              </div>
            </div>
            {toolStats.length ? (
              <div style={styles.table}>
                {toolStats.map((item) => (
                  <div key={item.key} style={styles.row}>
                    <div>
                      <div style={styles.rowName}>{item.name}</div>
                      <div style={styles.rowMeta}>最近点击：{formatTime(item.lastAt)}</div>
                    </div>
                    <div>
                      <div style={styles.rowCount}>{item.count}</div>
                      <div style={styles.rowCountLabel}>次点击</div>
                    </div>
                    <div style={styles.smallMuted}>{item.key}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.empty}>当前还没有功能点击数据。先从首页进入一次工具，这里就会开始累计。</div>
            )}
          </section>

          <section style={styles.boardCard}>
            <div style={styles.boardHead}>
              <div>
                <h2 style={styles.boardTitle}>页面访问统计</h2>
                <p style={styles.boardText}>这里展示各个页面被访问的次数，包含首页、工具页和统计页本身。</p>
              </div>
            </div>
            {routeStats.length ? (
              <div style={styles.table}>
                {routeStats.map((item) => (
                  <div key={item.key} style={styles.row}>
                    <div>
                      <div style={styles.rowName}>{item.name}</div>
                      <div style={styles.rowMeta}>最近访问：{formatTime(item.lastAt)}</div>
                    </div>
                    <div>
                      <div style={styles.rowCount}>{item.count}</div>
                      <div style={styles.rowCountLabel}>次访问</div>
                    </div>
                    <div style={styles.smallMuted}>{item.key}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.empty}>当前还没有页面访问数据。</div>
            )}
          </section>

          <section style={styles.boardCard}>
            <SelfTestCard tests={testResults} title="统计模块自检" />
            <div style={{ marginTop: "16px" }}>
              <StatusCard body="当前版本是纯前端本地统计。换浏览器、清缓存或换设备后，数据不会自动同步。" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
