import React, { useState, useCallback, useRef } from "react";
import { useStore } from "@/store/useStore";
import { uploadImageToGitHub } from "@/utils/githubApi";

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
    addImage,
  } = useStore();

  const [newSceneName, setNewSceneName] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState("");
  const [showScenes, setShowScenes] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件上传
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      console.log("📁 选择文件:", files?.length || 0, "个");

      if (!files || files.length === 0) {
        console.log("❌ 没有文件被选择");
        return;
      }

      setIsUploading(true);

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          console.log("⏭️ 跳过非图片文件:", file.name);
          continue;
        }

        console.log("🚀 开始上传:", file.name);

        try {
          // 上传到 GitHub
          const downloadUrl = await uploadImageToGitHub(file);
          console.log("✅ 上传成功:", downloadUrl);

          // 添加到本地 store
          addImage({
            src: downloadUrl,
            name: file.name.replace(/\.[^/.]+$/, ""),
            category: "本地",
            width: 300,
            height: 300,
          });
          console.log("✅ 已添加到本地图库");
        } catch (error) {
          console.error("❌ 上传失败:", error);
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
    <div className="bg-green-500 text-white px-3 py-2 flex items-center gap-2 shadow-md text-[10px] flex-wrap">
      {/* 添加图片按钮 */}
      <label
        className={`bg-white text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors shadow-sm font-medium text-[10px] cursor-pointer relative overflow-hidden ${
          isUploading ? "opacity-70" : ""
        }`}
      >
        <span>{isUploading ? "⏳" : "📁"}</span>
        <span>{isUploading ? "上传中..." : "添加"}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: "100%", height: "100%", fontSize: "100px" }}
        />
      </label>

      {/* 清空按钮 */}
      <button
        onClick={() => {
          if (confirm("确定清空画布吗？")) clearCanvas();
        }}
        className="bg-white text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors shadow-sm font-medium text-[10px]"
      >
        <span>🗑</span>
        <span>清空</span>
      </button>

      {/* 保存按钮 */}
      <button
        onClick={handleSaveScene}
        disabled={!currentSceneId}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors shadow-sm font-medium text-[10px]"
      >
        <span>💾</span>
        <span>保存</span>
      </button>

      {/* 场景管理下拉 */}
      <div className="relative">
        <button
          onClick={() => setShowScenes(!showScenes)}
          className="bg-white text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 flex items-center gap-1 transition-colors shadow-sm font-medium text-[10px]"
        >
          <span>📂</span>
          <span>场景</span>
        </button>

        {showScenes && (
          <div className="absolute top-full left-0 mt-1 bg-white text-gray-800 rounded-lg shadow-xl p-3 w-56 z-50">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="新场景名称"
                className="flex-1 border rounded px-2 py-1 text-[10px]"
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
                className="bg-green-500 text-white px-2 py-1 rounded text-[10px] hover:bg-green-600"
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
                  <span className="text-[10px]">{scene.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScene(scene.id);
                    }}
                    className="text-red-500 hover:bg-red-50 px-1 rounded text-[10px]"
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
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition-colors shadow-sm font-medium text-[10px]"
      >
        导出
      </button>

      {/* 导入按钮 */}
      <button
        onClick={() => setShowImport(true)}
        className="bg-white text-green-600 hover:bg-green-50 rounded-lg px-3 py-1.5 transition-colors shadow-sm font-medium text-[10px]"
      >
        导入
      </button>

      {/* 撤销重做 */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg px-2 py-1.5 transition-colors shadow-sm text-[10px]"
        title="撤销"
      >
        ↩️
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="bg-white text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg px-2 py-1.5 transition-colors shadow-sm text-[10px]"
        title="重做"
      >
        ↪️
      </button>

      {/* 导入弹窗 */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-w-[90%] text-gray-800">
            <h3 className="font-bold text-lg mb-4">导入场景</h3>
            <textarea
              className="w-full h-32 border rounded-lg p-3 text-[10px] mb-4"
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
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
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
