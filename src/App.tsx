import React, { useEffect, useState } from "react";
import SceneManager from "@/components/SceneManager";
import ImageLibrary from "@/components/ImageLibrary";
import Canvas from "@/components/Canvas";
import { useStore } from "@/store/useStore";

const App: React.FC = () => {
  // 侧边栏宽度状态，传给 ImageLibrary 和 Canvas
  const [sidebarWidth, setSidebarWidth] = useState(200);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useStore.getState();

      // Delete / Backspace：删除所有选中的卡片
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedIds, removeCard, clearSelection } = store;
        if (selectedIds.size > 0) {
          selectedIds.forEach((id) => removeCard(id));
          clearSelection();
        }
      }

      // Ctrl/Cmd + A：全选
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        store.selectAll();
      }

      // Ctrl/Cmd + C：复制
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        store.copy();
      }

      // Ctrl/Cmd + V：粘贴
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        store.paste();
      }

      // Ctrl/Cmd + Z：撤销 / Ctrl+Shift+Z：重做
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }

      // Escape：清空选择
      if (e.key === "Escape") {
        store.clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#e8e8e8] overflow-hidden select-none">
      <SceneManager />
      <div className="flex-1 flex overflow-hidden">
        <ImageLibrary onWidthChange={setSidebarWidth} />
        <div className="flex-1 relative overflow-hidden">
          <Canvas sidebarWidth={sidebarWidth} />
        </div>
      </div>
    </div>
  );
};

export default App;
