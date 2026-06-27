import React, { useRef, useCallback, useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { PlacedCard } from "@/types";

interface DraggableCardProps {
  card: PlacedCard;
}

const DraggableCard: React.FC<DraggableCardProps> = ({ card }) => {
  const {
    images,
    selectedId,
    setSelectedId,
    updateCard,
    bringToFront,
    snapToGrid,
    gridSize,
  } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 });

  const image = images.find((img) => img.id === card.imageId);
  if (!image) {
    console.error("DraggableCard: 找不到图片", card.imageId);
    return null;
  }

  const isSelected = selectedId === card.instanceId;

  // 开始拖拽
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // 选中当前卡片
      setSelectedId(card.instanceId);
      bringToFront(card.instanceId);

      // 记录拖拽起始位置
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cardX: card.x,
        cardY: card.y,
      };

      setIsDragging(true);
    },
    [card.instanceId, card.x, card.y, setSelectedId, bringToFront],
  );

  // 拖拽中
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      let newX = dragStartRef.current.cardX + dx;
      let newY = dragStartRef.current.cardY + dy;

      // 网格吸附
      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      updateCard(card.instanceId, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, card.instanceId, snapToGrid, gridSize, updateCard]);

  // 触摸支持（iPad）
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];

      setSelectedId(card.instanceId);
      bringToFront(card.instanceId);

      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        cardX: card.x,
        cardY: card.y,
      };

      setIsDragging(true);
    },
    [card.instanceId, card.x, card.y, setSelectedId, bringToFront],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;

      let newX = dragStartRef.current.cardX + dx;
      let newY = dragStartRef.current.cardY + dy;

      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      updateCard(card.instanceId, { x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, card.instanceId, snapToGrid, gridSize, updateCard]);

  return (
    <div
      className="absolute select-none"
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
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
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
