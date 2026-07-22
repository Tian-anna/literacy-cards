import React, { useState, useCallback, useRef, useMemo } from "react";
import { useStore } from "@/store/useStore";
import {
  uploadHanziToCloudinary,
  HanziStyleConfig,
} from "@/utils/cloudinaryApi";

interface HanziGeneratorProps {
  onAddToCanvas?: (imageId: string) => void;
}

type GridType = "tian" | "mi" | "huigong" | "pinyin" | "plain";

interface HanziItem {
  char: string;
  pinyin?: string;
}

const GRID_TYPES: { value: GridType; label: string; icon: string }[] = [
  { value: "tian", label: "田字格", icon: "田" },
  { value: "mi", label: "米字格", icon: "米" },
  { value: "huigong", label: "回宫格", icon: "回" },
  { value: "pinyin", label: "拼音格", icon: "拼" },
  { value: "plain", label: "纯文字", icon: "文" },
];

const PRESET_COLORS = [
  { name: "经典", color: "#333333", bg: "#ffffff" },
  { name: "红字", color: "#c41e3a", bg: "#ffffff" },
  { name: "黑底白字", color: "#ffffff", bg: "#1a1a1a" },
  { name: "米黄护眼", color: "#2c2c2c", bg: "#f5f0e6" },
  { name: "淡绿", color: "#2e7d32", bg: "#e8f5e9" },
  { name: "淡蓝", color: "#1565c0", bg: "#e3f2fd" },
];

