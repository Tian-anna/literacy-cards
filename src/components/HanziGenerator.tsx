import React, { useState, useCallback, useMemo } from "react";
import { useStore } from "@/store/useStore";
import {
  uploadHanziToCloudinary,
  HanziStyleConfig,
} from "@/utils/cloudinaryApi";

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

// 汉字字体
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

// 英文字体
const ENGLISH_FONTS = [
  { value: '"Times New Roman", Times, serif', label: "Times" },
  { value: '"Arial", "Helvetica", sans-serif', label: "Arial" },
  { value: '"Georgia", serif', label: "Georgia" },
  { value: '"Courier New", monospace', label: "Courier" },
  { value: '"Comic Sans MS", cursive', label: "Comic" },
];

// 尺寸配置
const HANZI_WIDTH = 493;
const HANZI_HEIGHT = 563;
const ENGLISH_WIDTH = 986; // 汉字宽度的 2 倍
const ENGLISH_HEIGHT = 563;

// 颜色配置
const BORDER_COLOR = "#e74c3c";
const GRID_COLOR = "#e74c3c";
const GRID_LINE_WIDTH = 1;
const BORDER_LINE_WIDTH = 2;

const HanziGenerator: React.FC<HanziGeneratorProps> = ({ onAddToCanvas }) => {
  const { addImage } = useStore();
  const [inputText, setInputText] = useState("");
  const [gridType, setGridType] = useState<GridType>("tian");
  const [fontSize, setFontSize] = useState(280);
  const [hanziFontFamily, setHanziFontFamily] = useState(HANZI_FONTS[0].value);
  const [englishFontFamily, setEnglishFontFamily] = useState(
    ENGLISH_FONTS[0].value,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToCloud, setUploadToCloud] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // ========== 内容类型判断 ==========
  const detectContentType = useCallback((text: string): ContentType => {
    // 去除空白后判断
    const trimmed = text.trim();
    if (!trimmed) return "hanzi";
    // 如果包含任何汉字，视为汉字内容
    if (/[\u4e00-\u9fa5]/.test(trimmed)) return "hanzi";
    // 否则视为英文（字母、数字、标点等）
    return "english";
  }, []);

  // 解析输入内容
  const parseInput = useCallback(
    (text: string): string[] => {
      const trimmed = text.trim();
      if (!trimmed) return [];

      const type = detectContentType(trimmed);

      if (type === "hanzi") {
        // 汉字：每个字符单独处理
        return trimmed.split("").filter((c) => /[\u4e00-\u9fa5]/.test(c));
      } else {
        // 英文：按空格或逗号分词，每个词作为一个单元
        return trimmed.split(/[\s,，]+/).filter((w) => w.length > 0);
      }
    },
    [detectContentType],
  );

  // 根据内容类型获取当前字体
  const getCurrentFontFamily = useCallback(
    (type: ContentType): string => {
      return type === "hanzi" ? hanziFontFamily : englishFontFamily;
    },
    [hanziFontFamily, englishFontFamily],
  );

  // ========== 绘制网格（红色虚线）==========
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

  // ========== 绘制红色边框 ==========
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

  // ========== 绘制汉字 ==========
  const drawHanzi = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      char: string,
      w: number,
      h: number,
      fontSize: number,
      fontFamily: string,
    ) => {
      // 白色背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      // 红色边框
      drawBorder(ctx, w, h);

      // 内部网格（红色虚线）
      if (gridType !== "plain") {
        drawGrid(ctx, w, h, gridType);
      }

      // 汉字（不加粗）
      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(char, w / 2, h / 2);

      // 纯文字模式淡色边框
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

  // ========== 绘制英文单词（四线三格）==========
  const drawEnglish = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      word: string,
      w: number,
      h: number,
      fontSize: number,
      fontFamily: string,
    ) => {
      // 白色背景
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      // 红色边框
      drawBorder(ctx, w, h);

      // 四线三格配置
      const lineColor = "rgba(231, 76, 60, 0.4)"; // 红色半透明
      const lineWidth = 1;
      const dashPattern = [6, 4]; // 虚线：6px 实线，4px 空白

      // 计算四线位置（基于字体大小）
      // 四线三格：顶线、中线、基线、降部线
      const baseLineY = h * 0.65; // 基线（字母底部对齐线）
      const xHeight = fontSize * 0.5; // x 高度（小写字母如 x 的高度）
      const ascender = fontSize * 0.35; // 升部高度（b, d, h, k, l 等向上延伸）
      const descender = fontSize * 0.25; // 降部深度（g, j, p, q, y 等向下延伸）

      const topLineY = baseLineY - xHeight - ascender; // 顶线
      const midLineY = baseLineY - xHeight; // 中线（x 高度线）
      const baseLine = baseLineY; // 基线
      const descenderLineY = baseLineY + descender; // 降部线

      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(dashPattern);

      // 顶线（升部顶部）
      ctx.beginPath();
      ctx.moveTo(0, topLineY);
      ctx.lineTo(w, topLineY);
      ctx.stroke();

      // 中线（x 高度）
      ctx.beginPath();
      ctx.moveTo(0, midLineY);
      ctx.lineTo(w, midLineY);
      ctx.stroke();

      // 基线（实线，稍明显一些）
      ctx.setLineDash([]); // 基线用实线
      ctx.strokeStyle = "rgba(231, 76, 60, 0.6)";
      ctx.beginPath();
      ctx.moveTo(0, baseLine);
      ctx.lineTo(w, baseLine);
      ctx.stroke();

      // 降部线
      ctx.setLineDash(dashPattern);
      ctx.strokeStyle = lineColor;
      ctx.beginPath();
      ctx.moveTo(0, descenderLineY);
      ctx.lineTo(w, descenderLineY);
      ctx.stroke();

      ctx.restore();

      // 英文单词（不加粗）
      ctx.fillStyle = "#000000";
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic"; // 使用 alphabetic 基线对齐
      ctx.fillText(word, w / 2, baseLine);
    },
    [drawBorder],
  );

  // ========== 生成图片（统一入口）==========
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

      return canvas.toDataURL("image/png", 1.0);
    },
    [fontSize, getCurrentFontFamily, drawHanzi, drawEnglish],
  );

  // ========== 预览 ==========
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

  // ========== 创建处理 ==========
  const handleCreate = useCallback(
    async (mode: "library" | "canvas") => {
      const contents = parseInput(inputText);
      if (contents.length === 0) {
        alert("请输入汉字或英文单词");
        return;
      }

      const contentType = detectContentType(inputText);
      const isHanzi = contentType === "hanzi";

      setIsUploading(true);
      setUploadProgress({ current: 0, total: contents.length });

      const styleConfig: HanziStyleConfig = {
        gridType,
        fontSize,
        color: "#000000",
        bgColor: "#ffffff",
        fontFamily: getCurrentFontFamily(contentType),
      };

      const uploadedIds: string[] = [];
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        const dataUrl = generateImage(content, contentType);
        if (!dataUrl) continue;

        const tempId = `word-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let finalSrc = dataUrl;

        if (uploadToCloud) {
          try {
            // 英文单词也用同一个上传函数，但标记不同
            finalSrc = await uploadHanziToCloudinary(
              dataUrl,
              content,
              styleConfig,
            );
          } catch (error) {
            alert(`"${content}" 云端上传失败，已保存本地`);
          }
        }

        addImage({
          src: finalSrc,
          name: content,
          category: isHanzi ? "汉字" : "英文",
          width: isHanzi ? HANZI_WIDTH : ENGLISH_WIDTH,
          height: isHanzi ? HANZI_HEIGHT : ENGLISH_HEIGHT,
        });

        uploadedIds.push(tempId);
        setUploadProgress({ current: i + 1, total: contents.length });
        if (mode === "canvas" && contents.length === 1) onAddToCanvas?.(tempId);
      }

      setIsUploading(false);
      setUploadProgress(null);

      if (mode === "library") {
        alert(
          `${contents.length} 个${isHanzi ? "汉字" : "单词"}已${uploadToCloud ? "同步云端" : "保存本地"}`,
        );
      } else if (contents.length > 1) {
        const store = useStore.getState();
        const cols = Math.ceil(Math.sqrt(contents.length));
        const gap = isHanzi ? 160 : 320; // 英文单词间距更大
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
    ],
  );

  // 判断当前内容类型用于 UI 显示
  const currentType = useMemo(
    () => detectContentType(inputText),
    [inputText, detectContentType],
  );
  const isHanziMode = currentType === "hanzi";
  const contents = parseInput(inputText);

  // 预览缩放比例
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
      {/* 标题 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-gray-50 flex-shrink-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-gray-700 flex items-center gap-1">
          <span>✏️</span>
          <span>{isHanziMode || !inputText ? "汉字生成器" : "单词生成器"}</span>
        </div>
        <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {/* 输入框 */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isHanziMode ? "输入汉字..." : "输入英文单词..."}
            rows={1}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 resize-none"
            style={{ fontSize: "13px", minHeight: "28px", maxHeight: "60px" }}
          />

          {/* 内容类型提示 */}
          {inputText && (
            <div className="text-xs text-gray-500">
              检测到: {isHanziMode ? "汉字" : "英文"} ({contents.length} 个)
            </div>
          )}

          {/* 格子类型 - 仅汉字模式显示 */}
          {isHanziMode && (
            <div className="grid grid-cols-3 gap-1">
              {GRID_TYPES.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => setGridType(gt.value)}
                  className={`py-1 rounded text-center text-xs border transition-all ${
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

          {/* 字号 + 字体 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">
              字号
            </span>
            <input
              type="range"
              min="40"
              max={isHanziMode ? 400 : 200}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 h-1 accent-green-500"
            />
            <span className="text-xs w-8 text-right">{fontSize}</span>

            {/* 字体选择 - 根据内容类型切换 */}
            <select
              value={isHanziMode ? hanziFontFamily : englishFontFamily}
              onChange={(e) => {
                if (isHanziMode) {
                  setHanziFontFamily(e.target.value);
                } else {
                  setEnglishFontFamily(e.target.value);
                }
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

          {/* 云端开关 */}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={uploadToCloud}
              onChange={(e) => setUploadToCloud(e.target.checked)}
              className="w-3 h-3 accent-green-500"
            />
            <span className="text-gray-500 text-xs">☁️ 同步云端</span>
          </label>

          {/* 预览 */}
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

          {/* 进度 */}
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

          {/* 按钮 */}
          <div className="flex gap-1.5">
            <button
              onClick={() => handleCreate("library")}
              disabled={contents.length === 0 || isUploading}
              className="flex-1 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {isUploading ? "..." : "加入图库"}
            </button>
            <button
              onClick={() => handleCreate("canvas")}
              disabled={contents.length === 0 || isUploading}
              className="flex-1 py-1.5 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 disabled:opacity-50"
            >
              {isUploading
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
