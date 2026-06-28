import React, { useEffect, useState } from "react";
import SceneManager from "@/components/SceneManager";
import ImageLibrary from "@/components/ImageLibrary";
import Canvas from "@/components/Canvas";
import { useStore } from "@/store/useStore";

const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(200);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const store = useStore.getState();
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedIds, removeCard, clearSelection } = store;
        if (selectedIds.size > 0) {
          selectedIds.forEach((id) => removeCard(id));
          clearSelection();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        store.selectAll();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        store.copy();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        store.paste();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      }
      if (e.key === "Escape") {
        store.clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAddToCanvas = (imageId: string) => {
    useStore.getState().addCardToScene(imageId);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#e8e8e8] overflow-hidden select-none">
      <SceneManager />
      <div className="flex-1 flex overflow-hidden">
        <ImageLibrary
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          onAddToCanvas={handleAddToCanvas}
        />
        <div className="flex-1 relative overflow-hidden">
          <Canvas sidebarWidth={sidebarWidth} />
        </div>
      </div>
    </div>
  );
};

export default App;
