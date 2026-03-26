import React, { useEffect, useMemo, useRef, useState } from "react";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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
  if (!data || width <= 0 || height <= 0) return null;
  const cx = clamp(Math.round(x), 0, width - 1);
  const cy = clamp(Math.round(y), 0, height - 1);
  const i = (cy * width + cx) * 4;
  if (i < 0 || i + 2 >= data.length) return null;

  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

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
    if (!exists) palette.push(sample);
    if (palette.length >= 10) break;
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
    img.crossOrigin = "anonymous";

    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      img.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("图片文件无法解码"));
      };

      img.src = objectUrl;

      if (typeof img.decode === "function") {
        img.decode()
          .then(() => {
            if (settled) return;
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

  const add = (name, pass, details = "") => {
    tests.push({ name, pass, details });
  };

  try {
    const palette = buildBorderPalette(null, 10, 10);
    add("无 data 时返回默认调色板", Array.isArray(palette) && palette.length > 0 && palette[0][0] === 255);
  } catch (err) {
    add("无 data 时返回默认调色板", false, String(err));
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
  } catch (err) {
    add("有效 data 可提取边界颜色", false, String(err));
  }

  try {
    const valid = isValidImageDataLike({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]),
    });
    add("ImageData 校验通过正常输入", valid === true);
  } catch (err) {
    add("ImageData 校验通过正常输入", false, String(err));
  }

  try {
    const invalid = isValidImageDataLike({ width: 2, height: 2, data: new Uint8ClampedArray([0, 0, 0, 255]) });
    add("ImageData 校验拦截长度不足", invalid === false);
  } catch (err) {
    add("ImageData 校验拦截长度不足", false, String(err));
  }

  try {
    const pixel = safePixelAt(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1, 0, 0);
    add("safePixelAt 读取单像素", Array.isArray(pixel) && pixel[0] === 10 && pixel[1] === 20 && pixel[2] === 30);
  } catch (err) {
    add("safePixelAt 读取单像素", false, String(err));
  }

  try {
    const palette = buildBorderPalette(new Uint8ClampedArray([255, 255, 255, 255]), 2, 2);
    add("边界数据长度不足时回退默认调色板", Array.isArray(palette) && palette.length > 0 && palette[0][0] === 255);
  } catch (err) {
    add("边界数据长度不足时回退默认调色板", false, String(err));
  }

  return tests;
}

