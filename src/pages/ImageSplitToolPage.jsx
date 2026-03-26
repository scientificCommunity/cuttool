import { useEffect, useMemo, useRef, useState } from "react";
import ImageToolWorkspace from "../components/ImageToolWorkspace.jsx";
import { SelfTestCard, StatusCard } from "../components/ImageToolPanels.jsx";
import { sharedToolPageStyles } from "../components/imageToolWorkspaceStyles.js";
import { decodeImageFromFile } from "../lib/cutoutCore.js";
import {
  MAX_SPLIT_COUNT,
  buildSplitPieces,
  createPieceDownloadName,
  normalizeSplitCount,
  runImageSplitTests,
} from "../lib/imageSplitCore.js";

const SPLIT_PRESETS = [
  { label: "2 × 2", rows: 2, columns: 2 },
  { label: "3 × 3", rows: 3, columns: 3 },
  { label: "4 × 4", rows: 4, columns: 4 },
  { label: "2 × 3", rows: 2, columns: 3 },
  { label: "3 × 4", rows: 3, columns: 4 },
];

const MAX_TILE_PREVIEWS = 240;

const styles = {
  ...sharedToolPageStyles,
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  numberCard: {
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    background: "#020617",
  },
  numberInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #334155",
    background: "rgba(15,23,42,0.82)",
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: 700,
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  presetButton: {
    padding: "10px 12px",
    borderRadius: "14px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  sourceBanner: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.9)",
    border: "1px solid #334155",
    fontSize: "12px",
    color: "#cbd5e1",
  },
  sourceDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#38bdf8",
    boxShadow: "0 0 16px rgba(56,189,248,0.45)",
  },
  previewScroller: {
    overflow: "auto",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "#020617",
    padding: "12px",
  },
  placeholder: {
    minHeight: "320px",
    display: "grid",
    placeItems: "center",
    borderRadius: "16px",
    border: "1px dashed #334155",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.75), rgba(2,6,23,0.92))",
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: 1.8,
    textAlign: "center",
    padding: "28px",
  },
  tileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  tileCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "rgba(2,6,23,0.88)",
  },
  tileHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "12px",
  },
  tileTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  tileMeta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#94a3b8",
  },
  tileCanvasWrap: {
    minHeight: "150px",
    display: "grid",
    placeItems: "center",
    padding: "12px",
    borderRadius: "14px",
    border: "1px solid #1e293b",
    background: "#0f172a",
    marginBottom: "12px",
  },
  tileCanvas: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "180px",
    borderRadius: "10px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.28)",
  },
  downloadButton: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "14px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
};

function clearCanvas(canvas) {
  if (!canvas) {
    return;
  }

  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx?.clearRect(0, 0, 1, 1);
}

function drawSourcePreview({ canvas, source, width, height, rowBoundaries, columnBoundaries }) {
  if (!canvas || !source || !width || !height) {
    clearCanvas(canvas);
    return;
  }

  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const previewWidth = Math.max(1, Math.round(width * scale));
  const previewHeight = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  canvas.width = previewWidth;
  canvas.height = previewHeight;
  ctx.clearRect(0, 0, previewWidth, previewHeight);
  ctx.drawImage(source, 0, 0, previewWidth, previewHeight);

  ctx.strokeStyle = "rgba(56,189,248,0.88)";
  ctx.fillStyle = "rgba(2,6,23,0.9)";
  ctx.lineWidth = Math.max(1.5, scale * 2);

  for (let index = 1; index < columnBoundaries.length - 1; index += 1) {
    const x = Math.round(columnBoundaries[index] * scale) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, previewHeight);
    ctx.stroke();
  }

  for (let index = 1; index < rowBoundaries.length - 1; index += 1) {
    const y = Math.round(rowBoundaries[index] * scale) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(previewWidth, y);
    ctx.stroke();
  }

  ctx.strokeRect(1, 1, Math.max(0, previewWidth - 2), Math.max(0, previewHeight - 2));

  const badgeText = `${rowBoundaries.length - 1} 行 × ${columnBoundaries.length - 1} 列`;
  ctx.font = "700 13px Inter, sans-serif";
  const badgeWidth = Math.ceil(ctx.measureText(badgeText).width + 20);
  ctx.fillRect(12, 12, badgeWidth, 30);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(badgeText, 22, 31);
}

