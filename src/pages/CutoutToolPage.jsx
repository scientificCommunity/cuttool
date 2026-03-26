import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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
  renderMaskedImageToCanvas,
  runInternalTests,
} from "../lib/cutoutCore.js";

const styles = sharedToolPageStyles;

export default function CutoutToolPage({ homeHref }) {
  const sourceCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const scratchCanvasRef = useRef(null);
  const sourceImageDataRef = useRef(null);
  const maskRef = useRef(null);
  const historyRef = useRef([]);
  const drawingRef = useRef(false);

  const [imgMeta, setImgMeta] = useState(null);
  const [threshold, setThreshold] = useState(42);
  const [brushSize, setBrushSize] = useState(26);
  const [mode, setMode] = useState("erase");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("上传一张图片后，先点“自动去底”，再用画笔修边。");
  const [hasImage, setHasImage] = useState(false);
  const [showOriginal, setShowOriginal] = useState(true);
  const [testResults] = useState(() => runInternalTests());

  const board = useMemo(() => checkerboardStyle(), []);

  const clearLoadedState = () => {
    sourceImageDataRef.current = null;
    maskRef.current = null;
    historyRef.current = [];
    scratchCanvasRef.current = null;
    setImgMeta(null);
    setHasImage(false);

    const sourceCanvas = sourceCanvasRef.current;
    const resultCanvas = resultCanvasRef.current;
    if (sourceCanvas) {
      sourceCanvas.width = 1;
      sourceCanvas.height = 1;
      const ctx = sourceCanvas.getContext("2d");
      ctx?.clearRect(0, 0, 1, 1);
    }

    if (resultCanvas) {
      resultCanvas.width = 1;
      resultCanvas.height = 1;
      const ctx = resultCanvas.getContext("2d");
      ctx?.clearRect(0, 0, 1, 1);
    }
  };

  const renderResult = () => {
    const src = sourceImageDataRef.current;
    const mask = maskRef.current;
    const canvas = resultCanvasRef.current;
    if (!isValidImageDataLike(src) || !mask || !canvas) {
      return;
    }

    const nextScratch = renderMaskedImageToCanvas({
      canvas,
      scratchCanvas: scratchCanvasRef.current,
      sourceImageData: src,
      mask,
    });

    if (nextScratch) {
      scratchCanvasRef.current = nextScratch;
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
    setStatus("已重置为原图。现在可以重新自动去底，或直接手动修边。");
  };

  const loadImage = async (file) => {
    if (!file) {
      return;
    }

    setBusy(true);
    setStatus("正在读取图片…");

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
      setStatus("图片已载入。先试试“自动去底”，背景越干净，效果越好。");
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
      setStatus("自动去底完成。头发、阴影、复杂背景可以用“擦除 / 恢复”画笔修边。");
    } catch (error) {
      console.error(error);
      setStatus(`自动去底失败：${error instanceof Error ? error.message : "请调一下阈值后重试"}`);
    } finally {
      setBusy(false);
    }
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
    setStatus(mode === "erase" ? "已擦除一部分背景。" : "已恢复一部分主体。");
  });

  const exportPng = () => {
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
      anchor.download = `${(imgMeta?.name || "cutout").replace(/\.[^.]+$/, "")}-cutout.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("透明 PNG 已导出。");
    }, "image/png");
  };

  useEffect(() => {
    const handlePointerUp = () => finishDrawing();
    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  return (
    <ImageToolWorkspace
      homeHref={homeHref}
      topHint="当前工具：抠图"
      title="抠图"
      subtitle="全部在浏览器本地处理，不上传服务器。当前这版先用“边缘背景识别 + 手动修边”的方式，适合白底、纯色底、拍摄背景较干净的图片。"
      metaText={imgMeta ? `${imgMeta.name} · ${imgMeta.width} × ${imgMeta.height}` : "还没有载入图片"}
      layoutColumns="340px minmax(0, 1fr)"
      canvasColumns="minmax(0, 1fr) minmax(0, 1.15fr)"
      sidebar={
        <>
          <div>
            <label style={styles.label}>选择图片</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => loadImage(event.target.files?.[0])}
              disabled={busy}
              style={styles.fileInput}
            />
            <div style={styles.mutedTip}>现在会优先走 createImageBitmap，失败后自动回退到 Image 对象解码。</div>
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
              onClick={exportPng}
              disabled={!hasImage || busy}
              style={{
                ...styles.infoButton,
                ...(busy || !hasImage ? styles.buttonDisabled : null),
              }}
            >
              导出 PNG
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
          <div style={styles.canvasScrollerDark}>
            <canvas ref={sourceCanvasRef} style={styles.canvasElement} />
          </div>
        </div>
      ) : (
        <canvas ref={sourceCanvasRef} style={{ display: "none" }} />
      )}

      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>结果（透明底预览）</div>
          <div style={styles.smallMuted}>
            {mode === "erase" ? "拖动画笔擦掉多余背景" : mode === "restore" ? "拖动画笔恢复主体" : "查看模式"}
          </div>
        </div>
        <div style={{ ...styles.canvasScroller, ...board }}>
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
        <div style={styles.mutedTip}>小提示：白底商品图、证件照、LOGO 图会比较稳；头发丝、半透明婚纱、复杂环境光背景，这版还需要更多模型能力。</div>
      </div>
    </ImageToolWorkspace>
  );
}