export default function FrontendCutoutToolDemo() {
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
    if (!isValidImageDataLike(src) || !mask || !canvas) return;
    if (mask.length < src.width * src.height) return;

    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const out = new ImageData(src.width, src.height);
    for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
      if (i + 3 >= src.data.length || i + 3 >= out.data.length) break;
      out.data[i] = src.data[i];
      out.data[i + 1] = src.data[i + 1];
      out.data[i + 2] = src.data[i + 2];
      out.data[i + 3] = mask[p];
    }

    ctx.putImageData(out, 0, 0);
  };

  const resetMask = () => {
    const src = sourceImageDataRef.current;
    if (!isValidImageDataLike(src)) return;
    maskRef.current = new Uint8ClampedArray(src.width * src.height);
    maskRef.current.fill(255);
    historyRef.current = [];
    renderResult();
    setStatus("已重置为原图。现在可以重新自动去底，或直接手动修边。");
  };

  const loadImage = async (file) => {
    if (!file) return;
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
    } catch (err) {
      console.error(err);
      clearLoadedState();
      setStatus(`图片载入失败：${err instanceof Error ? err.message : "请换一张再试"}`);
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

      for (let p = 0, i = 0; p < pixels; p++, i += 4) {
        if (i + 2 >= data.length) break;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        let minDist = Infinity;
        for (let k = 0; k < palette.length; k++) {
          const [pr, pg, pb] = palette[k];
          const d = colorDistanceSq(r, g, b, pr, pg, pb);
          if (d < minDist) minDist = d;
        }
        if (minDist <= thresholdSq) tentativeBg[p] = 1;
      }

      const enqueue = (idx) => {
        if (idx < 0 || idx >= pixels) return;
        if (visited[idx] || !tentativeBg[idx]) return;
        visited[idx] = 1;
        queue[tail++] = idx;
      };

      for (let x = 0; x < width; x++) {
        enqueue(x);
        enqueue((height - 1) * width + x);
      }
      for (let y = 0; y < height; y++) {
        enqueue(y * width);
        enqueue(y * width + (width - 1));
      }

      while (head < tail) {
        const idx = queue[head++];
        const x = idx % width;
        const y = Math.floor(idx / width);
        if (x > 0) enqueue(idx - 1);
        if (x < width - 1) enqueue(idx + 1);
        if (y > 0) enqueue(idx - width);
        if (y < height - 1) enqueue(idx + width);
      }

      const newMask = new Uint8ClampedArray(pixels);
      newMask.fill(255);
      for (let i = 0; i < pixels; i++) {
        if (visited[i]) newMask[i] = 0;
      }

      const softened = new Uint8ClampedArray(newMask);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (newMask[idx] !== 255) continue;
          let bgNeighbors = 0;
          if (newMask[idx - 1] === 0) bgNeighbors++;
          if (newMask[idx + 1] === 0) bgNeighbors++;
          if (newMask[idx - width] === 0) bgNeighbors++;
          if (newMask[idx + width] === 0) bgNeighbors++;
          if (bgNeighbors >= 2) softened[idx] = 220;
          if (bgNeighbors >= 3) softened[idx] = 180;
        }
      }

      historyRef.current.push(maskRef.current ? new Uint8ClampedArray(maskRef.current) : null);
      historyRef.current = historyRef.current.slice(-10);
      maskRef.current = softened;
      renderResult();
      setStatus("自动去底完成。头发、阴影、复杂背景可以用“擦除 / 恢复”画笔修边。");
    } catch (err) {
      console.error(err);
      setStatus(`自动去底失败：${err instanceof Error ? err.message : "请调一下阈值后重试"}`);
    } finally {
      setBusy(false);
    }
  };

  const saveHistory = () => {
    if (!maskRef.current) return;
    historyRef.current.push(new Uint8ClampedArray(maskRef.current));
    historyRef.current = historyRef.current.slice(-10);
  };

  const undo = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current.pop();
    if (!prev) return;
    maskRef.current = prev;
    renderResult();
    setStatus("已撤销一步。");
  };

  const paintAt = (clientX, clientY) => {
    const canvas = resultCanvasRef.current;
    const mask = maskRef.current;
    const src = sourceImageDataRef.current;
    if (!canvas || !mask || !isValidImageDataLike(src)) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((clientX - rect.left) / rect.width) * src.width;
    const y = ((clientY - rect.top) / rect.height) * src.height;
    const radius = brushSize / 2;
    const left = clamp(Math.floor(x - radius), 0, src.width - 1);
    const right = clamp(Math.ceil(x + radius), 0, src.width - 1);
    const top = clamp(Math.floor(y - radius), 0, src.height - 1);
    const bottom = clamp(Math.ceil(y + radius), 0, src.height - 1);
    const r2 = radius * radius;
    const value = mode === "erase" ? 0 : 255;

    for (let yy = top; yy <= bottom; yy++) {
      for (let xx = left; xx <= right; xx++) {
        const dx = xx - x;
        const dy = yy - y;
        if (dx * dx + dy * dy <= r2) {
          mask[yy * src.width + xx] = value;
        }
      }
    }

    renderResult();
  };

  const onPointerDown = (e) => {
    if (!hasImage) return;
    if (mode !== "erase" && mode !== "restore") return;
    drawingRef.current = true;
    saveHistory();
    paintAt(e.clientX, e.clientY);
  };

  const onPointerMove = (e) => {
    if (!drawingRef.current) return;
    paintAt(e.clientX, e.clientY);
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setStatus(mode === "erase" ? "已擦除一部分背景。" : "已恢复一部分主体。");
  };

  const exportPng = async () => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !hasImage) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("导出失败：浏览器没有生成图片数据。");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (imgMeta?.name || "cutout").replace(/\.[^.]+$/, "") + "-cutout.png";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("透明 PNG 已导出。");
    }, "image/png");
  };

  useEffect(() => {
    const up = () => onPointerUp();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">纯前端抠图工具 Demo</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              全部在浏览器本地处理，不上传服务器。当前这版先用“边缘背景识别 + 手动修边”的方式，适合白底、纯色底、拍摄背景较干净的图片。
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300 shadow-xl">
            {imgMeta ? `${imgMeta.name} · ${imgMeta.width} × ${imgMeta.height}` : "还没有载入图片"}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">选择图片</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full cursor-pointer rounded-2xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-slate-900"
                  onChange={(e) => loadImage(e.target.files?.[0])}
                  disabled={busy}
                />
                <p className="mt-2 text-xs text-slate-400">现在会优先走 createImageBitmap，失败后自动回退到 Image 对象解码。</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-200">自动去底阈值</span>
                  <span className="text-slate-400">{threshold}</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full"
                  disabled={!hasImage || busy}
                />
                <p className="mt-2 text-xs text-slate-400">背景和主体颜色接近时，适当调小；背景较纯净时，适当调大。</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-200">画笔大小</span>
                  <span className="text-slate-400">{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="80"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                  disabled={!hasImage || busy}
                />
              </div>

              <div>
                <div className="mb-2 block text-sm font-medium text-slate-200">修边模式</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["erase", "擦除"],
                    ["restore", "恢复"],
                    ["view", "查看"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setMode(value)}
                      className={`rounded-2xl px-3 py-2 text-sm transition ${
                        mode === value
                          ? "bg-slate-100 text-slate-900"
                          : "border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                      }`}
                      disabled={!hasImage || busy}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={autoCutout}
                  disabled={!hasImage || busy}
                  className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-medium text-slate-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "处理中..." : "自动去底"}
                </button>
                <button
                  onClick={resetMask}
                  disabled={!hasImage || busy}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  重置
                </button>
                <button
                  onClick={undo}
                  disabled={!hasImage || busy}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  撤销
                </button>
                <button
                  onClick={exportPng}
                  disabled={!hasImage || busy}
                  className="rounded-2xl bg-sky-400 px-4 py-3 text-sm font-medium text-slate-950 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  导出 PNG
                </button>
              </div>

              <button
                onClick={() => setShowOriginal((v) => !v)}
                disabled={!hasImage}
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {showOriginal ? "隐藏原图面板" : "显示原图面板"}
              </button>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                <div className="mb-1 font-medium text-slate-100">状态</div>
                <div>{status}</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium text-slate-100">内置自检</span>
                  <span className="text-xs text-slate-400">{passedCount}/{testResults.length} 通过</span>
                </div>
                <div className="space-y-2">
                  {testResults.map((test) => (
                    <div key={test.name} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span>{test.name}</span>
                        <span className={test.pass ? "text-emerald-300" : "text-rose-300"}>{test.pass ? "PASS" : "FAIL"}</span>
                      </div>
                      {test.details ? <div className="mt-1 text-slate-400">{test.details}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {showOriginal ? (
              <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl">
                <div className="mb-3 text-sm font-medium text-slate-200">原图</div>
                <div className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3">
                  <canvas ref={sourceCanvasRef} className="mx-auto block max-h-[70vh] max-w-full rounded-xl" />
                </div>
              </div>
            ) : (
              <canvas ref={sourceCanvasRef} className="hidden" />
            )}

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-200">结果（透明底预览）</div>
                <div className="text-xs text-slate-400">
                  {mode === "erase" ? "拖动画笔擦掉多余背景" : mode === "restore" ? "拖动画笔恢复主体" : "查看模式"}
                </div>
              </div>
              <div className="overflow-auto rounded-2xl border border-slate-800 p-3" style={board}>
                <canvas
                  ref={resultCanvasRef}
                  className="mx-auto block max-h-[70vh] max-w-full rounded-xl shadow-2xl"
                  style={{ touchAction: "none", cursor: mode === "view" ? "default" : "crosshair" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                />
              </div>
              <div className="mt-3 text-xs leading-6 text-slate-400">
                小提示：白底商品图、证件照、LOGO 图会比较稳；头发丝、半透明婚纱、复杂环境光背景，这版还需要更多模型能力。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

