import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useStore } from "@/store/useStore";
import { CardImage } from "@/types";

interface ImageLibraryProps {
  onAddToCanvas?: (imageId: string) => void;
  onWidthChange?: (width: number) => void;
  width?: number;
}

const ITEMS_PER_PAGE = 20;
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;

const ImageLibrary: React.FC<ImageLibraryProps> = ({
  onAddToCanvas,
  onWidthChange,
  width = 240,
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [githubCount, setGithubCount] = useState<number | null>(null);
  const [isLoadingGithubCount, setIsLoadingGithubCount] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isCleaning, setIsCleaning] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGithubCount = useCallback(async () => {
    setIsLoadingGithubCount(true);
    try {
      const res = await fetch(
        "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
      );
      if (!res.ok) throw new Error("获取失败");
      const files = await res.json();
      const imageFiles = files.filter(
        (file: any) =>
          file.type === "file" &&
          file.name !== ".gitkeep" &&
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name),
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

  // 拖拽调整宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      e.preventDefault();
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
      onWidthChange?.(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, onWidthChange]);

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
      result.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    } else {
      result.sort((a, b) => (b.id > a.id ? 1 : -1));
    }

    return result;
  }, [images, selectedCategory, searchTerm, sortBy]);

  const totalCount = filteredImages.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const paginatedImages = filteredImages.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );
  const hasMore = page < totalPages;

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

      const imageFiles = files.filter(
        (file: any) =>
          file.type === "file" &&
          file.name !== ".gitkeep" &&
          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name),
      );

      let addedCount = 0;
      for (const file of imageFiles) {
        const imageUrl = file.download_url;

        const exists = images.some(
          (img: CardImage) =>
            img.src === imageUrl ||
            img.name === file.name.replace(/\.[^/.]+$/, ""),
        );
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
      fetchGithubCount();
    } catch (error) {
      console.error("从 GitHub 加载图片失败:", error);
      alert("同步失败，请查看控制台");
    } finally {
      setIsSyncing(false);
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
      console.log("点击图片:", imageId);
      onAddToCanvas?.(imageId);
    }
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
    setIsBatchMode(false);
  };

  const handleBatchDelete = () => {
    if (confirm(`确定删除选中的 ${selectedImages.size} 张图片吗？`)) {
      selectedImages.forEach((id) => removeImage(id));
      setSelectedImages(new Set());
      setIsBatchMode(false);
    }
  };

  const handleCleanInvalid = async () => {
    if (!confirm("确定清理所有无效图片吗？")) return;
    setIsCleaning(true);
    try {
      await useStore.getState().cleanInvalidImages();
      alert("清理完成！");
    } catch (e) {
      console.error("清理失败:", e);
      alert("清理失败");
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-full flex flex-col bg-white border-r border-gray-200 relative"
      style={{ width, minWidth: width, maxWidth: width }}
    >
      {/* 拖拽调整宽度的手柄 */}
      <div
        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        style={{
          touchAction: "none",
          background: isResizing ? "rgba(59, 130, 246, 0.3)" : "transparent",
        }}
      >
        <div
          className="w-1 h-8 rounded-full"
          style={{
            background: isResizing ? "#3b82f6" : "#d1d5db",
          }}
        />
      </div>

      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <span>{isExpanded ? "▼" : "▶"}</span>
          <span>图片图库</span>
        </button>
        <span className="text-xs text-gray-400">{images.length} 张</span>
      </div>

      {isExpanded && (
        <>
          <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>GitHub:</span>
              {isLoadingGithubCount ? (
                <span className="animate-pulse">加载中...</span>
              ) : githubCount !== null ? (
                <span className="text-green-600">{githubCount} 张</span>
              ) : (
                <span className="text-red-400">获取失败</span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">分类筛选</span>
              <button
                onClick={() => setIsManagingCategories(!isManagingCategories)}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                {isManagingCategories ? "完成" : "管理"}
              </button>
            </div>

            <div className="flex flex-wrap gap-1">
              {["全部", ...categories].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded text-xs ${
                    selectedCategory === cat
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {isManagingCategories && (
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <div className="flex gap-1 mb-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                    placeholder="新分类名称"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-green-500"
                  />
                  <button
                    onClick={handleAddCategory}
                    className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 rounded text-xs"
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

          <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100">
            <button
              onClick={handleSyncFromGitHub}
              disabled={isSyncing}
              className="w-full px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {isSyncing ? (
                <>
                  <span className="animate-spin">↻</span>
                  <span>同步中...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>从 GitHub 同步</span>
                </>
              )}
            </button>
          </div>

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
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="flex-shrink-0 px-3 py-1 border-b border-gray-100 flex gap-2">
            <button
              onClick={() => setSortBy("name")}
              className={`text-xs px-2 py-0.5 rounded ${
                sortBy === "name"
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              按名称
            </button>
            <button
              onClick={() => setSortBy("date")}
              className={`text-xs px-2 py-0.5 rounded ${
                sortBy === "date"
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              按日期
            </button>
          </div>

          <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100 flex gap-2">
            <button
              onClick={() => {
                setIsBatchMode(!isBatchMode);
                setSelectedImages(new Set());
              }}
              className={`flex-1 px-2 py-1 rounded text-xs ${
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
              className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200 disabled:opacity-50"
            >
              {isCleaning ? "清理中..." : "清理无效"}
            </button>
          </div>

          {isBatchMode && (
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-100 space-y-1">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">
                  已选 {selectedImages.size} 张
                </span>
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedImages.size === 0}
                  className="ml-auto px-2 py-0.5 bg-red-500 text-white rounded text-xs disabled:opacity-50 hover:bg-red-600"
                >
                  删除
                </button>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">移到:</span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleBatchSetCategory(cat)}
                    disabled={selectedImages.size === 0}
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs disabled:opacity-50 hover:bg-gray-200"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-2"
            style={{
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            {totalCount === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {searchTerm ? "无结果" : "暂无图片，点击 🔄 同步从 GitHub 加载"}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {paginatedImages.map((image) => (
                    <div
                      key={image.id}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:shadow-md ${
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
                                parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-[10px] text-gray-400 text-center leading-tight px-1 break-all">${image.name || "?"}</div>`;
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            {image.name || "?"}
                          </div>
                        )}
                      </div>

                      {isBatchMode && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">
                          {selectedImages.has(image.id) ? "✓" : ""}
                        </div>
                      )}

                      {!isBatchMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`确定删除 "${image.name}" 吗？`)) {
                              removeImage(image.id);
                            }
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                        {image.name}
                      </div>
                    </div>
                  ))}
                </div>

                {hasMore && (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="w-full mt-2 py-1.5 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                  >
                    加载更多 ({page}/{totalPages})
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageLibrary;
