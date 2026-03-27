import { useEffect, useMemo, useRef, useState } from "react";
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
  getSafeImageData,
  renderMaskedImageToCanvas,
} from "../lib/cutoutCore.js";
import {
  normalizeMaskRefineConfig,
  refineAlphaMask,
  runMaskRefineTests,
} from "../lib/maskRefineCore.js";
import {
  MAX_EXTRACT_FRAMES,
  buildFrameExtractionPlan,
  createVideoFrameFileName,
  formatDurationLabel,
  normalizeFrameCount,
  normalizeFramesPerSecond,
  normalizeIntervalSeconds,
  runVideoFrameTests,
} from "../lib/videoFrameCore.js";

const PREVIEW_MAX_SIDE = 320;
const MAX_CONTRACT_PX = 4;
const MAX_FEATHER_PX = 6;

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
    fontSize: "15px",
    fontWeight: 700,
  },
  videoShell: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "#020617",
  },
  videoElement: {
    display: "block",
    width: "100%",
    maxHeight: "72vh",
    background: "#020617",
  },
  placeholder: {
    minHeight: "320px",
    display: "grid",
    placeItems: "center",
    borderRadius: "18px",
    border: "1px dashed #334155",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.75), rgba(2,6,23,0.92))",
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: 1.8,
    textAlign: "center",
    padding: "28px",
  },
  badge: {
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
  badgeDot: {
    width: "8px",
    height: "8px",
    borderRadius: "999px",
    background: "#34d399",
    boxShadow: "0 0 16px rgba(52,211,153,0.45)",
  },
  frameScroller: {
    overflow: "auto",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "#020617",
    padding: "12px",
  },
  frameGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "14px",
  },
  frameCard: {
    padding: "14px",
    borderRadius: "18px",
    border: "1px solid #1e293b",
    background: "rgba(2,6,23,0.88)",
  },
  frameHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "10px",
    marginBottom: "12px",
  },
  frameTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#f8fafc",
  },
  frameMeta: {
    marginTop: "4px",
    fontSize: "12px",
    color: "#94a3b8",
  },
  frameThumbWrap: {
    minHeight: "150px",
    display: "grid",
    placeItems: "center",
    padding: "12px",
    borderRadius: "14px",
    border: "1px solid #1e293b",
    background: "#0f172a",
    marginBottom: "12px",
  },
  frameThumb: {
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
  toggleCard: {
    padding: "14px",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    background: "#020617",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
    color: "#e2e8f0",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#38bdf8",
  },
  cropButtonRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  cropOverlay: {
    position: "absolute",
    inset: 0,
  },
  cropShade: {
    position: "absolute",
    inset: 0,
    background: "rgba(2,6,23,0.2)",
  },
  cropBox: {
    position: "absolute",
    border: "2px solid #38bdf8",
    boxShadow: "0 0 0 9999px rgba(2,6,23,0.36)",
    background: "rgba(56,189,248,0.12)",
  },
};

function waitForVideoLoaded(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      resolve();
      return;
    }

    let settled = false;
    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
    };

    const onLoaded = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve();
    };

    const onError = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error("视频文件无法解码"));
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
  });
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const safeTime = Math.max(0, Math.min(time, Number.isFinite(video.duration) ? video.duration : time));

    if (Math.abs(video.currentTime - safeTime) < 0.01) {
      waitForNextPaint().then(resolve);
      return;
    }

    let settled = false;
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };

    const onSeeked = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      waitForNextPaint().then(resolve);
    };

    const onError = () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error("视频跳转失败"));
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    try {
      video.currentTime = safeTime;
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("视频跳转失败"));
    }
  });
}

function revokePreviewUrls(frameItems) {
  for (const frame of frameItems) {
    if (frame.previewUrl) {
      URL.revokeObjectURL(frame.previewUrl);
    }
  }
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("浏览器没有生成图片数据"));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function createProcessConfig({
  outputMode,
  threshold,
  contractPx,
  featherPx,
  despeckle,
}) {
  const normalizedRefine = normalizeMaskRefineConfig({
    contractPx,
    featherPx,
    despeckle,
  });

  return {
    outputMode: outputMode === "transparent" ? "transparent" : "raw",
    threshold: Math.max(10, Math.min(100, Math.round(Number(threshold) || 42))),
    ...normalizedRefine,
  };
}