function drawPiecePreview(canvas, source, piece) {
  if (!canvas || !source || !piece) {
    clearCanvas(canvas);
    return;
  }

  const maxSide = 180;
  const scale = Math.min(1, maxSide / Math.max(piece.width, piece.height));
  const drawWidth = Math.max(1, Math.round(piece.width * scale));
  const drawHeight = Math.max(1, Math.round(piece.height * scale));
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  canvas.width = drawWidth;
  canvas.height = drawHeight;
  ctx.clearRect(0, 0, drawWidth, drawHeight);
  ctx.drawImage(
    source,
    piece.x,
    piece.y,
    piece.width,
    piece.height,
    0,
    0,
    drawWidth,
    drawHeight,
  );
}

function createPieceBlob(source, piece) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = piece.width;
    canvas.height = piece.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("无法创建导出画布"));
      return;
    }

    ctx.drawImage(source, piece.x, piece.y, piece.width, piece.height, 0, 0, piece.width, piece.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("浏览器没有生成图片数据"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ImageSplitToolPage({ homeHref }) {
  const sourceCanvasRef = useRef(null);
  const decodedRef = useRef(null);
  const tileCanvasRefs = useRef(new Map());

  const [imgMeta, setImgMeta] = useState(null);
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [loading, setLoading] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [status, setStatus] = useState("上传一张图片后，设置行数和列数，就能把整张图切成多张 PNG。");
  const [testResults] = useState(() => runImageSplitTests());

  const splitResult = useMemo(() => {
    if (!imgMeta) {
      return null;
    }

    return buildSplitPieces(imgMeta.width, imgMeta.height, rows, columns);
  }, [columns, imgMeta, rows]);

  const splitSummary = useMemo(() => {
    if (!splitResult) {
      return "等待图片载入。切分时会按像素边界自动分配余数，避免出现空白缝或丢像素。";
    }

    const widths = splitResult.pieces.map((piece) => piece.width);
    const heights = splitResult.pieces.map((piece) => piece.height);
    const minWidth = Math.min(...widths);
    const maxWidth = Math.max(...widths);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const adjusted = splitResult.rows !== rows || splitResult.columns !== columns;
    const widthText = minWidth === maxWidth ? `${minWidth}px` : `${minWidth}-${maxWidth}px`;
    const heightText = minHeight === maxHeight ? `${minHeight}px` : `${minHeight}-${maxHeight}px`;

    return `${splitResult.rows} 行 × ${splitResult.columns} 列，共 ${splitResult.pieces.length} 张；单张宽度 ${widthText}，高度 ${heightText}${adjusted ? "；原图像素较小，已自动收敛到可切分上限。" : "。"}`;
  }, [columns, rows, splitResult]);

  const visiblePieces = useMemo(() => {
    if (!splitResult) {
      return [];
    }

    return splitResult.pieces.slice(0, MAX_TILE_PREVIEWS);
  }, [splitResult]);

  const hiddenPreviewCount = splitResult ? splitResult.pieces.length - visiblePieces.length : 0;

  useEffect(() => {
    if (!imgMeta || !splitResult) {
      clearCanvas(sourceCanvasRef.current);
      return;
    }

    drawSourcePreview({
      canvas: sourceCanvasRef.current,
      source: decodedRef.current?.source,
      width: imgMeta.width,
      height: imgMeta.height,
      rowBoundaries: splitResult.rowBoundaries,
      columnBoundaries: splitResult.columnBoundaries,
    });
  }, [imgMeta, splitResult]);

  useEffect(() => {
    if (!splitResult || !decodedRef.current?.source) {
      tileCanvasRefs.current.forEach((canvas) => clearCanvas(canvas));
      return;
    }

    const source = decodedRef.current.source;
    for (const piece of visiblePieces) {
      const canvas = tileCanvasRefs.current.get(piece.id);
      drawPiecePreview(canvas, source, piece);
    }
  }, [splitResult, visiblePieces]);

  useEffect(() => {
    if (!imgMeta || !splitResult) {
      return;
    }

    const adjusted = splitResult.rows !== rows || splitResult.columns !== columns;
    setStatus(
      adjusted
        ? `已按 ${splitResult.rows} 行 × ${splitResult.columns} 列预览，共 ${splitResult.pieces.length} 张；原图尺寸较小，行列数已自动收敛。`
        : `已按 ${splitResult.rows} 行 × ${splitResult.columns} 列切分，共 ${splitResult.pieces.length} 张，可逐张下载或批量导出。`,
    );
  }, [columns, imgMeta, rows, splitResult]);

  useEffect(() => () => {
    decodedRef.current?.close?.();
  }, []);

  const controlsDisabled = loading || exportingAll;
  const hasImage = Boolean(imgMeta && splitResult);

  const clearLoadedState = () => {
    decodedRef.current?.close?.();
    decodedRef.current = null;
    setImgMeta(null);
    clearCanvas(sourceCanvasRef.current);
  };

  const loadImage = async (file) => {
    if (!file) {
      return;
    }

    setLoading(true);
    setStatus("正在读取图片…");

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("请选择图片文件");
      }

      clearLoadedState();
      const decoded = await decodeImageFromFile(file);
      decodedRef.current = decoded;
      setImgMeta({
        name: file.name,
        width: decoded.width,
        height: decoded.height,
      });
    } catch (error) {
      console.error(error);
      clearLoadedState();
      setStatus(`图片载入失败：${error instanceof Error ? error.message : "请换一张再试"}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPiece = async (piece) => {
    const source = decodedRef.current?.source;
    if (!source || !imgMeta) {
      return;
    }

    try {
      const blob = await createPieceBlob(source, piece);
      triggerBlobDownload(blob, createPieceDownloadName(imgMeta.name, piece));
      setStatus(`已导出第 ${piece.row} 行第 ${piece.column} 列。`);
    } catch (error) {
      console.error(error);
      setStatus(`导出失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    }
  };

  const exportAllPieces = async () => {
    const source = decodedRef.current?.source;
    if (!source || !imgMeta || !splitResult) {
      return;
    }

    setExportingAll(true);
    setStatus(`准备导出 ${splitResult.pieces.length} 张 PNG。浏览器可能会请求批量下载权限。`);

    try {
      for (const piece of splitResult.pieces) {
        const blob = await createPieceBlob(source, piece);
        triggerBlobDownload(blob, createPieceDownloadName(imgMeta.name, piece));
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }

      setStatus(`已触发 ${splitResult.pieces.length} 张 PNG 下载。`);
    } catch (error) {
      console.error(error);
      setStatus(`批量导出失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    } finally {
      setExportingAll(false);
    }
  };

  const applyPreset = (nextRows, nextColumns) => {
    setRows(normalizeSplitCount(nextRows));
    setColumns(normalizeSplitCount(nextColumns));
  };

  const handleRowChange = (event) => {
    setRows(normalizeSplitCount(event.target.value));
  };

  const handleColumnChange = (event) => {
    setColumns(normalizeSplitCount(event.target.value));
  };

  return (
    <ImageToolWorkspace
      homeHref={homeHref}
      topHint="当前工具：图片拆分"
      title="图片拆分"
      subtitle="按行数和列数把一张图切成多张小图，适合九宫格素材、拼图切片和规则网格导出。全部处理都在浏览器本地完成。"
      metaText={imgMeta ? `${imgMeta.name} · ${imgMeta.width} × ${imgMeta.height}` : "还没有载入图片"}
      shellMaxWidth="1500px"
      layoutColumns="360px minmax(0, 1fr)"
      canvasColumns="minmax(0, 0.92fr) minmax(0, 1.18fr)"
      sidebar={
        <>
          <div>
            <label style={styles.label}>选择图片</label>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => loadImage(event.target.files?.[0])}
              disabled={controlsDisabled}
              style={styles.fileInput}
            />
            <div style={styles.mutedTip}>切分按原始像素边界处理，导出时不会沿用预览缩放尺寸。行数和列数最高支持 {MAX_SPLIT_COUNT}。</div>
          </div>

          <div style={styles.controlGrid}>
            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>行数</span>
                <span style={styles.value}>{rows}</span>
              </div>
              <input
                type="number"
                min="1"
                max={MAX_SPLIT_COUNT}
                value={rows}
                onChange={handleRowChange}
                disabled={controlsDisabled}
                style={styles.numberInput}
              />
            </div>

            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>列数</span>
                <span style={styles.value}>{columns}</span>
              </div>
              <input
                type="number"
                min="1"
                max={MAX_SPLIT_COUNT}
                value={columns}
                onChange={handleColumnChange}
                disabled={controlsDisabled}
                style={styles.numberInput}
              />
            </div>
          </div>

          <div>
            <div style={styles.label}>常用预设</div>
            <div style={styles.presetGrid}>
              {SPLIT_PRESETS.map((preset) => {
                const active = rows === preset.rows && columns === preset.columns;
                return (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset.rows, preset.columns)}
                    disabled={controlsDisabled}
                    style={{
                      ...styles.presetButton,
                      ...(active ? styles.modeButtonActive : styles.modeButtonIdle),
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={styles.buttonGrid}>
            <button
              onClick={exportAllPieces}
              disabled={!hasImage || controlsDisabled}
              style={{
                ...styles.primaryButton,
                ...(hasImage && !controlsDisabled ? null : styles.buttonDisabled),
              }}
            >
              {exportingAll ? "导出中..." : "导出全部 PNG"}
            </button>
            <button
              onClick={() => applyPreset(3, 3)}
              disabled={controlsDisabled}
              style={{
                ...styles.secondaryButton,
                ...(controlsDisabled ? styles.buttonDisabled : null),
              }}
            >
              恢复 3 × 3
            </button>
          </div>

          <StatusCard body={status} />
          <StatusCard title="切分结果" body={splitSummary} />
          <SelfTestCard tests={testResults} />
        </>
      }
    >
      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>原图切分预览</div>
          <div style={styles.sourceBanner}>
            <span style={styles.sourceDot} />
            {splitResult ? `${splitResult.rows} × ${splitResult.columns}` : "等待图片"}
          </div>
        </div>
        <div style={styles.previewScroller}>
          {hasImage ? (
            <canvas ref={sourceCanvasRef} style={styles.canvasElement} />
          ) : (
            <div style={styles.placeholder}>上传图片后，这里会显示带切割线的原图预览。</div>
          )}
        </div>
        <div style={styles.mutedTip}>切分边界按比例取整，保证整张图的像素被完整覆盖，不会出现缝隙。</div>
      </div>

      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>拆分结果</div>
          <div style={styles.smallMuted}>
            {splitResult
              ? hiddenPreviewCount > 0
                ? `预览 ${visiblePieces.length} / ${splitResult.pieces.length} 张`
                : `${splitResult.pieces.length} 张小图`
              : "尚未生成"}
          </div>
        </div>
        <div style={styles.previewScroller}>
          {hasImage ? (
            <div style={styles.tileGrid}>
              {visiblePieces.map((piece) => (
                <div key={piece.id} style={styles.tileCard}>
                  <div style={styles.tileHead}>
                    <div>
                      <div style={styles.tileTitle}>第 {piece.row} 行 · 第 {piece.column} 列</div>
                      <div style={styles.tileMeta}>
                        {piece.width} × {piece.height}px
                      </div>
                    </div>
                    <div style={styles.smallMuted}>#{piece.index}</div>
                  </div>
                  <div style={styles.tileCanvasWrap}>
                    <canvas
                      ref={(node) => {
                        if (node) {
                          tileCanvasRefs.current.set(piece.id, node);
                        } else {
                          tileCanvasRefs.current.delete(piece.id);
                        }
                      }}
                      style={styles.tileCanvas}
                    />
                  </div>
                  <button onClick={() => downloadPiece(piece)} style={styles.downloadButton}>
                    下载这张
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.placeholder}>设置行数和列数后，右侧会生成所有切片预览和下载入口。</div>
          )}
        </div>
        <div style={styles.mutedTip}>
          {hiddenPreviewCount > 0
            ? `当前只渲染前 ${visiblePieces.length} 张预览，避免大规模切分时页面卡顿；批量导出仍会覆盖全部 ${splitResult?.pieces.length ?? 0} 张。`
            : "批量导出会逐张触发浏览器下载；如果浏览器拦截，需要允许当前站点的多文件下载。"}
        </div>
      </div>
    </ImageToolWorkspace>
  );
}
