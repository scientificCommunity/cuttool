import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

function isFiniteChannel(value) {
  return Number.isFinite(value) && value >= 0 && value <= 255;
}

function isValidImageDataLike(imageData) {
  if (!imageData || typeof imageData.width !== "number" || typeof imageData.height !== "number") {
    return false;
  }

  const { width, height, data } = imageData;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return false;
  }

  if (!data || typeof data.length !== "number") {
    return false;
  }

  return data.length >= width * height * 4;
}

function safePixelAt(data, width, height, x, y) {
  if (!data || width <= 0 || height <= 0) {
    return null;
  }

  const cx = clamp(Math.round(x), 0, width - 1);
  const cy = clamp(Math.round(y), 0, height - 1);
  const index = (cy * width + cx) * 4;
  if (index < 0 || index + 2 >= data.length) {
    return null;
  }

  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];

  if (!isFiniteChannel(r) || !isFiniteChannel(g) || !isFiniteChannel(b)) {
    return null;
  }

  return [r, g, b];
}

function buildBorderPalette(data, width, height) {
  if (!data || typeof data.length !== "number" || width <= 0 || height <= 0) {
    return [[255, 255, 255]];
  }

  const minLength = width * height * 4;
  if (data.length < minLength) {
    return [[255, 255, 255]];
  }

  const samples = [];
  const step = Math.max(4, Math.floor(Math.min(width, height) / 48));

  const pushSample = (x, y) => {
    const pixel = safePixelAt(data, width, height, x, y);
    if (pixel) {
      samples.push(pixel);
    }
  };

  for (let x = 0; x < width; x += step) {
    pushSample(x, 0);
    pushSample(x, height - 1);
  }

  for (let y = 0; y < height; y += step) {
    pushSample(0, y);
    pushSample(width - 1, y);
  }

  pushSample(0, 0);
  pushSample(width - 1, 0);
  pushSample(0, height - 1);
  pushSample(width - 1, height - 1);

  const palette = [];
  for (const sample of samples) {
    const [r, g, b] = sample;
    const exists = palette.some(([pr, pg, pb]) => colorDistanceSq(r, g, b, pr, pg, pb) < 28 * 28);
    if (!exists) {
      palette.push(sample);
    }
    if (palette.length >= 10) {
      break;
    }
  }

  if (palette.length === 0) {
    palette.push([255, 255, 255]);
  }

  return palette;
}

function checkerboardStyle() {
  return {
    backgroundImage:
      "linear-gradient(45deg, rgba(148,163,184,.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,.18) 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
  };
}

async function decodeImageFromFile(file) {
  if (!(file instanceof Blob)) {
    throw new Error("无效文件对象");
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
          close: () => bitmap.close(),
        };
      } catch (bitmapError) {
        console.warn("createImageBitmap 解码失败，回退到 HTMLImageElement", bitmapError);
      }
    }

    const img = new Image();
    img.decoding = "async";

    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve();
      };

      img.onerror = () => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        reject(new Error("图片文件无法解码"));
      };

      img.src = objectUrl;

      if (typeof img.decode === "function") {
        img.decode()
          .then(() => {
            if (settled) {
              return;
            }

            settled = true;
            cleanup();
            resolve();
          })
          .catch(() => {
            // 某些浏览器会在 decode 抛错后仍然触发 onload，这里交给 onload/onerror 继续处理。
          });
      }
    });

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) {
      throw new Error("图片尺寸无效");
    }

    return {
      width,
      height,
      draw: (ctx, drawWidth, drawHeight) => ctx.drawImage(img, 0, 0, drawWidth, drawHeight),
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getSafeImageData(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  if (!isValidImageDataLike(imageData)) {
    throw new Error("读取图片像素失败");
  }
  return imageData;
}

function runInternalTests() {
  const tests = [];
  const add = (name, pass, details = "") => tests.push({ name, pass, details });

  try {
    const palette = buildBorderPalette(null, 10, 10);
    add("无 data 时返回默认调色板", Array.isArray(palette) && palette[0][0] === 255);
  } catch (error) {
    add("无 data 时返回默认调色板", false, String(error));
  }

  try {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]);
    const palette = buildBorderPalette(data, 2, 2);
    add("有效 data 可提取边界颜色", Array.isArray(palette) && palette.length >= 1 && palette[0][0] === 255);
  } catch (error) {
    add("有效 data 可提取边界颜色", false, String(error));
  }

  try {
    const valid = isValidImageDataLike({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
    });
    add("ImageData 校验通过正常输入", valid === true);
  } catch (error) {
    add("ImageData 校验通过正常输入", false, String(error));
  }

  try {
    const invalid = isValidImageDataLike({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([0, 0, 0, 255]),
    });
    add("ImageData 校验拦截长度不足", invalid === false);
  } catch (error) {
    add("ImageData 校验拦截长度不足", false, String(error));
  }

  try {
    const pixel = safePixelAt(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1, 0, 0);
    add("safePixelAt 读取单像素", Array.isArray(pixel) && pixel[0] === 10 && pixel[1] === 20 && pixel[2] === 30);
  } catch (error) {
    add("safePixelAt 读取单像素", false, String(error));
  }

  try {
    const palette = buildBorderPalette(new Uint8ClampedArray([255, 255, 255, 255]), 2, 2);
    add("边界数据长度不足时回退默认调色板", Array.isArray(palette) && palette[0][0] === 255);
  } catch (error) {
    add("边界数据长度不足时回退默认调色板", false, String(error));
  }

  return tests;
}