function describeProcessConfig(config) {
  if (!config || config.outputMode !== "transparent") {
    return "输出原始帧，不做透明处理。";
  }

  const parts = [
    `自动去底阈值 ${config.threshold}`,
    `边缘内收 ${config.contractPx}px`,
    `羽化 ${config.featherPx}px`,
    config.despeckle ? "单像素去噪 开启" : "单像素去噪 关闭",
  ];

  return `输出透明 PNG，${parts.join("，")}。`;
}

function sameProcessConfig(left, right) {
  if (!left || !right) {
    return false;
  }

  return (
    left.outputMode === right.outputMode &&
    left.threshold === right.threshold &&
    left.contractPx === right.contractPx &&
    left.featherPx === right.featherPx &&
    left.despeckle === right.despeckle
  );
}

function normalizeCropRect(rect, sourceWidth, sourceHeight) {
  if (!rect || !sourceWidth || !sourceHeight) {
    return null;
  }

  const x = Math.max(0, Math.min(sourceWidth - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(sourceHeight - 1, Math.round(rect.y)));
  const right = Math.max(x + 1, Math.min(sourceWidth, Math.round(rect.x + rect.width)));
  const bottom = Math.max(y + 1, Math.min(sourceHeight, Math.round(rect.y + rect.height)));
  const width = right - x;
  const height = bottom - y;

  if (width < 2 || height < 2) {
    return null;
  }

  return { x, y, width, height };
}

function sameCropRect(left, right) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}

function describeCropRect(rect, sourceWidth, sourceHeight) {
  if (!rect) {
    return "未框选，默认提取整张画面。";
  }

  const widthRatio = ((rect.width / sourceWidth) * 100).toFixed(1);
  const heightRatio = ((rect.height / sourceHeight) * 100).toFixed(1);
  return `已框选区域：x ${rect.x}px，y ${rect.y}px，宽 ${rect.width}px，高 ${rect.height}px，占原画面 ${widthRatio}% × ${heightRatio}%。`;
}

function getOverlayCropStyle(rect, sourceWidth, sourceHeight) {
  if (!rect || !sourceWidth || !sourceHeight) {
    return null;
  }

  return {
    left: `${(rect.x / sourceWidth) * 100}%`,
    top: `${(rect.y / sourceHeight) * 100}%`,
    width: `${(rect.width / sourceWidth) * 100}%`,
    height: `${(rect.height / sourceHeight) * 100}%`,
  };
}

async function estimateVideoFrameRate(videoUrl) {
  if (typeof document === "undefined" || !videoUrl) {
    return null;
  }

  const probe = document.createElement("video");
  probe.preload = "auto";
  probe.muted = true;
  probe.playsInline = true;
  probe.src = videoUrl;

  try {
    await waitForVideoLoaded(probe);

    if (typeof probe.requestVideoFrameCallback !== "function") {
      return null;
    }

    const sampleStart = Math.min(0.2, Math.max(0, (probe.duration || 0) / 10));
    await seekVideo(probe, sampleStart);

    return await new Promise((resolve) => {
      let startMediaTime = null;
      let startFrames = null;
      let lastMediaTime = null;
      let lastFrames = null;
      let callbacks = 0;
      let settled = false;

      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        probe.pause();

        if (
          startMediaTime == null ||
          lastMediaTime == null ||
          startFrames == null ||
          lastFrames == null ||
          lastMediaTime <= startMediaTime ||
          lastFrames <= startFrames
        ) {
          resolve(null);
          return;
        }

        const fps = (lastFrames - startFrames) / (lastMediaTime - startMediaTime);
        resolve(Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : null);
      };

      const timeoutId = window.setTimeout(finish, 1500);

      const onFrame = (_now, metadata) => {
        if (settled) {
          return;
        }

        if (startMediaTime == null) {
          startMediaTime = metadata.mediaTime;
          startFrames = metadata.presentedFrames;
        }

        lastMediaTime = metadata.mediaTime;
        lastFrames = metadata.presentedFrames;
        callbacks += 1;

        if (callbacks >= 8 || metadata.mediaTime - startMediaTime >= 0.45) {
          finish();
          return;
        }

        probe.requestVideoFrameCallback(onFrame);
      };

      probe.requestVideoFrameCallback(onFrame);
      probe.play().catch(() => finish());
    });
  } catch (error) {
    console.warn("视频帧率估算失败", error);
    return null;
  } finally {
    probe.pause();
    probe.removeAttribute("src");
    probe.load();
  }
}

