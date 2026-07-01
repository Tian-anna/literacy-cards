const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "literacy-cards";

// 调试
console.log("☁️ Cloudinary 配置:");
console.log("  Cloud Name:", CLOUD_NAME || "未设置");

// 上传图片到 Cloudinary
export async function uploadImageToCloudinary(file: File): Promise<string> {
  console.log("🚀 上传到 Cloudinary:", file.name);

  if (!CLOUD_NAME) {
    throw new Error(
      "Cloudinary Cloud Name 未设置，请在环境变量中配置 VITE_CLOUDINARY_CLOUD_NAME",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "literacy-cards");

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    console.error("Cloudinary 错误:", error);
    throw new Error(error.error?.message || `上传失败 (${res.status})`);
  }

  const data = await res.json();
  console.log("✅ 上传成功:", data.secure_url);
  return data.secure_url;
}

// 从 Cloudinary URL 提取 public_id（用于删除）
export function getPublicIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
