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
    selectAll,
    setShowGrid,
    setGridSize,
    setSnapToGrid,
    snapToGrid,
  } = useStore();

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const isTouchBoxSelectingRef = useRef(false);
  const touchBoxStartRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const pinchStartRef = useRef({ distance: 0, scale: 1 });
  const isPinchingRef = useRef(false);

  const getCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (clientX - rect.left - canvasOffset.x) / canvasScale,
        y: (clientY - rect.top - canvasOffset.y) / canvasScale,
      };
    },
    [canvasScale, canvasOffset],
  );

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

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const buttons = e.buttons;

      if (buttons === 4 || (buttons === 1 && e.altKey)) {
        isPanningRef.current = true;
        panStartRef.current = {
          x: e.clientX - canvasOffset.x,
          y: e.clientY - canvasOffset.y,
        };
        return;
      }

      if (buttons !== 1) return;

      const target = e.target as HTMLElement;
      if (target.closest(".placed-card")) return;

      const point = getCanvasPoint(e.clientX, e.clientY);
      if (!e.ctrlKey && !e.metaKey) {
        clearSelection();
      }

      setSelectionBox({
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
      });
      setIsBoxSelecting(true);
    },
    [getCanvasPoint, clearSelection, canvasOffset],
  );

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setCanvasScale((prev) => Math.max(0.3, Math.min(3, prev + delta)));
    }
  }, []);

  // 阻止 Safari 默认行为
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener("wheel", preventBrowserZoom, { passive: false });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener("wheel", preventBrowserZoom);
      }
    };
  }, []);

  // 鼠标移动和释放
  useEffect(() => {
    if (!isBoxSelecting && !isPanningRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isPanningRef.current) {
        setCanvasOffset({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      const point = getCanvasPoint(e.clientX, e.clientY);
      setSelectionBox((prev) => {
        if (!prev) return null;
        return { ...prev, currentX: point.x, currentY: point.y };
      });

      const box = {
        left: Math.min(selectionBox?.startX || 0, point.x),
        top: Math.min(selectionBox?.startY || 0, point.y),
        right: Math.max(selectionBox?.startX || 0, point.x),
        bottom: Math.max(selectionBox?.startY || 0, point.y),
      };

      const selected = getCardsInBox(box);
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
      isPanningRef.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isBoxSelecting, getCanvasPoint, getCardsInBox, selectionBox]);

  // Safari 触摸事件处理
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartTime = 0;
    let hasMoved = false;
    let initialDistance = 0;
    let initialScale = 1;

    const onTouchStart = (e: TouchEvent) => {
      // 双指缩放开始
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );
        initialScale = canvasScale;
        isPinchingRef.current = true;
        return;
      }

      // 单指
      const touch = e.touches[0];
      const target = e.target as HTMLElement;
      if (target.closest(".placed-card")) return;
      if (!canvas.contains(target)) return;

      const point = getCanvasPoint(touch.clientX, touch.clientY);
      touchBoxStartRef.current = { x: point.x, y: point.y };
      touchStartTime = Date.now();
      hasMoved = false;
      isTouchBoxSelectingRef.current = false;

      const store = useStore.getState();
      if (store.selectedIds.size <= 1) {
        clearSelection();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // 双指缩放
      if (e.touches.length === 2 && isPinchingRef.current) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );

        if (initialDistance > 0) {
          const newScale = (distance / initialDistance) * initialScale;
          setCanvasScale(Math.max(0.3, Math.min(3, newScale)));
        }
        return;
      }

      // 单指移动
      if (e.touches.length !== 1) return;

      const target = e.target as HTMLElement;
      if (!canvas.contains(target)) return;

      const touch = e.touches[0];
      const point = getCanvasPoint(touch.clientX, touch.clientY);
      const dx = point.x - touchBoxStartRef.current.x;
      const dy = point.y - touchBoxStartRef.current.y;

      if (
        !isTouchBoxSelectingRef.current &&
        (Math.abs(dx) > 10 || Math.abs(dy) > 10)
      ) {
        hasMoved = true;
        isTouchBoxSelectingRef.current = true;
        setSelectionBox({
          startX: touchBoxStartRef.current.x,
          startY: touchBoxStartRef.current.y,
          currentX: point.x,
          currentY: point.y,
        });
        setIsBoxSelecting(true);
      }

      if (isTouchBoxSelectingRef.current) {
        e.preventDefault();

        setSelectionBox((prev) => {
          if (!prev) return null;
          return { ...prev, currentX: point.x, currentY: point.y };
        });

        const box = {
          left: Math.min(touchBoxStartRef.current.x, point.x),
          top: Math.min(touchBoxStartRef.current.y, point.y),
          right: Math.max(touchBoxStartRef.current.x, point.x),
          bottom: Math.max(touchBoxStartRef.current.y, point.y),
        };

        const selected = getCardsInBox(box);
        useStore.getState().setSelectedIds(selected);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      // 双指结束
      if (isPinchingRef.current) {
        isPinchingRef.current = false;
        initialDistance = 0;
        return;
      }

      if (isTouchBoxSelectingRef.current) {
        setIsBoxSelecting(false);
        setSelectionBox(null);
        isTouchBoxSelectingRef.current = false;
      } else if (!hasMoved && Date.now() - touchStartTime < 300) {
        clearSelection();
      }
    };

    // Safari 需要 { passive: false } 才能阻止默认行为
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

    // 阻止 Safari 双击缩放
    const preventDoubleTap = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchstart", preventDoubleTap, {
      passive: false,
    });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("touchstart", preventDoubleTap);
    };
  }, [getCanvasPoint, getCardsInBox, clearSelection, canvasScale]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAll();
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const ids = Array.from(useStore.getState().selectedIds);
        if (ids.length > 0) {
          ids.forEach((id) => useStore.getState().removeCard(id));
          clearSelection();
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        copy();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        paste();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }

      if (e.key === "Escape") {
        clearSelection();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "+") {
        e.preventDefault();
        setCanvasScale((prev) => Math.min(3, prev + 0.2));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "-") {
        e.preventDefault();
        setCanvasScale((prev) => Math.max(0.3, prev - 0.2));
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setCanvasScale(1);
        setCanvasOffset({ x: 0, y: 0 });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectAll, clearSelection, copy, paste, undo, redo, removeCard]);

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
      {/* 顶部工具栏 */}
      <div
        className="flex-shrink-0 flex items-center gap-1 px-2 py-2 bg-green-500 text-white z-10 overflow-x-auto"
        style={{ fontSize: "10px" }}
      >
        {/* 画布颜色 */}
        <div className="relative">
          <label
            className="w-6 h-6 rounded-full border-2 border-gray-300 shadow-sm flex items-center justify-center cursor-pointer overflow-hidden"
            style={{ backgroundColor: canvasColor }}
          >
            <input
              type="color"
              value={canvasColor}
              onChange={(e) => setCanvasColor(e.target.value)}
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              title="画布颜色"
            />
            <span style={{ fontSize: "8px", pointerEvents: "none" }}>🎨</span>
          </label>
        </div>

        <div className="w-px h-4 bg-white/30 mx-0.5" />

        {/* 缩放控制 */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setCanvasScale((prev) => Math.max(0.3, prev - 0.2))}
            className="w-6 h-6 bg-white text-green-600 rounded-lg hover:bg-green-50 flex items-center justify-center shadow-sm font-bold transition-colors"
            style={{ fontSize: "10px" }}
            title="缩小"
          >
            −
          </button>
          <span
            className="font-medium w-10 text-center whitespace-nowrap"
            style={{ fontSize: "10px" }}
          >
            {Math.round(canvasScale * 100)}%
          </span>
          <button
            onClick={() => setCanvasScale((prev) => Math.min(3, prev + 0.2))}
            className="w-6 h-6 bg-white text-green-600 rounded-lg hover:bg-green-50 flex items-center justify-center shadow-sm font-bold transition-colors"
            style={{ fontSize: "10px" }}
            title="放大"
          >
            +
          </button>
          <button
            onClick={() => {
              setCanvasScale(1);
              setCanvasOffset({ x: 0, y: 0 });
            }}
            className="w-6 h-6 bg-white text-green-600 rounded-lg hover:bg-green-50 flex items-center justify-center shadow-sm transition-colors"
            style={{ fontSize: "10px" }}
            title="重置"
          >
            ⌂
          </button>
        </div>

        <div className="w-px h-4 bg-white/30 mx-0.5" />

        {/* 网格控制 */}
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="w-3 h-3 rounded accent-white"
            />
            吸附
          </label>
          <label className="flex items-center gap-0.5 cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="w-3 h-3 rounded accent-white"
            />
            网格
          </label>
          <div className="flex items-center gap-1">
            <span className="whitespace-nowrap">{gridSize}px</span>
            <input
              type="range"
              min="10"
              max="100"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="w-12 h-1 accent-white"
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span
              className="font-medium bg-white/20 px-2 py-0.5 rounded whitespace-nowrap"
              style={{ fontSize: "9px" }}
            >
              已选 {selectedIds.size} 张
            </span>
            <button
              onClick={() => {
                const { removeCard } = useStore.getState();
                selectedIds.forEach((id) => removeCard(id));
                clearSelection();
              }}
              className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600"
              style={{ fontSize: "10px" }}
              title="删除全部选中"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 画布区域 */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden p-0"
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        style={{
          backgroundColor: canvasColor,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
          cursor: isBoxSelecting
            ? "crosshair"
            : isPanningRef.current
              ? "grabbing"
              : "default",
        }}
      >
        {/* 画布内容容器 */}
        <div
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {/* 网格线 */}
          {showGrid && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: -5000,
                top: -5000,
                width: 10000,
                height: 10000,
                backgroundImage:
                  "linear-gradient(to right, rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.12) 1px, transparent 1px)",
                backgroundSize: `${gridSize}px ${gridSize}px`,
                zIndex: 0,
              }}
            />
          )}

          {placedCards.map((card) => (
            <DraggableCard
              key={card.instanceId}
              card={card}
              canvasScale={canvasScale}
            />
          ))}

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
        </div>

        {placedCards.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-gray-400 mb-2" style={{ fontSize: "10px" }}>
                👆
              </p>
              <p className="text-gray-400" style={{ fontSize: "10px" }}>
                点击下方图库选择图片
              </p>
              <p className="text-gray-300 mt-1" style={{ fontSize: "10px" }}>
                拖拽移动 · 双指缩放 · 双指旋转
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;
