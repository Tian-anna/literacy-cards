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

interface HanziItem {
  char: string;
}

const GRID_TYPES: { value: GridType; label: string }[] = [
  { value: "tian", label: "田字格" },
  { value: "mi", label: "米字格" },
  { value: "plain", label: "纯文字" },
];

// 固定尺寸：493 x 563 像素 @ 300dpi
const CANVAS_WIDTH = 493;
const CANVAS_HEIGHT = 563;

const HanziGenerator: React.FC<HanziGeneratorProps> = ({ onAddToCanvas }) => {
  const { addImage } = useStore();
  const [inputText, setInputText] = useState("");
  const [gridType, setGridType] = useState<GridType>("tian");
  const [fontSize, setFontSize] = useState(280);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToCloud, setUploadToCloud] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // 解析输入文本（提取汉字）
  const parseInput = useCallback((text: string): HanziItem[] => {
    const chars = text.split("").filter((c) => /[\u4e00-\u9fa5]/.test(c));
    return chars.map((char) => ({ char }));
  }, []);

  // 绘制网格背景
  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      type: GridType,
    ) => {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
      ctx.lineWidth = 1;

      const halfW = width / 2;
      const halfH = height / 2;

      switch (type) {
        case "tian": // 田字格
          // 外框
          ctx.strokeRect(0, 0, width, height);
          // 横中线
          ctx.beginPath();
          ctx.moveTo(0, halfH);
          ctx.lineTo(width, halfH);
          ctx.stroke();
          // 竖中线
          ctx.beginPath();
          ctx.moveTo(halfW, 0);
          ctx.lineTo(halfW, height);
          ctx.stroke();
          break;

        case "mi": // 米字格
          // 外框
          ctx.strokeRect(0, 0, width, height);
          // 横中线
          ctx.beginPath();
          ctx.moveTo(0, halfH);
          ctx.lineTo(width, halfH);
          ctx.stroke();
          // 竖中线
          ctx.beginPath();
          ctx.moveTo(halfW, 0);
          ctx.lineTo(halfW, height);
          ctx.stroke();
          // 对角线
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(width, height);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(width, 0);
          ctx.lineTo(0, height);
          ctx.stroke();
          break;

        case "plain": // 纯文字 - 无边框
          break;
      }
    },
    [],
  );

  // 生成单张汉字图片（返回 DataURL）
  const generateHanziImage = useCallback(
    (char: string): string | null => {
      if (!char) return null;

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // 白底
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 绘制网格
      drawGrid(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, gridType);

      // 黑字
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${fontSize}px "Noto Serif SC", "Source Han Serif SC", "SimSun", "STSong", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // 文字阴影（极淡，增强可读性）
      ctx.shadowColor = "rgba(0,0,0,0.05)";
      ctx.shadowBlur = 1;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;

      ctx.fillText(char, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

      // 重置阴影
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 纯文字模式添加 subtle 边框
      if (gridType === "plain") {
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, CANVAS_WIDTH - 2, CANVAS_HEIGHT - 2);
      }

      return canvas.toDataURL("image/png", 1.0);
    },
    [gridType, fontSize, drawGrid],
  );

  // 实时预览
  const previewUrl = useMemo(() => {
    const chars = parseInput(inputText);
    if (chars.length === 0) return null;
    return generateHanziImage(chars[0].char);
  }, [inputText, generateHanziImage, parseInput]);

  // 核心：生成 + 可选上传云端 + 加入图库/画布
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
        fontFamily:
          '"Noto Serif SC", "Source Han Serif SC", "SimSun", "STSong", serif',
      };

      const uploadedIds: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        const { char } = chars[i];
        const dataUrl = generateHanziImage(char);
        if (!dataUrl) continue;

        const tempId = `hanzi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let finalSrc = dataUrl;

        // 上传到云端（汉字专用文件夹）
        if (uploadToCloud) {
          try {
            finalSrc = await uploadHanziToCloudinary(
              dataUrl,
              char,
              styleConfig,
            );
            console.log("汉字已上传到 Cloudinary (hanzi folder):", finalSrc);
          } catch (error) {
            console.error("上传失败，使用本地 DataURL:", error);
            alert(`"${char}" 云端上传失败，已保存为本地图片`);
          }
        }

        // 加入 store
        const newImage = {
          id: tempId,
          src: finalSrc,
          name: char,
          category: "汉字",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          createdAt: Date.now(),
        };

        addImage(newImage);
        uploadedIds.push(tempId);

        setUploadProgress({ current: i + 1, total: chars.length });

        // 单字直接拼图
        if (mode === "canvas" && chars.length === 1) {
          onAddToCanvas?.(tempId);
        }
      }

      setIsUploading(false);
      setUploadProgress(null);

      // 批量提示
      if (mode === "library") {
        const cloudMsg = uploadToCloud ? "(已同步云端)" : "(仅本地)";
        if (chars.length === 1) {
          alert(`"${chars[0].char}" 已添加到图库！${cloudMsg}`);
        } else {
          alert(`${chars.length} 个汉字已批量添加到图库！${cloudMsg}`);
        }
      } else if (chars.length > 1) {
        // 多字拼图模式：逐个添加到画布（错开位置）
        const store = useStore.getState();
        const canvasWidth = window.innerWidth - 300;
        const canvasHeight = window.innerHeight - 150;
        const cols = Math.ceil(Math.sqrt(chars.length));
        const spacing = Math.max(CANVAS_WIDTH, CANVAS_HEIGHT) * 0.4;
        const startX = Math.max(50, (canvasWidth - cols * spacing) / 2);
        const startY = Math.max(
          50,
          (canvasHeight - Math.ceil(chars.length / cols) * spacing) / 2,
        );

        uploadedIds.forEach((id, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          store.addCardToScene(
            id,
            startX + col * spacing,
            startY + row * spacing,
          );
        });
      }

      setInputText("");
    },
    [
      inputText,
      gridType,
      fontSize,
      uploadToCloud,
      generateHanziImage,
      parseInput,
      addImage,
      onAddToCanvas,
    ],
  );

  const chars = parseInput(inputText);
  const previewScale = Math.min(1, 180 / CANVAS_WIDTH); // 预览最大宽度 180px

  return (
    <div
      className="bg-white border-b border-gray-200 flex flex-col"
      style={{ fontSize: "12px", maxHeight: "60vh" }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 flex-shrink-0"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-gray-700 flex items-center gap-1.5">
          <span className="text-base">✏️</span>
          <span>汉字生成器</span>
          <span className="text-xs text-gray-400 font-normal">(493×563px)</span>
        </div>
        <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div
          className="p-3 space-y-3 overflow-y-auto flex-1"
          style={{
            maxHeight: "calc(60vh - 40px)",
            // Safari 滚动修复
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {/* 输入框 */}
          <div className="space-y-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="输入汉字，如：山水火木土..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              style={{ fontSize: "14px" }}
              maxLength={20}
            />
            {inputText && (
              <p className="text-xs text-green-600">
                将生成 {chars.length} 个汉字图片
              </p>
            )}
          </div>

          {/* 格子类型选择 */}
          <div>
            <label className="text-gray-500 text-xs mb-1.5 block">
              格子类型
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {GRID_TYPES.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => setGridType(gt.value)}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all border ${
                    gridType === gt.value
                      ? "bg-green-500 text-white border-green-500 font-medium"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  <div className="text-[10px]">{gt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 字号控制 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 whitespace-nowrap text-xs">
                字号:
              </span>
              <input
                type="range"
                min="80"
                max="400"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 h-1 accent-green-500"
              />
              <span className="w-10 text-right text-xs">{fontSize}</span>
            </div>
          </div>

          {/* 固定信息 */}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>尺寸: 493×563px</span>
            <span>300dpi</span>
            <span>白底黑字</span>
          </div>

          {/* 上传到云端开关 */}
          <label className="flex items-center gap-2 cursor-pointer bg-gray-50 rounded-lg px-2 py-1.5">
            <input
              type="checkbox"
              checked={uploadToCloud}
              onChange={(e) => setUploadToCloud(e.target.checked)}
              className="w-3 h-3 accent-green-500 rounded"
            />
            <span className="text-gray-600 text-xs">
              {uploadToCloud
                ? "☁️ 同步到云端 literacy-cards/hanzi/（多端可用）"
                : "💻 仅保存本地"}
            </span>
          </label>

          {/* 实时预览 - 自适应缩放 */}
          {previewUrl && (
            <div className="flex justify-center py-2">
              <div
                className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white"
                style={{
                  width: `${CANVAS_WIDTH * previewScale}px`,
                  height: `${CANVAS_HEIGHT * previewScale}px`,
                }}
              >
                <img
                  src={previewUrl}
                  alt="汉字预览"
                  className="w-full h-full object-contain"
                  style={{ imageRendering: "crisp-edges" }}
                />
              </div>
            </div>
          )}

          {/* 上传进度 */}
          {uploadProgress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>上传进度</span>
                <span>
                  {uploadProgress.current}/{uploadProgress.total}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-1 pb-1">
            <button
              onClick={() => handleCreate("library")}
              disabled={!inputText.trim() || isUploading}
              className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
            >
              {isUploading ? "处理中..." : "加入图库"}
            </button>
            <button
              onClick={() => handleCreate("canvas")}
              disabled={!inputText.trim() || isUploading}
              className="flex-1 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs font-medium"
            >
              {isUploading
                ? "处理中..."
                : chars.length > 1
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
