export const MAX_EXTRACT_FRAMES = 120;
export const MAX_FRAME_SHEET_SIDE = 8192;
export const MAX_FRAME_SHEET_PIXELS = 33554432;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToTenths(value) {
  return Math.round(value * 10) / 10;
}

function roundToMillis(value) {
  return Math.round(value * 1000) / 1000;
}

export function normalizeFrameCount(value, { min = 1, max = MAX_EXTRACT_FRAMES, fallback = 12 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return clamp(Math.round(numeric), min, max);
}

export function normalizeIntervalSeconds(value, { min = 0.1, max = 60, fallback = 1 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return roundToTenths(clamp(numeric, min, max));
}

export function normalizeFramesPerSecond(value, { min = 0.1, max = 60, fallback = 1 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return roundToTenths(clamp(numeric, min, max));
}

export function formatDurationLabel(seconds) {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalTenths = Math.round(safe * 10);
  const hours = Math.floor(totalTenths / 36000);
  const minutes = Math.floor((totalTenths % 36000) / 600);
  const wholeSeconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  const secondsLabel = `${String(wholeSeconds).padStart(2, "0")}${tenths ? `.${tenths}` : ""}`;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${secondsLabel}`;
  }

  return `${minutes}:${secondsLabel}`;
}

export function createVideoFrameFileName(fileName, index, time) {
  const stem = (fileName || "video-frame").replace(/\.[^.]+$/, "");
  const safeLabel = formatDurationLabel(time).replace(/[:.]/g, "-");
  return `${stem}-frame-${String(index).padStart(3, "0")}-${safeLabel}.png`;
}

export function createVideoFrameSheetFileName(fileName, frameCount, startTime, endTime) {
  const stem = (fileName || "video-frame").replace(/\.[^.]+$/, "");
  const startLabel = formatDurationLabel(startTime).replace(/[:.]/g, "-");
  const endLabel = formatDurationLabel(endTime).replace(/[:.]/g, "-");
  return `${stem}-frames-${String(frameCount).padStart(3, "0")}-${startLabel}-to-${endLabel}.png`;
}

export function buildFrameSheetLayout({
  frameCount,
  frameWidth,
  frameHeight,
  maxSide = MAX_FRAME_SHEET_SIDE,
  maxPixels = MAX_FRAME_SHEET_PIXELS,
}) {
  const safeCount = Math.max(0, Math.round(Number(frameCount) || 0));
  const safeWidth = Math.max(0, Math.round(Number(frameWidth) || 0));
  const safeHeight = Math.max(0, Math.round(Number(frameHeight) || 0));

  if (!safeCount || !safeWidth || !safeHeight) {
    return null;
  }

  let bestLayout = null;

  for (let columns = 1; columns <= safeCount; columns += 1) {
    const rows = Math.ceil(safeCount / columns);
    const rawWidth = columns * safeWidth;
    const rawHeight = rows * safeHeight;
    const rawPixels = rawWidth * rawHeight;
    const sideScale = Math.min(
      1,
      maxSide > 0 ? maxSide / rawWidth : 1,
      maxSide > 0 ? maxSide / rawHeight : 1,
    );
    const pixelScale = Math.min(1, maxPixels > 0 ? Math.sqrt(maxPixels / rawPixels) : 1);
    const scale = Math.max(0, Math.min(sideScale, pixelScale));
    const cellWidth = Math.max(1, Math.floor(safeWidth * scale));
    const cellHeight = Math.max(1, Math.floor(safeHeight * scale));
    const sheetWidth = cellWidth * columns;
    const sheetHeight = cellHeight * rows;
    const occupancy = safeCount / (columns * rows);
    const balance = Math.min(sheetWidth, sheetHeight) / Math.max(sheetWidth, sheetHeight);
    const score = scale * 1000 + occupancy * 10 + balance;

    if (!bestLayout || score > bestLayout.score) {
      bestLayout = {
        columns,
        rows,
        cellWidth,
        cellHeight,
        width: sheetWidth,
        height: sheetHeight,
        scale,
        limited: scale < 0.999,
        score,
      };
    }
  }

  if (!bestLayout) {
    return null;
  }

  return {
    columns: bestLayout.columns,
    rows: bestLayout.rows,
    cellWidth: bestLayout.cellWidth,
    cellHeight: bestLayout.cellHeight,
    width: bestLayout.width,
    height: bestLayout.height,
    scale: Math.round(bestLayout.scale * 1000) / 1000,
    limited: bestLayout.limited,
  };
}

export function buildFrameExtractionPlan({
  duration,
  mode,
  frameCount,
  intervalSeconds,
  framesPerSecond,
  startTime,
  endTime,
  maxFrames = MAX_EXTRACT_FRAMES,
}) {
  const safeDuration = Math.max(0, Number.isFinite(duration) ? duration : 0);
  const safeStart = clamp(Number.isFinite(startTime) ? startTime : 0, 0, safeDuration);
  const safeEnd = clamp(Number.isFinite(endTime) ? endTime : safeDuration, safeStart, safeDuration);
  const spanSeconds = Math.max(0, safeEnd - safeStart);

  if (safeDuration <= 0) {
    return {
      mode,
      startTime: 0,
      endTime: 0,
      spanSeconds: 0,
      timestamps: [],
      actualFrames: 0,
      limitedByMaxFrames: false,
      stepSeconds: mode === "interval" ? normalizeIntervalSeconds(intervalSeconds) : null,
      framesPerSecond: mode === "fps" ? normalizeFramesPerSecond(framesPerSecond) : null,
    };
  }

  if (mode === "fps") {
    const safeFps = normalizeFramesPerSecond(framesPerSecond);
    const stepSeconds = 1 / safeFps;
    const timestamps = [];
    let currentTime = safeStart;
    let safety = 0;

    while (currentTime <= safeEnd + 0.0005 && timestamps.length < maxFrames && safety < maxFrames * 4) {
      timestamps.push(roundToMillis(currentTime));
      currentTime += stepSeconds;
      safety += 1;
    }

    if (timestamps.length === 0) {
      timestamps.push(roundToMillis(safeStart));
    }

    const estimatedFrames = spanSeconds <= 0 ? 1 : Math.floor(spanSeconds * safeFps) + 1;

    return {
      mode,
      startTime: safeStart,
      endTime: safeEnd,
      spanSeconds,
      stepSeconds,
      timestamps,
      actualFrames: timestamps.length,
      limitedByMaxFrames: estimatedFrames > timestamps.length,
      framesPerSecond: safeFps,
    };
  }

  if (mode === "interval") {
    const stepSeconds = normalizeIntervalSeconds(intervalSeconds);
    const timestamps = [];
    let currentTime = safeStart;
    let safety = 0;

    while (currentTime <= safeEnd + 0.0005 && timestamps.length < maxFrames && safety < maxFrames * 4) {
      timestamps.push(roundToMillis(currentTime));
      currentTime += stepSeconds;
      safety += 1;
    }

    if (timestamps.length === 0) {
      timestamps.push(roundToMillis(safeStart));
    }

    const estimatedFrames = spanSeconds <= 0 ? 1 : Math.floor(spanSeconds / stepSeconds) + 1;

    return {
      mode,
      startTime: safeStart,
      endTime: safeEnd,
      spanSeconds,
      stepSeconds,
      timestamps,
      actualFrames: timestamps.length,
      limitedByMaxFrames: estimatedFrames > timestamps.length,
      framesPerSecond: null,
    };
  }

  const count = normalizeFrameCount(frameCount, { max: maxFrames });
  if (count <= 1 || spanSeconds <= 0.0005) {
    return {
      mode,
      startTime: safeStart,
      endTime: safeEnd,
      spanSeconds,
      timestamps: [roundToMillis(safeStart)],
      actualFrames: 1,
      limitedByMaxFrames: false,
      stepSeconds: null,
      framesPerSecond: null,
    };
  }

  const stepSeconds = spanSeconds / (count - 1);
  const timestamps = [];

  for (let index = 0; index < count; index += 1) {
    timestamps.push(roundToMillis(safeStart + stepSeconds * index));
  }

  timestamps[timestamps.length - 1] = roundToMillis(safeEnd);

  return {
    mode,
    startTime: safeStart,
    endTime: safeEnd,
    spanSeconds,
    timestamps,
    actualFrames: timestamps.length,
    limitedByMaxFrames: false,
    stepSeconds,
    framesPerSecond: null,
  };
}

export function runVideoFrameTests() {
  const countPlan = buildFrameExtractionPlan({
    duration: 9,
    mode: "count",
    frameCount: 4,
    intervalSeconds: 1,
    startTime: 0,
    endTime: 9,
  });
  const intervalPlan = buildFrameExtractionPlan({
    duration: 5,
    mode: "interval",
    frameCount: 12,
    intervalSeconds: 2,
    framesPerSecond: 1,
    startTime: 0.5,
    endTime: 4.6,
  });
  const fpsPlan = buildFrameExtractionPlan({
    duration: 2,
    mode: "fps",
    frameCount: 12,
    intervalSeconds: 1,
    framesPerSecond: 2,
    startTime: 0,
    endTime: 1.6,
  });
  const clampedPlan = buildFrameExtractionPlan({
    duration: 7.2,
    mode: "count",
    frameCount: 3,
    intervalSeconds: 1,
    framesPerSecond: 1,
    startTime: -4,
    endTime: 99,
  });
  const sheetLayout = buildFrameSheetLayout({
    frameCount: 10,
    frameWidth: 1920,
    frameHeight: 1080,
  });

  return [
    {
      name: "等数量抽帧",
      pass: JSON.stringify(countPlan.timestamps) === JSON.stringify([0, 3, 6, 9]),
      details: countPlan.timestamps.join(", "),
    },
    {
      name: "等间隔抽帧",
      pass: JSON.stringify(intervalPlan.timestamps) === JSON.stringify([0.5, 2.5, 4.5]),
      details: intervalPlan.timestamps.join(", "),
    },
    {
      name: "时间窗口夹紧",
      pass: clampedPlan.startTime === 0 && clampedPlan.endTime === 7.2,
      details: `${clampedPlan.startTime} - ${clampedPlan.endTime}`,
    },
    {
      name: "按 FPS 抽帧",
      pass: JSON.stringify(fpsPlan.timestamps) === JSON.stringify([0, 0.5, 1, 1.5]),
      details: fpsPlan.timestamps.join(", "),
    },
    {
      name: "合并图布局限制",
      pass:
        Boolean(sheetLayout) &&
        sheetLayout.width <= MAX_FRAME_SHEET_SIDE &&
        sheetLayout.height <= MAX_FRAME_SHEET_SIDE &&
        sheetLayout.columns * sheetLayout.rows >= 10,
      details: sheetLayout ? `${sheetLayout.columns}x${sheetLayout.rows} @ ${sheetLayout.width}x${sheetLayout.height}` : "null",
    },
  ];
}