function drawFrameToCanvas(video, canvas, maxSide = null, cropRect = null) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("视频尺寸无效");
  }

  const normalizedCrop = normalizeCropRect(cropRect, sourceWidth, sourceHeight);
  const cropWidth = normalizedCrop?.width || sourceWidth;
  const cropHeight = normalizedCrop?.height || sourceHeight;
  const cropX = normalizedCrop?.x || 0;
  const cropY = normalizedCrop?.y || 0;

  const scale = maxSide ? Math.min(1, maxSide / Math.max(cropWidth, cropHeight)) : 1;
  const drawWidth = Math.max(1, Math.round(cropWidth * scale));
  const drawHeight = Math.max(1, Math.round(cropHeight * scale));

  canvas.width = drawWidth;
  canvas.height = drawHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("无法获取画布上下文");
  }

  ctx.clearRect(0, 0, drawWidth, drawHeight);
  ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, drawWidth, drawHeight);

  return {
    width: drawWidth,
    height: drawHeight,
    imageData: getSafeImageData(ctx, drawWidth, drawHeight),
  };
}

async function renderProcessedFrameBlob({
  sourceImageData,
  processConfig,
  outputCanvas,
  scratchCanvas,
}) {
  if (!outputCanvas) {
    throw new Error("输出画布未初始化");
  }

  if (processConfig.outputMode !== "transparent") {
    outputCanvas.width = sourceImageData.width;
    outputCanvas.height = sourceImageData.height;
    const ctx = outputCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error("无法获取输出画布");
    }

    ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    ctx.putImageData(sourceImageData, 0, 0);

    return {
      blob: await canvasToBlob(outputCanvas),
      width: sourceImageData.width,
      height: sourceImageData.height,
      scratchCanvas,
    };
  }

  const baseMask = buildAutoMask(sourceImageData, processConfig.threshold);
  const refinedMask = refineAlphaMask(baseMask, sourceImageData.width, sourceImageData.height, processConfig);
  const nextScratch = renderMaskedImageToCanvas({
    canvas: outputCanvas,
    scratchCanvas,
    sourceImageData,
    mask: refinedMask,
  });

  return {
    blob: await canvasToBlob(outputCanvas),
    width: sourceImageData.width,
    height: sourceImageData.height,
    scratchCanvas: nextScratch || scratchCanvas,
  };
}

