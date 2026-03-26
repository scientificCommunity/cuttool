import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import ImageToolWorkspace from "../components/ImageToolWorkspace.jsx";
import {
  EditModeSelector,
  SelfTestCard,
  StatusCard,
} from "../components/ImageToolPanels.jsx";
import { sharedToolPageStyles } from "../components/imageToolWorkspaceStyles.js";
import {
  buildAutoMask,
  checkerboardStyle,
  clamp,
  createOpaqueMask,
  decodeImageFromFile,
  getSafeImageData,
  isValidImageDataLike,
  renderCompositeToCanvas,
  runInternalTests,
} from "../lib/cutoutCore.js";

const SOLID_SWATCHS = ["#ffffff", "#f8fafc", "#e2e8f0", "#dbeafe", "#fef3c7", "#0f172a"];

const GRADIENT_PRESETS = [
  {
    id: "studio",
    label: "棚拍灰",
    angle: 140,
    stops: ["#f8fafc", "#e2e8f0", "#cbd5e1"],
  },
  {
    id: "sky",
    label: "晴空",
    angle: 130,
    stops: ["#dbeafe", "#93c5fd", "#38bdf8"],
  },
  {
    id: "peach",
    label: "暖肤",
    angle: 135,
    stops: ["#fff7ed", "#fdba74", "#fb7185"],
  },
  {
    id: "mint",
    label: "薄荷",
    angle: 120,
    stops: ["#ecfeff", "#a7f3d0", "#34d399"],
  },
  {
    id: "night",
    label: "深空",
    angle: 145,
    stops: ["#0f172a", "#1d4ed8", "#38bdf8"],
  },
  {
    id: "candy",
    label: "糖霜",
    angle: 125,
    stops: ["#fdf2f8", "#f9a8d4", "#c084fc"],
  },
];

function getGradientPreset(gradientId) {
  return GRADIENT_PRESETS.find((preset) => preset.id === gradientId) || GRADIENT_PRESETS[0];
}

const styles = {
  ...sharedToolPageStyles,
  backgroundGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  solidPanel: {
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    background: "#020617",
  },
  colorRow: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  colorInput: {
    width: "54px",
    height: "42px",
    padding: 0,
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "#020617",
    cursor: "pointer",
  },
  colorText: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #334155",
    background: "rgba(15,23,42,0.8)",
    color: "#e2e8f0",
    fontSize: "13px",
  },
  swatchRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "14px",
  },
  swatch: {
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    border: "2px solid rgba(255,255,255,0.2)",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
  },
  gradientGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  gradientButton: {
    padding: "10px",
    borderRadius: "16px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    cursor: "pointer",
    textAlign: "left",
  },
  gradientPreview: {
    height: "44px",
    borderRadius: "12px",
    marginBottom: "8px",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  primaryButton: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid transparent",
    background: "#34d399",
    color: "#082f49",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  infoButton: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid transparent",
    background: "#38bdf8",
    color: "#082f49",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "12px 14px",
    borderRadius: "16px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  infoCard: {
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    background: "#020617",
  },
  infoTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "6px",
  },
  infoBody: {
    fontSize: "14px",
    lineHeight: 1.6,
    color: "#cbd5e1",
  },
  testItem: {
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid #1e293b",
    background: "rgba(15,23,42,0.72)",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  testDetails: {
    marginTop: "6px",
    color: "#94a3b8",
  },
  passText: {
    color: "#86efac",
    fontWeight: 700,
  },
  failText: {
    color: "#fda4af",
    fontWeight: 700,
  },
  canvasCard: {
    borderRadius: "24px",
    border: "1px solid #1e293b",
    background: "rgba(15,23,42,0.88)",
    padding: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.32)",
  },
  canvasTitle: {
    marginBottom: "12px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#e2e8f0",
  },
  canvasScrollerDark: {
    overflow: "auto",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "#020617",
    padding: "12px",
  },
  canvasScrollerPreview: {
    overflow: "auto",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "#0f172a",
    padding: "12px",
  },
  canvasElement: {
    display: "block",
    margin: "0 auto",
    maxWidth: "100%",
    maxHeight: "70vh",
    borderRadius: "12px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
  },
  previewBanner: {
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.9)",
    border: "1px solid #334155",
    fontSize: "12px",
    color: "#cbd5e1",
  },
  previewDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "#38bdf8",
  },
};

