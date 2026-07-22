// src/utils/cloudinaryApi.ts

import { supabase } from "./supabase";

const CLOUD_NAME = "kqcvg4iw";
const UPLOAD_PRESET = "literacy-cards";

// Netlify Function URL
const NETLIFY_API_URL =
  "https://effervescent-kulfi-8283b0.netlify.app/.netlify/delete-cloudinary";

// GitHub storage config
const GITHUB_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GITHUB_REPO =
  import.meta.env.VITE_GITHUB_REPO || "Tian-anna/literacy-cards";

// Debug tools
function logDebug(label: string, data?: any) {
  console.log(`[CloudAPI] ${label}`, data || "");
}

function logError(label: string, error: any) {
  console.error(`[CloudAPI] ${label}:`, error);
}

// File conversion
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

// GitHub upload/delete
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
    logDebug("已删除 GitHub 文件", fileName);
  } catch (error) {
    logError("删除 GitHub 文件失败", error);
    throw error;
  }
}

// Cloudinary sample filter
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

export function filterOutSamples<T extends { public_id?: string }>(
  images: T[],
): T[] {
  return images.filter((img) => !isCloudinarySample(img.public_id || ""));
}

export function checkImageAccessible(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) {
      resolve(false);
      return;
    }

    const img = new Image();
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
        resolve(false);
        return;
      }
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    const separator = url.includes("?") ? "&" : "?";
    img.src = `${url}${separator}_nocache=${Date.now()}`;
  });
}

// Database operations
async function checkImageExists(
  fileName: string,
): Promise<{ url: string; public_id: string } | null> {
  logDebug("检查图片是否存在", fileName);

  try {
    const { data, error } = await supabase
      .from("cloud_images")
      .select("url, public_id")
      .eq("name", fileName)
      .maybeSingle();

    if (error) {
      logError("检查存在性时数据库错误", error);
      return null;
    }

    return data;
  } catch (e) {
    logError("检查存在性时异常", e);
    return null;
  }
}

// General upload
export async function uploadImageToCloudinary(file: File): Promise<string> {
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  logDebug("开始上传", fileName);

  const existing = await checkImageExists(fileName);
  if (existing) {
    const isAccessible = await checkImageAccessible(existing.url);
    if (isAccessible) {
      logDebug("图片已存在且可访问，直接复用", existing.url);
      return existing.url;
    }
    logDebug("图片存在但不可访问，重新上传");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "literacy-cards");

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  logDebug("上传到 Cloudinary", url);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    logError("Cloudinary 上传失败", error);
    throw new Error(error.error?.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();
  logDebug("上传成功", data.secure_url);

  if (existing) {
    const { error } = await supabase
      .from("cloud_images")
      .update({
        url: data.secure_url,
        public_id: data.public_id,
      })
      .eq("name", fileName);

    if (error) logError("Supabase 更新错误", error);
  } else {
    const { error } = await supabase.from("cloud_images").insert({
      name: fileName,
      url: data.secure_url,
      public_id: data.public_id,
      category: "cloud",
    });

    if (error) logError("Supabase 插入错误", error);
  }

  logDebug("已保存到 Supabase");
  return data.secure_url;
}

// Hanzi/English upload
export interface HanziStyleConfig {
  gridType: "tian" | "mi" | "plain";
  fontSize: number;
  color: string;
  bgColor: string;
  fontFamily: string;
}

export async function uploadHanziToCloudinary(
  dataUrl: string,
  char: string,
  styleConfig: HanziStyleConfig,
): Promise<string> {
  const timestamp = Date.now();
  const styleTag = `${styleConfig.gridType}_${styleConfig.fontSize}`;
  const publicId = `hanzi_${char}_${styleTag}_${timestamp}`;
  const file = dataUrlToFile(dataUrl, publicId);

  // Detect English vs Hanzi
  const isEnglish = /^[a-zA-Z]+$/.test(char);
  const category = isEnglish ? "英文" : "汉字";

  const { data: existing } = await supabase
    .from("cloud_images")
    .select("url, public_id")
    .eq("name", char)
    .eq("category", category)
    .maybeSingle();

  if (existing) {
    const isAccessible = await checkImageAccessible(existing.url);
    if (isAccessible) {
      logDebug(`${category}图片已存在，直接复用`, existing.url);
      return existing.url;
    }
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "literacy-cards/hanzi");
  formData.append("public_id", publicId);
  formData.append(
    "tags",
    `${isEnglish ? "english" : "hanzi"},${styleConfig.gridType},literacy`,
  );

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    logError("Cloudinary 上传失败", error);
    logDebug("尝试降级到 GitHub 存储...");
    try {
      return await uploadImageToGitHub(file);
    } catch (githubError) {
      throw new Error(
        `上传失败 (Cloudinary: ${error.error?.message || "未知"}, GitHub: ${githubError})`,
      );
    }
  }

  const data = await res.json();
  logDebug("上传成功", data.secure_url);

  const { error } = await supabase.from("cloud_images").insert({
    name: char,
    url: data.secure_url,
    public_id: data.public_id,
    category: category,
    metadata: {
      gridType: styleConfig.gridType,
      fontSize: styleConfig.fontSize,
      color: styleConfig.color,
      bgColor: styleConfig.bgColor,
      fontFamily: styleConfig.fontFamily,
    },
  });

  if (error) {
    logError("Supabase 插入错误", error);
  }

  return data.secure_url;
}

