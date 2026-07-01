import { supabase } from "./supabase";

const CLOUD_NAME = "kqvg4iw";
const UPLOAD_PRESET = "literacy-cards";

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || `上传失败 (${res.status})`);
  }

  const data = await res.json();

  // 保存到 Supabase
  const { error } = await supabase.from("cloud_images").insert({
    name: file.name.replace(/\.[^/.]+$/, ""),
    url: data.secure_url,
    public_id: data.public_id,
    category: "云端",
  });

  if (error) {
    console.error("Supabase 插入失败:", error);
  }

  return data.secure_url;
}

export async function getCloudinaryImages() {
  const { data, error } = await supabase
    .from("cloud_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("获取云端图片失败:", error);
    return [];
  }

  return data || [];
}

export async function getCloudinaryImageCount() {
  const { count, error } = await supabase
    .from("cloud_images")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("获取云端数量失败:", error);
    return 0;
  }

  return count || 0;
}
