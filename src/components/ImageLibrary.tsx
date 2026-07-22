import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useStore } from "@/store/useStore";
import { CardImage } from "@/types";
import {
  getCloudinaryImages,
  getCloudinaryImageCount,
  getHanziImages,
  clearAllCloudImages,
  cleanInvalidCloudImages,
  CleanResult,
  RebuildResult,
} from "@/utils/cloudinaryApi";
import HanziGenerator from "./HanziGenerator";

interface ImageLibraryProps {
  onAddToCanvas?: (imageId: string) => void;
  onWidthChange?: (width: number) => void;
  width?: number;
}

const ITEMS_PER_PAGE = 30;
const MIN_WIDTH = 160;
const MAX_WIDTH = 500;
const LAZY_LOAD_BATCH = 30;
const LAZY_LOAD_INTERVAL = 50;

const ImageLibrary: React.FC<ImageLibraryProps> = ({
  onAddToCanvas,
  onWidthChange,
  width = 200,
}) => {
  const {
    images,
    addImage,
    removeImage,
    categories,
    addCategory,
    removeCategory,
    updateImageCategory,
  } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [cloudStatus, setCloudStatus] = useState<{
    count: number;
    error?: string;
  } | null>(null);
  const [isLoadingCloudCount, setIsLoadingCloudCount] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [lastRebuildResult, setLastRebuildResult] =
    useState<RebuildResult | null>(null);
  // ========== 修复：同时显示汉字和英文数量 ==========
  const [hanziCount, setHanziCount] = useState<number | null>(null);
  const [englishCount, setEnglishCount] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  const [lastCleanResult, setLastCleanResult] = useState<CleanResult | null>(
    null,
  );
  const [lastSyncResult, setLastSyncResult] = useState<{
    added: number;
    removed: number;
  } | null>(null);

  const [displayMode, setDisplayMode] = useState<"page" | "all">("page");
  const [loadedCount, setLoadedCount] = useState(0);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(width);

  const fetchCloudCount = useCallback(async () => {
    setIsLoadingCloudCount(true);
    try {
      const result = await getCloudinaryImageCount();
      setCloudStatus(result);
      if (result.error) {
        console.error("⚠️ 云端查询返回错误:", result.error);
      }

      // ========== 修复：同时获取汉字和英文数量 ==========
      const allCloudImages = await getCloudinaryImages();
      const hanzi = allCloudImages.filter(
        (img) => img.category === "汉字",
      ).length;
      const english = allCloudImages.filter(
        (img) => img.category === "英文",
      ).length;
      setHanziCount(hanzi);
      setEnglishCount(english);
    } catch (error) {
      console.error("获取云端图片数量失败:", error);
      setCloudStatus({
        count: 0,
        error: error instanceof Error ? error.message : "未知异常",
      });
      setHanziCount(null);
      setEnglishCount(null);
    } finally {
      setIsLoadingCloudCount(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudCount();
  }, [fetchCloudCount]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      e.preventDefault();
      const deltaX = e.clientX - resizeStartXRef.current;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, resizeStartWidthRef.current + deltaX),
      );
      onWidthChange?.(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isResizingRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - resizeStartXRef.current;
      const newWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, resizeStartWidthRef.current + deltaX),
      );
      onWidthChange?.(newWidth);
    };

    const handleEnd = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [onWidthChange]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = width;
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleTouchResizeStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    resizeStartXRef.current = touch.clientX;
    resizeStartWidthRef.current = width;
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      全部: images.length,
      汉字: 0,
      英文: 0,
    };
    categories.forEach((cat) => {
      counts[cat] = images.filter((img) => img.category === cat).length;
    });
    counts["汉字"] = images.filter((img) => img.category === "汉字").length;
    counts["英文"] = images.filter((img) => img.category === "英文").length;
    return counts;
  }, [images, categories]);

  const filteredImages = useMemo(() => {
    let result = [...images];

    if (selectedCategory !== "全部") {
      result = result.filter((img) => img.category === selectedCategory);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (img) =>
          img.name.toLowerCase().includes(term) ||
          (img.category && img.category.toLowerCase().includes(term)),
      );
    }

    if (sortBy === "name") {
      result.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, "zh-CN");
        return sortOrder === "asc" ? cmp : -cmp;
      });
    } else {
      result.sort((a, b) => {
        const cmp = (b.createdAt || 0) - (a.createdAt || 0);
        return sortOrder === "asc" ? -cmp : cmp;
      });
    }

    return result;
  }, [images, selectedCategory, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    if (displayMode !== "all") {
      setLoadedCount(0);
      setIsLoadingAll(false);
      return;
    }

    setIsLoadingAll(true);
    setLoadedCount(0);

    const loadBatch = (current: number) => {
      if (current >= filteredImages.length) {
        setIsLoadingAll(false);
        setLoadedCount(filteredImages.length);
        return;
      }
      const next = Math.min(current + LAZY_LOAD_BATCH, filteredImages.length);
      setLoadedCount(next);
      setTimeout(() => loadBatch(next), LAZY_LOAD_INTERVAL);
    };

    loadBatch(0);

    return () => {
      setIsLoadingAll(false);
    };
  }, [displayMode, filteredImages.length]);

  const totalCount = filteredImages.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const displayImages = useMemo(() => {
    if (displayMode === "page") {
      return filteredImages.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
      );
    } else {
      return filteredImages.slice(0, loadedCount);
    }
  }, [filteredImages, displayMode, page, loadedCount]);

  const handleSort = (type: "name" | "date") => {
    if (sortBy === type) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(type);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleDisplayModeChange = (mode: "page" | "all") => {
    setDisplayMode(mode);
    setPage(1);
    setLoadedCount(0);
  };

  // ========== 修复：优化同步逻辑，减少等待时间 ==========
  const handleSyncCloud = async () => {
    if (!confirm("确定同步云端图片吗？\n\n这会检查云端图片并同步到本地图库"))
      return;

    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      // 并行执行清理和获取
      const [cleanResult, cloudImages] = await Promise.all([
        cleanInvalidCloudImages(),
        getCloudinaryImages(),
      ]);
      setLastCleanResult(cleanResult);

      let addedCount = 0;
      let skippedCount = 0;

      // 批量检查本地是否存在
      const existingSrcs = new Set(images.map((img) => img.src));
      const existingNames = new Set(images.map((img) => img.name));

      for (const img of cloudImages) {
        if (existingSrcs.has(img.url) || existingNames.has(img.name)) {
          skippedCount++;
        } else {
          addImage({
            src: img.url,
            name: img.name,
            category: img.category || "云端",
            width: 300,
            height: 300,
          });
          addedCount++;
        }
      }

      await fetchCloudCount();

      setLastSyncResult({
        added: addedCount,
        removed: cleanResult.deleted,
      });

      alert(
        `同步完成！\n新增: ${addedCount} 张\n跳过: ${skippedCount} 张\n清理: ${cleanResult.deleted} 条`,
      );
    } catch (error) {
      console.error("同步云端图片失败:", error);
      alert("同步失败: " + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearAllCloud = async () => {
    if (
      !confirm(
        "确定清空所有云端图片吗？此操作不可恢复！\n（Cloudinary 示例图片不会被删除）",
      )
    )
      return;

    try {
      const deletedCount = await clearAllCloudImages();
      await fetchCloudCount();
      alert(`清空成功！已删除 ${deletedCount} 张图片`);
    } catch (error) {
      alert("清空失败：" + (error as Error).message);
    }
  };

  const handleRebuildIndex = async () => {
    if (
      !confirm(
        "确定修复云端索引吗？\n\n这会扫描本地图库，补录 Cloudinary URL 到云端索引。",
      )
    )
      return;

    setIsRebuilding(true);
    setLastRebuildResult(null);

    try {
      const { rebuildCloudIndexFromLocal } =
        await import("@/utils/cloudinaryApi");
      const result = await rebuildCloudIndexFromLocal(images);
      setLastRebuildResult(result);

      await fetchCloudCount();

      alert(
        `索引修复完成！\n扫描: ${result.scanned} 张\n补录: ${result.added} 条\n已存在: ${result.skipped} 条`,
      );
    } catch (error) {
      console.error("修复索引失败:", error);
      alert("修复失败: " + (error as Error).message);
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleImageClick = (imageId: string) => {
    if (isBatchMode) {
      setSelectedImages((prev) => {
        const next = new Set(prev);
        if (next.has(imageId)) {
          next.delete(imageId);
        } else {
          next.add(imageId);
        }
        return next;
      });
    } else {
      onAddToCanvas?.(imageId);
    }
  };

  const handleSelectAll = () => {
    const allIds = new Set(filteredImages.map((img) => img.id));
    setSelectedImages(allIds);
  };

  const handleDeselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim());
      setNewCategoryName("");
    }
  };

  const handleBatchSetCategory = (category: string) => {
    selectedImages.forEach((id) => {
      updateImageCategory(id, category);
    });
    setSelectedImages(new Set());
  };

  const handleBatchDelete = () => {
    if (confirm(`确定删除选中的 ${selectedImages.size} 张图片吗？`)) {
      selectedImages.forEach((id) => removeImage(id));
      setSelectedImages(new Set());
      setIsBatchMode(false);
    }
  };

  const handleCleanInvalid = async () => {
    if (
      !confirm(
        "确定清理所有无效图片吗？\n\n这会检查云端图片是否可访问，删除无效记录。",
      )
    )
      return;

    setIsCleaning(true);
    setLastCleanResult(null);

    try {
      await useStore.getState().cleanInvalidImages();
      const result = await cleanInvalidCloudImages();
      setLastCleanResult(result);
      await fetchCloudCount();

      alert(
        `清理完成！\n检查: ${result.checked} 张\n无效: ${result.invalid} 张\n删除: ${result.deleted} 条`,
      );
    } catch (e) {
      console.error("清理失败:", e);
      alert("清理失败: " + (e as Error).message);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="h-full flex" style={{ fontSize: "12px" }}>
      <div
        className="h-full flex flex-col bg-white border-r border-gray-200 overflow-hidden"
        style={{ width, minWidth: width, maxWidth: width, flexShrink: 0 }}
      >
        <div
          className="flex-1 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        >
          {/* 图库标题 */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 sticky top-0 bg-white z-10">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
            >
              <span>{isExpanded ? "▼" : "▶"}</span>
              <span>图片图库</span>
            </button>
            <span className="text-gray-400">{images.length} 张</span>
          </div>

          {isExpanded && (
            <>
              {/* 汉字生成器 */}
              <HanziGenerator onAddToCanvas={onAddToCanvas} />

              {/* 云端信息 */}
              <div className="px-2 py-1 border-b border-gray-100">
                <div className="flex items-center justify-between text-gray-500">
                  <span>云端:</span>
                  <div className="flex items-center gap-1">
                    {isLoadingCloudCount ? (
                      <span className="animate-pulse text-xs">加载中...</span>
                    ) : cloudStatus ? (
                      <>
                        {cloudStatus.error ? (
                          <span
                            className="text-red-400 text-xs"
                            title={cloudStatus.error}
                          >
                            查询失败
                          </span>
                        ) : (
                          <span className="text-green-600 text-xs">
                            {cloudStatus.count} 张
                          </span>
                        )}
                        {cloudStatus.count === 0 &&
                          !cloudStatus.error &&
                          images.length > 0 && (
                            <button
                              onClick={handleRebuildIndex}
                              disabled={isRebuilding}
                              className="px-1 py-0.5 bg-orange-100 text-orange-600 rounded hover:bg-orange-200 text-xs"
                              title="从本地图库反向重建云端索引"
                            >
                              {isRebuilding ? "修复中..." : "修复索引"}
                            </button>
                          )}
                        {cloudStatus.count > 0 && (
                          <button
                            onClick={handleClearAllCloud}
                            className="px-1 py-0.5 bg-red-100 text-red-500 rounded hover:bg-red-200 text-xs"
                            title="清空云端（保留示例图）"
                          >
                            清空
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">--</span>
                    )}
                  </div>
                </div>

                {lastRebuildResult && (
                  <div className="mt-1 text-xs text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                    修复: 扫描 {lastRebuildResult.scanned} 张, 补录{" "}
                    {lastRebuildResult.added} 条
                    {lastRebuildResult.errors.length > 0 &&
                      `, 错误 ${lastRebuildResult.errors.length} 个`}
                  </div>
                )}

                {/* ========== 修复：同时显示汉字和英文数量 ========== */}
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-gray-500 text-xs">汉字:</span>
                  <span className="text-orange-500 text-xs">
                    {hanziCount !== null ? `${hanziCount} 张` : "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-gray-500 text-xs">英文:</span>
                  <span className="text-blue-500 text-xs">
                    {englishCount !== null ? `${englishCount} 张` : "--"}
                  </span>
                </div>
              </div>

              {/* 同步云端按钮 */}
              <div className="px-2 py-1 border-b border-gray-100">
                <button
                  onClick={handleSyncCloud}
                  disabled={isSyncing}
                  className="w-full px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1 text-xs"
                >
                  {isSyncing ? (
                    <>
                      <span className="animate-spin">↻</span>
                      <span>同步中...</span>
                    </>
                  ) : (
                    <>
                      <span>🔄</span>
                      <span>同步云端</span>
                    </>
                  )}
                </button>
                {/* ========== 修复：删除这段不需要的文字 ========== */}
              </div>

              {/* 同步结果提示 */}
              {lastSyncResult && (
                <div className="px-2 py-1 bg-green-50 border-b border-green-100 text-green-700 text-xs">
                  上次同步: 清理 {lastSyncResult.removed} 条, 新增{" "}
                  {lastSyncResult.added} 张
                </div>
              )}

              {/* 分类筛选 */}
              <div className="px-2 py-1 border-b border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-500">分类筛选</span>
                  <button
                    onClick={() =>
                      setIsManagingCategories(!isManagingCategories)
                    }
                    className="text-blue-500 hover:text-blue-600 text-xs"
                  >
                    {isManagingCategories ? "完成" : "管理"}
                  </button>
                </div>

                <div className="flex gap-1 mb-1">
                  <button
                    onClick={() => {
                      setSelectedCategory("汉字");
                      setPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      selectedCategory === "汉字"
                        ? "bg-orange-500 text-white"
                        : "bg-orange-50 text-orange-600 hover:bg-orange-100"
                    }`}
                  >
                    汉字 ({categoryCounts["汉字"] || 0})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory("英文");
                      setPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      selectedCategory === "英文"
                        ? "bg-blue-500 text-white"
                        : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                    }`}
                  >
                    英文 ({categoryCounts["英文"] || 0})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory("全部");
                      setPage(1);
                    }}
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      selectedCategory === "全部"
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    全部
                  </button>
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 bg-white text-xs"
                >
                  {[
                    "全部",
                    "汉字",
                    "英文",
                    ...categories.filter((c) => c !== "汉字" && c !== "英文"),
                  ].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </select>

                {isManagingCategories && (
                  <div className="mt-2 p-2 bg-gray-50 rounded">
                    <div className="flex gap-1 mb-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleAddCategory()
                        }
                        placeholder="新分类名称"
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 text-xs"
                      />
                      <button
                        onClick={handleAddCategory}
                        className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                      >
                        添加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {categories
                        .filter(
                          (c) => c !== "未分类" && c !== "汉字" && c !== "英文",
                        )
                        .map((cat) => (
                          <span
                            key={cat}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-gray-200 rounded text-xs"
                          >
                            {cat}
                            <button
                              onClick={() => removeCategory(cat)}
                              className="text-red-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 搜索 */}
              <div className="px-2 py-1 border-b border-gray-100">
                <input
                  type="text"
                  placeholder="搜索图片..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                    setSelectedImages(new Set());
                  }}
                  className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 text-xs"
                />
              </div>

              {/* 排序 */}
              <div className="px-2 py-1 border-b border-gray-100 flex gap-2">
                <button
                  onClick={() => handleSort("name")}
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-xs ${
                    sortBy === "name"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  名称
                  {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
                <button
                  onClick={() => handleSort("date")}
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-xs ${
                    sortBy === "date"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  日期
                  {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </div>

              {/* 显示模式切换 */}
              <div className="px-2 py-1 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">显示:</span>
                  <div className="flex-1 flex gap-1">
                    <button
                      onClick={() => handleDisplayModeChange("page")}
                      className={`flex-1 px-2 py-0.5 rounded text-center text-xs ${
                        displayMode === "page"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      分页
                    </button>
                    <button
                      onClick={() => handleDisplayModeChange("all")}
                      className={`flex-1 px-2 py-0.5 rounded text-center text-xs ${
                        displayMode === "all"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      全部
                    </button>
                  </div>
                </div>
                {displayMode === "all" && totalCount > 0 && (
                  <div className="mt-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {isLoadingAll
                          ? `加载中... ${loadedCount}/${totalCount}`
                          : `已加载 ${loadedCount}/${totalCount}`}
                      </span>
                      <span>
                        {Math.round((loadedCount / totalCount) * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{
                          width: `${(loadedCount / totalCount) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 批量操作 + 清理无效 */}
              <div className="px-2 py-1 border-b border-gray-100 flex gap-1">
                <button
                  onClick={() => {
                    setIsBatchMode(!isBatchMode);
                    setSelectedImages(new Set());
                  }}
                  className={`flex-1 px-1.5 py-0.5 rounded text-xs ${
                    isBatchMode
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {isBatchMode ? "退出多选" : "批量操作"}
                </button>
                <button
                  onClick={handleCleanInvalid}
                  disabled={isCleaning}
                  className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50 text-xs"
                  title="检查所有云端图片URL是否可访问，删除无效记录"
                >
                  {isCleaning ? "清理中..." : "清理无效"}
                </button>
              </div>

              {/* 清理结果提示 */}
              {lastCleanResult && lastCleanResult.deleted > 0 && (
                <div className="px-2 py-1 bg-yellow-50 border-b border-yellow-100 text-yellow-700 text-xs">
                  上次清理: 检查 {lastCleanResult.checked} 张, 无效{" "}
                  {lastCleanResult.invalid} 张, 删除 {lastCleanResult.deleted}{" "}
                  条
                  {lastCleanResult.errors.length > 0 &&
                    ` (错误 ${lastCleanResult.errors.length} 个)`}
                </div>
              )}

              {/* 批量模式工具栏 */}
              {isBatchMode && (
                <div className="px-2 py-1 border-b border-gray-100 space-y-1">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-xs">
                      已选 {selectedImages.size} 张
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button
                        onClick={handleSelectAll}
                        className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 text-xs"
                      >
                        全选
                      </button>
                      <button
                        onClick={handleDeselectAll}
                        className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-xs"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleBatchDelete}
                        disabled={selectedImages.size === 0}
                        className="px-1.5 py-0.5 bg-red-500 text-white rounded disabled:opacity-50 hover:bg-red-600 text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-xs">移到:</span>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && selectedImages.size > 0) {
                          handleBatchSetCategory(e.target.value);
                        }
                      }}
                      disabled={selectedImages.size === 0}
                      className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded disabled:opacity-50 focus:outline-none text-xs"
                    >
                      <option value="">选择分类...</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 图片列表 */}
              <div className="p-1.5">
                {totalCount === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-xs">
                    {searchTerm
                      ? "无结果"
                      : "暂无图片，使用上方汉字生成器或同步云端"}
                  </div>
                ) : (
                  <>
                    <div
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(45px, 1fr))",
                      }}
                    >
                      {displayImages.map((image) => (
                        <div
                          key={image.id}
                          className={`relative aspect-square rounded-md overflow-hidden border-2 cursor-pointer transition-all hover:shadow-md ${
                            isBatchMode && selectedImages.has(image.id)
                              ? "border-green-500 ring-2 ring-green-300"
                              : image.category === "汉字"
                                ? "border-orange-200 hover:border-orange-400"
                                : image.category === "英文"
                                  ? "border-blue-200 hover:border-blue-400"
                                  : "border-gray-200 hover:border-green-300"
                          }`}
                          onClick={() => handleImageClick(image.id)}
                        >
                          <div className="w-full h-full bg-gray-50 flex items-center justify-center">
                            {image.src ? (
                              <img
                                src={image.src}
                                alt={image.name}
                                className="w-full h-full object-cover pointer-events-none"
                                draggable={false}
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<div class="flex items-center justify-center w-full h-full text-gray-400 bg-gray-100 text-xs">${image.name || "?"}</div>`;
                                  }
                                }}
                              />
                            ) : (
                              <div className="flex items-center justify-center w-full h-full text-gray-400 bg-gray-100 text-xs">
                                {image.name || "?"}
                              </div>
                            )}
                          </div>

                          {image.category === "汉字" && (
                            <div className="absolute top-0.5 left-0.5 px-1 py-0 bg-orange-500 text-white text-[8px] rounded">
                              汉字
                            </div>
                          )}
                          {image.category === "英文" && (
                            <div className="absolute top-0.5 left-0.5 px-1 py-0 bg-blue-500 text-white text-[8px] rounded">
                              英文
                            </div>
                          )}

                          {isBatchMode && selectedImages.has(image.id) && (
                            <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center text-white shadow-sm text-[8px]">
                              ✓
                            </div>
                          )}

                          {!isBatchMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`确定删除"${image.name}"吗？`)) {
                                  removeImage(image.id);
                                }
                              }}
                              className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 transition-opacity text-[8px]"
                              style={{ zIndex: 10 }}
                            >
                              ×
                            </button>
                          )}

                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0 truncate text-center text-[10px]">
                            {image.name}
                          </div>
                        </div>
                      ))}
                    </div>

                    {displayMode === "all" &&
                      loadedCount < totalCount &&
                      !isLoadingAll && (
                        <div className="flex items-center justify-center py-2 text-gray-400 text-xs">
                          <span className="animate-pulse">
                            向下滚动加载更多... ({loadedCount}/{totalCount})
                          </span>
                        </div>
                      )}

                    {displayMode === "page" && totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 mt-2 py-1">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 text-xs"
                        >
                          ← 上一页
                        </button>
                        <span className="text-gray-500 text-xs">
                          {page} / {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page >= totalPages}
                          className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 text-xs"
                        >
                          下一页 →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 拖拽手柄 */}
      <div
        className="h-full cursor-col-resize flex items-center justify-center hover:bg-blue-100/50 transition-colors flex-shrink-0 relative z-10"
        onMouseDown={handleResizeStart}
        onTouchStart={handleTouchResizeStart}
        style={{
          width: "12px",
          minWidth: "12px",
          touchAction: "none",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "3px",
            height: "48px",
            backgroundColor: "#9ca3af",
            borderRadius: "9999px",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
};

export default ImageLibrary;
