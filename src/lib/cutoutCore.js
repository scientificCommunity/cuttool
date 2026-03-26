export function clamp(value, min, max) {
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

export function isValidImageDataLike(imageData) {
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

export function checkerboardStyle() {
  return {
    backgroundImage:
      "linear-gradient(45deg, rgba(148,163,184,.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(148,163,184,.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(148,163,184,.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(148,163,184,.18) 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
  };
}

export async function decodeImageFromFile(file) {
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
          source: bitmap,
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
      source: img,
      draw: (ctx, drawWidth, drawHeight) => ctx.drawImage(img, 0, 0, drawWidth, drawHeight),
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function getSafeImageData(ctx, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  if (!isValidImageDataLike(imageData)) {
    throw new Error("读取图片像素失败");
  }
  return imageData;
}

export function createOpaqueMask(width, height) {
  const mask = new Uint8ClampedArray(width * height);
  mask.fill(255);
  return mask;
}

export function buildAutoMask(sourceImageData, threshold) {
  if (!isValidImageDataLike(sourceImageData)) {
    throw new Error("当前没有可处理的图片");
  }

  const { width, height, data } = sourceImageData;
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

  return softened;
}

function getScratchCanvas(scratchCanvas) {
  if (scratchCanvas) {
    return scratchCanvas;
  }

  if (typeof document !== "undefined") {
    return document.createElement("canvas");
  }

  return null;
}

function paintMaskedSource(ctx, scratchCanvas, sourceImageData, mask) {
  if (!isValidImageDataLike(sourceImageData) || !mask) {
    return scratchCanvas;
  }

  if (mask.length < sourceImageData.width * sourceImageData.height) {
    return scratchCanvas;
  }

  const nextScratch = getScratchCanvas(scratchCanvas);
  if (!nextScratch) {
    return scratchCanvas;
  }

  nextScratch.width = sourceImageData.width;
  nextScratch.height = sourceImageData.height;

  const scratchCtx = nextScratch.getContext("2d", { willReadFrequently: true });
  if (!scratchCtx) {
    return scratchCanvas;
  }

  const output = new ImageData(sourceImageData.width, sourceImageData.height);
  for (let pixel = 0, index = 0; pixel < mask.length; pixel += 1, index += 4) {
    if (index + 3 >= sourceImageData.data.length || index + 3 >= output.data.length) {
      break;
    }

    output.data[index] = sourceImageData.data[index];
    output.data[index + 1] = sourceImageData.data[index + 1];
    output.data[index + 2] = sourceImageData.data[index + 2];
    output.data[index + 3] = mask[pixel];
  }

  scratchCtx.clearRect(0, 0, nextScratch.width, nextScratch.height);
  scratchCtx.putImageData(output, 0, 0);
  ctx.drawImage(nextScratch, 0, 0);

  return nextScratch;
}

export function renderMaskedImageToCanvas({ canvas, scratchCanvas, sourceImageData, mask }) {
  if (!canvas || !isValidImageDataLike(sourceImageData) || !mask) {
    return scratchCanvas;
  }

  canvas.width = sourceImageData.width;
  canvas.height = sourceImageData.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return scratchCanvas;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return paintMaskedSource(ctx, scratchCanvas, sourceImageData, mask);
}

function getGradientEndpoints(width, height, angle = 135) {
  const radians = (angle * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const halfSpan = Math.abs(Math.cos(radians)) * (width / 2) + Math.abs(Math.sin(radians)) * (height / 2);
  const dx = Math.cos(radians) * halfSpan;
  const dy = Math.sin(radians) * halfSpan;
  return [cx - dx, cy - dy, cx + dx, cy + dy];
}

function drawDecodedImageCover(ctx, asset, width, height) {
  const source = asset?.source;
  const sourceWidth = asset?.width;
  const sourceHeight = asset?.height;

  if (!source || !sourceWidth || !sourceHeight) {
    return false;
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = width / height;
  let drawWidth;
  let drawHeight;
  let drawX = 0;
  let drawY = 0;

  if (sourceAspect > targetAspect) {
    drawHeight = height;
    drawWidth = height * sourceAspect;
    drawX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / sourceAspect;
    drawY = (height - drawHeight) / 2;
  }

  ctx.drawImage(source, drawX, drawY, drawWidth, drawHeight);
  return true;
}

function drawBackground(ctx, width, height, background) {
  const config = background || {};

  if (config.type === "image" && drawDecodedImageCover(ctx, config.asset, width, height)) {
    return;
  }

  if (config.type === "gradient" && Array.isArray(config.stops) && config.stops.length >= 2) {
    const [x0, y0, x1, y1] = getGradientEndpoints(width, height, config.angle);
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
    config.stops.forEach((color, index) => {
      const stop = config.stops.length === 1 ? 0 : index / (config.stops.length - 1);
      gradient.addColorStop(stop, color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.fillStyle = config.color || "#f8fafc";
  ctx.fillRect(0, 0, width, height);
}

export function renderCompositeToCanvas({ canvas, scratchCanvas, sourceImageData, mask, background }) {
  if (!canvas || !isValidImageDataLike(sourceImageData) || !mask) {
    return scratchCanvas;
  }

  canvas.width = sourceImageData.width;
  canvas.height = sourceImageData.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return scratchCanvas;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx, canvas.width, canvas.height, background);
  return paintMaskedSource(ctx, scratchCanvas, sourceImageData, mask);
}

export function runInternalTests() {
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
    const mask = buildAutoMask(
      {
        width: 2,
        height: 2,
        data: new Uint8ClampedArray([
          255, 255, 255, 255,
          255, 255, 255, 255,
          30, 30, 30, 255,
          30, 30, 30, 255,
        ]),
      },
      16,
    );
    add("自动去底会产出有效蒙版", mask instanceof Uint8ClampedArray && mask.length === 4);
  } catch (error) {
    add("自动去底会产出有效蒙版", false, String(error));
  }

  return tests;
}
