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

// 全局变量，确保只同步一次
let globalHasSynced = false;

const ImageLibrary: React.FC = () => {
  const {
    images,
    addImage,
    removeImage,
    addCardToScene,
    cleanInvalidImages,
    cleanDuplicateImages,
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
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const ITEMS_PER_PAGE = 40;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  // 启动时从 GitHub 加载已有图片
  useEffect(() => {
    if (globalHasSynced) {
      console.log("全局已同步，跳过");
      return;
    }

    // 检查 localStorage
    const lastSync = localStorage.getItem("images_last_sync");
    const now = Date.now();
    if (lastSync && now - parseInt(lastSync) < 3600000) {
      console.log("1小时内已同步过，跳过");
      globalHasSynced = true;
      return;
    }

    async function loadImagesFromGitHub() {
      if (images.length > 0) {
        console.log("本地已有图片，跳过同步");
        localStorage.setItem("images_last_sync", now.toString());
        globalHasSynced = true;
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch(
          "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
        );
        if (!res.ok) throw new Error("加载失败");

        const files = await res.json();
        const imageFiles = files.filter(
          (file: any) => file.name !== ".gitkeep",
        );

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
          }
        }

        localStorage.setItem("images_last_sync", now.toString());
        globalHasSynced = true;
        console.log("同步完成，共加载", imageFiles.length, "张图片");
      } catch (error) {
        console.error("从 GitHub 加载图片失败:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadImagesFromGitHub();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);

    await Promise.all(
      Array.from(files).map(async (file) => {
        if (!file.type.startsWith("image/")) return;

        const fileName = file.name.replace(/\.[^/.]+$/, "");

        // 1. 检查本地是否已存在
        const existsLocal = images.some((img) => img.name === fileName);
        if (existsLocal) {
          console.log("本地已存在，跳过:", fileName);
          return;
        }

        // 2. 检查 GitHub 是否已有同名文件
        try {
          const res = await fetch(
            "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
          );
          if (res.ok) {
            const githubFiles = await res.json();
            const existsGitHub = githubFiles.some(
              (f: any) =>
                f.name.includes(`_${fileName}.`) || f.name === file.name,
            );
            if (existsGitHub) {
              console.log("GitHub 已存在，跳过:", fileName);
              return;
            }
          }
        } catch (error) {
          console.error("检查 GitHub 失败:", error);
        }

        // 3. 上传到 GitHub
        try {
          const imageUrl = await uploadImageToGitHub(file);
          console.log("上传成功:", imageUrl);

          // 4. 获取图片尺寸
          const img = new Image();
          img.crossOrigin = "anonymous";

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => {
              img.width = 300;
              img.height = 300;
              resolve();
            };
            img.src = imageUrl;
          });

          // 5. 保存 URL 到 store
          addImage({
            src: imageUrl,
            name: fileName,
            category: "未分类",
            width: img.width,
            height: img.height,
          });
        } catch (error) {
          console.error("上传失败:", error);
          alert("图片上传失败，请检查 Token 配置或网络连接");
        }
      }),
    );

    setIsUploading(false);
    e.target.value = "";
  };

  // 清理重复和无效图片
  const handleCleanImages = async () => {
    if (!confirm("清理重复和无效的图片？此操作不可撤销。")) return;

    setIsCleaning(true);
    try {
      // 1. 清理本地重复图片
      cleanDuplicateImages();

      // 2. 清理无效 URL
      await cleanInvalidImages();

      // 3. 获取 GitHub 上的图片列表
      const res = await fetch(
        "https://api.github.com/repos/Tian-anna/literacy-cards/contents/images",
      );
      if (res.ok) {
        const files = await res.json();
        const githubFiles = files
          .filter((file: any) => file.name !== ".gitkeep")
          .map((file: any) => file.name);

        // 4. 删除 GitHub 上不在本地列表中的图片
        const localNames = new Set(images.map((img) => img.name));
        for (const fileName of githubFiles) {
          const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
          const nameWithoutTimestamp = nameWithoutExt.replace(/^\d+_/, "");
          if (!localNames.has(nameWithoutTimestamp)) {
            try {
              await deleteImageFromGitHub(fileName);
            } catch (error) {
              console.error("删除 GitHub 图片失败:", fileName, error);
            }
          }
        }
      }

      alert("清理完成");
    } catch (error) {
      console.error("清理失败:", error);
      alert("清理失败，请查看控制台");
    } finally {
      setIsCleaning(false);
    }
  };

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

  // 分页
  const paginatedImages = useMemo(() => {
    return filteredImages.slice(0, page * ITEMS_PER_PAGE);
  }, [filteredImages, page]);

  const hasMore = paginatedImages.length < filteredImages.length;
  const totalCount = filteredImages.length;

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

  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setWidth(Math.max(80, newWidth));
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return (
    <div
      className="bg-white border-r border-gray-300 shadow-lg flex flex-col relative h-full select-none"
      style={{
        width: isExpanded ? `${width}px` : "40px",
        minWidth: isExpanded ? "80px" : "40px",
      }}
    >
      {/* 拖拽调整条 */}
      {isExpanded && (
        <div
          ref={resizeRef}
          onMouseDown={handleMouseDown}
          style={{
            width: "12px",
            background: isResizing ? "rgba(76,175,80,0.3)" : "transparent",
            cursor: "ew-resize",
            position: "absolute",
            top: 0,
            bottom: 0,
            right: "-6px",
            zIndex: 100,
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
          {/* 加载提示 */}
          {isLoading && (
            <div className="text-center text-gray-400 py-4">
              <p className="text-xs">正在加载图片...</p>
            </div>
          )}

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
              {isUploading ? "上传中..." : "+ 添加"}
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
              {isCleaning ? "清理中..." : "🧹 清理重复"}
            </button>
          </div>

          {/* 批量模式操作按钮 */}
          {isBatchMode && (
            <div className="flex items-center gap-1 mb-2">
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
          )}

          {/* 图片列表 */}
          {totalCount === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <p className="text-xs">{searchTerm ? "无结果" : "暂无图片"}</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2">
                {paginatedImages.map((image) => (
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
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-2">
                  <button
                    onClick={() => setPage(page + 1)}
                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                  >
                    更多({filteredImages.length - paginatedImages.length})
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
