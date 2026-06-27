import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useStore } from "@/store/useStore";
import {
  uploadImageToGitHub,
  deleteImageFromGitHub,
} from "@/utils/imageupload";

type SortField = "name" | "createdAt";
type SortOrder = "asc" | "desc";

// 分类颜色映射
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  中文: { bg: "bg-red-500", text: "text-white" },
  英文: { bg: "bg-blue-500", text: "text-white" },
  未分类: { bg: "bg-gray-400", text: "text-white" },
};

const getCategoryStyle = (cat: string) => {
  return CATEGORY_COLORS[cat] || { bg: "bg-purple-500", text: "text-white" };
};

const ImageLibrary: React.FC = () => {
  const {
    images,
    addImage,
    removeImage,
    addCardToScene,
    cleanInvalidImages,
    cleanDuplicateImages,
    categories,
    addCategory,
    removeCategory,
    updateImageCategory,
  } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [width, setWidth] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ========== 分类相关状态 ==========
  const [activeCategory, setActiveCategory] = useState<string>("全部");
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  // 批量修改分类
  const [batchCategoryTarget, setBatchCategoryTarget] = useState<string>("");
  // =================================

  // ========== GitHub 图片数量 ==========
  const [githubCount, setGithubCount] = useState<number | null>(null);
  const [isLoadingGithubCount, setIsLoadingGithubCount] = useState(false);

  const fetchGithubCount = useCallback(async () => {
    setIsLoadingGithubCount(true);
    try {
      const res = await fetch(
        "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
      );
      if (!res.ok) throw new Error("获取失败");

      const files = await res.json();
      const imageFiles = files.filter(
        (file: any) => file.name !== ".gitkeep" && file.type === "file",
      );
      setGithubCount(imageFiles.length);
    } catch (error) {
      console.error("获取 GitHub 图片数量失败:", error);
      setGithubCount(null);
    } finally {
      setIsLoadingGithubCount(false);
    }
  }, []);

  useEffect(() => {
    fetchGithubCount();
  }, [fetchGithubCount]);

  useEffect(() => {
    if (!isSyncing && githubCount !== null) {
      fetchGithubCount();
    }
  }, [isSyncing, fetchGithubCount]);
  // =====================================

  const ITEMS_PER_PAGE = 40;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // 手动同步 GitHub 图片
  const handleSyncFromGitHub = async () => {
    if (images.length > 0) {
      if (!confirm("本地已有图片，同步可能导致重复。是否继续？")) return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch(
        "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
      );
      if (!res.ok) throw new Error("加载失败");

      const files = await res.json();
      const imageFiles = files.filter((file: any) => file.name !== ".gitkeep");

      let addedCount = 0;
      for (const file of imageFiles) {
        const imageUrl = encodeURI(file.download_url);
        const exists = images.some((img: any) => img.src === imageUrl);
        if (!exists) {
          addImage({
            src: imageUrl,
            name: file.name.replace(/\.[^/.]+$/, ""),
            category: "未分类",
            width: 300,
            height: 300,
          });
          addedCount++;
        }
      }

      alert(`同步完成，新增 ${addedCount} 张图片`);
    } catch (error) {
      console.error("从 GitHub 加载图片失败:", error);
      alert("同步失败，请查看控制台");
    } finally {
      setIsSyncing(false);
    }
  };

  // ========== 完全串行上传：一张一张传，避免 SHA 冲突 ==========
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) {
      alert("请选择图片文件");
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: imageFiles.length });

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    let githubFiles: any[] = [];
    try {
      const res = await fetch(
        "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
      );
      if (res.ok) {
        githubFiles = await res.json();
      }
    } catch (error) {
      console.error("获取 GitHub 文件列表失败:", error);
    }

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const fileName = file.name.replace(/\.[^/.]+$/, "");

      setUploadProgress({
        current: i + 1,
        total: imageFiles.length,
      });

      const existsLocal = images.some((img) => img.name === fileName);
      if (existsLocal) {
        console.log("本地已存在，跳过:", fileName);
        skipCount++;
        continue;
      }

      const existsGitHub = githubFiles.some(
        (f: any) => f.name.includes(`_${fileName}.`) || f.name === file.name,
      );
      if (existsGitHub) {
        console.log("GitHub 已存在，跳过:", fileName);
        skipCount++;
        continue;
      }

      try {
        const imageUrl = await uploadImageToGitHub(file);

        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => {
            img.width = 300;
            img.height = 300;
            resolve();
          };
          img.src = imageUrl;
        });

        addImage({
          src: imageUrl,
          name: fileName,
          category: activeCategory === "全部" ? "未分类" : activeCategory,
          width: img.width,
          height: img.height,
        });

        console.log("上传成功:", fileName);
        successCount++;

        githubFiles.push({ name: `${Date.now()}_${file.name}` });
      } catch (error) {
        console.error("上传失败:", fileName, error);
        failCount++;
      }

      if (i < imageFiles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });
    e.target.value = "";

    fetchGithubCount();

    const messages: string[] = [];
    if (successCount > 0) messages.push(`成功 ${successCount} 张`);
    if (skipCount > 0) messages.push(`跳过 ${skipCount} 张（已存在）`);
    if (failCount > 0) messages.push(`失败 ${failCount} 张`);

    alert(messages.join("，") || "上传完成");
  };

  // ========== 清理按钮：只清理本地 IndexedDB，绝不删除 GitHub ==========
  const handleCleanImages = async () => {
    if (
      !confirm(
        "清理重复和无效的图片？\n（仅清理本地显示，不会删除 GitHub 文件）",
      )
    )
      return;

    setIsCleaning(true);
    try {
      cleanDuplicateImages();
      await cleanInvalidImages();
      alert("清理完成！仅移除了本地重复/无效记录，GitHub 文件不受影响。");
    } catch (error) {
      console.error("清理失败:", error);
      alert("清理失败，请查看控制台");
    } finally {
      setIsCleaning(false);
    }
  };

  // ========== 分类管理 ==========
  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.includes(name)) {
      alert("分类已存在");
      return;
    }
    addCategory(name);
    setNewCategoryName("");
  };

  const handleRemoveCategory = (category: string) => {
    if (!confirm(`删除分类"${category}"？该分类下的图片将变为"未分类"。`))
      return;
    removeCategory(category);
    if (activeCategory === category) setActiveCategory("全部");
  };

  const handleChangeImageCategory = (imageId: string, category: string) => {
    updateImageCategory(imageId, category);
    setEditingImageId(null);
  };

  // 批量修改分类
  const handleBatchChangeCategory = () => {
    if (selectedImages.size === 0 || !batchCategoryTarget) return;
    if (
      !confirm(
        `将选中的 ${selectedImages.size} 张图片移到"${batchCategoryTarget}"分类？`,
      )
    )
      return;
    selectedImages.forEach((id) =>
      updateImageCategory(id, batchCategoryTarget),
    );
    setSelectedImages(new Set());
    setIsBatchMode(false);
    setBatchCategoryTarget("");
    alert("批量修改分类完成！");
  };
  // =============================

  // 排序切换
  const handleSortChange = (field: SortField) => {
    setPage(1);
    setSelectedImages(new Set());

    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // 排序后的图片
  const sortedImages = useMemo(() => {
    if (images.length === 0) return [];

    const sorted = [...images];

    try {
      sorted.sort((a, b) => {
        let comparison = 0;

        if (sortField === "name") {
          const nameA = (a.name || "").toString();
          const nameB = (b.name || "").toString();
          comparison = nameA.localeCompare(nameB, "zh-CN");
        } else if (sortField === "createdAt") {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          comparison = timeA - timeB;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });
    } catch (err) {
      console.error("排序出错:", err);
      return images;
    }

    return sorted;
  }, [images, sortField, sortOrder]);

  // 搜索过滤
  const filteredImages = useMemo(() => {
    if (!searchTerm.trim()) return sortedImages;

    const term = searchTerm.toLowerCase();
    return sortedImages.filter((img) =>
      (img.name || "").toLowerCase().includes(term),
    );
  }, [sortedImages, searchTerm]);

  // ========== 按分类过滤 ==========
  const categoryFilteredImages = useMemo(() => {
    if (activeCategory === "全部") return filteredImages;
    return filteredImages.filter((img) => img.category === activeCategory);
  }, [filteredImages, activeCategory]);
  // =============================

  // 分页
  const paginatedImages = useMemo(() => {
    return categoryFilteredImages.slice(0, page * ITEMS_PER_PAGE);
  }, [categoryFilteredImages, page]);

  const hasMore = paginatedImages.length < categoryFilteredImages.length;
  const totalCount = categoryFilteredImages.length;

  // 批量选择
  const toggleSelect = (id: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedImages(new Set(paginatedImages.map((img) => img.id)));
  };

  const deselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleBatchDelete = () => {
    if (selectedImages.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedImages.size} 张图片吗？`)) return;
    selectedImages.forEach((id) => removeImage(id));
    setSelectedImages(new Set());
    setIsBatchMode(false);
  };

  const handleImageClick = (imageId: string) => {
    if (isBatchMode) {
      toggleSelect(imageId);
    } else {
      addCardToScene(imageId);
    }
  };

  // ========== 拖拽调整宽度：同时支持鼠标和触摸 ==========
  const startResizing = useCallback((clientX: number) => {
    setIsResizing(true);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startResizing(e.clientX);
    },
    [startResizing],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      const touch = e.touches[0];
      startResizing(touch.clientX);
    },
    [startResizing],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setWidth(Math.max(80, newWidth));
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const newWidth = touch.clientX;
      setWidth(Math.max(80, newWidth));
    };

    const handleMouseUp = () => setIsResizing(false);
    const handleTouchEnd = () => setIsResizing(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isResizing]);

  // 统计各分类数量
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach((cat) => {
      counts[cat] = images.filter((img) => img.category === cat).length;
    });
    counts["全部"] = images.length;
    return counts;
  }, [images, categories]);

  return (
    <div
      className="bg-white border-r border-gray-300 shadow-lg flex flex-col relative h-full select-none"
      style={{
        width: isExpanded ? `${width}px` : "40px",
        minWidth: isExpanded ? "80px" : "40px",
      }}
    >
      {/* 拖拽调整条 — 同时支持鼠标和触摸 */}
      {isExpanded && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            width: "24px",
            background: isResizing ? "rgba(76,175,80,0.3)" : "transparent",
            cursor: "ew-resize",
            position: "absolute",
            top: 0,
            bottom: 0,
            right: "-12px",
            zIndex: 100,
            touchAction: "none",
          }}
          title="左右拖拽调整宽度"
        />
      )}

      {/* 图库头部 */}
      <div className="flex items-center justify-between px-2 py-2 bg-gray-50">
        <div
          className="flex items-center gap-1 cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-lg">🖼️</span>
          {isExpanded && (
            <span className="font-medium text-gray-700 text-sm">
              {totalCount}
            </span>
          )}
          <span className="text-gray-400 text-xs">
            {isExpanded ? "◀" : "▶"}
          </span>
        </div>
      </div>

      {/* 图库内容 */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-2">
          {/* GitHub 图片数量 */}
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs text-gray-500">
              GitHub:
              {isLoadingGithubCount ? (
                <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin ml-1" />
              ) : githubCount !== null ? (
                <span className="font-medium text-blue-600 ml-1">
                  {githubCount} 张
                </span>
              ) : (
                <span className="text-red-400 ml-1">获取失败</span>
              )}
            </span>
            <button
              onClick={fetchGithubCount}
              disabled={isLoadingGithubCount}
              className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-400"
              title="刷新数量"
            >
              🔄
            </button>
          </div>

          {/* ========== 分类筛选栏 ========== */}
          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 font-medium">
                分类筛选
              </span>
              <button
                onClick={() => setIsManagingCategories(!isManagingCategories)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {isManagingCategories ? "完成" : "管理"}
              </button>
            </div>

            {/* 分类标签 */}
            <div className="flex flex-wrap gap-1">
              {["全部", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                    activeCategory === cat
                      ? "bg-[#4CAF50] text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  {cat}
                  <span className="ml-0.5 opacity-70">
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              ))}
            </div>

            {/* 分类管理面板 */}
            {isManagingCategories && (
              <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-1 mb-2">
                  <input
                    type="text"
                    placeholder="新分类名称"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-[#4CAF50]"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-2 py-1 bg-[#4CAF50] text-white rounded text-xs hover:bg-green-600"
                  >
                    添加
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {categories
                    .filter((c) => c !== "未分类")
                    .map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 rounded-full text-xs text-gray-600"
                      >
                        {cat}
                        <button
                          onClick={() => handleRemoveCategory(cat)}
                          className="text-red-400 hover:text-red-600 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
          {/* ============================== */}

          {/* 同步按钮 */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={handleSyncFromGitHub}
              disabled={isSyncing}
              className={`flex-1 py-1 rounded text-xs ${
                isSyncing
                  ? "bg-blue-300 text-white cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isSyncing ? "同步中..." : "🔄 同步"}
            </button>
          </div>

          {/* 搜索框 */}
          <div className="mb-2">
            <input
              type="text"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
                setSelectedImages(new Set());
              }}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-[#4CAF50]"
            />
          </div>

          {/* 排序按钮 */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => handleSortChange("name")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                sortField === "name"
                  ? "bg-[#4CAF50] text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              名称
              {sortField === "name" && (sortOrder === "asc" ? " ▲" : " ▼")}
            </button>
            <button
              onClick={() => handleSortChange("createdAt")}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                sortField === "createdAt"
                  ? "bg-[#4CAF50] text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              时间
              {sortField === "createdAt" && (sortOrder === "asc" ? " ▲" : " ▼")}
            </button>
          </div>

          {/* 批量操作栏 */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`flex-1 py-1 rounded text-xs ${
                isUploading
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-[#4CAF50] text-white hover:bg-green-600"
              }`}
            >
              {isUploading
                ? `上传中 ${uploadProgress.current}/${uploadProgress.total}`
                : "+ 添加"}
            </button>
            <button
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedImages(new Set());
              }}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                isBatchMode
                  ? "bg-orange-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {isBatchMode ? "完成" : "多选"}
            </button>
          </div>

          {/* 清理按钮 */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={handleCleanImages}
              disabled={isCleaning}
              className={`w-full py-1 rounded text-xs ${
                isCleaning
                  ? "bg-purple-300 text-white cursor-not-allowed"
                  : "bg-purple-500 text-white hover:bg-purple-600"
              }`}
            >
              {isCleaning ? "清理中..." : "🧹 清理重复/无效"}
            </button>
          </div>

          {/* 批量模式操作按钮 */}
          {isBatchMode && (
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAll}
                  className="flex-1 bg-blue-500 text-white py-1 rounded text-xs hover:bg-blue-600"
                >
                  全选
                </button>
                <button
                  onClick={deselectAll}
                  className="flex-1 bg-gray-500 text-white py-1 rounded text-xs hover:bg-gray-600"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedImages.size === 0}
                  className="flex-1 bg-red-500 text-white py-1 rounded text-xs hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  删除({selectedImages.size})
                </button>
              </div>
              {/* 批量修改分类 */}
              <div className="flex items-center gap-1 mt-1">
                <select
                  value={batchCategoryTarget}
                  onChange={(e) => setBatchCategoryTarget(e.target.value)}
                  className="flex-1 px-1 py-1 border border-gray-300 rounded text-xs"
                >
                  <option value="">选择目标分类...</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleBatchChangeCategory}
                  disabled={selectedImages.size === 0 || !batchCategoryTarget}
                  className="px-2 py-1 bg-[#4CAF50] text-white rounded text-xs hover:bg-green-600 disabled:opacity-50"
                >
                  移动
                </button>
              </div>
            </div>
          )}

          {/* 图片列表 */}
          {totalCount === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <p className="text-xs">
                {searchTerm ? "无结果" : "暂无图片，点击 🔄 同步从 GitHub 加载"}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2">
                {paginatedImages.map((image) => {
                  const catStyle = getCategoryStyle(image.category);
                  return (
                    <div
                      key={image.id}
                      className={`group relative cursor-pointer hover:scale-105 transition-transform ${
                        selectedImages.has(image.id)
                          ? "ring-2 ring-red-500 rounded-lg"
                          : ""
                      }`}
                      onClick={() => handleImageClick(image.id)}
                    >
                      <div
                        className={`bg-gray-100 rounded-lg overflow-hidden border-2 shadow-sm ${
                          selectedImages.has(image.id)
                            ? "border-red-500"
                            : "border-gray-200 hover:border-[#4CAF50]"
                        }`}
                        style={{ width: "64px", height: "64px" }}
                      >
                        {image.src ? (
                          <img
                            src={image.src}
                            alt={image.name}
                            crossOrigin="anonymous"
                            className="w-full h-full object-cover pointer-events-none"
                            draggable={false}
                            onError={(e) => {
                              console.error(
                                "图片加载失败:",
                                image.id,
                                image.name,
                              );
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-xs text-gray-400">${
                                  image.name?.charAt(0) || "?"
                                }</div>`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            {image.name?.charAt(0) || "?"}
                          </div>
                        )}
                      </div>

                      {/* ========== 分类标签（常驻显示，带颜色） ========== */}
                      <div className="absolute -bottom-2 left-0 right-0 flex justify-center z-10">
                        <span
                          className={`px-1.5 py-0 rounded-full text-[9px] cursor-pointer shadow-sm ${catStyle.bg} ${catStyle.text}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingImageId(image.id);
                          }}
                          title="点击修改分类"
                        >
                          {image.category}
                        </span>
                      </div>

                      {/* 分类下拉框 */}
                      {editingImageId === image.id && (
                        <div
                          className="absolute top-8 left-0 z-50 bg-white border border-gray-300 rounded shadow-lg p-1 min-w-[80px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[10px] text-gray-400 mb-1 px-1 border-b pb-0.5">
                            选择分类
                          </div>
                          {categories.map((cat) => {
                            const style = getCategoryStyle(cat);
                            return (
                              <button
                                key={cat}
                                onClick={() =>
                                  handleChangeImageCategory(image.id, cat)
                                }
                                className={`block w-full text-left px-2 py-1 text-xs rounded hover:bg-gray-100 mb-0.5 ${
                                  image.category === cat
                                    ? "bg-green-50 font-medium"
                                    : ""
                                }`}
                              >
                                <span
                                  className={`inline-block w-2 h-2 rounded-full mr-1 ${style.bg}`}
                                />
                                {cat}
                                {image.category === cat && (
                                  <span className="ml-1 text-green-600">✓</span>
                                )}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setEditingImageId(null)}
                            className="block w-full text-center px-2 py-1 text-[10px] text-gray-400 hover:text-gray-600 mt-1 border-t pt-1"
                          >
                            取消
                          </button>
                        </div>
                      )}
                      {/* ================================================ */}

                      {isBatchMode && (
                        <div
                          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                            selectedImages.has(image.id)
                              ? "bg-red-500 text-white"
                              : "bg-gray-300 text-gray-500"
                          }`}
                        >
                          {selectedImages.has(image.id) ? "✓" : ""}
                        </div>
                      )}
                      {!isBatchMode && (
                        <button
                          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`删除"${image.name}"?`)) {
                              removeImage(image.id);
                            }
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={() => setPage(page + 1)}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                  >
                    更多(
                    {categoryFilteredImages.length - paginatedImages.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
};

export default ImageLibrary;
