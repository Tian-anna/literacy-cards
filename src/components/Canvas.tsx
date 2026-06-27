import React, { useRef, useCallback } from "react";
import { useStore } from "@/store/useStore";
import DraggableCard from "./DraggableCard";

const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    placedCards,
    selectedId,
    setSelectedId,
    gridSize,
    showGrid,
    canvasColor,
    setCanvasColor,
  } = useStore();

  const presetColors = [
    "#e8e8e8",
    "#ffffff",
    "#f5f5dc",
    "#e0f2f1",
    "#fff3e0",
    "#fce4ec",
    "#e8eaf6",
    "#e0f7fa",
    "#f1f8e9",
    "#3e2723",
    "#1a1a2e",
    "#0d3b66",
  ];

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
        setSelectedId(null);
      }
    },
    [setSelectedId],
  );

  return (
    <div className="w-full h-full flex flex-col relative">
      {/* 颜色工具栏 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur border-b border-gray-200 z-10">
        <span className="text-xs text-gray-500">画布颜色:</span>
        <div className="flex items-center gap-1">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => setCanvasColor(color)}
              className={`w-5 h-5 rounded-full border-2 ${canvasColor === color ? "border-gray-800" : "border-gray-300"}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-2">{canvasColor}</span>
      </div>

      {/* 画布区域 - 关键：relative 建立定位上下文 */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        onClick={handleCanvasClick}
        style={{
          backgroundColor: canvasColor,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* 网格线 */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(to right, #999 1px, transparent 1px), linear-gradient(to bottom, #999 1px, transparent 1px)",
              backgroundSize: `${gridSize}px ${gridSize}px`,
              zIndex: 0,
            }}
          />
        )}

        {/* 图片卡片 */}
        {placedCards.map((card) => (
          <DraggableCard key={card.instanceId} card={card} />
        ))}

        {placedCards.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm opacity-30" style={{ color: "#666" }}>
              从左侧图库点击图片添加到画布
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;
