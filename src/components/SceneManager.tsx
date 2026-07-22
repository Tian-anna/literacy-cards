import React, { useState, useCallback, useRef } from "react";
import { useStore } from "@/store/useStore";
import { uploadImageToCloudinary } from "@/utils/cloudinaryApi";

const SceneManager: React.FC = () => {
  const {
    scenes,
    currentSceneId,
    createScene,
    loadScene,
    deleteScene,
    updateScene,
    placedCards,
    exportScene,
    importScene,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    addImage,
  } = useStore();

  const [newSceneName, setNewSceneName] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState("");
  const [showScenes, setShowScenes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;

        try {
          const imageUrl = await uploadImageToCloudinary(file);
          addImage({
            src: imageUrl,
            name: file.name.replace(/\.[^/.]+$/, ""),
            category: "本地",
            width: 300,
            height: 300,
          });
        } catch (error) {
          alert(
            `上传失败: ${error instanceof Error ? error.message : "未知错误"}`,
          );
        }
      }

      setIsUploading(false);
      e.target.value = "";
    },
    [addImage],
  );

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

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
    <div
      className="bg-green-500 text-white px-2 py-1.5 flex items-center gap-1.5 shadow-md flex-wrap"
      style={{ fontSize: "12px" }}
    >
      {/* 添加图片按钮 */}
      <button
        onClick={handleAddClick}
        disabled={isUploading}
        className={`bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs`}
      >
        <span>{isUploading ? "⏳" : "📁"}</span>
        <span>{isUploading ? "上传中..." : "添加"}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 清空按钮 */}
      <button
        onClick={() => {
          if (confirm("确定清空画布吗？")) clearCanvas();
        }}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
      >
        <span>🗑</span>
        <span>清空</span>
      </button>

      {/* 保存按钮 */}
      <button
        onClick={handleSaveScene}
        disabled={!currentSceneId}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
      >
        <span>💾</span>
        <span>保存</span>
      </button>

      {/* 场景管理下拉 */}
      <div className="relative">
        <button
          onClick={() => setShowScenes(!showScenes)}
          className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
        >
          <span>📂</span>
          <span>场景</span>
        </button>

        {showScenes && (
          <div
            className="absolute top-full left-0 mt-1 bg-white text-gray-800 rounded-lg shadow-xl p-2 w-52 z-50"
            style={{ fontSize: "12px" }}
          >
            <div className="flex gap-1 mb-2">
              <input
                type="text"
                placeholder="新场景名称"
                className="flex-1 border rounded px-2 py-1 text-xs"
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
                className="bg-green-500 text-white rounded px-2 py-1 text-xs"
              >
                +
              </button>
            </div>

            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs ${
                    scene.id === currentSceneId
                      ? "bg-green-100"
                      : "hover:bg-gray-100"
                  }`}
                  onClick={() => loadScene(scene.id)}
                >
                  <span>{scene.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScene(scene.id);
                    }}
                    className="text-red-500 hover:bg-red-50 px-1 rounded text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 导出按钮 */}
      <button
        onClick={handleExport}
        disabled={!currentSceneId}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
      >
        导出
      </button>

      {/* 导入按钮 */}
      <button
        onClick={() => setShowImport(true)}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
      >
        导入
      </button>

      {/* 撤销重做 */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
        title="撤销"
      >
        ↩️
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-70 rounded px-2 py-1 flex items-center gap-1 transition-colors shadow-sm font-medium border border-green-200 text-xs"
        title="重做"
      >
        ↪️
      </button>

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="bg-white rounded-xl p-5 w-96 max-w-[90%] text-gray-800"
            style={{ fontSize: "12px" }}
          >
            <h3 className="font-bold mb-3" style={{ fontSize: "12px" }}>
              导入场景
            </h3>
            <textarea
              className="w-full h-28 border rounded-lg p-2 mb-3 text-xs"
              placeholder="粘贴场景JSON数据..."
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowImport(false)}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg text-xs"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                className="bg-green-500 text-white rounded px-3 py-1.5 text-xs hover:bg-green-600"
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
