import { useEffect, useMemo, useRef, useState } from "react";
import ImageToolWorkspace from "../components/ImageToolWorkspace.jsx";
import {
  EditModeSelector,
  SelfTestCard,
  StatusCard,
} from "../components/ImageToolPanels.jsx";
import { sharedToolPageStyles } from "../components/imageToolWorkspaceStyles.js";
import {
  MAX_EXTRACT_FRAMES,
  buildFrameExtractionPlan,
  createVideoFrameFileName,
  formatDurationLabel,
  normalizeFrameCount,
  normalizeIntervalSeconds,
  runVideoFrameTests,
} from "../lib/videoFrameCore.js";

const PREVIEW_MAX_SIDE = 320;

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

function captureFrameBlob(video, canvas, maxSide = null) {
  return new Promise((resolve, reject) => {
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (!sourceWidth || !sourceHeight) {
      reject(new Error("视频尺寸无效"));
      return;
    }

    const scale = maxSide ? Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight)) : 1;
    const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
    canvas.width = drawWidth;
    canvas.height = drawHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("无法获取画布上下文"));
      return;
    }

    ctx.clearRect(0, 0, drawWidth, drawHeight);
    ctx.drawImage(video, 0, 0, drawWidth, drawHeight);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("浏览器没有生成图片数据"));
        return;
      }

      resolve({
        blob,
        width: drawWidth,
        height: drawHeight,
      });
    }, "image/png");
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

export default function VideoFrameToolPage({ homeHref }) {
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const previewFramesRef = useRef([]);
  const videoUrlRef = useRef("");

  const [videoMeta, setVideoMeta] = useState(null);
  const [mode, setMode] = useState("count");
  const [frameCount, setFrameCount] = useState(12);
  const [intervalSeconds, setIntervalSeconds] = useState(1);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingOneId, setDownloadingOneId] = useState(null);
  const [frames, setFrames] = useState([]);
  const [status, setStatus] = useState("上传视频后，可以按张数或时间间隔抽出关键帧，并导出 PNG。");
  const [testResults] = useState(() => runVideoFrameTests());

  const plan = useMemo(() => {
    if (!videoMeta) {
      return null;
    }

    return buildFrameExtractionPlan({
      duration: videoMeta.duration,
      mode,
      frameCount,
      intervalSeconds,
      startTime,
      endTime,
    });
  }, [endTime, frameCount, intervalSeconds, mode, startTime, videoMeta]);

  const metaText = useMemo(() => {
    if (!videoMeta) {
      return "还没有载入视频";
    }

    return `${videoMeta.name} · ${videoMeta.width} × ${videoMeta.height} · ${formatDurationLabel(videoMeta.duration)}`;
  }, [videoMeta]);

  const planSummary = useMemo(() => {
    if (!videoMeta || !plan) {
      return "等待视频载入。抽帧时会按设定的时间窗口生成 PNG 预览。";
    }

    const timeWindow = `${formatDurationLabel(plan.startTime)} - ${formatDurationLabel(plan.endTime)}`;
    const ruleText =
      mode === "count"
        ? `按数量均匀抽 ${plan.actualFrames} 张`
        : `每 ${plan.stepSeconds} 秒抽一张，共 ${plan.actualFrames} 张`;
    const limitText = plan.limitedByMaxFrames ? `；已自动限制在 ${MAX_EXTRACT_FRAMES} 张以内。` : "。";

    return `${timeWindow}，${ruleText}${limitText}`;
  }, [mode, plan, videoMeta]);

  useEffect(() => {
    previewFramesRef.current = frames;
  }, [frames]);

  useEffect(() => () => {
    revokePreviewUrls(previewFramesRef.current);
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
  }, []);

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
    setStartTime(0);
    setEndTime(0);
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

  const captureFrameAtTime = async (time, { maxSide = null } = {}) => {
    const video = videoRef.current;
    if (!video) {
      throw new Error("视频尚未初始化");
    }

    await seekVideo(video, time);
    return captureFrameBlob(video, ensureCaptureCanvas(), maxSide);
  };

  const extractFrames = async () => {
    if (!videoMeta || !plan) {
      return;
    }

    setExtracting(true);
    setStatus(`准备抽取 ${plan.actualFrames} 张预览帧…`);

    try {
      const nextFrames = [];

      for (let index = 0; index < plan.timestamps.length; index += 1) {
        const time = plan.timestamps[index];
        setStatus(`正在抽取第 ${index + 1} / ${plan.timestamps.length} 张：${formatDurationLabel(time)}`);
        const { blob, width, height } = await captureFrameAtTime(time, { maxSide: PREVIEW_MAX_SIDE });
        nextFrames.push({
          id: `frame-${index + 1}-${time}`,
          index: index + 1,
          time,
          label: formatDurationLabel(time),
          previewUrl: URL.createObjectURL(blob),
          previewWidth: width,
          previewHeight: height,
        });
      }

      setPreviewFrames(nextFrames);
      setStatus(`抽帧完成，共生成 ${nextFrames.length} 张预览图。可以逐张下载，也可以批量导出 PNG。`);
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
    setStatus(`正在导出 ${frame.label} 的原始分辨率 PNG…`);

    try {
      const { blob } = await captureFrameAtTime(frame.time);
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
    setStatus(`准备导出 ${frames.length} 张原始分辨率 PNG。浏览器可能会请求批量下载权限。`);

    try {
      for (const frame of frames) {
        const { blob } = await captureFrameAtTime(frame.time);
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
            <div style={styles.mutedTip}>整个抽帧过程都在浏览器本地完成。当前最多一次生成 {MAX_EXTRACT_FRAMES} 张预览帧。</div>
          </div>

          <EditModeSelector
            mode={mode}
            disabled={!videoMeta || controlsDisabled}
            onChange={setMode}
            title="抽帧方式"
            options={[
              ["count", "按张数"],
              ["interval", "按间隔"],
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
          {videoMeta ? null : <div style={{ ...styles.placeholder, border: "none", borderRadius: 0 }}>上传视频后，这里会显示原视频预览和时间信息。</div>}
        </div>
        <div style={styles.mutedTip}>抽帧时会复用同一个视频元素逐帧 seek，再抓取成 PNG。复杂编码的视频首次定位可能稍慢。</div>
      </div>

      <div style={styles.canvasCard}>
        <div style={styles.rowBetween}>
          <div style={styles.canvasTitle}>抽帧结果</div>
          <div style={styles.smallMuted}>{frames.length ? `${frames.length} 张预览帧` : "尚未生成"}</div>
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
                        第 {frame.index} 张 · {frame.previewWidth} × {frame.previewHeight}
                      </div>
                    </div>
                    <div style={styles.smallMuted}>PNG</div>
                  </div>
                  <div style={styles.frameThumbWrap}>
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
        <div style={styles.mutedTip}>预览使用缩略图减轻内存占用；实际下载时会重新按原视频分辨率抓取 PNG。</div>
      </div>
    </ImageToolWorkspace>
  );
}
