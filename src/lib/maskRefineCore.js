function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function copyMask(mask, width, height) {
  const pixels = width * height;
  if (!(mask instanceof Uint8ClampedArray) || mask.length < pixels) {
    throw new Error("蒙版数据无效");
  }

  return new Uint8ClampedArray(mask.slice(0, pixels));
}

export function normalizeMaskRefineConfig(config = {}) {
  return {
    contractPx: clamp(Math.round(Number(config.contractPx) || 0), 0, 4),
    featherPx: clamp(Math.round(Number(config.featherPx) || 0), 0, 6),
    despeckle: Boolean(config.despeckle),
  };
}

function applySinglePixelCleanup(mask, width, height) {
  const next = new Uint8ClampedArray(mask);
  const threshold = 128;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let neighbors = 0;

      for (let yy = -1; yy <= 1; yy += 1) {
        for (let xx = -1; xx <= 1; xx += 1) {
          if (xx === 0 && yy === 0) {
            continue;
          }

          const neighborIndex = (y + yy) * width + (x + xx);
          if (mask[neighborIndex] >= threshold) {
            neighbors += 1;
          }
        }
      }

      const isForeground = mask[index] >= threshold;
      if (isForeground && neighbors <= 1) {
        next[index] = 0;
      } else if (!isForeground && neighbors >= 7) {
        next[index] = 255;
      }
    }
  }

  return next;
}

function contractMask(mask, width, height, steps) {
  let working = new Uint8ClampedArray(mask);

  for (let step = 0; step < steps; step += 1) {
    const next = new Uint8ClampedArray(working);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (working[index] < 128) {
          next[index] = 0;
          continue;
        }

        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
          next[index] = 0;
          continue;
        }

        let touchesBackground = false;
        for (let yy = -1; yy <= 1 && !touchesBackground; yy += 1) {
          for (let xx = -1; xx <= 1; xx += 1) {
            if (xx === 0 && yy === 0) {
              continue;
            }

            const neighborIndex = (y + yy) * width + (x + xx);
            if (working[neighborIndex] < 128) {
              touchesBackground = true;
              break;
            }
          }
        }

        if (touchesBackground) {
          next[index] = 0;
        }
      }
    }

    working = next;
  }

  return working;
}

function blurMask(mask, width, height, radius) {
  if (radius <= 0) {
    return new Uint8ClampedArray(mask);
  }

  const temp = new Float32Array(width * height);
  const output = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    const prefix = new Float32Array(width + 1);
    const rowStart = y * width;

    for (let x = 0; x < width; x += 1) {
      prefix[x + 1] = prefix[x] + mask[rowStart + x];
    }

    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      temp[rowStart + x] = (prefix[right + 1] - prefix[left]) / (right - left + 1);
    }
  }

  for (let x = 0; x < width; x += 1) {
    const prefix = new Float32Array(height + 1);

    for (let y = 0; y < height; y += 1) {
      prefix[y + 1] = prefix[y] + temp[y * width + x];
    }

    for (let y = 0; y < height; y += 1) {
      const top = Math.max(0, y - radius);
      const bottom = Math.min(height - 1, y + radius);
      output[y * width + x] = Math.round((prefix[bottom + 1] - prefix[top]) / (bottom - top + 1));
    }
  }

  return output;
}

export function refineAlphaMask(mask, width, height, config = {}) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error("蒙版尺寸无效");
  }

  const normalized = normalizeMaskRefineConfig(config);
  let working = copyMask(mask, width, height);

  if (normalized.despeckle) {
    working = applySinglePixelCleanup(working, width, height);
  }

  if (normalized.contractPx > 0) {
    working = contractMask(working, width, height, normalized.contractPx);
  }

  if (normalized.featherPx > 0) {
    working = blurMask(working, width, height, normalized.featherPx);
  }

  return working;
}

export function runMaskRefineTests() {
  const singlePixel = new Uint8ClampedArray([
    0, 0, 0,
    0, 255, 0,
    0, 0, 0,
  ]);
  const despeckled = refineAlphaMask(singlePixel, 3, 3, { despeckle: true });

  const squareMask = new Uint8ClampedArray([
    0, 0, 0, 0, 0,
    0, 255, 255, 255, 0,
    0, 255, 255, 255, 0,
    0, 255, 255, 255, 0,
    0, 0, 0, 0, 0,
  ]);
  const contracted = refineAlphaMask(squareMask, 5, 5, { contractPx: 1 });

  const feathered = refineAlphaMask(singlePixel, 3, 3, { featherPx: 1 });

  return [
    {
      name: "单像素去噪可移除孤点",
      pass: despeckled[4] === 0,
      details: `center=${despeckled[4]}`,
    },
    {
      name: "边缘内收可缩小主体",
      pass: contracted[12] === 255 && contracted[6] === 0 && contracted[8] === 0,
      details: `center=${contracted[12]}, edge=${contracted[6]}`,
    },
    {
      name: "羽化会扩散 alpha",
      pass: feathered[4] < 255 && feathered[1] > 0,
      details: `center=${feathered[4]}, side=${feathered[1]}`,
    },
  ];
}
