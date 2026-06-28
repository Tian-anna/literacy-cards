import React, { useCallback, useRef, useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { PlacedCard } from "@/types";

interface DraggableCardProps {
  card: PlacedCard;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ card }) => {
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
  const dragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 });
  const initialPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );

  const image = images.find((img) => img.id === card.imageId);
  if (!image) {
    console.error("DraggableCard: 找不到图片", card.imageId);
    return null;
  }

  const isSelected = selectedIds.has(card.instanceId);

  // 开始拖拽（支持多卡一起拖拽）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Ctrl/Cmd + 点击：切换选中状态
      if (e.ctrlKey || e.metaKey) {
        toggleSelect(card.instanceId);
        return;
      }

      // Shift + 点击：范围选择
      if (e.shiftKey) {
        selectRange(card.instanceId);
        return;
      }

      // 普通点击：如果当前卡片不在选中集合中，只选这一张
      if (!isSelected) {
        selectOne(card.instanceId);
      }

      // 提升层级
      bringToFront(card.instanceId);

      // 记录所有选中卡片的初始位置
      const store = useStore.getState();
      initialPositionsRef.current = new Map();
      store.placedCards.forEach((c) => {
        if (store.selectedIds.has(c.instanceId)) {
          initialPositionsRef.current.set(c.instanceId, { x: c.x, y: c.y });
        }
      });

      // 记录拖拽起始位置
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

  // 拖拽中（移动所有选中的卡片）
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const store = useStore.getState();

      initialPositionsRef.current.forEach((pos, id) => {
        let newX = pos.x + dx;
        let newY = pos.y + dy;

        // 网格吸附
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
  }, [isDragging, snapToGrid, gridSize, updateCard, setIsDragging]);

  // 触摸支持（iPad）
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];

      // 如果已经在多选模式，切换选中
      const store = useStore.getState();
      if (
        store.selectedIds.size > 1 ||
        (store.selectedIds.has(card.instanceId) && store.selectedIds.size === 1)
      ) {
        toggleSelect(card.instanceId);
        return;
      }

      if (!isSelected) {
        selectOne(card.instanceId);
      }

      bringToFront(card.instanceId);

      // 记录所有选中卡片的初始位置
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

      setIsDraggingLocal(true);
      setIsDragging(true);
    },
    [
      card.instanceId,
      card.x,
      card.y,
      isSelected,
      toggleSelect,
      selectOne,
      bringToFront,
      setIsDragging,
    ],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;

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

    const handleTouchEnd = () => {
      setIsDraggingLocal(false);
      setIsDragging(false);
      useStore.getState().saveHistory();
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, snapToGrid, gridSize, updateCard, setIsDragging]);

  return (
    <div
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
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* 选中标记（多选时显示数量） */}
      {isSelected && selectedIds.size > 1 && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs z-10">
          {selectedIds.size}
        </div>
      )}

      <img
        src={image.src}
        alt={image.name}
        className="w-full h-full object-cover rounded-lg pointer-events-none"
        draggable={false}
      />

      {/* 选中时显示操作按钮 */}
      {isSelected && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-1">
          <button
            className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-blue-600"
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
            className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md hover:bg-red-600"
            onClick={(e) => {
              e.stopPropagation();
              const { removeCard } = useStore.getState();
              removeCard(card.instanceId);
            }}
            title="删除"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default DraggableCard;
