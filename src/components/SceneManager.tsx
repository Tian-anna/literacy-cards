import React, { useState } from "react";
import { useStore } from "@/store/useStore";

const SceneManager: React.FC = () => {
  const {
    scenes,
    currentSceneId,
    createScene,
    loadScene,
    deleteScene,
    updateScene,
    placedCards,
    gridSize,
    setGridSize,
    snapToGrid,
    setSnapToGrid,
    showGrid,
    setShowGrid,
    exportScene,
    importScene,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  } = useStore();

  const [newSceneName, setNewSceneName] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState("");
  const [showScenes, setShowScenes] = useState(false);

  const handleSaveScene = () => {
    if (!currentSceneId) return;
    updateScene(currentSceneId, { cards: placedCards });
    alert("场景已保存！");
  };

  const handleExport = () => {
    const data = exportScene();
    if (!data) return;
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `识字卡场景_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (!importData.trim()) return;
    importScene(importData);
    setShowImport(false);
    setImportData("");
  };

  return (
    <div className="bg-[#4CAF50] text-white px-2 py-1 flex items-center gap-1 shadow-md text-sm">
      {/* 添加图片按钮 */}
      <button
        onClick={() => document.getElementById("file-upload")?.click()}
        className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 flex items-center gap-1 transition-colors"
      >
        <span className="text-sm">📁</span>
        <span>添加</span>
      </button>

      {/* 清空按钮 */}
      <button
        onClick={() => {
          if (confirm("确定清空画布吗？")) clearCanvas();
        }}
        className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 flex items-center gap-1 transition-colors"
      >
        <span className="text-sm">🗑</span>
        <span>清空</span>
      </button>

      {/* 保存按钮 */}
      <button
        onClick={handleSaveScene}
        disabled={!currentSceneId}
        className="bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded px-2 py-1 flex items-center gap-1 transition-colors"
      >
        <span className="text-sm">💾</span>
        <span>保存</span>
      </button>

      {/* 场景管理下拉 */}
      <div className="relative">
        <button
          onClick={() => setShowScenes(!showScenes)}
          className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 flex items-center gap-1 transition-colors"
        >
          <span className="text-sm">📂</span>
          <span>场景</span>
        </button>

        {showScenes && (
          <div className="absolute top-full left-0 mt-1 bg-white text-gray-800 rounded-lg shadow-xl p-3 w-56 z-50">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="新场景名称"
                className="flex-1 border rounded px-2 py-1 text-sm"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
              />
              <button
                onClick={() => {
                  if (newSceneName.trim()) {
                    createScene(newSceneName.trim());
                    setNewSceneName("");
                  }
                }}
                className="bg-[#4CAF50] text-white px-2 py-1 rounded text-sm"
              >
                +
              </button>
            </div>

            <div className="space-y-1 max-h-40 overflow-y-auto">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer ${
                    scene.id === currentSceneId
                      ? "bg-green-100"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => loadScene(scene.id)}
                >
                  <span className="text-sm">{scene.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScene(scene.id);
                    }}
                    className="text-red-500 hover:bg-red-50 px-1 rounded text-sm"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 导出导入 */}
      <button
        onClick={handleExport}
        disabled={!currentSceneId}
        className="bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded px-2 py-1 transition-colors text-sm"
      >
        导出
      </button>
      <button
        onClick={() => setShowImport(true)}
        className="bg-white/20 hover:bg-white/30 rounded px-2 py-1 transition-colors text-sm"
      >
        导入
      </button>

      {/* 网格设置 */}
      <div className="flex items-center gap-2 ml-2 bg-white/10 rounded px-2 py-1">
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
            className="w-3 h-3 accent-green-600"
          />
          <span>吸附</span>
        </label>

        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="w-3 h-3 accent-green-600"
          />
          <span>网格</span>
        </label>

        <div className="flex items-center gap-1">
          <span className="text-xs">{gridSize}</span>
          <input
            type="range"
            min="20"
            max="200"
            step="10"
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value))}
            className="w-16 accent-green-600"
          />
        </div>
      </div>

      {/* 撤销重做 */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="bg-white/20 hover:bg-white/30 disabled:opacity-30 rounded px-2 py-1 transition-colors ml-1 text-sm"
      >
        ↩️
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="bg-white/20 hover:bg-white/30 disabled:opacity-30 rounded px-2 py-1 transition-colors text-sm"
      >
        ↪️
      </button>

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-w-[90%] text-gray-800">
            <h3 className="font-bold text-lg mb-4">导入场景</h3>
            <textarea
              className="w-full h-32 border rounded-lg p-3 text-sm mb-4"
              placeholder="粘贴场景JSON数据..."
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-[#4CAF50] text-white rounded-lg hover:bg-green-600"
              >
                导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SceneManager;