export default function BackgroundReplaceToolPage({ homeHref }) {
  const sourceCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const scratchCanvasRef = useRef(null);
  const sourceImageDataRef = useRef(null);
  const maskRef = useRef(null);
  const historyRef = useRef([]);
  const drawingRef = useRef(false);
  const backgroundImageRef = useRef(null);

  const [imgMeta, setImgMeta] = useState(null);
  const [threshold, setThreshold] = useState(42);
  const [brushSize, setBrushSize] = useState(26);
  const [mode, setMode] = useState("erase");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("上传主体图片后，先自动去底，再选择新背景。");
  const [hasImage, setHasImage] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [backgroundType, setBackgroundType] = useState("solid");
  const [solidColor, setSolidColor] = useState("#f8fafc");
  const [gradientId, setGradientId] = useState(GRADIENT_PRESETS[0].id);
  const [backgroundImageMeta, setBackgroundImageMeta] = useState(null);
  const [testResults] = useState(() => runInternalTests());

  const checkerboard = useMemo(() => checkerboardStyle(), []);
  const selectedGradient = getGradientPreset(gradientId);

  const clearCanvas = (canvas) => {
    if (!canvas) {
      return;
    }

    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, 1, 1);
  };

  const clearLoadedState = () => {
    sourceImageDataRef.current = null;
    maskRef.current = null;
    historyRef.current = [];
    setImgMeta(null);
    setHasImage(false);
    clearCanvas(sourceCanvasRef.current);
    clearCanvas(resultCanvasRef.current);
  };

  const renderResult = useCallback(() => {
    const src = sourceImageDataRef.current;
    const mask = maskRef.current;
    const canvas = resultCanvasRef.current;
    if (!isValidImageDataLike(src) || !mask || !canvas) {
      return;
    }

    const background =
      backgroundType === "image" && backgroundImageRef.current
        ? {
            type: "image",
            asset: backgroundImageRef.current,
          }
        : backgroundType === "gradient"
          ? {
              type: "gradient",
              angle: selectedGradient.angle,
              stops: selectedGradient.stops,
            }
          : {
              type: "solid",
              color: solidColor,
            };

    const nextScratch = renderCompositeToCanvas({
      canvas,
      scratchCanvas: scratchCanvasRef.current,
      sourceImageData: src,
      mask,
      background,
    });

    if (nextScratch) {
      scratchCanvasRef.current = nextScratch;
    }
  }, [backgroundType, selectedGradient, solidColor]);

  const replaceBackgroundImage = async (file) => {
    if (!file) {
      return;
    }

    setBusy(true);
    setStatus("正在读取背景图…");

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("请选择背景图片文件");
      }

      backgroundImageRef.current?.close?.();
      backgroundImageRef.current = await decodeImageFromFile(file);
      setBackgroundImageMeta({
        name: file.name,
        width: backgroundImageRef.current.width,
        height: backgroundImageRef.current.height,
      });
      setBackgroundType("image");
      renderResult();
      setStatus("背景图已载入。现在结果预览会按新背景重新合成。");
    } catch (error) {
      console.error(error);
      backgroundImageRef.current = null;
      setBackgroundImageMeta(null);
      setStatus(`背景图载入失败：${error instanceof Error ? error.message : "请换一张再试"}`);
    } finally {
      setBusy(false);
    }
  };

  const loadImage = async (file) => {
    if (!file) {
      return;
    }

    setBusy(true);
    setStatus("正在读取主体图片…");

    try {
      clearLoadedState();

      if (!file.type.startsWith("image/")) {
        throw new Error("请选择图片文件");
      }

      const decoded = await decodeImageFromFile(file);
      const maxSide = 1200;
      const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));

      const sourceCanvas = sourceCanvasRef.current;
      if (!sourceCanvas) {
        throw new Error("源画布未初始化");
      }

      sourceCanvas.width = width;
      sourceCanvas.height = height;
      const sctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
      if (!sctx) {
        throw new Error("无法获取画布上下文");
      }

      sctx.clearRect(0, 0, width, height);
      decoded.draw(sctx, width, height);
      decoded.close?.();

      const imageData = getSafeImageData(sctx, width, height);
      sourceImageDataRef.current = imageData;
      maskRef.current = createOpaqueMask(width, height);
      historyRef.current = [];

      renderResult();
      setImgMeta({ width, height, name: file.name });
      setHasImage(true);
      setStatus("主体图片已载入。先试试“自动去底”，再选择背景样式。");
    } catch (error) {
      console.error(error);
      clearLoadedState();
      setStatus(`图片载入失败：${error instanceof Error ? error.message : "请换一张再试"}`);
    } finally {
      setBusy(false);
    }
  };

  const autoCutout = async () => {
    const src = sourceImageDataRef.current;
    if (!isValidImageDataLike(src)) {
      setStatus("当前没有可处理的图片，请先上传。");
      return;
    }

    setBusy(true);
    setStatus("正在自动去底…");
    await new Promise((resolve) => setTimeout(resolve, 20));

    try {
      historyRef.current.push(maskRef.current ? new Uint8ClampedArray(maskRef.current) : null);
      historyRef.current = historyRef.current.slice(-10);
      maskRef.current = buildAutoMask(src, threshold);
      renderResult();
      setStatus("自动去底完成。现在可以继续修边，并实时预览替换背景后的效果。");
    } catch (error) {
      console.error(error);
      setStatus(`自动去底失败：${error instanceof Error ? error.message : "请调一下阈值后重试"}`);
    } finally {
      setBusy(false);
    }
  };

  const resetMask = () => {
    const src = sourceImageDataRef.current;
    if (!isValidImageDataLike(src)) {
      return;
    }

    maskRef.current = createOpaqueMask(src.width, src.height);
    historyRef.current = [];
    renderResult();
    setStatus("已重置为原图主体。现在可以重新自动去底，或继续换背景。");
  };

  const saveHistory = () => {
    if (!maskRef.current) {
      return;
    }

    historyRef.current.push(new Uint8ClampedArray(maskRef.current));
    historyRef.current = historyRef.current.slice(-10);
  };

  const undo = () => {
    if (!historyRef.current.length) {
      return;
    }

    const prev = historyRef.current.pop();
    if (!prev) {
      return;
    }

    maskRef.current = prev;
    renderResult();
    setStatus("已撤销一步。");
  };

  const paintAt = (clientX, clientY) => {
    const canvas = resultCanvasRef.current;
    const mask = maskRef.current;
    const src = sourceImageDataRef.current;
    if (!canvas || !mask || !isValidImageDataLike(src)) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const x = ((clientX - rect.left) / rect.width) * src.width;
    const y = ((clientY - rect.top) / rect.height) * src.height;
    const radius = brushSize / 2;
    const left = clamp(Math.floor(x - radius), 0, src.width - 1);
    const right = clamp(Math.ceil(x + radius), 0, src.width - 1);
    const top = clamp(Math.floor(y - radius), 0, src.height - 1);
    const bottom = clamp(Math.ceil(y + radius), 0, src.height - 1);
    const radiusSq = radius * radius;
    const value = mode === "erase" ? 0 : 255;

    for (let yy = top; yy <= bottom; yy += 1) {
      for (let xx = left; xx <= right; xx += 1) {
        const dx = xx - x;
        const dy = yy - y;
        if (dx * dx + dy * dy <= radiusSq) {
          mask[yy * src.width + xx] = value;
        }
      }
    }

    renderResult();
  };

  const onPointerDown = (event) => {
    if (!hasImage) {
      return;
    }

    if (mode !== "erase" && mode !== "restore") {
      return;
    }

    drawingRef.current = true;
    saveHistory();
    paintAt(event.clientX, event.clientY);
  };

  const onPointerMove = (event) => {
    if (!drawingRef.current) {
      return;
    }

    paintAt(event.clientX, event.clientY);
  };

  const finishDrawing = useEffectEvent(() => {
    if (!drawingRef.current) {
      return;
    }

    drawingRef.current = false;
    setStatus(mode === "erase" ? "已擦除一部分背景边缘。" : "已恢复一部分主体。");
  });

  const exportComposite = () => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !hasImage) {
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("导出失败：浏览器没有生成图片数据。");
        return;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(imgMeta?.name || "background-replace").replace(/\.[^.]+$/, "")}-background.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("替换背景后的 PNG 已导出。");
    }, "image/png");
  };

  useEffect(() => {
    renderResult();
  }, [backgroundImageMeta, renderResult]);

  useEffect(() => {
    const handlePointerUp = () => finishDrawing();
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  useEffect(() => () => {
    backgroundImageRef.current?.close?.();
  }, []);

  const previewBanner =
    backgroundType === "solid"
      ? `纯色背景 ${solidColor.toUpperCase()}`
      : backgroundType === "gradient"
        ? `渐变背景 · ${selectedGradient.label}`
        : backgroundImageMeta
          ? `背景图 · ${backgroundImageMeta.name}`
          : "背景图模式 · 尚未上传";

  return (
    <ImageToolWorkspace
      homeHref={homeHref}
      topHint="当前工具：背景替换"
      title="背景替换"
      subtitle="先在浏览器本地完成主体抠出，再把主体合成到纯色、渐变或自定义背景图上。适合商品图、头像和简单物料场景。"
      metaText={imgMeta ? `${imgMeta.name} · ${imgMeta.width} × ${imgMeta.height}` : "还没有载入主体图片"}
      shellMaxWidth="1480px"
      layoutColumns="360px minmax(0, 1fr)"
      canvasColumns="minmax(0, 0.95fr) minmax(0, 1.2fr)"
      sidebar={
        <>
          <div>
            <label style={styles.label}>主体图片</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => loadImage(event.target.files?.[0])}
              disabled={busy}
              style={styles.fileInput}
            />
            <div style={styles.mutedTip}>先上传主体图，结果会按当前背景设置实时重绘。</div>
          </div>

          <div>
            <div style={styles.rowBetween}>
              <span style={styles.labelInline}>自动去底阈值</span>
              <span style={styles.value}>{threshold}</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={threshold}
              onChange={(event) => setThreshold(Number(event.target.value))}
              disabled={!hasImage || busy}
              style={styles.range}
            />
            <div style={styles.mutedTip}>背景和主体颜色接近时，适当调小；背景较纯净时，适当调大。</div>
          </div>

          <div>
            <div style={styles.rowBetween}>
              <span style={styles.labelInline}>画笔大小</span>
              <span style={styles.value}>{brushSize}px</span>
            </div>
            <input
              type="range"
              min="6"
              max="80"
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
              disabled={!hasImage || busy}
              style={styles.range}
            />
          </div>

          <EditModeSelector
            mode={mode}
            disabled={!hasImage || busy}
            onChange={setMode}
          />

          <div>
            <div style={styles.label}>背景模式</div>
            <div style={styles.backgroundGrid}>
              {[
                ["solid", "纯色"],
                ["gradient", "渐变"],
                ["image", "背景图"],
              ].map(([value, label]) => {
                const active = backgroundType === value;
                return (
                  <button
                    key={value}
                    onClick={() => setBackgroundType(value)}
                    disabled={busy}
                    style={{
                      ...styles.modeButton,
                      ...(active ? styles.modeButtonActive : styles.modeButtonIdle),
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {backgroundType === "solid" ? (
            <div style={styles.solidPanel}>
              <div style={styles.label}>纯色背景</div>
              <div style={styles.colorRow}>
                <input
                  type="color"
                  value={solidColor}
                  onChange={(event) => setSolidColor(event.target.value)}
                  style={styles.colorInput}
                />
                <div style={styles.colorText}>{solidColor.toUpperCase()}</div>
              </div>
              <div style={styles.swatchRow}>
                {SOLID_SWATCHS.map((color) => (
                  <button
                    key={color}
                    aria-label={color}
                    onClick={() => setSolidColor(color)}
                    style={{
                      ...styles.swatch,
                      background: color,
                      boxShadow: solidColor === color ? "0 0 0 2px #38bdf8, 0 4px 12px rgba(0,0,0,0.18)" : styles.swatch.boxShadow,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {backgroundType === "gradient" ? (
            <div>
              <div style={styles.label}>渐变预设</div>
              <div style={styles.gradientGrid}>
                {GRADIENT_PRESETS.map((preset) => {
                  const active = preset.id === gradientId;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setGradientId(preset.id)}
                      style={{
                        ...styles.gradientButton,
                        borderColor: active ? "#38bdf8" : "#334155",
                        boxShadow: active ? "0 0 0 1px rgba(56,189,248,0.28)" : "none",
                      }}
                    >
                      <div
                        style={{
                          ...styles.gradientPreview,
                          background: `linear-gradient(${preset.angle}deg, ${preset.stops.join(", ")})`,
                        }}
                      />
                      <div>{preset.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {backgroundType === "image" ? (
            <div>
              <label style={styles.label}>背景图片</label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => replaceBackgroundImage(event.target.files?.[0])}
                disabled={busy}
                style={styles.fileInput}
              />
              <div style={styles.mutedTip}>
                {backgroundImageMeta
                  ? `${backgroundImageMeta.name} · ${backgroundImageMeta.width} × ${backgroundImageMeta.height}`
                  : "上传一张背景图，结果会自动按 cover 方式铺满画布。"}
              </div>
            </div>
          ) : null}

          <div style={styles.buttonGrid}>
            <button
              onClick={autoCutout}
              disabled={!hasImage || busy}
              style={{
                ...styles.primaryButton,
                ...(busy || !hasImage ? styles.buttonDisabled : null),
              }}
            >
              {busy ? "处理中..." : "自动去底"}
            </button>
            <button
              onClick={resetMask}
              disabled={!hasImage || busy}
              style={{
                ...styles.secondaryButton,
                ...(busy || !hasImage ? styles.buttonDisabled : null),
              }}
            >
              重置
            </button>
            <button
              onClick={undo}
              disabled={!hasImage || busy}
              style={{
                ...styles.secondaryButton,
                ...(busy || !hasImage ? styles.buttonDisabled : null),
              }}
            >
              撤销
            </button>
            <button
              onClick={exportComposite}
              disabled={!hasImage || busy}
              style={{
                ...styles.infoButton,
                ...(busy || !hasImage ? styles.buttonDisabled : null),
              }}
            >
              导出结果
            </button>
          </div>

          <button
            onClick={() => setShowOriginal((value) => !value)}
            disabled={!hasImage}
            style={{
              ...styles.secondaryButton,
              width: "100%",
              ...(hasImage ? null : styles.buttonDisabled),
            }}
          >
            {showOriginal ? "隐藏原图面板" : "显示原图面板"}
          </button>

          <StatusCard body={status} />
          <SelfTestCard tests={testResults} />
        </>
      }
    >
      {showOriginal ? (
        <div style={styles.canvasCard}>
          <div style={styles.canvasTitle}>原图</div>
          <div style={{ ...styles.canvasScrollerDark, ...checkerboard }}>
            <canvas ref={sourceCanvasRef} style={styles.canvasElement} />
          </div>
        </div>
      ) : (
        <canvas ref={sourceCanvasRef} style={{ display: "none" }} />
      )}

      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>结果（替换背景后预览）</div>
          <div style={styles.previewBanner}>
            <span style={styles.previewDot} />
            {previewBanner}
          </div>
        </div>
        <div style={styles.canvasScrollerPreview}>
          <canvas
            ref={resultCanvasRef}
            style={{
              ...styles.canvasElement,
              cursor: mode === "view" ? "default" : "crosshair",
              touchAction: "none",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          />
        </div>
        <div style={styles.mutedTip}>
          小提示：这页是“抠图 + 背景合成”的组合工具。主体边缘效果仍然取决于自动去底结果和手动修边质量。
        </div>
      </div>
    </ImageToolWorkspace>
  );
}
