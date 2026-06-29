import React, { useCallback, useRef, useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { PlacedCard } from "@/types";

interface DraggableCardProps {
  card: PlacedCard;
  canvasScale?: number;
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  card,
  canvasScale = 1,
}) => {
  const {
    images,
    selectedIds,
    selectOne,
    toggleSelect,
    selectRange,
    updateCard,
    bringToFront,
    snapToGrid,
    gridSize,
    setIsDragging,
  } = useStore();

  const [isDragging, setIsDraggingLocal] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 });
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const isTouchDraggingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const image = images.find((img) => img.id === card.imageId);
  if (!image) {
    console.error("DraggableCard: 找不到图片", card.imageId);
    return null;
  }

  const isSelected = selectedIds.has(card.instanceId);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        toggleSelect(card.instanceId);
        return;
      }

      if (e.shiftKey) {
        selectRange(card.instanceId);
        return;
      }

      if (!isSelected) {
        selectOne(card.instanceId);
      }

      bringToFront(card.instanceId);

      const store = useStore.getState();
      initialPositionsRef.current = new Map();
      store.placedCards.forEach((c) => {
        if (store.selectedIds.has(c.instanceId)) {
          initialPositionsRef.current.set(c.instanceId, { x: c.x, y: c.y });
        }
      });

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cardX: card.x,
        cardY: card.y,
      };

      setIsDraggingLocal(true);
      setIsDragging(true);
    },
    [
      card.instanceId,
      card.x,
      card.y,
      isSelected,
      toggleSelect,
      selectRange,
      selectOne,
      bringToFront,
      setIsDragging,
    ],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartRef.current.x) / canvasScale;
      const dy = (e.clientY - dragStartRef.current.y) / canvasScale;

      initialPositionsRef.current.forEach((pos, id) => {
        let newX = pos.x + dx;
        let newY = pos.y + dy;

        if (snapToGrid) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }

        updateCard(id, { x: newX, y: newY });
      });
    };

    const handleMouseUp = () => {
      setIsDraggingLocal(false);
      setIsDragging(false);
      useStore.getState().saveHistory();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    isDragging,
    snapToGrid,
    gridSize,
    updateCard,
    setIsDragging,
    canvasScale,
  ]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let hasMoved = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchStartTime = Date.now();
      hasMoved = false;
      isTouchDraggingRef.current = false;
      isLongPressRef.current = false;

      // 长按检测（500ms）
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        setShowControls(true);
        // 震动反馈（如果支持）
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 500);

      const store = useStore.getState();
      initialPositionsRef.current = new Map();
      store.placedCards.forEach((c) => {
        if (store.selectedIds.has(c.instanceId)) {
          initialPositionsRef.current.set(c.instanceId, { x: c.x, y: c.y });
        }
      });

      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        cardX: card.x,
        cardY: card.y,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      const dx = (touch.clientX - dragStartRef.current.x) / canvasScale;
      const dy = (touch.clientY - dragStartRef.current.y) / canvasScale;

      // 如果移动超过 10px，取消长按
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      if (
        !isTouchDraggingRef.current &&
        (Math.abs(dx) > 5 || Math.abs(dy) > 5)
      ) {
        hasMoved = true;
        isTouchDraggingRef.current = true;
        setIsDraggingLocal(true);
        setIsDragging(true);

        const store = useStore.getState();
        if (!store.selectedIds.has(card.instanceId)) {
          selectOne(card.instanceId);
          initialPositionsRef.current = new Map();
          initialPositionsRef.current.set(card.instanceId, {
            x: card.x,
            y: card.y,
          });
        }

        bringToFront(card.instanceId);
      }

      if (isTouchDraggingRef.current) {
        initialPositionsRef.current.forEach((pos, id) => {
          let newX = pos.x + dx;
          let newY = pos.y + dy;

          if (snapToGrid) {
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;
          }

          updateCard(id, { x: newX, y: newY });
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      // 清除长按定时器
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const touchDuration = Date.now() - touchStartTime;

      if (isTouchDraggingRef.current) {
        setIsDraggingLocal(false);
        setIsDragging(false);
        useStore.getState().saveHistory();
      } else if (touchDuration < 300 && !hasMoved && !isLongPressRef.current) {
        // 短点击 - 切换选中
        e.preventDefault();
        const store = useStore.getState();
        if (
          store.selectedIds.has(card.instanceId) &&
          store.selectedIds.size === 1
        ) {
          selectOne("");
        } else {
          selectOne(card.instanceId);
        }
      }

      isTouchDraggingRef.current = false;
      isLongPressRef.current = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [
    card.instanceId,
    card.x,
    card.y,
    selectOne,
    bringToFront,
    updateCard,
    snapToGrid,
    gridSize,
    setIsDragging,
    canvasScale,
  ]);

  // 点击其他地方隐藏控制按钮
  useEffect(() => {
    if (!showControls) return;

    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) {
        setShowControls(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [showControls]);

  const handleDelete = useCallback(
    (e: any) => {
      e.stopPropagation();
      const { removeCard } = useStore.getState();
      removeCard(card.instanceId);
      setShowControls(false);
    },
    [card.instanceId],
  );

  const handleRotate = useCallback(
    (e: any) => {
      e.stopPropagation();
      updateCard(card.instanceId, {
        rotation: (card.rotation + 15) % 360,
      });
    },
    [card.instanceId, card.rotation, updateCard],
  );

  return (
    <div
      ref={cardRef}
      className="placed-card absolute select-none"
      style={{
        left: card.x,
        top: card.y,
        width: 120 * card.scale,
        height: 120 * card.scale,
        zIndex: card.zIndex,
        transform: `rotate(${card.rotation}deg)`,
        cursor: isDragging ? "grabbing" : "grab",
        border: isSelected ? "3px solid #4CAF50" : "2px solid transparent",
        borderRadius: "8px",
        boxShadow: isSelected
          ? "0 4px 12px rgba(76,175,80,0.4)"
          : "0 2px 8px rgba(0,0,0,0.1)",
        transition: isDragging ? "none" : "box-shadow 0.2s",
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      {isSelected && selectedIds.size > 1 && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-[9px] z-10">
          {selectedIds.size}
        </div>
      )}

      {imageLoaded ? (
        <img
          src={image.src}
          alt={image.name}
          className="w-full h-full object-cover rounded-lg pointer-events-none"
          draggable={false}
          onError={() => {
            console.error("画布图片加载失败:", image.src);
            setImageLoaded(false);
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 bg-gray-100 rounded-lg">
          {image.name || "?"}
        </div>
      )}

      {/* 控制按钮 - 选中或长按显示 */}
      {(isSelected || showControls) && (
        <div
          className="absolute top-1 right-1 flex gap-1 z-50"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            className="w-5 h-5 bg-blue-500/80 text-white rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              updateCard(card.instanceId, {
                rotation: (card.rotation + 15) % 360,
              });
            }}
            title="旋转"
          >
            ↻
          </button>
          <button
            className="w-5 h-5 bg-red-500/80 text-white rounded-full flex items-center justify-center text-[10px] shadow-md hover:bg-red-600"
            onClick={(e) => {
              e.stopPropagation();
              const { removeCard } = useStore.getState();
              removeCard(card.instanceId);
              setShowControls(false);
            }}
            title="删除"
          >
            ×
          </button>
        </div>
      )}

      {/* 长按提示 */}
      {showControls && !isSelected && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-gray-500 whitespace-nowrap">
          长按菜单
        </div>
      )}
    </div>
  );
};

export default DraggableCard;
