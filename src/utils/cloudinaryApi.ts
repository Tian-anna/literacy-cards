import { supabase } from "./supabase";

const CLOUD_NAME = "kqcvg4iw";
const UPLOAD_PRESET = "literacy-cards";

console.log("Cloudinary config:");
console.log("  Cloud Name:", CLOUD_NAME);
console.log("  Upload Preset:", UPLOAD_PRESET);

// ========== Cloudinary 示例图片过滤 ==========

/** 判断是否是 Cloudinary 的示例图片（无法删除） */
export function isCloudinarySample(publicId: string): boolean {
  if (!publicId) return false;
  const lower = publicId.toLowerCase();
  return (
    lower === "sample" ||
    lower.startsWith("sample/") ||
    lower.startsWith("samples/") ||
    lower.startsWith("cld-sample") ||
    lower.includes("/sample") ||
    lower.includes("/samples")
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

// ========== 上传 ==========

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const fileName = file.name.replace(/\.[^/.]+$/, "");
  console.log("Uploading:", fileName);

  // 检查是否已存在
  const existing = await checkImageExists(fileName);
  if (existing) {
    console.log("Image already exists:", fileName);
    return existing.url;
  }

  // 上传到 Cloudinary，指定 folder 参数隔离
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "literacy-cards"); // ← 放到指定文件夹

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

  // 保存到 Supabase
  const { error } = await supabase.from("cloud_images").insert({
    name: fileName,
    url: data.secure_url,
    public_id: data.public_id,
    category: "cloud",
    folder: "literacy-cards",
  });

  if (error) {
    console.error("Supabase insert error:", error);
  } else {
    console.log("Saved to Supabase");
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

  // 过滤掉 Cloudinary 示例图片
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

  // 只计算非示例图片
  const filtered = filterOutSamples(data || []);
  return filtered.length;
}

// ========== 删除 ==========

// 删除单张云端图片
export async function deleteCloudImage(public_id: string): Promise<boolean> {
  // 阻止删除 Cloudinary 示例图片
  if (isCloudinarySample(public_id)) {
    console.warn("无法删除 Cloudinary 示例图片:", public_id);
    throw new Error("Cloudinary 示例图片无法删除");
  }

  console.log("Deleting cloud image:", public_id);

  const { error } = await supabase
    .from("cloud_images")
    .delete()
    .eq("public_id", public_id);

  if (error) {
    console.error("Delete error:", error);
    throw new Error(error.message);
  }

  console.log("Delete success");
  return true;
}

// 清空所有云端图片（只删除自己的图片）
export async function clearAllCloudImages(): Promise<number> {
  console.log("Clearing all cloud images");

  // 先获取所有非示例图片
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

  // 批量删除自己的图片
  const publicIds = myImages.map((img) => img.public_id);
  const { error } = await supabase
    .from("cloud_images")
    .delete()
    .in("public_id", publicIds);

  if (error) {
    console.error("Clear error:", error);
    throw new Error(error.message);
  }

  console.log(
    `已删除 ${myImages.length} 张图片，跳过了 ${sampleCount} 张示例图`,
  );
  return myImages.length;
}

// ========== 清理无效图片 ==========

export interface CleanResult {
  total: number; // Supabase 中总记录数
  checked: number; // 实际检查了多少张
  invalid: number; // 发现多少张无效
  deleted: number; // 成功删除多少条记录
  errors: string[]; // 错误信息
}

/**
 * 清理无效图片
 * 1. 先清理 Cloudinary 示例图片的记录（这些不是用户上传的）
 * 2. 检查剩余图片 URL 是否可访问
 * 3. 删除不可访问的记录
 */
export async function cleanInvalidCloudImages(): Promise<CleanResult> {
  console.log("开始清理无效云端图片...");

  const result: CleanResult = {
    total: 0,
    checked: 0,
    invalid: 0,
    deleted: 0,
    errors: [],
  };

  // 1. 获取所有云端图片记录
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

  // 2. 先清理 Cloudinary 示例图片的记录
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

  // 3. 检查用户上传图片的可访问性
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

  // 4. 删除无效记录
  for (const id of invalidIds) {
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
