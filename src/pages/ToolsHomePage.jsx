function buildSections(cutoutHref, backgroundReplaceHref, imageSplitHref) {
  return [
    {
      key: "ready",
      eyebrow: "Live Now",
      title: "已接入",
      description: "这些工具已经可以直接打开使用。",
      tools: [
        {
          key: "cutout",
          name: "抠图",
          category: "图像处理",
          status: "Ready",
          state: "active",
          href: cutoutHref,
          summary: "自动识别边缘背景并生成透明结果，再用画笔做局部擦除和恢复，适合作为轻量的本地图片处理入口。",
          features: ["自动去底", "手动修边", "撤销重置", "导出 PNG"],
          metricLabel: "本地运行",
          metricValue: "100%",
        },
        {
          key: "background-replace",
          name: "背景替换",
          category: "图像处理",
          status: "Ready",
          state: "active",
          href: backgroundReplaceHref,
          summary: "在浏览器内完成主体分离，再把主体合成到纯色、渐变或上传背景图上，适合商品图和头像素材。",
          features: ["纯色背景", "渐变模板", "背景上传", "导出合成图"],
          metricLabel: "本地运行",
          metricValue: "100%",
        },
        {
          key: "image-split",
          name: "图片拆分",
          category: "图像处理",
          status: "Ready",
          state: "active",
          href: imageSplitHref,
          summary: "把一张图按指定行数和列数切成多张小图，适合九宫格、切片素材、规则拼图和批量拆分场景。",
          features: ["行列切分", "网格预览", "单张下载", "批量导出"],
          metricLabel: "输出格式",
          metricValue: "PNG",
        },
      ],
    },
    {
      key: "planned",
      eyebrow: "Pipeline",
      title: "规划中",
      description: "先把工具矩阵和卡片信息铺开，后续可以按这个结构逐个接入。",
      tools: [
        {
          key: "resize-batch",
          name: "批量改尺寸",
          category: "批量处理",
          status: "Planned",
          state: "planned",
          summary: "批量导入图片并统一按电商平台、社媒封面或头像尺寸裁切导出，减少重复手工操作。",
          features: ["预设尺寸", "批量导出", "裁切对齐", "比例锁定"],
          metricLabel: "阶段",
          metricValue: "P1",
        },
        {
          key: "format-convert",
          name: "格式转换",
          category: "格式工具",
          status: "Planned",
          state: "planned",
          summary: "面向常见图片格式的快速转换页，聚焦浏览器内完成的轻量处理，不依赖服务端。",
          features: ["PNG 转 JPG", "透明保留", "质量调节", "批量导出"],
          metricLabel: "阶段",
          metricValue: "P2",
        },
        {
          key: "poster-crop",
          name: "海报裁切",
          category: "内容制作",
          status: "Planned",
          state: "planned",
          summary: "为长图、横版 banner 和平台封面准备的安全区域裁切工具，优先解决多端比例适配。",
          features: ["安全区", "多端比例", "参考线", "多稿导出"],
          metricLabel: "阶段",
          metricValue: "P2",
        },
        {
          key: "compress",
          name: "图片压缩",
          category: "格式工具",
          status: "Planned",
          state: "planned",
          summary: "按目标体积或清晰度上限压缩图片，适合上传前预处理和落地页资源瘦身。",
          features: ["目标体积", "质量对比", "尺寸联动", "批量模式"],
          metricLabel: "阶段",
          metricValue: "P3",
        },
        {
          key: "watermark",
          name: "水印工具",
          category: "内容制作",
          status: "Planned",
          state: "planned",
          summary: "面向品牌物料的批量文字或图片水印叠加工具，适合商品图、海报和宣发素材。",
          features: ["文字水印", "图片水印", "透明度调节", "批量叠加"],
          metricLabel: "阶段",
          metricValue: "P3",
        },
      ],
    },
  ];
}

function countToolsByState(sections, state) {
  return sections.flatMap((section) => section.tools).filter((tool) => tool.state === state).length;
}

