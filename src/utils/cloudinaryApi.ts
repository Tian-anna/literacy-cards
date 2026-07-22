import { supabase } from "./supabase";

const CLOUD_NAME = "kqcvg4iw";
const UPLOAD_PRESET = "literacy-cards";

// Netlify Function 完整 URL
const NETLIFY_API_URL =
  "https://effervescent-kulfi-8283b0.netlify.app/.netlify/functions/delete-cloudinary";

// ========== GitHub 存储配置（备选方案） ==========
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GITHUB_REPO =
  import.meta.env.VITE_GITHUB_REPO || "Tian-anna/literacy-cards";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getFileSha(path: string): Promise<string> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` },
  });
  if (!res.ok) throw new Error("获取文件信息失败");
  const data = await res.json();
  return data.sha;
}

export async function uploadImageToGitHub(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  const content = base64.split(",")[1];
  const path = `images/${Date.now()}_${file.name}`;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: "添加图片", content }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "上传失败");
  }
  const data = await res.json();
  return data.content.download_url;
}

export async function deleteImageFromGitHub(fileName: string): Promise<void> {
  const path = `images/${fileName}`;
  try {
    const sha = await getFileSha(path);
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: "删除图片", sha }),
    });
    if (!res.ok) throw new Error("删除失败");
    console.log("已删除 GitHub 文件:", fileName);
  } catch (error) {
    console.error("删除 GitHub 文件失败:", error);
    throw error;
  }
}

// ========== Cloudinary 示例图片过滤 ==========

/** 判断是否是 Cloudinary 的示例图片（无法删除） */
export function isCloudinarySample(publicId: string): boolean {
  if (!publicId) return false;
  const lower = publicId.toLowerCase();
  return (
    lower === "sample" ||
    lower.startsWith("sample/") ||
    lower.startsWith("samples/") ||
    lower.startsWith("cld-sample")
  );
}

/** 过滤掉 Cloudinary 示例图片 */
export function filterOutSamples<T extends { public_id?: string }>(
  images: T[],
): T[] {
  return images.filter((img) => !isCloudinarySample(img.public_id || ""));
}

// ========== 图片可访问性检查 ==========

/**
 * 检查图片 URL 是否可访问
 * 使用 Image 对象加载，比 fetch HEAD 更可靠（不受 CORS 限制）
 */
export function checkImageAccessible(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) {
      resolve(false);
      return;
    }

    const img = new Image();
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000); // 5秒超时

    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
}

// ========== 数据库操作 ==========

// 检查图片是否已存在
async function checkImageExists(
  fileName: string,
): Promise<{ url: string; public_id: string } | null> {
  const { data, error } = await supabase
    .from("cloud_images")
    .select("url, public_id")
    .eq("name", fileName)
    .maybeSingle();

  if (error) {
    console.error("Check exists error:", error);
    return null;
  }

  return data;
}

// ========== 通用上传（原有图片） ==========

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  console.log("Uploading:", fileName);

  // 检查是否已存在
  const existing = await checkImageExists(fileName);
  if (existing) {
    const isAccessible = await checkImageAccessible(existing.url);
    if (isAccessible) {
      return existing.url;
    }
    // 如果存在但不可访问，继续上传新图片
  }

  // 上传到 Cloudinary，指定 folder 参数隔离
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "literacy-cards"); // ← 普通图片放到 literacy-cards

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  console.log("Uploading to:", url);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Cloudinary error:", error);
    throw new Error(error.error?.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  console.log("Upload success:", data.secure_url);

  // 保存到 Supabase（更新或插入）
  if (existing) {
    const { error } = await supabase
      .from("cloud_images")
      .update({
        url: data.secure_url,
        public_id: data.public_id,
      })
      .eq("name", fileName);

    if (error) console.error("Supabase update error:", error);
  } else {
    const { error } = await supabase.from("cloud_images").insert({
      name: fileName,
      url: data.secure_url,
      public_id: data.public_id,
      category: "cloud",
    });

    if (error) console.error("Supabase insert error:", error);
  }

  console.log("Saved to Supabase");
  return data.secure_url;
}

// ========== 汉字专用上传（隔离存储 + 多端一致性保证） ==========

export interface HanziStyleConfig {
  gridType: "tian" | "mi" | "huigong" | "pinyin" | "plain"; // 田字格/米字格/回宫格/拼音格/纯文字
  fontSize: number;
  color: string;
  bgColor: string;
  fontFamily: string;
  showStrokeOrder?: boolean; // 未来扩展：笔顺
  showPinyin?: boolean; // 拼音格专用
  pinyinText?: string; // 拼音内容
}

/**
 * 上传汉字图片到 Cloudinary（专用文件夹隔离）
 * 使用 public_id 包含样式信息，确保多端渲染一致
 */
export async function uploadHanziToCloudinary(
  dataUrl: string,
  char: string,
  styleConfig: HanziStyleConfig,
): Promise<string> {
  const timestamp = Date.now();
  // public_id 包含汉字和样式摘要，便于管理和识别
  const styleTag = `${styleConfig.gridType}_${styleConfig.fontSize}`;
  const publicId = `hanzi_${char}_${styleTag}_${timestamp}`;

  const file = dataUrlToFile(dataUrl, publicId);

  // 检查是否已存在相同汉字+样式的图片
  const { data: existing } = await supabase
    .from("cloud_images")
    .select("url, public_id")
    .eq("name", char)
    .eq("category", "汉字")
    .maybeSingle();

  if (existing) {
    const isAccessible = await checkImageAccessible(existing.url);
    if (isAccessible) {
      console.log("汉字图片已存在，直接复用:", existing.url);
      return existing.url;
    }
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  // 关键：汉字图片单独存放到 literacy-cards/hanzi/ 文件夹
  formData.append("folder", "literacy-cards/hanzi");
  formData.append("public_id", publicId);
  // 添加标签便于分类管理
  formData.append("tags", `hanzi,${styleConfig.gridType},literacy`);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Cloudinary hanzi upload error:", error);
    // 降级到 GitHub
    console.log("尝试降级到 GitHub 存储...");
    try {
      return await uploadImageToGitHub(file);
    } catch (githubError) {
      throw new Error(
        `上传失败 (Cloudinary: ${error.error?.message || "未知"}, GitHub: ${githubError})`,
      );
    }
  }

  const data = await res.json();
  console.log("Hanzi upload success:", data.secure_url);

  // 保存到 Supabase，标记为汉字分类
  const { error } = await supabase.from("cloud_images").insert({
    name: char,
    url: data.secure_url,
    public_id: data.public_id,
    category: "汉字",
    metadata: {
      gridType: styleConfig.gridType,
      fontSize: styleConfig.fontSize,
      color: styleConfig.color,
      bgColor: styleConfig.bgColor,
      fontFamily: styleConfig.fontFamily,
    },
  });

  if (error) {
    console.error("Supabase hanzi insert error:", error);
  }

  return data.secure_url;
}

// ========== 获取图片列表 ==========

export async function getCloudinaryImages() {
  const { data, error } = await supabase
    .from("cloud_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get cloud images error:", error);
    return [];
  }

  const filtered = filterOutSamples(data || []);

  if ((data || []).length !== filtered.length) {
    console.log(
      `过滤了 ${(data || []).length - filtered.length} 张 Cloudinary 示例图片`,
    );
  }

  return filtered;
}

export async function getCloudinaryImageCount(): Promise<number> {
  const { data, error } = await supabase
    .from("cloud_images")
    .select("public_id");

  if (error) {
    console.error("Get cloud count error:", error);
    return 0;
  }

  const filtered = filterOutSamples(data || []);
  return filtered.length;
}

/** 获取汉字图片列表（专用接口） */
export async function getHanziImages() {
  const { data, error } = await supabase
    .from("cloud_images")
    .select("*")
    .eq("category", "汉字")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get hanzi images error:", error);
    return [];
  }

  return data || [];
}

// ========== 删除（调用 Netlify Function） ==========

export async function deleteCloudImage(public_id: string): Promise<boolean> {
  if (isCloudinarySample(public_id)) {
    console.warn("无法删除 Cloudinary 示例图片:", public_id);
    throw new Error("Cloudinary 示例图片无法删除");
  }

  console.log("Deleting cloud image:", public_id);

  // 1. 先调用 Netlify Function 删除 Cloudinary 图片
  try {
    const backendRes = await fetch(NETLIFY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id }),
    });

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({}));
      console.error("删除 Cloudinary 图片失败:", errorData);
    } else {
      console.log("Cloudinary 图片删除成功");
    }
  } catch (e) {
    console.error("调用后端删除 API 失败:", e);
  }

  // 2. 删除 Supabase 记录
  const { error } = await supabase
    .from("cloud_images")
    .delete()
    .eq("public_id", public_id);

  if (error) {
    console.error("Delete Supabase error:", error);
    throw new Error(error.message);
  }

  console.log("Delete success - Supabase record removed");
  return true;
}

// 清空所有云端图片（只删除自己的图片）
export async function clearAllCloudImages(): Promise<number> {
  console.log("Clearing all cloud images");

  const { data, error: fetchError } = await supabase
    .from("cloud_images")
    .select("public_id");

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    throw new Error(fetchError.message);
  }

  const myImages = filterOutSamples(data || []);
  const sampleCount = (data || []).length - myImages.length;

  if (myImages.length === 0) {
    console.log("没有可删除的图片");
    return 0;
  }

  let deletedCount = 0;
  for (const img of myImages) {
    try {
      await deleteCloudImage(img.public_id);
      deletedCount++;
    } catch (e) {
      console.error("删除失败:", img.public_id, e);
    }
  }

  console.log(`已删除 ${deletedCount} 张图片，跳过了 ${sampleCount} 张示例图`);
  return deletedCount;
}

// ========== 清理无效图片 ==========

export interface CleanResult {
  total: number;
  checked: number;
  invalid: number;
  deleted: number;
  errors: string[];
}

export async function cleanInvalidCloudImages(): Promise<CleanResult> {
  console.log("开始清理无效云端图片...");

  const result: CleanResult = {
    total: 0,
    checked: 0,
    invalid: 0,
    deleted: 0,
    errors: [],
  };

  const { data: images, error } = await supabase
    .from("cloud_images")
    .select("*");

  if (error) {
    console.error("获取云端图片失败:", error);
    throw new Error(error.message);
  }

  if (!images || images.length === 0) {
    console.log("云端没有图片记录");
    return result;
  }

  result.total = images.length;
  console.log(`云端共有 ${images.length} 条记录`);

  // 先清理 Cloudinary 示例图片的记录
  const sampleImages = images.filter((img) =>
    isCloudinarySample(img.public_id),
  );
  if (sampleImages.length > 0) {
    console.log(`发现 ${sampleImages.length} 张 Cloudinary 示例图片记录`);

    for (const img of sampleImages) {
      try {
        const { error: delError } = await supabase
          .from("cloud_images")
          .delete()
          .eq("id", img.id);

        if (delError) {
          result.errors.push(
            `删除示例图失败 ${img.public_id}: ${delError.message}`,
          );
        } else {
          result.deleted++;
          console.log("已清理示例图片记录:", img.public_id);
        }
      } catch (e) {
        result.errors.push(`删除示例图异常 ${img.public_id}: ${e}`);
      }
    }
  }

  // 检查用户上传图片的可访问性
  const userImages = images.filter((img) => !isCloudinarySample(img.public_id));
  const invalidIds: number[] = [];

  for (const img of userImages) {
    result.checked++;
    const isAccessible = await checkImageAccessible(img.url);

    if (!isAccessible) {
      invalidIds.push(img.id);
      result.invalid++;
      console.log("发现无效图片:", img.name, img.url);
    }
  }

  // 删除无效记录
  for (const id of invalidIds) {
    const img = userImages.find((i) => i.id === id);
    if (img) {
      try {
        await fetch(NETLIFY_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_id: img.public_id }),
        });
      } catch (e) {
        console.log("删除 Cloudinary 图片失败（可能已不存在）:", img.public_id);
      }
    }

    try {
      const { error: delError } = await supabase
        .from("cloud_images")
        .delete()
        .eq("id", id);

      if (delError) {
        result.errors.push(`删除无效图片失败 id=${id}: ${delError.message}`);
      } else {
        result.deleted++;
      }
    } catch (e) {
      result.errors.push(`删除无效图片异常 id=${id}: ${e}`);
    }
  }

  console.log(
    `清理完成: 总计 ${result.total} 条, 检查 ${result.checked} 张, 无效 ${result.invalid} 张, 删除 ${result.deleted} 条`,
  );

  return result;
}

// ========== DataURL 转 File（用于汉字生成器上传） ==========

export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], `${fileName}.png`, { type: mime });
}

/**
 * 上传 DataURL 图片到 Cloudinary
 * 复用现有的 uploadImageToCloudinary，只是把 DataURL 包装成 File
 */
export async function uploadDataUrlToCloudinary(
  dataUrl: string,
  fileName: string,
): Promise<string> {
  const file = dataUrlToFile(dataUrl, fileName);
  return uploadImageToCloudinary(file);
}