// Get images
export async function getCloudinaryImages() {
  logDebug("开始获取云端图片列表");

  try {
    const { data, error } = await supabase
      .from("cloud_images")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logError("获取云端图片数据库错误", error);
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    const filtered = filterOutSamples(data || []);

    if ((data || []).length !== filtered.length) {
      logDebug(`过滤了 ${(data || []).length - filtered.length} 张示例图片`);
    }

    logDebug(`获取到 ${filtered.length} 张云端图片`);
    return filtered;
  } catch (e) {
    logError("获取云端图片异常", e);
    throw e;
  }
}

export async function getHanziImages() {
  logDebug("开始获取汉字图片列表");

  try {
    const { data, error } = await supabase
      .from("cloud_images")
      .select("*")
      .eq("category", "汉字")
      .order("created_at", { ascending: false });

    if (error) {
      logError("获取汉字图片数据库错误", error);
      throw new Error(`数据库查询失败: ${error.message}`);
    }

    logDebug(`获取到 ${(data || []).length} 张汉字图片`);
    return data || [];
  } catch (e) {
    logError("获取汉字图片异常", e);
    throw e;
  }
}

// Rebuild index
export interface RebuildResult {
  scanned: number;
  cloudUrls: number;
  added: number;
  skipped: number;
  errors: string[];
}

export async function rebuildCloudIndexFromLocal(
  localImages: { src: string; name: string; category?: string }[],
): Promise<RebuildResult> {
  const result: RebuildResult = {
    scanned: localImages.length,
    cloudUrls: 0,
    added: 0,
    skipped: 0,
    errors: [],
  };

  for (const img of localImages) {
    if (!img.src || !img.src.includes("res.cloudinary.com")) continue;
    result.cloudUrls++;

    let publicId: string | null = null;
    try {
      const url = new URL(img.src);
      const pathParts = url.pathname.split("/");
      const uploadIndex = pathParts.indexOf("upload");
      if (uploadIndex !== -1 && uploadIndex + 1 < pathParts.length) {
        let startIdx = uploadIndex + 1;
        if (pathParts[startIdx]?.startsWith("v")) {
          startIdx++;
        }
        const filePart = pathParts.slice(startIdx).join("/");
        publicId = filePart.replace(/\.[^/.]+$/, "");
      }
    } catch {
      result.errors.push(`URL 解析失败: ${img.name}`);
      continue;
    }

    if (!publicId) {
      result.errors.push(`无法提取 public_id: ${img.name}`);
      continue;
    }

    const { data: existing } = await supabase
      .from("cloud_images")
      .select("id")
      .eq("public_id", publicId)
      .maybeSingle();

    if (existing) {
      result.skipped++;
      continue;
    }

    const { error } = await supabase.from("cloud_images").insert({
      name: img.name,
      url: img.src,
      public_id: publicId,
      category:
        img.category && img.category !== "本地" ? img.category : "cloud",
    });

    if (error) {
      result.errors.push(`${img.name}: ${error.message}`);
    } else {
      result.added++;
      logDebug("补录云端索引", { name: img.name, publicId });
    }
  }

  logDebug(`索引重建完成`, result);
  return result;
}

// Count
export interface CloudCountResult {
  count: number;
  error?: string;
}

