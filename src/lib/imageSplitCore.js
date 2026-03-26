export const MAX_SPLIT_COUNT = 100;

export function normalizeSplitCount(value, { min = 1, max = MAX_SPLIT_COUNT, fallback = 1 } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(numeric)));
}

export function getEffectiveSplitCounts(width, height, rows, columns) {
  const safeWidth = Number.isInteger(width) && width > 0 ? width : 1;
  const safeHeight = Number.isInteger(height) && height > 0 ? height : 1;

  return {
    rows: Math.min(normalizeSplitCount(rows, { max: Math.min(MAX_SPLIT_COUNT, Math.max(1, safeHeight)) }), safeHeight),
    columns: Math.min(normalizeSplitCount(columns, { max: Math.min(MAX_SPLIT_COUNT, Math.max(1, safeWidth)) }), safeWidth),
  };
}

export function buildAxisBoundaries(total, segments) {
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error("切分尺寸无效");
  }

  const safeSegments = Math.min(Math.max(1, Math.round(segments)), total);
  const boundaries = [];

  for (let index = 0; index <= safeSegments; index += 1) {
    boundaries.push(Math.round((index * total) / safeSegments));
  }

  boundaries[0] = 0;
  boundaries[boundaries.length - 1] = total;

  return boundaries;
}

export function buildSplitPieces(width, height, rows, columns) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new Error("图片尺寸无效");
  }

  const counts = getEffectiveSplitCounts(width, height, rows, columns);
  const rowBoundaries = buildAxisBoundaries(height, counts.rows);
  const columnBoundaries = buildAxisBoundaries(width, counts.columns);
  const pieces = [];

  for (let rowIndex = 0; rowIndex < counts.rows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < counts.columns; columnIndex += 1) {
      const x = columnBoundaries[columnIndex];
      const y = rowBoundaries[rowIndex];
      const pieceWidth = columnBoundaries[columnIndex + 1] - x;
      const pieceHeight = rowBoundaries[rowIndex + 1] - y;

      pieces.push({
        id: `r${rowIndex + 1}-c${columnIndex + 1}`,
        index: pieces.length + 1,
        row: rowIndex + 1,
        column: columnIndex + 1,
        x,
        y,
        width: pieceWidth,
        height: pieceHeight,
      });
    }
  }

  return {
    rows: counts.rows,
    columns: counts.columns,
    rowBoundaries,
    columnBoundaries,
    pieces,
  };
}

export function createPieceDownloadName(fileName, piece) {
  const stem = (fileName || "image-split").replace(/\.[^.]+$/, "");
  return `${stem}-r${String(piece.row).padStart(2, "0")}-c${String(piece.column).padStart(2, "0")}.png`;
}

export function runImageSplitTests() {
  const sample = buildSplitPieces(101, 67, 4, 3);
  const totalArea = sample.pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
  const widths = sample.pieces.map((piece) => piece.width);
  const heights = sample.pieces.map((piece) => piece.height);
  const minWidth = Math.min(...widths);
  const maxWidth = Math.max(...widths);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);

  return [
    {
      name: "数量计算",
      pass: sample.pieces.length === 12,
      details: `4 × 3 => ${sample.pieces.length} 张`,
    },
    {
      name: "像素完整覆盖",
      pass: totalArea === 101 * 67,
      details: `切片面积 ${totalArea} / 原图面积 ${101 * 67}`,
    },
    {
      name: "余数均匀分配",
      pass: maxWidth - minWidth <= 1 && maxHeight - minHeight <= 1,
      details: `列宽 ${minWidth}-${maxWidth}px，行高 ${minHeight}-${maxHeight}px`,
    },
  ];
}
