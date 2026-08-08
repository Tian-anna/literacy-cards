import React, { useState, useCallback, useMemo, useRef } from "react";
import { useStore } from "@/store/useStore";
import pinyinModule from "pinyin";
import {
  uploadHanziToCloudinary,
  HanziStyleConfig,
} from "@/utils/cloudinaryApi";

// ========== 生产构建兼容：pinyin 导入容错 ==========
const pinyin = (
  typeof pinyinModule === "function"
    ? pinyinModule
    : (pinyinModule as any).default || (pinyinModule as any)
) as typeof pinyinModule;

interface HanziGeneratorProps {
  onAddToCanvas?: (imageId: string) => void;
}

type GridType = "tian" | "mi" | "plain";
type ContentType = "hanzi" | "english";

const GRID_TYPES: { value: GridType; label: string }[] = [
  { value: "tian", label: "田字格" },
  { value: "mi", label: "米字格" },
  { value: "plain", label: "纯文字" },
];

const HANZI_FONTS = [
  {
    value: '"Noto Serif SC", "Source Han Serif SC", "SimSun", "STSong", serif',
    label: "宋体",
  },
  {
    value:
      '"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
    label: "黑体",
  },
  { value: '"Ma Shan Zheng", "ZCOOL XiaoWei", cursive', label: "楷体" },
];

const ENGLISH_FONTS = [
  { value: '"Times New Roman", Times, serif', label: "Times" },
  { value: '"Arial", "Helvetica", sans-serif', label: "Arial" },
  { value: '"Georgia", serif', label: "Georgia" },
  { value: '"Courier New", monospace', label: "Courier" },
  { value: '"Comic Sans MS", cursive', label: "Comic" },
];

const HANZI_WIDTH = 493;
const HANZI_HEIGHT = 563;
const ENGLISH_WIDTH = 986;
const ENGLISH_HEIGHT = 563;

const BORDER_COLOR = "#e74c3c";
const GRID_COLOR = "#e74c3c";
const GRID_LINE_WIDTH = 1;
const BORDER_LINE_WIDTH = 2;

// 中文转拼音命名（英文保持原样）
function getCloudFileName(char: string): string {
  if (/^[a-zA-Z]+$/.test(char)) {
    return char.toLowerCase();
  }
  try {
    const py = pinyin(char, {
      style: pinyin.STYLE_NORMAL,
      segment: false,
    });
    return py.flat().join("").toLowerCase() || char;
  } catch (e) {
    console.warn("pinyin 转换失败，使用原始字符:", char, e);
    return char;
  }
}