export async function getCloudinaryImageCount(): Promise<CloudCountResult> {
  logDebug("开始查询云端图片数量");

  try {
    if (!supabase) {
      throw new Error("Supabase 客户端未初始化");
    }

    const { data, error } = await supabase
      .from("cloud_images")
      .select("public_id");

    if (error) {
      logError("查询数量时数据库错误", error);
      return {
        count: 0,
        error: `数据库错误: ${error.message} (code: ${error.code})`,
      };
    }

    const filtered = filterOutSamples(data || []);
    logDebug(`查询成功，共 ${filtered.length} 张有效图片`);
    return { count: filtered.length };
  } catch (e) {
    logError("查询数量时异常", e);
    const errorMsg = e instanceof Error ? e.message : "未知异常";

    if (
      errorMsg.includes("Failed to fetch") ||
      errorMsg.includes("NetworkError")
    ) {
      return { count: 0, error: "网络连接失败，请检查网络" };
    }
    if (
      errorMsg.includes("JWT") ||
      errorMsg.includes("token") ||
      errorMsg.includes("Unauthorized")
    ) {
      return { count: 0, error: "Supabase 密钥错误，请检查 ANON KEY" };
    }
    if (errorMsg.includes("relation") && errorMsg.includes("does not exist")) {
      return { count: 0, error: "数据库表不存在，请检查 cloud_images 表" };
    }

    return { count: 0, error: errorMsg };
  }
}

// Delete
export async function deleteCloudImage(public_id: string): Promise<boolean> {
  if (isCloudinarySample(public_id)) {
    logDebug("无法删除示例图片", public_id);
    throw new Error("Cloudinary 示例图片无法删除");
  }

  logDebug("删除云端图片", public_id);

  try {
    const backendRes = await fetch(NETLIFY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_id }),
    });

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({}));
      logError("删除 Cloudinary 图片失败", errorData);
    } else {
      logDebug("Cloudinary 图片删除成功");
    }
  } catch (e) {
    logError("调用后端删除 API 失败", e);
  }

  const { error } = await supabase
    .from("cloud_images")
    .delete()
    .eq("public_id", public_id);

  if (error) {
    logError("删除 Supabase 记录失败", error);
    throw new Error(error.message);
  }

  logDebug("删除成功 - Supabase 记录已移除");
  return true;
}

export async function clearAllCloudImages(): Promise<number> {
  logDebug("清空所有云端图片");

  const { data, error: fetchError } = await supabase
    .from("cloud_images")
    .select("public_id");

  if (fetchError) {
    logError("获取图片列表失败", fetchError);
    throw new Error(fetchError.message);
  }

  const myImages = filterOutSamples(data || []);
  const sampleCount = (data || []).length - myImages.length;

  if (myImages.length === 0) {
    logDebug("没有可删除的图片");
    return 0;
  }

  let deletedCount = 0;
  for (const img of myImages) {
    try {
      await deleteCloudImage(img.public_id);
      deletedCount++;
    } catch (e) {
      logError("删除失败", { public_id: img.public_id, error: e });
    }
  }

  logDebug(`已删除 ${deletedCount} 张，跳过 ${sampleCount} 张示例图`);
  return deletedCount;
}

// Clean invalid
export interface CleanResult {
  total: number;
  checked: number;
  invalid: number;
  deleted: number;
  errors: string[];
}

export async function cleanInvalidCloudImages(): Promise<CleanResult> {
  logDebug("开始清理无效云端图片...");

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
    logError("获取云端图片失败", error);
    throw new Error(error.message);
  }

  if (!images || images.length === 0) {
    logDebug("云端没有图片记录");
    return result;
  }

  result.total = images.length;
  logDebug(`云端共有 ${images.length} 条记录`);

  // Clean sample images
  const sampleImages = images.filter((img) =>
    isCloudinarySample(img.public_id),
  );
  if (sampleImages.length > 0) {
    logDebug(`发现 ${sampleImages.length} 张示例图片记录`);

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
          logDebug("已清理示例图片记录", img.public_id);
        }
      } catch (e) {
        result.errors.push(`删除示例图异常 ${img.public_id}: ${e}`);
      }
    }
  }

  // Check user images - batch parallel
  const userImages = images.filter((img) => !isCloudinarySample(img.public_id));
  const invalidIds: number[] = [];

  const BATCH_CHECK_SIZE = 5;
  for (let i = 0; i < userImages.length; i += BATCH_CHECK_SIZE) {
    const batch = userImages.slice(i, i + BATCH_CHECK_SIZE);
    const results = await Promise.all(
      batch.map(async (img) => {
        const isAccessible = await checkImageAccessible(img.url);
        return { img, isAccessible };
      }),
    );

    for (const { img, isAccessible } of results) {
      result.checked++;
      if (!isAccessible) {
        invalidIds.push(img.id);
        result.invalid++;
        logDebug("发现无效图片", { name: img.name, url: img.url });
      }
    }
  }

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
        logDebug("删除 Cloudinary 图片失败（可能已不存在）", img.public_id);
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

  logDebug("清理完成", result);
  return result;
}

// DataURL to File
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

export async function uploadDataUrlToCloudinary(
  dataUrl: string,
  fileName: string,
): Promise<string> {
  const file = dataUrlToFile(dataUrl, fileName);
  return uploadImageToCloudinary(file);
}