function getCardStyle(tool) {
  if (tool.state === "active") {
    return {
      border: "1px solid rgba(56,189,248,0.24)",
      background:
        "radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 26%), linear-gradient(180deg, rgba(15,23,42,0.96), rgba(8,15,29,0.92))",
      boxShadow: "0 24px 72px rgba(0,0,0,0.28)",
    };
  }

  return {
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.88), rgba(8,15,29,0.82))",
    boxShadow: "0 18px 56px rgba(0,0,0,0.22)",
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px 24px 48px",
    background:
      "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 28%), radial-gradient(circle at top right, rgba(245,158,11,0.16), transparent 26%), linear-gradient(180deg, #07111f 0%, #020617 62%, #02050b 100%)",
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
    gridTemplateColumns: "minmax(0, 1.25fr) minmax(300px, 0.75fr)",
    gap: "24px",
    alignItems: "stretch",
    marginBottom: "34px",
  },
  heroCard: {
    padding: "34px",
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
    fontSize: "clamp(42px, 7vw, 76px)",
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
  laneGrid: {
    display: "grid",
    gap: "24px",
  },
  laneCard: {
    padding: "24px",
    borderRadius: "28px",
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.52)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  },
  laneHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: "18px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  laneEyebrow: {
    fontSize: "12px",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#7dd3fc",
    marginBottom: "8px",
  },
  laneTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  laneText: {
    margin: "8px 0 0",
    fontSize: "14px",
    lineHeight: 1.75,
    color: "#94a3b8",
    maxWidth: "62ch",
  },
  laneCount: {
    padding: "10px 14px",
    borderRadius: "16px",
    background: "rgba(2,6,23,0.62)",
    border: "1px solid rgba(148,163,184,0.14)",
    fontSize: "13px",
    color: "#cbd5e1",
    whiteSpace: "nowrap",
  },
  toolGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
    gap: "18px",
  },
  toolCard: {
    display: "block",
    padding: "22px",
    borderRadius: "26px",
    color: "inherit",
    textDecoration: "none",
    minHeight: "100%",
    transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
  },
  plannedCard: {
    cursor: "default",
  },
  toolMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "18px",
  },
  toolCategory: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(56,189,248,0.12)",
    color: "#7dd3fc",
    fontSize: "13px",
    fontWeight: 700,
  },
  toolStatus: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 700,
  },
  toolName: {
    margin: 0,
    fontSize: "30px",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "-0.05em",
    color: "#f8fafc",
  },
  summary: {
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
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginTop: "22px",
    paddingTop: "18px",
    borderTop: "1px solid rgba(148,163,184,0.12)",
  },
  metric: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  metricLabel: {
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#94a3b8",
  },
  metricValue: {
    fontSize: "16px",
    fontWeight: 800,
    color: "#f8fafc",
  },
  action: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  note: {
    marginTop: "20px",
    fontSize: "13px",
    lineHeight: 1.8,
    color: "#94a3b8",
  },
};

const homeCss = `
  .tools-hero {
    position: relative;
  }

  .tool-card--active:hover {
    transform: translateY(-4px);
    border-color: rgba(125, 211, 252, 0.36) !important;
    box-shadow: 0 30px 90px rgba(2, 132, 199, 0.16), 0 24px 72px rgba(0, 0, 0, 0.3) !important;
  }

  .tool-card--active:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 3px;
  }

  @media (max-width: 920px) {
    .tools-hero {
      grid-template-columns: 1fr;
    }
  }
`;

