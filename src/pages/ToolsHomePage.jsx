const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px 24px 40px",
    background:
      "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 28%), radial-gradient(circle at top right, rgba(245,158,11,0.16), transparent 26%), linear-gradient(180deg, #07111f 0%, #020617 62%, #02050b 100%)",
    color: "#e2e8f0",
  },
  shell: {
    width: "min(1180px, 100%)",
    margin: "0 auto",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "32px",
  },
  brand: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "999px",
    border: "1px solid rgba(148,163,184,0.2)",
    background: "rgba(2,6,23,0.52)",
    color: "#e2e8f0",
    fontSize: "14px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  dot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #22c55e, #38bdf8)",
    boxShadow: "0 0 20px rgba(56,189,248,0.45)",
  },
  miniNote: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
    gap: "24px",
    alignItems: "stretch",
    marginBottom: "28px",
  },
  heroCard: {
    padding: "32px",
    borderRadius: "32px",
    border: "1px solid rgba(148,163,184,0.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(7,12,24,0.88))",
    boxShadow: "0 24px 80px rgba(0,0,0,0.34)",
  },
  heroEyebrow: {
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
    fontSize: "clamp(40px, 7vw, 72px)",
    lineHeight: 0.94,
    letterSpacing: "-0.06em",
    color: "#f8fafc",
    fontWeight: 800,
    maxWidth: "9ch",
  },
  subtitle: {
    margin: "22px 0 0",
    maxWidth: "60ch",
    fontSize: "16px",
    lineHeight: 1.8,
    color: "#cbd5e1",
  },
  heroFooter: {
    display: "flex",
    gap: "14px",
    flexWrap: "wrap",
    marginTop: "28px",
  },
  heroChip: {
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
    fontSize: "16px",
    fontWeight: 800,
    color: "#f8fafc",
  },
  sideCard: {
    padding: "28px",
    borderRadius: "32px",
    border: "1px solid rgba(148,163,184,0.16)",
    background:
      "linear-gradient(160deg, rgba(34,197,94,0.18), rgba(15,23,42,0.92) 30%, rgba(14,116,144,0.28) 100%)",
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
    fontSize: "72px",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    fontWeight: 800,
    color: "#f8fafc",
  },
  sideText: {
    margin: "14px 0 0",
    fontSize: "14px",
    lineHeight: 1.8,
    color: "#dbeafe",
  },
  sectionTitle: {
    margin: "0 0 16px",
    fontSize: "20px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  toolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },
  toolCard: {
    display: "block",
    padding: "24px",
    borderRadius: "28px",
    border: "1px solid rgba(148,163,184,0.16)",
    background: "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(8,15,29,0.9))",
    boxShadow: "0 24px 72px rgba(0,0,0,0.28)",
    color: "inherit",
    textDecoration: "none",
    transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
  },
  toolMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "18px",
  },
  toolTag: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(56,189,248,0.12)",
    color: "#7dd3fc",
    fontSize: "13px",
    fontWeight: 700,
  },
  toolState: {
    fontSize: "12px",
    color: "#86efac",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  toolName: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.05em",
    color: "#f8fafc",
  },
  toolDesc: {
    margin: "16px 0 0",
    fontSize: "14px",
    lineHeight: 1.75,
    color: "#cbd5e1",
  },
  featureList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "20px",
  },
  feature: {
    padding: "9px 12px",
    borderRadius: "14px",
    background: "rgba(15,23,42,0.92)",
    border: "1px solid rgba(148,163,184,0.14)",
    fontSize: "13px",
    color: "#cbd5e1",
  },
  toolFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginTop: "24px",
    fontSize: "14px",
  },
  openHint: {
    color: "#94a3b8",
  },
  openAction: {
    color: "#f8fafc",
    fontWeight: 700,
  },
  note: {
    marginTop: "18px",
    fontSize: "13px",
    lineHeight: 1.8,
    color: "#94a3b8",
  },
};

const homeCss = `
  .tool-card:hover {
    transform: translateY(-4px);
    border-color: rgba(125, 211, 252, 0.34);
    box-shadow: 0 30px 90px rgba(2, 132, 199, 0.16), 0 24px 72px rgba(0, 0, 0, 0.3);
  }

  .tool-card:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 3px;
  }

  @media (max-width: 920px) {
    .tools-hero {
      grid-template-columns: 1fr;
    }
  }
`;

export default function ToolsHomePage({ cutoutHref }) {
  return (
    <div style={styles.page}>
      <style>{homeCss}</style>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <div style={styles.brand}>
            <span style={styles.dot} />
            Tool Shelf
          </div>
          <div style={styles.miniNote}>首页已经改成工具集入口，后续工具可以继续往这里加。</div>
        </div>

        <section className="tools-hero" style={styles.hero}>
          <div style={styles.heroCard}>
            <div style={styles.heroEyebrow}>Browser First</div>
            <h1 style={styles.title}>工具集</h1>
            <p style={styles.subtitle}>
              这里作为所有小工具的统一入口。当前已接入的第一个工具是
              “抠图”，保留了原来主页上的全部能力，包括自动去底、手动修边和透明
              PNG 导出。
            </p>
            <div style={styles.heroFooter}>
              <div style={styles.heroChip}>
                <span style={styles.chipValue}>1</span>
                已接入工具
              </div>
              <div style={styles.heroChip}>
                <span style={styles.chipValue}>0</span>
                服务端依赖
              </div>
              <div style={styles.heroChip}>
                <span style={styles.chipValue}>PNG</span>
                本地导出
              </div>
            </div>
          </div>

          <aside style={styles.sideCard}>
            <p style={styles.sideTitle}>当前工具</p>
            <div style={styles.sideBig}>抠图</div>
            <p style={styles.sideText}>
              适合白底、纯色底、拍摄背景较干净的图片。处理过程全在浏览器里完成，不走上传。
            </p>
          </aside>
        </section>

        <section>
          <h2 style={styles.sectionTitle}>工具列表</h2>
          <div style={styles.toolGrid}>
            <a
              className="tool-card"
              href={cutoutHref}
              style={styles.toolCard}
            >
              <div style={styles.toolMeta}>
                <span style={styles.toolTag}>图像处理</span>
                <span style={styles.toolState}>Ready</span>
              </div>
              <h3 style={styles.toolName}>抠图</h3>
              <p style={styles.toolDesc}>
                自动识别边缘背景并生成透明结果，再用画笔做局部擦除和恢复。适合作为一个轻量、本地运行的商品图处理入口。
              </p>
              <div style={styles.featureList}>
                <span style={styles.feature}>自动去底</span>
                <span style={styles.feature}>手动修边</span>
                <span style={styles.feature}>撤销重置</span>
                <span style={styles.feature}>导出 PNG</span>
              </div>
              <div style={styles.toolFooter}>
                <span style={styles.openHint}>打开工具页继续处理图片</span>
                <span style={styles.openAction}>进入</span>
              </div>
            </a>
          </div>
          <div style={styles.note}>后续如果要继续加工具，直接按这个卡片结构扩展即可。</div>
        </section>
      </div>
    </div>
  );
}
