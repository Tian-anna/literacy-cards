const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY;
const UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "literacy-cards";

// 调试
console.log("☁️ Cloudinary 配置:");
console.log("  Cloud Name:", CLOUD_NAME || "未设置");
console.log("  API Key:", API_KEY ? "已设置" : "未设置");

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
  formData.append("tags", "literacy-cards");

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

// 获取 Cloudinary 图片列表
export async function getCloudinaryImages(): Promise<
  Array<{ name: string; url: string }>
> {
  if (!CLOUD_NAME) {
    throw new Error("Cloudinary Cloud Name 未设置");
  }

  // 使用 Cloudinary 客户端资源列表 API（不需要签名）
  const url = `https://res.cloudinary.com/${CLOUD_NAME}/image/list/literacy-cards.json`;

  console.log("📋 获取云端图片列表...");

  try {
    const res = await fetch(url);

    if (!res.ok) {
      // 如果 tag 列表不存在，返回空数组
      if (res.status === 404) {
        console.log("  暂无云端图片");
        return [];
      }
      throw new Error(`获取失败 (${res.status})`);
    }

    const data = await res.json();

    const images = data.resources.map((resource: any) => ({
      name: resource.public_id.split("/").pop() || resource.public_id,
      url: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${resource.public_id}`,
    }));

    console.log("  获取成功:", images.length, "张");
    return images;
  } catch (error) {
    console.error("  获取失败:", error);
    return [];
  }
}

// 获取云端图片数量
export async function getCloudinaryImageCount(): Promise<number> {
  const images = await getCloudinaryImages();
  return images.length;
}
