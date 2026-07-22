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

const GRID_TYPES: { value: GridType; label: string }[] = [
  { value: "tian", label: "田字格" },
  { value: "mi", label: "米字格" },
  { value: "plain", label: "纯文字" },
];

const FONT_OPTIONS = [
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

// 固定尺寸
const CANVAS_WIDTH = 493;
const CANVAS_HEIGHT = 563;

const HanziGenerator: React.FC<HanziGeneratorProps> = ({ onAddToCanvas }) => {
  const { addImage } = useStore();
  const [inputText, setInputText] = useState("");
  const [gridType, setGridType] = useState<GridType>("tian");
  const [fontSize, setFontSize] = useState(280);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToCloud, setUploadToCloud] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // 解析汉字
  const parseInput = useCallback((text: string): string[] => {
    return text.split("").filter((c) => /[\u4e00-\u9fa5]/.test(c));
  }, []);

  // 绘制网格
  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, type: GridType) => {
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.lineWidth = 1;
      const hw = w / 2,
        hh = h / 2;

      if (type === "tian") {
        ctx.strokeRect(0, 0, w, h);
        ctx.beginPath();
        ctx.moveTo(0, hh);
        ctx.lineTo(w, hh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(hw, 0);
        ctx.lineTo(hw, h);
        ctx.stroke();
      } else if (type === "mi") {
        ctx.strokeRect(0, 0, w, h);
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
    },
    [],
  );

  // 生成图片
  const generateHanziImage = useCallback(
    (char: string): string | null => {
      if (!char) return null;
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawGrid(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, gridType);

      ctx.fillStyle = "#000000";
      ctx.font = `bold ${fontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(char, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

      if (gridType === "plain") {
        ctx.strokeStyle = "rgba(0,0,0,0.05)";
        ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
      }
      return canvas.toDataURL("image/png", 1.0);
    },
    [gridType, fontSize, fontFamily, drawGrid],
  );

  const previewUrl = useMemo(() => {
    const chars = parseInput(inputText);
    return chars.length > 0 ? generateHanziImage(chars[0]) : null;
  }, [inputText, generateHanziImage, parseInput]);

  const handleCreate = useCallback(
    async (mode: "library" | "canvas") => {
      const chars = parseInput(inputText);
      if (chars.length === 0) {
        alert("请输入汉字");
        return;
      }

      setIsUploading(true);
      setUploadProgress({ current: 0, total: chars.length });

      const styleConfig: HanziStyleConfig = {
        gridType,
        fontSize,
        color: "#000000",
        bgColor: "#ffffff",
        fontFamily,
      };

      const uploadedIds: string[] = [];
      for (let i = 0; i < chars.length; i++) {
        const dataUrl = generateHanziImage(chars[i]);
        if (!dataUrl) continue;
        const tempId = `hanzi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let finalSrc = dataUrl;

        if (uploadToCloud) {
          try {
            finalSrc = await uploadHanziToCloudinary(
              dataUrl,
              chars[i],
              styleConfig,
            );
          } catch (error) {
            alert(`"${chars[i]}" 云端上传失败，已保存本地`);
          }
        }

        addImage({
          id: tempId,
          src: finalSrc,
          name: chars[i],
          category: "汉字",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          createdAt: Date.now(),
        });
        uploadedIds.push(tempId);
        setUploadProgress({ current: i + 1, total: chars.length });
        if (mode === "canvas" && chars.length === 1) onAddToCanvas?.(tempId);
      }

      setIsUploading(false);
      setUploadProgress(null);
      if (mode === "library") {
        alert(
          `${chars.length} 个汉字已${uploadToCloud ? "同步云端" : "保存本地"}`,
        );
      } else if (chars.length > 1) {
        const store = useStore.getState();
        const cols = Math.ceil(Math.sqrt(chars.length));
        const gap = 160;
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
      fontFamily,
      uploadToCloud,
      generateHanziImage,
      parseInput,
      addImage,
      onAddToCanvas,
    ],
  );

  const chars = parseInput(inputText);
  const previewScale = Math.min(1, 170 / CANVAS_WIDTH);

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
          <span>汉字生成器</span>
        </div>
        <span className="text-gray-400 text-xs">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {/* 输入框 - textarea 支持多行/自动换行 */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入汉字..."
            rows={1}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 resize-none"
            style={{ fontSize: "13px", minHeight: "28px", maxHeight: "60px" }}
          />

          {/* 格子类型 */}
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

          {/* 字号 + 字体 一行 */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs whitespace-nowrap">
              字号
            </span>
            <input
              type="range"
              min="80"
              max="400"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="flex-1 h-1 accent-green-500"
            />
            <span className="text-xs w-8 text-right">{fontSize}</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-green-500"
            >
              {FONT_OPTIONS.map((f) => (
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
          {previewUrl && (
            <div className="flex justify-center">
              <div
                className="border border-gray-200 rounded overflow-hidden bg-white"
                style={{
                  width: `${CANVAS_WIDTH * previewScale}px`,
                  height: `${CANVAS_HEIGHT * previewScale}px`,
                }}
              >
                <img
                  src={previewUrl}
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
              disabled={chars.length === 0 || isUploading}
              className="flex-1 py-1.5 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 disabled:opacity-50"
            >
              {isUploading ? "..." : "加入图库"}
            </button>
            <button
              onClick={() => handleCreate("canvas")}
              disabled={chars.length === 0 || isUploading}
              className="flex-1 py-1.5 bg-green-500 text-white rounded text-xs font-medium hover:bg-green-600 disabled:opacity-50"
            >
              {isUploading ? "..." : chars.length > 1 ? "批量拼图" : "直接拼图"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HanziGenerator;