// 让出主线程，防止 UI 卡死
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const HanziGenerator: React.FC<HanziGeneratorProps> = ({ onAddToCanvas }) => {
  const { addImage } = useStore();
  const [inputText, setInputText] = useState("");
  const [gridType, setGridType] = useState<GridType>("tian");
  const [fontSize, setFontSize] = useState(280);
  const [hanziFontFamily, setHanziFontFamily] = useState(HANZI_FONTS[0].value);
  const [englishFontFamily, setEnglishFontFamily] = useState(
    ENGLISH_FONTS[0].value,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadToCloud, setUploadToCloud] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [syncingCount, setSyncingCount] = useState(0);

  // ========== 修复：按钮防重（useRef 立即锁定）==========
  const isSubmittingRef = useRef(false);

  const detectContentType = useCallback((text: string): ContentType => {
    const trimmed = text.trim();
    if (!trimmed) return "hanzi";
    if (/[\u4e00-\u9fa5]/.test(trimmed)) return "hanzi";
    return "english";
  }, []);

  const parseInput = useCallback(
    (text: string): string[] => {
      const trimmed = text.trim();
      if (!trimmed) return [];
      const type = detectContentType(trimmed);
      if (type === "hanzi") {
        return trimmed.split("").filter((c) => /[\u4e00-\u9fa5]/.test(c));
      } else {
        return trimmed.split(/[\s,，]+/).filter((w) => w.length > 0);
      }
    },
    [detectContentType],
  );

  const getCurrentFontFamily = useCallback(
    (type: ContentType): string => {
      return type === "hanzi" ? hanziFontFamily : englishFontFamily;
    },
    [hanziFontFamily, englishFontFamily],
  );

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, type: GridType) => {
      ctx.save();
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = GRID_LINE_WIDTH;
      ctx.setLineDash([8, 4]);
      const hw = w / 2,
        hh = h / 2;

      if (type === "tian") {
        ctx.beginPath();
        ctx.moveTo(0, hh);
        ctx.lineTo(w, hh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hw, 0);
        ctx.lineTo(hw, h);
        ctx.stroke();
      } else if (type === "mi") {
        ctx.beginPath();
        ctx.moveTo(0, hh);
        ctx.lineTo(w, hh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hw, 0);
        ctx.lineTo(hw, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(w, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w, 0);
        ctx.lineTo(0, h);
        ctx.stroke();
      }
      ctx.restore();
    },
    [],
  );

  const drawBorder = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.save();
      ctx.strokeStyle = BORDER_COLOR;
      ctx.lineWidth = BORDER_LINE_WIDTH;
      ctx.setLineDash([]);
      ctx.strokeRect(0, 0, w, h);
      ctx.restore();
    },
    [],
  );

  const drawHanzi = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      char: string,
      w: number,
      h: number,
      fontSize: number,
      fontFamily: string,
    ) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      drawBorder(ctx, w, h);
      if (gridType !== "plain") {
        drawGrid(ctx, w, h, gridType);
      }
      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(char, w / 2, h / 2);
      if (gridType === "plain") {
        ctx.save();
        ctx.strokeStyle = "rgba(231, 76, 60, 0.15)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.restore();
      }
    },
    [gridType, drawGrid, drawBorder],
  );

  const drawEnglish = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      word: string,
      w: number,
      h: number,
      fontSize: number,
      fontFamily: string,
    ) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      drawBorder(ctx, w, h);

      const lineColor = "rgba(231, 76, 60, 0.7)";
      const midLineColor = "rgba(231, 76, 60, 0.5)";
      const lineWidth = 1.5;
      const dashPattern = [6, 4];

      const baseLineY = h * 0.65;
      const xHeight = fontSize * 0.5;
      const ascender = fontSize * 0.35;
      const descender = fontSize * 0.25;

      const topLineY = baseLineY - xHeight - ascender;
      const midLineY = baseLineY - xHeight;
      const baseLine = baseLineY;
      const descenderLineY = baseLineY + descender;

      ctx.save();
      ctx.lineWidth = lineWidth;

      ctx.strokeStyle = lineColor;
      ctx.setLineDash(dashPattern);
      ctx.beginPath();
      ctx.moveTo(0, topLineY);
      ctx.lineTo(w, topLineY);
      ctx.stroke();

      ctx.strokeStyle = midLineColor;
      ctx.beginPath();
      ctx.moveTo(0, midLineY);
      ctx.lineTo(w, midLineY);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(231, 76, 60, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, baseLine);
      ctx.lineTo(w, baseLine);
      ctx.stroke();

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = lineColor;
      ctx.setLineDash(dashPattern);
      ctx.beginPath();
      ctx.moveTo(0, descenderLineY);
      ctx.lineTo(w, descenderLineY);
      ctx.stroke();

      ctx.restore();

      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(word, w / 2, baseLine);
    },
    [drawBorder],
  );

  const generateImage = useCallback(
    (content: string, type: ContentType): string | null => {
      if (!content) return null;
      const isHanzi = type === "hanzi";
      const w = isHanzi ? HANZI_WIDTH : ENGLISH_WIDTH;
      const h = isHanzi ? HANZI_HEIGHT : ENGLISH_HEIGHT;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const fontFamily = getCurrentFontFamily(type);
      if (isHanzi) {
        drawHanzi(ctx, content, w, h, fontSize, fontFamily);
      } else {
        drawEnglish(ctx, content, w, h, fontSize, fontFamily);
      }
      return canvas.toDataURL("image/jpeg", 0.92);
    },
    [fontSize, getCurrentFontFamily, drawHanzi, drawEnglish],
  );

  const previewInfo = useMemo(() => {
    const contents = parseInput(inputText);
    if (contents.length === 0) return null;
    const firstContent = contents[0];
    const type = detectContentType(inputText);
    const dataUrl = generateImage(firstContent, type);
    return {
      content: firstContent,
      type,
      dataUrl,
      width: type === "hanzi" ? HANZI_WIDTH : ENGLISH_WIDTH,
      height: type === "hanzi" ? HANZI_HEIGHT : ENGLISH_HEIGHT,
    };
  }, [inputText, parseInput, detectContentType, generateImage]);

  // 后台静默同步云端
  const syncToCloudInBackground = useCallback(
    async (
      imageId: string,
      dataUrl: string,
      content: string,
      styleConfig: HanziStyleConfig,
    ) => {
      setSyncingCount((c) => c + 1);
      console.log(`[Sync] 开始上传 "${content}"...`);
      try {
        const fileName = getCloudFileName(content);
        const cloudUrl = await uploadHanziToCloudinary(
          dataUrl,
          content,
          fileName,
          styleConfig,
        );

        console.log(`[Sync] "${content}" 上传成功:`, cloudUrl);

        const { updateImage } = useStore.getState();
        if (updateImage) {
          updateImage(imageId, { src: cloudUrl });
        } else {
          const store = useStore.getState();
          const img = store.images.find((i) => i.id === imageId);
          if (img) img.src = cloudUrl;
        }
      } catch (error) {
        console.error(`[Sync] "${content}" 上传失败:`, error);
      } finally {
        setSyncingCount((c) => Math.max(0, c - 1));
      }
    },
    [],
  );

  const handleCreate = useCallback(
    async (mode: "library" | "canvas") => {
      // ========== 修复1：按钮防重（useRef 立即锁定，无视 React 渲染延迟）==========
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      try {
        const contents = parseInput(inputText);
        if (contents.length === 0) {
          alert("请输入汉字或英文单词");
          return;
        }

        if (contents.length > 100) {
          if (!confirm(`即将生成 ${contents.length} 张图片，继续吗？`)) return;
        }

        const contentType = detectContentType(inputText);
        const isHanzi = contentType === "hanzi";
        const imgWidth = isHanzi ? HANZI_WIDTH : ENGLISH_WIDTH;
        const imgHeight = isHanzi ? HANZI_HEIGHT : ENGLISH_HEIGHT;

        setIsProcessing(true);
        setUploadProgress({ current: 0, total: contents.length });

        const styleConfig: HanziStyleConfig = {
          gridType,
          fontSize,
          color: "#000000",
          bgColor: "#ffffff",
          fontFamily: getCurrentFontFamily(contentType),
        };

        const uploadedIds: string[] = [];
        const store = useStore.getState();

        // ========== 修复2：本次 batch 内去重（输入"我我我"只处理一次）==========
        const processedInBatch = new Map<string, string>();

        for (let i = 0; i < contents.length; i++) {
          const content = contents[i];

          // Batch 内已处理过，直接复用 ID
          if (processedInBatch.has(content)) {
            const existingId = processedInBatch.get(content)!;
            uploadedIds.push(existingId);
            console.log(`[Batch] "${content}" 本次已处理，直接复用`);
            if (mode === "canvas" && contents.length === 1) {
              onAddToCanvas?.(existingId);
            }
            setUploadProgress({ current: i + 1, total: contents.length });
            continue;
          }

          // ========== 修复3：本地图库查重（跨 session，清空后也能防重）==========
          const existingLocal = store.images.find(
            (img) =>
              img.name === content &&
              img.category === (isHanzi ? "汉字" : "英文"),
          );

          if (existingLocal) {
            processedInBatch.set(content, existingLocal.id);
            uploadedIds.push(existingLocal.id);
            console.log(`[Local] "${content}" 本地已存在，直接复用`);
            if (mode === "canvas" && contents.length === 1) {
              onAddToCanvas?.(existingLocal.id);
            }
            setUploadProgress({ current: i + 1, total: contents.length });
            continue;
          }

          // 生成新图片
          const dataUrl = generateImage(content, contentType);
          if (!dataUrl) continue;

          const tempId = `word-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;

          const actualId = addImage({
            id: tempId,
            src: dataUrl,
            name: content,
            category: isHanzi ? "汉字" : "英文",
            width: imgWidth,
            height: imgHeight,
          });

          const imageId = actualId || tempId;
          processedInBatch.set(content, imageId);
          uploadedIds.push(imageId);

          if (mode === "canvas" && contents.length === 1) {
            onAddToCanvas?.(imageId);
          }

          // 后台同步云端（不 await，不阻塞 UI）
          if (uploadToCloud) {
            syncToCloudInBackground(imageId, dataUrl, content, styleConfig);
          }

          setUploadProgress({ current: i + 1, total: contents.length });

          if ((i + 1) % 5 === 0) {
            await yieldToMain();
          }
        }

        setIsProcessing(false);
        setUploadProgress(null);

        if (mode === "library") {
          console.log(
            `${contents.length} 个${isHanzi ? "汉字" : "单词"}已保存本地` +
              (uploadToCloud ? "，云端同步后台进行中..." : ""),
          );
        } else if (contents.length > 1) {
          const cols = Math.ceil(Math.sqrt(contents.length));
          const gap = isHanzi ? 160 : 320;
          const startX = 100,
            startY = 100;
          uploadedIds.forEach((id, idx) =>
            store.addCardToScene(
              id,
              startX + (idx % cols) * gap,
              startY + Math.floor(idx / cols) * gap,
            ),
          );
        }

        setInputText("");
      } finally {
        // 释放锁定
        isSubmittingRef.current = false;
        setIsProcessing(false);
      }
    },
    [
      inputText,
      gridType,
      fontSize,
      detectContentType,
      parseInput,
      generateImage,
      getCurrentFontFamily,
      uploadToCloud,
      addImage,
      onAddToCanvas,
      syncToCloudInBackground,
    ],
  );

  const currentType = useMemo(
    () => detectContentType(inputText),
    [inputText, detectContentType],
  );
  const isHanziMode = currentType === "hanzi";
  const contents = parseInput(inputText);
  const previewScale = useMemo(() => {
    if (!previewInfo) return 1;
    const maxPreviewWidth = 170;
    return Math.min(1, maxPreviewWidth / previewInfo.width);
  }, [previewInfo]);

  return (
    <div
      className="bg-white border-b border-gray-200 flex flex-col"
      style={{ fontSize: "12px" }}
    >
      <div
        className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-50 flex-shrink-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-gray-700 flex items-center gap-1">
          <span>✏️</span>
          <span>{isHanziMode || !inputText ? "汉字生成器" : "单词生成器"}</span>
        </div>
        <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div className="px-2 pb-1.5 space-y-1">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="请输入汉字或英文单词"
            rows={1}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 resize-none"
            style={{ fontSize: "13px", minHeight: "28px", maxHeight: "60px" }}
          />

          {inputText && (
            <div className="text-xs text-gray-500">
              检测到: {isHanziMode ? "汉字" : "英文"} ({contents.length} 个)
            </div>
          )}

          {isHanziMode && (
            <div className="grid grid-cols-3 gap-1">
              {GRID_TYPES.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => setGridType(gt.value)}
                  className={`py-0.5 rounded text-center text-xs border transition-all ${
                    gridType === gt.value
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-green-50"
                  }`}
                >
                  {gt.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">
              字号
            </span>
            <input
              type="range"
              min="40"
              max={400}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 h-1 accent-green-500"
            />
            <span className="text-xs w-8 text-right">{fontSize}</span>
            <select
              value={isHanziMode ? hanziFontFamily : englishFontFamily}
              onChange={(e) => {
                if (isHanziMode) setHanziFontFamily(e.target.value);
                else setEnglishFontFamily(e.target.value);
              }}
              className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-green-500"
            >
              {(isHanziMode ? HANZI_FONTS : ENGLISH_FONTS).map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={uploadToCloud}
              onChange={(e) => setUploadToCloud(e.target.checked)}
              className="w-3 h-3 accent-green-500"
            />
            <span className="text-gray-500 text-xs">
              ☁️ 同步云端
              {syncingCount > 0 && (
                <span className="text-orange-500 ml-1">
                  (同步中 {syncingCount}...)
                </span>
              )}
            </span>
          </label>

          {previewInfo?.dataUrl && (
            <div className="flex justify-center">
              <div
                className="border border-gray-200 rounded overflow-hidden bg-white"
                style={{
                  width: `${previewInfo.width * previewScale}px`,
                  height: `${previewInfo.height * previewScale}px`,
                }}
              >
                <img
                  src={previewInfo.dataUrl}
                  alt="预览"
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "crisp-edges" }}
                />
              </div>
            </div>
          )}

          {uploadProgress && (
            <div className="space-y-0.5">
              <div className="flex justify-between text-xs text-gray-500">
                <span>
                  处理中 {uploadProgress.current}/{uploadProgress.total}
                </span>
              </div>
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-1">
            <button
              onClick={() => handleCreate("library")}
              disabled={contents.length === 0 || isProcessing}
              className="flex-1 py-1 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {isProcessing ? "..." : "加入图库"}
            </button>
            <button
              onClick={() => handleCreate("canvas")}
              disabled={contents.length === 0 || isProcessing}
              className="flex-1 py-1 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 disabled:opacity-50"
            >
              {isProcessing
                ? "..."
                : contents.length > 1
                  ? "批量拼图"
                  : "直接拼图"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HanziGenerator;