const HanziGenerator: React.FC<HanziGeneratorProps> = ({ onAddToCanvas }) => {
  const { addImage } = useStore();

  // 输入状态
  const [inputText, setInputText] = useState("");
  const [hanziList, setHanziList] = useState<HanziItem[]>([]);

  // 样式状态
  const [gridType, setGridType] = useState<GridType>("tian");
  const [fontSize, setFontSize] = useState(140);
  const [color, setColor] = useState("#333333");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [fontFamily, setFontFamily] = useState(
    '"Noto Serif SC", "Source Han Serif SC", "SimSun", "STSong", serif',
  );
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [showPinyin, setShowPinyin] = useState(false);

  // 上传状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToCloud, setUploadToCloud] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  // UI 状态
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 解析输入文本（支持汉字+拼音格式：山[shān]）
  const parseInput = useCallback((text: string): HanziItem[] => {
    const items: HanziItem[] = [];
    // 匹配汉字[拼音]格式
    const regex = /([\u4e00-\u9fa5])(?:\[([^\]]+)\])?/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      items.push({ char: match[1], pinyin: match[2] });
    }
    // 如果没有匹配到格式，按单个字符拆分
    if (items.length === 0) {
      const chars = text.split("").filter((c) => /[\u4e00-\u9fa5]/.test(c));
      chars.forEach((char) => items.push({ char }));
    }
    return items;
  }, []);

  // 绘制网格背景
  const drawGrid = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      size: number,
      type: GridType,
      strokeColor: string,
    ) => {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;

      const half = size / 2;
      const quarter = size / 4;
      const threeQuarter = (size * 3) / 4;

      switch (type) {
        case "tian": // 田字格
          // 外框
          ctx.strokeRect(0, 0, size, size);
          // 横中线
          ctx.beginPath();
          ctx.moveTo(0, half);
          ctx.lineTo(size, half);
          ctx.stroke();
          // 竖中线
          ctx.beginPath();
          ctx.moveTo(half, 0);
          ctx.lineTo(half, size);
          ctx.stroke();
          break;

        case "mi": // 米字格
          // 外框
          ctx.strokeRect(0, 0, size, size);
          // 横中线
          ctx.beginPath();
          ctx.moveTo(0, half);
          ctx.lineTo(size, half);
          ctx.stroke();
          // 竖中线
          ctx.beginPath();
          ctx.moveTo(half, 0);
          ctx.lineTo(half, size);
          ctx.stroke();
          // 对角线
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(size, size);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(size, 0);
          ctx.lineTo(0, size);
          ctx.stroke();
          break;

        case "huigong": // 回宫格（内宫+外宫）
          // 外框
          ctx.strokeRect(0, 0, size, size);
          // 内宫（居中，占 60%）
          const padding = size * 0.2;
          ctx.strokeRect(
            padding,
            padding,
            size - padding * 2,
            size - padding * 2,
          );
          // 内宫十字线
          ctx.beginPath();
          ctx.moveTo(0, half);
          ctx.lineTo(size, half);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(half, 0);
          ctx.lineTo(half, size);
          ctx.stroke();
          break;

        case "pinyin": // 拼音格（四线三格 + 汉字区域）
          // 汉字区域（下半部分 70%）
          const hanziTop = size * 0.35;
          ctx.strokeRect(0, hanziTop, size, size - hanziTop);
          // 汉字区域十字线
          ctx.beginPath();
          ctx.moveTo(0, hanziTop + (size - hanziTop) / 2);
          ctx.lineTo(size, hanziTop + (size - hanziTop) / 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(half, hanziTop);
          ctx.lineTo(half, size);
          ctx.stroke();
          // 拼音四线格（上半部分）
          const lineSpacing = hanziTop / 4;
          for (let i = 1; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * lineSpacing);
            ctx.lineTo(size, i * lineSpacing);
            ctx.stroke();
          }
          // 拼音区域竖中线
          ctx.beginPath();
          ctx.moveTo(half, 0);
          ctx.lineTo(half, hanziTop);
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          break;

        case "plain": // 纯文字 - 无边框
          break;
      }
    },
    [],
  );

  // 生成单张汉字图片（返回 DataURL）
  const generateHanziImage = useCallback(
    (
      char: string,
      pinyin?: string,
      customConfig?: Partial<HanziStyleConfig>,
    ): string | null => {
      if (!char) return null;

      const config: HanziStyleConfig = {
        gridType: customConfig?.gridType ?? gridType,
        fontSize: customConfig?.fontSize ?? fontSize,
        color: customConfig?.color ?? color,
        bgColor: customConfig?.bgColor ?? bgColor,
        fontFamily: customConfig?.fontFamily ?? fontFamily,
        showPinyin: customConfig?.showPinyin ?? showPinyin,
        pinyinText: pinyin,
      };

      const canvas = document.createElement("canvas");
      const size = Math.max(300, config.fontSize * 2.2);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      // 高清渲染（保证多端一致性）
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;

      // 背景
      ctx.fillStyle = config.bgColor;
      ctx.fillRect(0, 0, size, size);

      // 绘制网格
      const gridColor =
        config.bgColor === "#1a1a1a" || config.bgColor === "#000000"
          ? "rgba(255,255,255,0.15)"
          : "rgba(0,0,0,0.12)";
      drawGrid(ctx, size, config.gridType, gridColor);

      // 绘制拼音（拼音格模式）
      if (config.gridType === "pinyin" && (config.showPinyin || pinyin)) {
        const pinyinText = pinyin || config.pinyinText;
        if (pinyinText) {
          ctx.fillStyle = config.color;
          ctx.font = `bold ${size * 0.18}px ${config.fontFamily}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(pinyinText, size / 2, size * 0.175);
        }
      }

      // 绘制汉字
      ctx.fillStyle = config.color;
      // 使用更大字号确保填满格子
      const actualFontSize =
        config.gridType === "pinyin" ? config.fontSize * 0.9 : config.fontSize;
      ctx.font = `bold ${actualFontSize}px ${config.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textY =
        config.gridType === "pinyin"
          ? size * 0.35 + (size * 0.65) / 2
          : size / 2;

      // 文字阴影（增强可读性）
      ctx.shadowColor = "rgba(0,0,0,0.08)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(char, size / 2, textY);

      // 重置阴影
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 外框（纯文字模式添加 subtle 边框）
      if (config.gridType === "plain") {
        ctx.strokeStyle =
          config.bgColor === "#1a1a1a"
            ? "rgba(255,255,255,0.1)"
            : "rgba(0,0,0,0.08)";
        ctx.lineWidth = 1;
        ctx.strokeRect(2, 2, size - 4, size - 4);
      }

      return canvas.toDataURL("image/png", 1.0);
    },
    [gridType, fontSize, color, bgColor, fontFamily, showPinyin, drawGrid],
  );

  // 实时预览
  const previewUrl = useMemo(() => {
    const chars = parseInput(inputText);
    if (chars.length === 0) return null;
    return generateHanziImage(chars[0].char, chars[0].pinyin);
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
        color,
        bgColor,
        fontFamily,
        showPinyin,
      };

      const uploadedIds: string[] = [];

      for (let i = 0; i < chars.length; i++) {
        const { char, pinyin } = chars[i];
        const dataUrl = generateHanziImage(char, pinyin);
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
          width: 300,
          height: 300,
          createdAt: Date.now(),
        };

        addImage(newImage);
        uploadedIds.push(tempId);

        setUploadProgress({ current: i + 1, total: chars.length });

        // 如果是直接拼图模式且是单字，直接放到画布
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
        const spacing = 140;
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
      setHanziList([]);
    },
    [
      inputText,
      gridType,
      fontSize,
      color,
      bgColor,
      fontFamily,
      showPinyin,
      uploadToCloud,
      generateHanziImage,
      parseInput,
      addImage,
      onAddToCanvas,
    ],
  );

  // 应用预设配色
  const applyPreset = (preset: (typeof PRESET_COLORS)[0]) => {
    setColor(preset.color);
    setBgColor(preset.bg);
  };

  // 检测输入中是否包含拼音格式
  const hasPinyinFormat = inputText.includes("[");

  return (
    <div
      className="bg-white border-b border-gray-200"
      style={{ fontSize: "12px" }}
    >
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-gray-700 flex items-center gap-1.5">
          <span className="text-base">✏️</span>
          <span>汉字生成器</span>
          <span className="text-xs text-gray-400 font-normal">
            (支持田字格/米字格/回宫格/拼音格)
          </span>
        </div>
        <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-3 border-t border-gray-100">
          {/* 输入模式切换 */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("single")}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                activeTab === "single"
                  ? "bg-white text-green-600 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              单字/多字
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              className={`flex-1 py-1 rounded-md text-center transition-all ${
                activeTab === "batch"
                  ? "bg-white text-green-600 shadow-sm font-medium"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              批量格式
            </button>
          </div>

          {/* 输入框 */}
          <div className="space-y-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeTab === "single"
                  ? "输入汉字，如：山水火..."
                  : "输入汉字[拼音]，如：山[shān]水[shuǐ]火[huǒ]"
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              style={{ fontSize: "14px" }}
              maxLength={activeTab === "single" ? 20 : 200}
            />
            {activeTab === "batch" && (
              <p className="text-xs text-gray-400">
                提示：支持连续输入，如「山[shān]水[shuǐ]火[huǒ]木[mù]」
              </p>
            )}
            {inputText && (
              <p className="text-xs text-green-600">
                将生成 {parseInput(inputText).length} 个汉字图片
              </p>
            )}
          </div>

          {/* 格子类型选择 */}
          <div>
            <label className="text-gray-500 text-xs mb-1.5 block">
              格子类型
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {GRID_TYPES.map((gt) => (
                <button
                  key={gt.value}
                  onClick={() => setGridType(gt.value)}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all border ${
                    gridType === gt.value
                      ? "bg-green-500 text-white border-green-500 font-medium"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-green-300 hover:bg-green-50"
                  }`}
                  title={gt.label}
                >
                  <div className="text-lg leading-none mb-0.5">{gt.icon}</div>
                  <div className="text-[10px]">{gt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 预设配色 */}
          <div>
            <label className="text-gray-500 text-xs mb-1.5 block">
              快速配色
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg border hover:shadow-sm transition-all"
                  style={{
                    backgroundColor: preset.bg,
                    borderColor:
                      color === preset.color && bgColor === preset.bg
                        ? "#22c55e"
                        : "#e5e7eb",
                  }}
                  title={preset.name}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: preset.color }}
                  />
                  <span className="text-[10px]" style={{ color: preset.color }}>
                    {preset.name}
                  </span>
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
                min="60"
                max="220"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="flex-1 h-1 accent-green-500"
              />
              <span className="w-10 text-right text-xs">{fontSize}</span>
            </div>
          </div>

          {/* 自定义颜色 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">字色:</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 text-xs">背景:</span>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              />
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-gray-500 text-xs">字体:</span>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:border-green-500"
              >
                <option value='"Noto Serif SC", "Source Han Serif SC", "SimSun", "STSong", serif'>
                  宋体
                </option>
                <option value='"Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif'>
                  黑体
                </option>
                <option value='"ZCOOL XiaoWei", "Ma Shan Zheng", cursive'>
                  楷体/手写
                </option>
              </select>
            </div>
          </div>

          {/* 拼音格额外选项 */}
          {gridType === "pinyin" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPinyin}
                onChange={(e) => setShowPinyin(e.target.checked)}
                className="w-3 h-3 accent-green-500 rounded"
              />
              <span className="text-gray-600 text-xs">
                显示拼音区域（输入格式：山[shān]）
              </span>
            </label>
          )}

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

          {/* 实时预览 */}
          {previewUrl && (
            <div className="flex justify-center py-2">
              <div
                className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm"
                style={{ borderRadius: "12px" }}
              >
                <img
                  src={previewUrl}
                  alt="汉字预览"
                  className="w-24 h-24 object-contain"
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
          <div className="flex gap-2 pt-1">
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
                : parseInput(inputText).length > 1
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
