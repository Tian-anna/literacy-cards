import React, { useEffect } from "react";
import SceneManager from "@/components/SceneManager";
import ImageLibrary from "@/components/ImageLibrary";
import Canvas from "@/components/Canvas";
import { useStore } from "@/store/useStore";

const App: React.FC = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedId, removeCard } = useStore.getState();
        if (selectedId) removeCard(selectedId);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          useStore.getState().redo();
        } else {
          useStore.getState().undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#e8e8e8] overflow-hidden select-none">
      <SceneManager />
      <div className="flex-1 flex overflow-hidden">
        <ImageLibrary />
        <div className="flex-1 relative overflow-hidden">
          <Canvas />
        </div>
      </div>
    </div>
  );
};

export default App;