export default function VideoFrameToolPage({ homeHref }) {
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const scratchCanvasRef = useRef(null);
  const previewFramesRef = useRef([]);
  const videoUrlRef = useRef("");
  const cropDraftRef = useRef(null);

  const [videoMeta, setVideoMeta] = useState(null);
  const [estimatedFps, setEstimatedFps] = useState(null);
  const [mode, setMode] = useState("count");
  const [outputMode, setOutputMode] = useState("raw");
  const [frameCount, setFrameCount] = useState(12);
  const [framesPerSecond, setFramesPerSecond] = useState(2);
  const [intervalSeconds, setIntervalSeconds] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [threshold, setThreshold] = useState(42);
  const [contractPx, setContractPx] = useState(1);
  const [featherPx, setFeatherPx] = useState(1);
  const [despeckle, setDespeckle] = useState(true);
  const [cropMode, setCropMode] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingOneId, setDownloadingOneId] = useState(null);
  const [frames, setFrames] = useState([]);
  const [status, setStatus] = useState("上传视频后，可以按张数或时间间隔抽出关键帧，并导出 PNG。");
  const [testResults] = useState(() => [...runVideoFrameTests(), ...runMaskRefineTests()]);
  const checkerboard = useMemo(() => checkerboardStyle(), []);

  const currentProcessConfig = useMemo(
    () =>
      createProcessConfig({
        outputMode,
        threshold,
        contractPx,
        featherPx,
        despeckle,
      }),
    [contractPx, despeckle, featherPx, outputMode, threshold],
  );

  const plan = useMemo(() => {
    if (!videoMeta) {
      return null;
    }

    return buildFrameExtractionPlan({
      duration: videoMeta.duration,
      mode,
      frameCount,
      intervalSeconds,
      framesPerSecond,
      startTime,
      endTime,
    });
  }, [endTime, frameCount, framesPerSecond, intervalSeconds, mode, startTime, videoMeta]);

  const metaText = useMemo(() => {
    if (!videoMeta) {
      return "还没有载入视频";
    }

    const fpsLabel = estimatedFps ? ` · ${estimatedFps} fps` : "";
    return `${videoMeta.name} · ${videoMeta.width} × ${videoMeta.height} · ${formatDurationLabel(videoMeta.duration)}${fpsLabel}`;
  }, [estimatedFps, videoMeta]);

  const planSummary = useMemo(() => {
    if (!videoMeta || !plan) {
      return "等待视频载入。抽帧时会按设定的时间窗口生成 PNG 预览。";
    }

    const timeWindow = `${formatDurationLabel(plan.startTime)} - ${formatDurationLabel(plan.endTime)}`;
    const ruleText =
      mode === "count"
        ? `按数量均匀抽 ${plan.actualFrames} 张`
        : mode === "fps"
          ? `按每秒 ${plan.framesPerSecond} 帧抽取，共 ${plan.actualFrames} 张`
        : `每 ${plan.stepSeconds} 秒抽一张，共 ${plan.actualFrames} 张`;
    const limitText = plan.limitedByMaxFrames ? `；已自动限制在 ${MAX_EXTRACT_FRAMES} 张以内。` : "。";

    return `${timeWindow}，${ruleText}${limitText}`;
  }, [mode, plan, videoMeta]);

  const extractedProcessConfig = frames[0]?.processConfig || null;
  const processSummary = useMemo(() => {
    if (!frames.length) {
      return describeProcessConfig(currentProcessConfig);
    }

    return describeProcessConfig(extractedProcessConfig);
  }, [currentProcessConfig, extractedProcessConfig, frames.length]);

  const processSettingsDirty = useMemo(() => {
    if (!frames.length || !extractedProcessConfig) {
      return false;
    }

    return !sameProcessConfig(currentProcessConfig, extractedProcessConfig);
  }, [currentProcessConfig, extractedProcessConfig, frames.length]);

  const cropSummary = useMemo(() => {
    if (!videoMeta) {
      return "等待视频载入。";
    }

    return describeCropRect(cropRect, videoMeta.width, videoMeta.height);
  }, [cropRect, videoMeta]);

  const extractedCropRect = frames[0]?.cropRect || null;
  const cropSettingsDirty = useMemo(() => {
    if (!frames.length) {
      return false;
    }

    return !sameCropRect(cropRect, extractedCropRect);
  }, [cropRect, extractedCropRect, frames.length]);

  useEffect(() => {
    previewFramesRef.current = frames;
  }, [frames]);

  useEffect(() => () => {
    revokePreviewUrls(previewFramesRef.current);
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!videoMeta || !videoUrlRef.current) {
      return () => {
        cancelled = true;
      };
    }

    estimateVideoFrameRate(videoUrlRef.current).then((fps) => {
      if (!cancelled) {
        setEstimatedFps(fps);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [videoMeta]);

  const controlsDisabled = extracting || downloadingAll || Boolean(downloadingOneId);

  const setPreviewFrames = (nextFrames) => {
    revokePreviewUrls(previewFramesRef.current);
    previewFramesRef.current = nextFrames;
    setFrames(nextFrames);
  };

  const resetVideoSource = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = "";
    }
  };

  const clearLoadedState = () => {
    setPreviewFrames([]);
    setVideoMeta(null);
    setEstimatedFps(null);
    setStartTime(0);
    setEndTime(0);
    setCropRect(null);
    setCropMode(false);
    scratchCanvasRef.current = null;
    cropDraftRef.current = null;
    resetVideoSource();
  };

  const loadVideo = async (file) => {
    if (!file) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    setStatus("正在读取视频…");

    try {
      if (!file.type.startsWith("video/")) {
        throw new Error("请选择视频文件");
      }

      clearLoadedState();
      const objectUrl = URL.createObjectURL(file);
      videoUrlRef.current = objectUrl;
      video.src = objectUrl;
      video.preload = "auto";
      video.load();
      await waitForVideoLoaded(video);

      setVideoMeta({
        name: file.name,
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
      });
      setStartTime(0);
      setEndTime(Number.isFinite(video.duration) ? video.duration : 0);
      setStatus("视频已载入。设置抽帧方式和时间范围后，点击“开始抽帧”。");
    } catch (error) {
      console.error(error);
      clearLoadedState();
      setStatus(`视频载入失败：${error instanceof Error ? error.message : "请换一个文件再试"}`);
    }
  };

  const ensureCaptureCanvas = () => {
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement("canvas");
    }

    return captureCanvasRef.current;
  };

  const ensureOutputCanvas = () => {
    if (!outputCanvasRef.current) {
      outputCanvasRef.current = document.createElement("canvas");
    }

    return outputCanvasRef.current;
  };

  const getCropPointFromEvent = (event) => {
    const video = videoRef.current;
    if (!video || !videoMeta) {
      return null;
    }

    const rect = video.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const x = Math.max(0, Math.min(videoMeta.width, ((event.clientX - rect.left) / rect.width) * videoMeta.width));
    const y = Math.max(0, Math.min(videoMeta.height, ((event.clientY - rect.top) / rect.height) * videoMeta.height));

    return { x, y };
  };

  const updateCropRectFromPoints = (startPoint, endPoint) => {
    if (!videoMeta || !startPoint || !endPoint) {
      return null;
    }

    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    return normalizeCropRect({ x: left, y: top, width, height }, videoMeta.width, videoMeta.height);
  };

  const handleCropPointerDown = (event) => {
    if (!cropMode || !videoMeta) {
      return;
    }

    const point = getCropPointFromEvent(event);
    if (!point) {
      return;
    }

    cropDraftRef.current = {
      pointerId: event.pointerId,
      startPoint: point,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setCropRect(normalizeCropRect({ x: point.x, y: point.y, width: 2, height: 2 }, videoMeta.width, videoMeta.height));
  };

  const handleCropPointerMove = (event) => {
    if (!cropMode || !videoMeta || cropDraftRef.current?.pointerId !== event.pointerId) {
      return;
    }

    const point = getCropPointFromEvent(event);
    if (!point) {
      return;
    }

    setCropRect(updateCropRectFromPoints(cropDraftRef.current.startPoint, point));
  };

  const handleCropPointerUp = (event) => {
    if (cropDraftRef.current?.pointerId !== event.pointerId) {
      return;
    }

    const point = getCropPointFromEvent(event);
    const nextRect = updateCropRectFromPoints(cropDraftRef.current.startPoint, point);
    cropDraftRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setCropRect(nextRect);
  };

  const captureFrameImageDataAtTime = async (time, { maxSide = null, crop = null } = {}) => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("视频尚未初始化");
    }

    await seekVideo(video, time);
    return drawFrameToCanvas(video, ensureCaptureCanvas(), maxSide, crop);
  };

  const buildFrameOutputAtTime = async (time, processConfig, { maxSide = null, crop = null } = {}) => {
    const { imageData } = await captureFrameImageDataAtTime(time, { maxSide, crop });
    const rendered = await renderProcessedFrameBlob({
      sourceImageData: imageData,
      processConfig,
      outputCanvas: ensureOutputCanvas(),
      scratchCanvas: scratchCanvasRef.current,
    });

    scratchCanvasRef.current = rendered.scratchCanvas || scratchCanvasRef.current;
    return rendered;
  };

  const extractFrames = async () => {
    if (!videoMeta || !plan) {
      return;
    }

    const processConfig = currentProcessConfig;
    setExtracting(true);
    setStatus(`准备抽取 ${plan.actualFrames} 张预览帧…`);

    try {
      const nextFrames = [];
      const cropAtExtraction = cropRect;

      for (let index = 0; index < plan.timestamps.length; index += 1) {
        const time = plan.timestamps[index];
        setStatus(`正在抽取第 ${index + 1} / ${plan.timestamps.length} 张：${formatDurationLabel(time)}`);
        const { blob, width, height } = await buildFrameOutputAtTime(time, processConfig, {
          maxSide: PREVIEW_MAX_SIDE,
          crop: cropAtExtraction,
        });
        nextFrames.push({
          id: `frame-${index + 1}-${time}`,
          index: index + 1,
          time,
          label: formatDurationLabel(time),
          previewUrl: URL.createObjectURL(blob),
          previewWidth: width,
          previewHeight: height,
          processConfig,
          cropRect: cropAtExtraction,
        });
      }

      setPreviewFrames(nextFrames);
      setStatus(
        processConfig.outputMode === "transparent"
          ? `抽帧完成，共生成 ${nextFrames.length} 张透明预览图。修改去底参数后，请重新抽帧以刷新当前结果。`
          : `抽帧完成，共生成 ${nextFrames.length} 张预览图。可以逐张下载，也可以批量导出 PNG。`,
      );
    } catch (error) {
      console.error(error);
      setStatus(`抽帧失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    } finally {
      setExtracting(false);
    }
  };

  const downloadFrame = async (frame) => {
    if (!videoMeta) {
      return;
    }

    setDownloadingOneId(frame.id);
    setStatus(`正在导出 ${frame.label} 的${frame.processConfig?.outputMode === "transparent" ? "透明" : "原始"} PNG…`);

    try {
      const { blob } = await buildFrameOutputAtTime(frame.time, frame.processConfig || currentProcessConfig, {
        crop: frame.cropRect || null,
      });
      triggerBlobDownload(blob, createVideoFrameFileName(videoMeta.name, frame.index, frame.time));
      setStatus(`已导出第 ${frame.index} 张：${frame.label}。`);
    } catch (error) {
      console.error(error);
      setStatus(`导出失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    } finally {
      setDownloadingOneId(null);
    }
  };

  const downloadAllFrames = async () => {
    if (!videoMeta || !frames.length) {
      return;
    }

    setDownloadingAll(true);
    setStatus(`准备导出 ${frames.length} 张 PNG。浏览器可能会请求批量下载权限。`);

    try {
      for (const frame of frames) {
        const { blob } = await buildFrameOutputAtTime(frame.time, frame.processConfig || currentProcessConfig, {
          crop: frame.cropRect || null,
        });
        triggerBlobDownload(blob, createVideoFrameFileName(videoMeta.name, frame.index, frame.time));
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }

      setStatus(`已触发 ${frames.length} 张 PNG 下载。`);
    } catch (error) {
      console.error(error);
      setStatus(`批量导出失败：${error instanceof Error ? error.message : "请稍后重试"}`);
    } finally {
      setDownloadingAll(false);
    }
  };

  const resultPreviewUsesTransparency = frames[0]?.processConfig?.outputMode === "transparent";
  const overlayCropStyle = videoMeta ? getOverlayCropStyle(cropRect, videoMeta.width, videoMeta.height) : null;

  return (
    <ImageToolWorkspace
      homeHref={homeHref}
      topHint="当前工具：视频帧提取"
      title="视频帧提取"
      subtitle="把本地视频按时间窗口抽成一组静态帧。支持按总张数均匀抽帧，也支持按时间间隔连续抽帧，导出为 PNG。"
      metaText={metaText}
      shellMaxWidth="1500px"
      layoutColumns="360px minmax(0, 1fr)"
      canvasColumns="minmax(0, 0.92fr) minmax(0, 1.18fr)"
      sidebar={
        <>
          <div>
            <label style={styles.label}>选择视频</label>
            <input
              type="file"
              accept="video/*"
              onChange={(event) => loadVideo(event.target.files?.[0])}
              disabled={controlsDisabled}
              style={styles.fileInput}
            />
            <div style={styles.mutedTip}>
              整个抽帧过程都在浏览器本地完成。当前最多一次生成 {MAX_EXTRACT_FRAMES} 张预览帧；如果开启透明输出，会对每一帧自动去底并做边缘精修。
            </div>
          </div>

          <EditModeSelector
            mode={mode}
            disabled={!videoMeta || controlsDisabled}
            onChange={setMode}
            title="抽帧方式"
            options={[
              ["count", "按张数"],
              ["fps", "按 FPS"],
              ["interval", "按间隔"],
            ]}
          />

          <EditModeSelector
            mode={outputMode}
            disabled={!videoMeta || controlsDisabled}
            onChange={setOutputMode}
            title="输出方式"
            options={[
              ["raw", "原始帧"],
              ["transparent", "透明抠图"],
            ]}
          />

          <div style={styles.controlGrid}>
            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>开始时间</span>
                <span style={styles.value}>{formatDurationLabel(startTime)}</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={startTime}
                onChange={(event) => setStartTime(Math.max(0, Number(event.target.value) || 0))}
                disabled={!videoMeta || controlsDisabled}
                style={styles.numberInput}
              />
            </div>

            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>结束时间</span>
                <span style={styles.value}>{formatDurationLabel(endTime)}</span>
              </div>
              <input
                type="number"
                min="0"
                step="0.1"
                value={endTime}
                onChange={(event) => setEndTime(Math.max(0, Number(event.target.value) || 0))}
                disabled={!videoMeta || controlsDisabled}
                style={styles.numberInput}
              />
            </div>
          </div>

          {mode === "count" ? (
            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>总张数</span>
                <span style={styles.value}>{frameCount} 张</span>
              </div>
              <input
                type="number"
                min="1"
                max={MAX_EXTRACT_FRAMES}
                value={frameCount}
                onChange={(event) => setFrameCount(normalizeFrameCount(event.target.value))}
                disabled={!videoMeta || controlsDisabled}
                style={styles.numberInput}
              />
            </div>
          ) : mode === "fps" ? (
            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>每秒提取</span>
                <span style={styles.value}>{framesPerSecond} 帧</span>
              </div>
              <input
                type="number"
                min="0.1"
                max="60"
                step="0.1"
                value={framesPerSecond}
                onChange={(event) => setFramesPerSecond(normalizeFramesPerSecond(event.target.value))}
                disabled={!videoMeta || controlsDisabled}
                style={styles.numberInput}
              />
              <div style={styles.mutedTip}>
                {estimatedFps
                  ? `当前视频估算帧率约 ${estimatedFps} fps。提取 FPS 高于源视频时，可能会得到重复帧。`
                  : "当前浏览器没有稳定拿到源视频帧率时，会继续按你填写的 FPS 时间步长抓帧。"}
              </div>
            </div>
          ) : (
            <div style={styles.numberCard}>
              <div style={styles.rowBetween}>
                <span style={styles.labelInline}>时间间隔</span>
                <span style={styles.value}>{intervalSeconds} 秒</span>
              </div>
              <input
                type="number"
                min="0.1"
                max="60"
                step="0.1"
                value={intervalSeconds}
                onChange={(event) => setIntervalSeconds(normalizeIntervalSeconds(event.target.value))}
                disabled={!videoMeta || controlsDisabled}
                style={styles.numberInput}
              />
            </div>
          )}

          {outputMode === "transparent" ? (
            <>
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
                  disabled={!videoMeta || controlsDisabled}
                  style={styles.range}
                />
                <div style={styles.mutedTip}>当前仍然走轻量的边缘背景取样去底方式，适合背景较干净的人像、商品或已经有透明边缘的素材。</div>
              </div>

              <div style={styles.controlGrid}>
                <div style={styles.numberCard}>
                  <div style={styles.rowBetween}>
                    <span style={styles.labelInline}>边缘内收</span>
                    <span style={styles.value}>{contractPx}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={MAX_CONTRACT_PX}
                    value={contractPx}
                    onChange={(event) => setContractPx(Number(event.target.value))}
                    disabled={!videoMeta || controlsDisabled}
                    style={styles.range}
                  />
                  <div style={styles.mutedTip}>把选区边缘往里收一圈。`1px` 常用来压掉人物边缘的彩边和像素杂点。</div>
                </div>

                <div style={styles.numberCard}>
                  <div style={styles.rowBetween}>
                    <span style={styles.labelInline}>羽化</span>
                    <span style={styles.value}>{featherPx}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={MAX_FEATHER_PX}
                    value={featherPx}
                    onChange={(event) => setFeatherPx(Number(event.target.value))}
                    disabled={!videoMeta || controlsDisabled}
                    style={styles.range}
                  />
                  <div style={styles.mutedTip}>轻微羽化能缓和锯齿，但数值太大时边缘会发虚。</div>
                </div>
              </div>

              <div style={styles.toggleCard}>
                <label style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={despeckle}
                    onChange={(event) => setDespeckle(event.target.checked)}
                    disabled={!videoMeta || controlsDisabled}
                    style={styles.checkbox}
                  />
                  <span>单像素去噪</span>
                </label>
                <div style={styles.mutedTip}>会清理孤立的前景像素点，并填掉单像素级别的小透明孔洞。</div>
              </div>
            </>
          ) : null}

          <div style={styles.toggleCard}>
            <label style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={cropMode}
                onChange={(event) => setCropMode(event.target.checked)}
                disabled={!videoMeta || controlsDisabled}
                style={styles.checkbox}
              />
              <span>画面框选裁切</span>
            </label>
            <div style={styles.mutedTip}>开启后可直接在左侧原视频上拖拽，提取指定区域的图片。未框选时默认输出整张画面。</div>
            <div style={{ ...styles.cropButtonRow, marginTop: "12px" }}>
              <button
                onClick={() => setCropMode((value) => !value)}
                disabled={!videoMeta || controlsDisabled}
                style={{
                  ...styles.secondaryButton,
                  ...(!videoMeta || controlsDisabled ? styles.buttonDisabled : null),
                }}
              >
                {cropMode ? "关闭框选" : "开始框选"}
              </button>
              <button
                onClick={() => setCropRect(null)}
                disabled={!cropRect || controlsDisabled}
                style={{
                  ...styles.secondaryButton,
                  ...(!cropRect || controlsDisabled ? styles.buttonDisabled : null),
                }}
              >
                清空选区
              </button>
            </div>
          </div>

          <div style={styles.buttonGrid}>
            <button
              onClick={extractFrames}
              disabled={!videoMeta || !plan || controlsDisabled}
              style={{
                ...styles.primaryButton,
                ...(!videoMeta || !plan || controlsDisabled ? styles.buttonDisabled : null),
              }}
            >
              {extracting ? "抽帧中..." : "开始抽帧"}
            </button>
            <button
              onClick={downloadAllFrames}
              disabled={!frames.length || controlsDisabled}
              style={{
                ...styles.infoButton,
                ...(!frames.length || controlsDisabled ? styles.buttonDisabled : null),
              }}
            >
              {downloadingAll ? "导出中..." : "导出全部 PNG"}
            </button>
          </div>

          <StatusCard body={status} />
          <StatusCard title="抽帧方案" body={planSummary} />
          <StatusCard title="裁切区域" body={cropSummary} />
          <StatusCard title="当前输出" body={processSummary} />
          {processSettingsDirty || cropSettingsDirty ? (
            <StatusCard
              title="参数变更提醒"
              body={`${
                processSettingsDirty ? "透明输出参数已变更。" : ""
              }${cropSettingsDirty ? " 框选区域已变更。" : ""}当前右侧预览仍然是上一次抽帧结果，点击“开始抽帧”后才会重新生成。`}
            />
          ) : null}
          <SelfTestCard tests={testResults} />
        </>
      }
    >
      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>原视频</div>
          <div style={styles.badge}>
            <span style={styles.badgeDot} />
            {videoMeta ? `${formatDurationLabel(videoMeta.duration)} · ${videoMeta.width} × ${videoMeta.height}` : "等待视频"}
          </div>
        </div>
        <div style={styles.videoShell}>
          <video
            ref={videoRef}
            controls
            playsInline
            style={{
              ...styles.videoElement,
              display: videoMeta ? "block" : "none",
            }}
          />
          {videoMeta ? (
            <div
              style={{
                ...styles.cropOverlay,
                pointerEvents: cropMode ? "auto" : "none",
                cursor: cropMode ? "crosshair" : "default",
              }}
              onPointerDown={handleCropPointerDown}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
            >
              {overlayCropStyle ? (
                <div style={{ ...styles.cropBox, ...overlayCropStyle }} />
              ) : null}
            </div>
          ) : null}
          {videoMeta ? null : <div style={{ ...styles.placeholder, border: "none", borderRadius: 0 }}>上传视频后，这里会显示原视频预览和时间信息。</div>}
        </div>
        <div style={styles.mutedTip}>
          抽帧时会复用同一个视频元素逐帧 seek，再抓取成 PNG。复杂编码的视频首次定位可能稍慢。
          {estimatedFps ? ` 当前视频估算帧率约为 ${estimatedFps} fps。` : " 当前浏览器未稳定拿到源帧率时，会继续显示时长和分辨率信息。"}
        </div>
      </div>

      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>抽帧结果</div>
          <div style={styles.smallMuted}>
            {frames.length
              ? `${frames.length} 张${resultPreviewUsesTransparency ? "透明" : ""}预览帧`
              : "尚未生成"}
          </div>
        </div>
        <div style={styles.frameScroller}>
          {frames.length ? (
            <div style={styles.frameGrid}>
              {frames.map((frame) => (
                <div key={frame.id} style={styles.frameCard}>
                  <div style={styles.frameHead}>
                    <div>
                      <div style={styles.frameTitle}>{frame.label}</div>
                      <div style={styles.frameMeta}>
                        第 {frame.index} 张 · {frame.previewWidth} × {frame.previewHeight} · {frame.processConfig?.outputMode === "transparent" ? "透明 PNG" : "原始 PNG"}
                      </div>
                    </div>
                    <div style={styles.smallMuted}>PNG</div>
                  </div>
                  <div
                    style={{
                      ...styles.frameThumbWrap,
                      ...(frame.processConfig?.outputMode === "transparent" ? checkerboard : null),
                    }}
                  >
                    <img src={frame.previewUrl} alt={`frame-${frame.index}`} style={styles.frameThumb} />
                  </div>
                  <button
                    onClick={() => downloadFrame(frame)}
                    disabled={controlsDisabled}
                    style={{
                      ...styles.downloadButton,
                      ...(controlsDisabled ? styles.buttonDisabled : null),
                    }}
                  >
                    {downloadingOneId === frame.id ? "导出中..." : "下载这张"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.placeholder}>设置时间范围和抽帧方式后，点击“开始抽帧”，右侧会生成所有预览帧。</div>
          )}
        </div>
        <div style={styles.mutedTip}>
          预览使用缩略图减轻内存占用；实际下载时会重新按原视频分辨率抓取 PNG。
          {resultPreviewUsesTransparency ? " 透明模式下，导出会按同一组去底与精修参数重新处理整帧。" : ""}
        </div>
      </div>
    </ImageToolWorkspace>
  );
}
