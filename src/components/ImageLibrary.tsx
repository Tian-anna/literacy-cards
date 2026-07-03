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
  clearAllCloudImages,
  cleanInvalidCloudImages,
  CleanResult,
} from "@/utils/cloudinaryApi";

interface ImageLibraryProps {
  onAddToCanvas?: (imageId: string) => void;
  onWidthChange?: (width: number) => void;
  width?: number;
}

const ITEMS_PER_PAGE = 30;
const MIN_WIDTH = 160;
const MAX_WIDTH = 500;
const LAZY_LOAD_BATCH = 30; // 每批加载数量
const LAZY_LOAD_INTERVAL = 50; // 每批间隔(ms)

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
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [isLoadingCloudCount, setIsLoadingCloudCount] = useState(false);
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 🆕 显示模式：分页 / 全部
  const [displayMode, setDisplayMode] = useState<"page" | "all">("page");
  // 🆕 全部模式下已加载数量
  const [loadedCount, setLoadedCount] = useState(0);
  // 🆕 全部模式是否正在加载
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(width);

  const fetchCloudCount = useCallback(async () => {
    setIsLoadingCloudCount(true);
    try {
      const count = await getCloudinaryImageCount();
      setCloudCount(count);
    } catch (error) {
      console.error("获取云端图片数量失败:", error);
      setCloudCount(null);
    } finally {
      setIsLoadingCloudCount(false);
    }
  }, []);

  useEffect(() => {
    fetchCloudCount();
  }, [fetchCloudCount]);

  // 🆕 全部显示模式：懒加载分批加载图片
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
      // 清理：切换模式时中断加载
      setIsLoadingAll(false);
    };
  }, [displayMode, filteredImages.length]);

  // 🆕 全部模式下滚动加载更多
  useEffect(() => {
    if (displayMode !== "all") return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = container;
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        setLoadedCount((prev) =>
          Math.min(prev + LAZY_LOAD_BATCH, filteredImages.length),
        );
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [displayMode, filteredImages.length]);

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
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
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
    const counts: Record<string, number> = { 全部: images.length };
    categories.forEach((cat) => {
      counts[cat] = images.filter((img) => img.category === cat).length;
    });
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

  // 🆕 根据显示模式决定显示的图片列表
  const totalCount = filteredImages.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const displayImages = useMemo(() => {
    if (displayMode === "page") {
      return filteredImages.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE,
      );
    } else {
      // 全部模式：显示已加载的部分
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

  // 🆕 切换显示模式
  const handleDisplayModeChange = (mode: "page" | "all") => {
    setDisplayMode(mode);
    setPage(1);
    setLoadedCount(0);
    // 滚动到顶部
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // 🔄 同步云端图片：清理无效记录 + 同步到本地
  const handleSyncCloud = async () => {
    if (
      !confirm(
        "确定同步云端图片吗？\n\n这会:\n1. 检查所有云端图片是否可访问\n2. 删除 Cloudinary 中已不存在但 Supabase 中仍有的记录\n3. 将云端图片同步到本地图库",
      )
    )
      return;

    setIsSyncing(true);
    setLastSyncResult(null);

    try {
      // 1. 先清理无效云端记录
      const cleanResult = await cleanInvalidCloudImages();
      setLastCleanResult(cleanResult);

      // 2. 获取清理后的云端图片
      const cloudImages = await getCloudinaryImages();

      // 3. 同步到本地
      let addedCount = 0;
      let skippedCount = 0;

      for (const img of cloudImages) {
        const exists = images.some(
          (localImg) => localImg.src === img.url || localImg.name === img.name,
        );
        if (!exists) {
          addImage({
            src: img.url,
            name: img.name,
            category: "云端",
            width: 300,
            height: 300,
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      // 4. 更新云端数量显示
      await fetchCloudCount();

      setLastSyncResult({
        added: addedCount,
        removed: cleanResult.deleted,
      });

      const messages = ["同步完成！"];
      messages.push(`清理无效: ${cleanResult.deleted} 条`);
      messages.push(`新增本地: ${addedCount} 张`);
      messages.push(`跳过重复: ${skippedCount} 张`);
      messages.push(`云端总计: ${cloudImages.length} 张`);
      alert(messages.join("\n"));
    } catch (error) {
      console.error("同步云端图片失败:", error);
      alert("同步失败: " + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromCloud = async () => {
    if (images.length > 0) {
      if (!confirm("本地已有图片，同步可能导致重复。是否继续？")) return;
    }

    setIsSyncing(true);
    try {
      const cloudImages = await getCloudinaryImages();
      let addedCount = 0;
      let skippedCount = 0;

      for (const img of cloudImages) {
        const exists = images.some(
          (localImg) => localImg.src === img.url || localImg.name === img.name,
        );
        if (!exists) {
          addImage({
            src: img.url,
            name: img.name,
            category: "云端",
            width: 300,
            height: 300,
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      setCloudCount(cloudImages.length);
      const msg =
        skippedCount > 0
          ? `同步完成，新增 ${addedCount} 张，跳过 ${skippedCount} 张重复`
          : `同步完成，新增 ${addedCount} 张图片`;
      alert(msg);
    } catch (error) {
      console.error("从云端同步失败:", error);
      alert("同步失败，请查看控制台");
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
        "确定清理所有无效图片吗？\n\n这会:\n1. 检查每张云端图片是否可访问\n2. 删除不可访问的云端记录\n3. 清理 Cloudinary 示例图片记录\n4. 清理本地无效图片",
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

      const messages = ["清理完成！"];
      messages.push(`云端记录: ${result.total} 条`);
      messages.push(`检查图片: ${result.checked} 张`);
      messages.push(`发现无效: ${result.invalid} 张`);
      messages.push(`已删除: ${result.deleted} 条`);
      if (result.errors.length > 0) {
        messages.push(`错误: ${result.errors.length} 个`);
      }
      alert(messages.join("\n"));
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
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 font-medium text-gray-700 hover:text-gray-900"
            style={{ borderRadius: "8px" }}
          >
            <span>{isExpanded ? "▼" : "▶"}</span>
            <span>图片图库</span>
          </button>
          <span className="text-gray-400">{images.length} 张</span>
        </div>

        {isExpanded && (
          <>
            {/* 云端信息 */}
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
              <div className="flex items-center justify-between text-gray-500">
                <span>云端:</span>
                <div className="flex items-center gap-2">
                  {isLoadingCloudCount ? (
                    <span className="animate-pulse">加载中...</span>
                  ) : cloudCount !== null ? (
                    <span className="text-green-600">{cloudCount} 张</span>
                  ) : (
                    <span className="text-red-400">获取失败</span>
                  )}
                  {cloudCount !== null && cloudCount > 0 && (
                    <button
                      onClick={handleClearAllCloud}
                      className="px-1.5 py-0.5 bg-red-100 text-red-500 rounded hover:bg-red-200"
                      title="清空云端（保留示例图）"
                      style={{ borderRadius: "8px" }}
                    >
                      清空
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 🔄 同步云端按钮 */}
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
              <button
                onClick={handleSyncCloud}
                disabled={isSyncing}
                className="w-full px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1"
                style={{ borderRadius: "8px" }}
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
              <p
                className="text-gray-400 mt-1 text-center"
                style={{ fontSize: "9px" }}
              >
                清理无效记录并同步到本地
              </p>
            </div>

            {/* 同步结果提示 */}
            {lastSyncResult && (
              <div className="flex-shrink-0 px-3 py-1 bg-green-50 border-b border-green-100 text-green-700">
                上次同步: 清理 {lastSyncResult.removed} 条, 新增{" "}
                {lastSyncResult.added} 张
              </div>
            )}

            {/* 从云端同步按钮（旧功能保留） */}
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
              <button
                onClick={handleSyncFromCloud}
                disabled={isSyncing}
                className="w-full px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
                style={{ borderRadius: "8px" }}
              >
                {isSyncing ? (
                  <>
                    <span className="animate-spin">↻</span>
                    <span>同步中...</span>
                  </>
                ) : (
                  <>
                    <span>⬇️</span>
                    <span>从云端导入</span>
                  </>
                )}
              </button>
            </div>

            {/* 分类筛选 */}
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-500">分类筛选</span>
                <button
                  onClick={() => setIsManagingCategories(!isManagingCategories)}
                  className="text-blue-500 hover:text-blue-600"
                  style={{ borderRadius: "8px" }}
                >
                  {isManagingCategories ? "完成" : "管理"}
                </button>
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500 bg-white"
                style={{ borderRadius: "8px" }}
              >
                {["全部", ...categories].map((cat) => (
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
                      className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500"
                    />
                    <button
                      onClick={handleAddCategory}
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      style={{ borderRadius: "8px" }}
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
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 rounded"
                          style={{ borderRadius: "8px" }}
                        >
                          {cat}
                          <button
                            onClick={() => removeCategory(cat)}
                            className="text-red-400 hover:text-red-600"
                            style={{ borderRadius: "8px" }}
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
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
              <input
                type="text"
                placeholder="搜索图片..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                  setSelectedImages(new Set());
                }}
                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-green-500"
                style={{ maxWidth: "100%", borderRadius: "8px" }}
              />
            </div>

            {/* 排序 */}
            <div className="flex-shrink-0 px-3 py-1 border-b border-gray-100 flex gap-2">
              <button
                onClick={() => handleSort("name")}
                className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                  sortBy === "name"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
                style={{ borderRadius: "8px" }}
              >
                名称
                {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
              <button
                onClick={() => handleSort("date")}
                className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                  sortBy === "date"
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
                style={{ borderRadius: "8px" }}
              >
                日期
                {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
            </div>

            {/* 🆕 显示模式切换 */}
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">显示方式:</span>
                <div className="flex-1 flex gap-1">
                  <button
                    onClick={() => handleDisplayModeChange("page")}
                    className={`flex-1 px-2 py-0.5 rounded text-center ${
                      displayMode === "page"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    style={{ borderRadius: "8px" }}
                  >
                    分页
                  </button>
                  <button
                    onClick={() => handleDisplayModeChange("all")}
                    className={`flex-1 px-2 py-0.5 rounded text-center ${
                      displayMode === "all"
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                    style={{ borderRadius: "8px" }}
                  >
                    全部
                  </button>
                </div>
              </div>
              {/* 🆕 全部模式加载进度 */}
              {displayMode === "all" && totalCount > 0 && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {isLoadingAll
                        ? `加载中... ${loadedCount}/${totalCount}`
                        : `已加载 ${loadedCount}/${totalCount}`}
                    </span>
                    <span>{Math.round((loadedCount / totalCount) * 100)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100 flex gap-2">
              <button
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  setSelectedImages(new Set());
                }}
                className={`flex-1 px-2 py-1 rounded ${
                  isBatchMode
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                style={{ borderRadius: "8px" }}
              >
                {isBatchMode ? "退出多选" : "批量操作"}
              </button>
              <button
                onClick={handleCleanInvalid}
                disabled={isCleaning}
                className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50"
                title="检查所有云端图片URL是否可访问，删除无效记录"
                style={{ borderRadius: "8px" }}
              >
                {isCleaning ? "清理中..." : "清理无效"}
              </button>
            </div>

            {/* 清理结果提示 */}
            {lastCleanResult && lastCleanResult.deleted > 0 && (
              <div className="flex-shrink-0 px-3 py-1 bg-yellow-50 border-b border-yellow-100 text-yellow-700">
                上次清理: 检查 {lastCleanResult.checked} 张, 无效{" "}
                {lastCleanResult.invalid} 张, 删除 {lastCleanResult.deleted} 条
                {lastCleanResult.errors.length > 0 &&
                  ` (错误 ${lastCleanResult.errors.length} 个)`}
              </div>
            )}

            {/* 批量模式工具栏 */}
            {isBatchMode && (
              <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100 space-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">
                    已选 {selectedImages.size} 张
                  </span>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={handleSelectAll}
                      className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                      style={{ borderRadius: "8px" }}
                    >
                      全选
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                      style={{ borderRadius: "8px" }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      disabled={selectedImages.size === 0}
                      className="px-2 py-0.5 bg-red-500 text-white rounded disabled:opacity-50 hover:bg-red-600"
                      style={{ borderRadius: "8px" }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">移到:</span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value && selectedImages.size > 0) {
                        handleBatchSetCategory(e.target.value);
                      }
                    }}
                    disabled={selectedImages.size === 0}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded disabled:opacity-50 focus:outline-none focus:border-green-500"
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
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-2"
              style={{
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              {totalCount === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {searchTerm
                    ? "无结果"
                    : "暂无图片，点击 📁 添加或 🔄 同步云端"}
                </div>
              ) : (
                <>
                  <div
                    className="grid gap-1.5"
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
                                console.error(
                                  "图片加载失败:",
                                  image.id,
                                  image.name,
                                  image.src,
                                );
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="flex items-center justify-center w-full h-full text-gray-400 bg-gray-100">
                                      ${image.name || "?"}
                                    </div>
                                  `;
                                }
                              }}
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-gray-400 bg-gray-100">
                              {image.name || "?"}
                            </div>
                          )}
                        </div>

                        {isBatchMode && selectedImages.has(image.id) && (
                          <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white shadow-sm">
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
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500/80 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                            style={{ zIndex: 10 }}
                          >
                            ×
                          </button>
                        )}

                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white px-1 py-0.5 truncate text-center">
                          {image.name}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 🆕 全部模式：底部加载更多提示 */}
                  {displayMode === "all" &&
                    loadedCount < totalCount &&
                    !isLoadingAll && (
                      <div className="flex items-center justify-center py-3 text-gray-400 text-xs">
                        <span className="animate-pulse">
                          向下滚动加载更多... ({loadedCount}/{totalCount})
                        </span>
                      </div>
                    )}

                  {/* 分页控件（仅分页模式显示） */}
                  {displayMode === "page" && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-2 py-1.5">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderRadius: "8px" }}
                      >
                        ← 上一页
                      </button>
                      <span className="text-gray-500">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page >= totalPages}
                        className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ borderRadius: "8px" }}
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

      {/* 拖拽手柄 */}
      <div
        className="h-full cursor-col-resize flex items-center justify-center hover:bg-blue-100/50 transition-colors flex-shrink-0 relative z-10"
        onMouseDown={handleResizeStart}
        onTouchStart={handleTouchResizeStart}
        style={{
          width: "16px",
          minWidth: "16px",
          touchAction: "none",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "4px",
            height: "64px",
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
