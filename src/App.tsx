import React, { useEffect, useState, useCallback } from "react";
import SceneManager from "@/components/SceneManager";
import ImageLibrary from "@/components/ImageLibrary";
import Canvas from "@/components/Canvas";
import { useStore, checkStorage } from "@/store/useStore";

// ==================== Safari 存储调试面板 ====================
const StorageDebugger: React.FC = () => {
  const [info, setInfo] = useState<string[]>([]);
  const images = useStore((s) => s.images);
  const _hasHydrated = useStore((s) => s._hasHydrated);

  const refreshInfo = useCallback(() => {
    const lines: string[] = [];

    lines.push(
      `IndexedDB: ${typeof window !== "undefined" && window.indexedDB ? "✅" : "❌"}`,
    );
    try {
      const testKey = "__safari_test__";
      localStorage.setItem(testKey, "1");
      localStorage.removeItem(testKey);
      lines.push("localStorage: ✅");
    } catch {
      lines.push("localStorage: ❌（无痕模式）");
    }

    lines.push(`图库: ${images.length} 张`);
    lines.push(`Hydrated: ${_hasHydrated ? "✅" : "⏳"}`);

    const base64Count = images.filter((img) =>
      img.src?.startsWith("data:"),
    ).length;
    const blobCount = images.filter((img) =>
      img.src?.startsWith("blob:"),
    ).length;
    const httpCount = images.filter((img) =>
      img.src?.startsWith("http"),
    ).length;
    lines.push(
      `URL: HTTP=${httpCount} Base64=${base64Count} Blob=${blobCount}`,
    );

    setInfo(lines);
  }, [images, _hasHydrated]);

  useEffect(() => {
    refreshInfo();
  }, [refreshInfo]);

  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(0,0,0,0.85)",
        color: "#0f0",
        fontSize: "11px",
        padding: "6px 12px",
        zIndex: 9999,
        fontFamily: "monospace",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span>{info.join(" | ")}</span>
      <button
        onClick={() => {
          checkStorage();
          refreshInfo();
        }}
        style={{
          fontSize: "11px",
          padding: "2px 8px",
          background: "#333",
          color: "#0f0",
          border: "1px solid #0f0",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        检查存储
      </button>
    </div>
  );
};

// ==================== 主应用组件 ====================
const App: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [isReady, setIsReady] = useState(false);

  // 等待持久化数据恢复完成
  useEffect(() => {
    // 方案1：使用 zustand 的 persist 事件监听
    const unsubscribe = useStore.persist.onFinishHydration(() => {
      console.log("[App] hydration 完成");
      setIsReady(true);
    });

    // 方案2：检测 _hasHydrated 状态变化
    const unsubState = useStore.subscribe((state) => {
      if (state._hasHydrated) {
        setIsReady(true);
      }
    });

    // 方案3：超时兜底
    const timeout = setTimeout(() => {
      console.log("[App] hydration 超时，强制就绪");
      setIsReady(true);
    }, 3000);

    return () => {
      unsubscribe();
      unsubState();
      clearTimeout(timeout);
    };
  }, []);

  // 键盘快捷键
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
    const store = useStore.getState();
    const canvasWidth = window.innerWidth - sidebarWidth;
    const canvasHeight = window.innerHeight - 100;
    const x = Math.max(50, (canvasWidth - 120) / 2);
    const y = Math.max(50, (canvasHeight - 120) / 2);
    store.addCardToScene(imageId, x, y);
  };

  if (!isReady) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#e8e8e8]">
        <div className="text-center">
          <div className="text-2xl mb-2">⏳</div>
          <p className="text-gray-500 text-sm">正在恢复数据...</p>
        </div>
      </div>
    );
  }

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
      <StorageDebugger />
    </div>
  );
};

export default App;