export default function ToolsHomePage({ cutoutHref, backgroundReplaceHref, imageSplitHref }) {
  const sections = buildSections(cutoutHref, backgroundReplaceHref, imageSplitHref);
  const totalCount = sections.flatMap((section) => section.tools).length;
  const readyCount = countToolsByState(sections, "active");
  const plannedCount = countToolsByState(sections, "planned");

  return (
    <div style={styles.page}>
      <style>{homeCss}</style>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <div style={styles.brand}>
            <span style={styles.dot} />
            Tool Shelf
          </div>
          <div style={styles.miniNote}>首页现在已经扩成多工具卡片布局，后续接工具只需要补路由和页面即可。</div>
        </div>

        <section className="tools-hero" style={styles.hero}>
          <div style={styles.heroCard}>
            <div style={styles.heroEyebrow}>Browser First</div>
            <h1 style={styles.title}>工具集</h1>
            <p style={styles.subtitle}>
              这里作为所有小工具的统一入口。当前“抠图”“背景替换”和“图片拆分”已经接入可用，其他卡片先按工具矩阵的方式排开，后续可以逐个落成真实页面。
            </p>
            <div style={styles.heroFooter}>
              <div style={styles.heroChip}>
                <span style={styles.chipValue}>{totalCount}</span>
                工具卡片
              </div>
              <div style={styles.heroChip}>
                <span style={styles.chipValue}>{readyCount}</span>
                已接入
              </div>
              <div style={styles.heroChip}>
                <span style={styles.chipValue}>{plannedCount}</span>
                规划中
              </div>
            </div>
          </div>

          <aside style={styles.sideCard}>
            <p style={styles.sideTitle}>当前焦点</p>
            <div style={styles.sideBig}>三工具</div>
            <p style={styles.sideText}>
              现在已经有“抠图”“背景替换”和“图片拆分”三个真实工具。其余卡片继续作为后续扩展占位，方便按同一套结构逐个接入。
            </p>
          </aside>
        </section>

        <div style={styles.laneGrid}>
          {sections.map((section) => (
            <section key={section.key} style={styles.laneCard}>
              <div style={styles.laneHead}>
                <div>
                  <div style={styles.laneEyebrow}>{section.eyebrow}</div>
                  <h2 style={styles.laneTitle}>{section.title}</h2>
                  <p style={styles.laneText}>{section.description}</p>
                </div>
                <div style={styles.laneCount}>{section.tools.length} 张卡片</div>
              </div>

              <div style={styles.toolGrid}>
                {section.tools.map((tool) => {
                  const cardStyle = getCardStyle(tool);
                  const statusColor = tool.state === "active" ? "#86efac" : "#fbbf24";

                  if (tool.href) {
                    return (
                      <a
                        key={tool.key}
                        href={tool.href}
                        className="tool-card--active"
                        style={{ ...styles.toolCard, ...cardStyle }}
                      >
                        <div style={styles.toolMeta}>
                          <span style={styles.toolCategory}>{tool.category}</span>
                          <span style={{ ...styles.toolStatus, color: statusColor }}>{tool.status}</span>
                        </div>
                        <h3 style={styles.toolName}>{tool.name}</h3>
                        <p style={styles.summary}>{tool.summary}</p>
                        <div style={styles.featureList}>
                          {tool.features.map((feature) => (
                            <span key={feature} style={styles.feature}>
                              {feature}
                            </span>
                          ))}
                        </div>
                        <div style={styles.footer}>
                          <div style={styles.metric}>
                            <span style={styles.metricLabel}>{tool.metricLabel}</span>
                            <span style={styles.metricValue}>{tool.metricValue}</span>
                          </div>
                          <span style={styles.action}>进入工具</span>
                        </div>
                      </a>
                    );
                  }

                  return (
                    <article
                      key={tool.key}
                      aria-disabled="true"
                      className="tool-card--planned"
                      style={{ ...styles.toolCard, ...styles.plannedCard, ...cardStyle }}
                    >
                      <div style={styles.toolMeta}>
                        <span style={styles.toolCategory}>{tool.category}</span>
                        <span style={{ ...styles.toolStatus, color: statusColor }}>{tool.status}</span>
                      </div>
                      <h3 style={styles.toolName}>{tool.name}</h3>
                      <p style={styles.summary}>{tool.summary}</p>
                      <div style={styles.featureList}>
                        {tool.features.map((feature) => (
                          <span key={feature} style={styles.feature}>
                            {feature}
                          </span>
                        ))}
                      </div>
                      <div style={styles.footer}>
                        <div style={styles.metric}>
                          <span style={styles.metricLabel}>{tool.metricLabel}</span>
                          <span style={styles.metricValue}>{tool.metricValue}</span>
                        </div>
                        <span style={{ ...styles.action, color: "#94a3b8" }}>即将上线</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div style={styles.note}>后续如果你要继续加工具，我可以直接把规划中的某一张卡片接成真实页面并挂到当前首页结构里。</div>
      </div>
    </div>
  );
}