const styles = {
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
  stackSmall: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px",
  },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#e2e8f0",
    marginBottom: "8px",
  },
  labelInline: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#e2e8f0",
  },
  value: {
    fontSize: "14px",
    color: "#94a3b8",
  },
  fileInput: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    borderRadius: "16px",
    border: "1px solid #334155",
    background: "#020617",
    color: "#e2e8f0",
    fontSize: "14px",
  },
  range: {
    width: "100%",
    marginTop: "6px",
  },
  mutedTip: {
    marginTop: "8px",
    fontSize: "12px",
    lineHeight: 1.6,
    color: "#94a3b8",
  },
  smallMuted: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  rowBetween: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  modeButton: {
    padding: "10px 12px",
    borderRadius: "14px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  modeButtonActive: {
    background: "#f8fafc",
    color: "#0f172a",
    border: "1px solid #f8fafc",
  },
  modeButtonIdle: {
    background: "#020617",
    color: "#e2e8f0",
    border: "1px solid #334155",
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
  canvasScroller: {
    overflow: "auto",
    borderRadius: "18px",
    border: "1px solid #1e293b",
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
};

const globalCss = `
  * { box-sizing: border-box; }
  html, body, #root { margin: 0; min-height: 100%; }
  body { background: #020617; }
  button, input { font: inherit; }

  .cuttool-layout {
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .cuttool-canvases {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 24px;
    align-items: start;
  }

  @media (max-width: 1180px) {
    .cuttool-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 980px) {
    .cuttool-canvases {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    input[type="file"] {
      font-size: 13px;
    }
  }
`;

export default function CutoutToolPage({ homeHref }) {
  const sourceCanvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
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
  const passedCount = testResults.filter((item) => item.pass).length;

  const clearLoadedState = () => {
    sourceImageDataRef.current = null;
    maskRef.current = null;
    historyRef.current = [];
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

    if (mask.length < src.width * src.height) {
      return;
    }

    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    const output = new ImageData(src.width, src.height);
    for (let pixel = 0, index = 0; pixel < mask.length; pixel += 1, index += 4) {
      if (index + 3 >= src.data.length || index + 3 >= output.data.length) {
        break;
      }

      output.data[index] = src.data[index];
      output.data[index + 1] = src.data[index + 1];
      output.data[index + 2] = src.data[index + 2];
      output.data[index + 3] = mask[pixel];
    }

    ctx.putImageData(output, 0, 0);
  };

  const resetMask = () => {
    const src = sourceImageDataRef.current;
    if (!isValidImageDataLike(src)) {
      return;
    }

    maskRef.current = new Uint8ClampedArray(src.width * src.height);
    maskRef.current.fill(255);
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
      maskRef.current = new Uint8ClampedArray(width * height);
      maskRef.current.fill(255);
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
      const { width, height, data } = src;
      const pixels = width * height;
      const palette = buildBorderPalette(data, width, height);
      const thresholdSq = threshold * threshold;
      const tentativeBg = new Uint8Array(pixels);
      const visited = new Uint8Array(pixels);
      const queue = new Int32Array(pixels);
      let head = 0;
      let tail = 0;

      for (let pixel = 0, index = 0; pixel < pixels; pixel += 1, index += 4) {
        if (index + 2 >= data.length) {
          break;
        }

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        let minDist = Infinity;
        for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
          const [pr, pg, pb] = palette[paletteIndex];
          const distance = colorDistanceSq(r, g, b, pr, pg, pb);
          if (distance < minDist) {
            minDist = distance;
          }
        }

        if (minDist <= thresholdSq) {
          tentativeBg[pixel] = 1;
        }
      }

      const enqueue = (idx) => {
        if (idx < 0 || idx >= pixels) {
          return;
        }

        if (visited[idx] || !tentativeBg[idx]) {
          return;
        }

        visited[idx] = 1;
        queue[tail] = idx;
        tail += 1;
      };

      for (let x = 0; x < width; x += 1) {
        enqueue(x);
        enqueue((height - 1) * width + x);
      }

      for (let y = 0; y < height; y += 1) {
        enqueue(y * width);
        enqueue(y * width + (width - 1));
      }

      while (head < tail) {
        const idx = queue[head];
        head += 1;
        const x = idx % width;
        const y = Math.floor(idx / width);

        if (x > 0) {
          enqueue(idx - 1);
        }
        if (x < width - 1) {
          enqueue(idx + 1);
        }
        if (y > 0) {
          enqueue(idx - width);
        }
        if (y < height - 1) {
          enqueue(idx + width);
        }
      }

      const newMask = new Uint8ClampedArray(pixels);
      newMask.fill(255);
      for (let index = 0; index < pixels; index += 1) {
        if (visited[index]) {
          newMask[index] = 0;
        }
      }

      const softened = new Uint8ClampedArray(newMask);
      for (let y = 1; y < height - 1; y += 1) {
        for (let x = 1; x < width - 1; x += 1) {
          const index = y * width + x;
          if (newMask[index] !== 255) {
            continue;
          }

          let bgNeighbors = 0;
          if (newMask[index - 1] === 0) {
            bgNeighbors += 1;
          }
          if (newMask[index + 1] === 0) {
            bgNeighbors += 1;
          }
          if (newMask[index - width] === 0) {
            bgNeighbors += 1;
          }
          if (newMask[index + width] === 0) {
            bgNeighbors += 1;
          }

          if (bgNeighbors >= 2) {
            softened[index] = 220;
          }
          if (bgNeighbors >= 3) {
            softened[index] = 180;
          }
        }
      }

      historyRef.current.push(maskRef.current ? new Uint8ClampedArray(maskRef.current) : null);
      historyRef.current = historyRef.current.slice(-10);
      maskRef.current = softened;
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
    <div style={styles.page}>
      <style>{globalCss}</style>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <a href={homeHref} style={styles.backLink}>
            返回工具集
          </a>
          <div style={styles.topHint}>当前工具：抠图</div>
        </div>

        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.title}>抠图</h1>
            <p style={styles.subtitle}>
              全部在浏览器本地处理，不上传服务器。当前这版先用“边缘背景识别 +
              手动修边”的方式，适合白底、纯色底、拍摄背景较干净的图片。
            </p>
          </div>
          <div style={styles.metaCard}>
            {imgMeta ? `${imgMeta.name} · ${imgMeta.width} × ${imgMeta.height}` : "还没有载入图片"}
          </div>
        </div>

        <div className="cuttool-layout">
          <div style={styles.sidebarCard}>
            <div style={styles.stackLarge}>
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

              <div>
                <div style={styles.label}>修边模式</div>
                <div style={styles.modeGrid}>
                  {[
                    ["erase", "擦除"],
                    ["restore", "恢复"],
                    ["view", "查看"],
                  ].map(([value, label]) => {
                    const active = mode === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setMode(value)}
                        disabled={!hasImage || busy}
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

              <div style={styles.infoCard}>
                <div style={styles.infoTitle}>状态</div>
                <div style={styles.infoBody}>{status}</div>
              </div>

              <div style={styles.infoCard}>
                <div style={styles.rowBetween}>
                  <span style={styles.infoTitle}>内置自检</span>
                  <span style={styles.smallMuted}>{passedCount}/{testResults.length} 通过</span>
                </div>
                <div style={styles.stackSmall}>
                  {testResults.map((test) => (
                    <div key={test.name} style={styles.testItem}>
                      <div style={styles.rowBetween}>
                        <span>{test.name}</span>
                        <span style={test.pass ? styles.passText : styles.failText}>
                          {test.pass ? "PASS" : "FAIL"}
                        </span>
                      </div>
                      {test.details ? <div style={styles.testDetails}>{test.details}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="cuttool-canvases">
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
              <div style={styles.mutedTip}>
                小提示：白底商品图、证件照、LOGO 图会比较稳；头发丝、半透明婚纱、复杂环境光背景，这版还需要更多模型能力。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
