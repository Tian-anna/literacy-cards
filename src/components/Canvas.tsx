import React, {
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useStore } from "@/store/useStore";
import DraggableCard from "./DraggableCard";

interface CanvasProps {
  sidebarWidth?: number;
}

// 框选框类型
interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const Canvas: React.FC<CanvasProps> = ({ sidebarWidth = 0 }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    placedCards,
    selectedIds,
    clearSelection,
    setSelectedIds,
    gridSize,
    showGrid,
    canvasColor,
    setCanvasColor,
    copy,
    paste,
    removeCard,
    undo,
    redo,
    canUndo,
    canRedo,
    selectAll,
  } = useStore();

  // 框选状态
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);

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

  // 获取画布上的坐标点
  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  // 检查卡片是否在框选范围内
  const getCardsInBox = useCallback(
    (box: { left: number; top: number; right: number; bottom: number }) => {
      const selected = new Set<string>();
      placedCards.forEach((card) => {
        const cardWidth = 120 * (card.scale || 1);
        const cardHeight = 120 * (card.scale || 1);
        const cardLeft = card.x;
        const cardTop = card.y;
        const cardRight = cardLeft + cardWidth;
        const cardBottom = cardTop + cardHeight;

        // 矩形相交检测
        if (
          cardLeft < box.right &&
          cardRight > box.left &&
          cardTop < box.bottom &&
          cardBottom > box.top
        ) {
          selected.add(card.instanceId);
        }
      });
      return selected;
    },
    [placedCards],
  );

  // 画布鼠标按下（开始框选或清空）
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;

      // 如果点击的是卡片，不处理（由 DraggableCard 处理）
      const target = e.target as HTMLElement;
      if (target.closest(".placed-card")) return;

      const point = getCanvasPoint(e.clientX, e.clientY);

      // 如果没有按住 Ctrl/Cmd，清空选择
      if (!e.ctrlKey && !e.metaKey) {
        clearSelection();
      }

      // 开始框选
      setSelectionBox({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      setIsBoxSelecting(true);
    },
    [getCanvasPoint, clearSelection],
  );

  // 全局鼠标移动（框选）
  useEffect(() => {
    if (!isBoxSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
      const point = getCanvasPoint(e.clientX, e.clientY);

      setSelectionBox((prev) => {
        if (!prev) return null;
        return { ...prev, currentX: point.x, currentY: point.y };
      });

      // 实时更新选中
      const box = {
        left: Math.min(selectionBox?.startX || 0, point.x),
        top: Math.min(selectionBox?.startY || 0, point.y),
        right: Math.max(selectionBox?.startX || 0, point.x),
        bottom: Math.max(selectionBox?.startY || 0, point.y),
      };

      const selected = getCardsInBox(box);
      // 合并到现有选择中（如果按住 Ctrl）
      if (e.ctrlKey || e.metaKey) {
        const current = new Set(useStore.getState().selectedIds);
        selected.forEach((id) => current.add(id));
        useStore.getState().setSelectedIds(current);
      } else {
        useStore.getState().setSelectedIds(selected);
      }
    };

    const handleMouseUp = () => {
      setIsBoxSelecting(false);
      setSelectionBox(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isBoxSelecting, getCanvasPoint, getCardsInBox, selectionBox]);

  // 触摸框选（iPad）
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const target = e.target as HTMLElement;
      if (target.closest(".placed-card")) return;

      const point = getCanvasPoint(touch.clientX, touch.clientY);

      setSelectionBox({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      setIsBoxSelecting(true);
    },
    [getCanvasPoint],
  );

  useEffect(() => {
    if (!isBoxSelecting) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);

      setSelectionBox((prev) => {
        if (!prev) return null;
        const box = {
          left: Math.min(prev.startX, point.x),
          top: Math.min(prev.startY, point.y),
          right: Math.max(prev.startX, point.x),
          bottom: Math.max(prev.startY, point.y),
        };

        const selected = getCardsInBox(box);
        useStore.getState().setSelectedIds(selected);

        return { ...prev, currentX: point.x, currentY: point.y };
      });
    };

    const handleTouchEnd = () => {
      setIsBoxSelecting(false);
      setSelectionBox(null);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isBoxSelecting, getCanvasPoint, getCardsInBox]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A 全选
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }

      // Delete 删除选中的
      if (e.key === "Delete" || e.key === "Backspace") {
        const ids = Array.from(useStore.getState().selectedIds);
        if (ids.length > 0) {
          ids.forEach((id) => useStore.getState().removeCard(id));
          clearSelection();
        }
      }

      // Ctrl+C 复制
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        copy();
      }

      // Ctrl+V 粘贴
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        paste();
      }

      // Ctrl+Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl+Shift+Z 或 Ctrl+Y 重做
      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }

      // Escape 清空选择
      if (e.key === "Escape") {
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, clearSelection, copy, paste, undo, redo, removeCard]);

  // 框选框样式
  const selectionBoxStyle = useMemo(() => {
    if (!selectionBox) return null;
    const left = Math.min(selectionBox.startX, selectionBox.currentX);
    const top = Math.min(selectionBox.startY, selectionBox.currentY);
    const width = Math.abs(selectionBox.currentX - selectionBox.startX);
    const height = Math.abs(selectionBox.currentY - selectionBox.startY);
    return { left, top, width, height };
  }, [selectionBox]);

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

        {/* 多选提示 */}
        {selectedIds.size > 0 && (
          <span className="ml-auto text-xs text-green-600 font-medium">
            已选 {selectedIds.size} 张
          </span>
        )}
      </div>

      {/* 画布区域 */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        onMouseDown={handleCanvasMouseDown}
        onTouchStart={handleTouchStart}
        style={{
          backgroundColor: canvasColor,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          cursor: isBoxSelecting ? "crosshair" : "default",
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
              opacity: 0.3,
            }}
          />
        )}

        {/* 图片卡片 */}
        {placedCards.map((card) => (
          <DraggableCard key={card.instanceId} card={card} />
        ))}

        {/* 框选框 */}
        {selectionBoxStyle && (
          <div
            className="absolute border-2 border-blue-400 bg-blue-400 bg-opacity-20 pointer-events-none z-40"
            style={{
              left: selectionBoxStyle.left,
              top: selectionBoxStyle.top,
              width: selectionBoxStyle.width,
              height: selectionBoxStyle.height,
            }}
          />
        )}

        {/* 空状态提示 */}
        {placedCards.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-sm opacity-30" style={{ color: "#666" }}>
                从左侧图库点击图片添加到画布
              </p>
              <div
                className="mt-2 text-xs opacity-20"
                style={{ color: "#666" }}
              >
                <p>Ctrl+点击 多选 | Shift+点击 范围选</p>
                <p>拖拽空白处框选 | Ctrl+A 全选</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;
