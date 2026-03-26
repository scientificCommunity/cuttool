const workspaceStyles = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#e2e8f0",
    padding: "24px",
    boxSizing: "border-box",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shell: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "18px",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 16px",
    borderRadius: "999px",
    border: "1px solid #1e293b",
    background: "rgba(15,23,42,0.78)",
    color: "#e2e8f0",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
  },
  topHint: {
    fontSize: "13px",
    color: "#94a3b8",
  },
  headerRow: {
    display: "flex",
    gap: "16px",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: "24px",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.15,
    fontWeight: 700,
    color: "#f8fafc",
  },
  subtitle: {
    margin: "12px 0 0",
    maxWidth: "860px",
    fontSize: "14px",
    lineHeight: 1.7,
    color: "#cbd5e1",
  },
  metaCard: {
    padding: "14px 16px",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "rgba(15,23,42,0.78)",
    color: "#cbd5e1",
    fontSize: "14px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  sidebarCard: {
    borderRadius: "24px",
    border: "1px solid #1e293b",
    background: "rgba(15,23,42,0.88)",
    padding: "20px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.32)",
  },
  stackLarge: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
};

const workspaceCss = `
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; }
  body { background: #020617; }
  button, input { font: inherit; }

  .tool-workspace-layout {
    display: grid;
    grid-template-columns: var(--tool-layout-columns);
    gap: 24px;
    align-items: start;
  }

  .tool-workspace-canvases {
    display: grid;
    grid-template-columns: var(--tool-canvas-columns);
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 1180px) {
    .tool-workspace-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 980px) {
    .tool-workspace-canvases {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    input[type="file"] {
      font-size: 13px;
    }
  }
`;

export default function ImageToolWorkspace({
  homeHref,
  topHint,
  title,
  subtitle,
  metaText,
  shellMaxWidth = "1440px",
  layoutColumns = "340px minmax(0, 1fr)",
  canvasColumns = "minmax(0, 1fr) minmax(0, 1.15fr)",
  sidebar,
  children,
}) {
  return (
    <div style={workspaceStyles.page}>
      <style>{workspaceCss}</style>
      <div style={{ ...workspaceStyles.shell, maxWidth: shellMaxWidth }}>
        <div style={workspaceStyles.topRow}>
          <a href={homeHref} style={workspaceStyles.backLink}>
            返回工具集
          </a>
          <div style={workspaceStyles.topHint}>{topHint}</div>
        </div>

        <div style={workspaceStyles.headerRow}>
          <div>
            <h1 style={workspaceStyles.title}>{title}</h1>
            <p style={workspaceStyles.subtitle}>{subtitle}</p>
          </div>
          <div style={workspaceStyles.metaCard}>{metaText}</div>
        </div>

        <div
          className="tool-workspace-layout"
          style={{ "--tool-layout-columns": layoutColumns }}
        >
          <div style={workspaceStyles.sidebarCard}>
            <div style={workspaceStyles.stackLarge}>{sidebar}</div>
          </div>
          <div
            className="tool-workspace-canvases"
            style={{ "--tool-canvas-columns": canvasColumns }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
