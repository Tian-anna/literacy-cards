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
  } = useStore();

  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const isTouchBoxSelectingRef = useRef(false);
  const touchBoxStartRef = useRef({ x: 0, y: 0 });

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

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

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
      if (e.button !== 0) return;
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
    [getCanvasPoint, clearSelection],
  );

  useEffect(() => {
    if (!isBoxSelecting) return;

    const handleMouseMove = (e: MouseEvent) => {
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
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isBoxSelecting, getCanvasPoint, getCardsInBox, selectionBox]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartTime = 0;
    let hasMoved = false;

    const onTouchStart = (e: TouchEvent) => {
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
        isTouchBoxSelectingRef.current = true;
        hasMoved = true;
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

    const onTouchEnd = () => {
      if (isTouchBoxSelectingRef.current) {
        setIsBoxSelecting(false);
        setSelectionBox(null);
        isTouchBoxSelectingRef.current = false;
      } else if (!hasMoved && Date.now() - touchStartTime < 300) {
        clearSelection();
      }
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [getCanvasPoint, getCardsInBox, clearSelection]);

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

        {selectedIds.size > 0 && (
          <span className="ml-auto text-xs text-green-600 font-medium">
            已选 {selectedIds.size} 张
          </span>
        )}
      </div>

      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden"
        onMouseDown={handleCanvasMouseDown}
        style={{
          backgroundColor: canvasColor,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          cursor: isBoxSelecting ? "crosshair" : "default",
        }}
      >
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

        {placedCards.map((card) => (
          <DraggableCard key={card.instanceId} card={card} />
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
