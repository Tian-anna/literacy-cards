import { supabase } from "./supabase";

const CLOUD_NAME = "kqcvg4iw";
const UPLOAD_PRESET = "literacy-cards";

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || `Upload failed (${res.status})`);
  }

  const data = await res.json();

  const { error } = await supabase.from("cloud_images").insert({
    name: file.name.replace(/\.[^/.]+$/, ""),
    url: data.secure_url,
    public_id: data.public_id,
    category: "cloud",
  });

  if (error) {
    console.error("Supabase insert error:", error);
  }

  return data.secure_url;
}

export async function getCloudinaryImages() {
  const { data, error } = await supabase
    .from("cloud_images")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get cloud images error:", error);
    return [];
  }

  return data || [];
}

export async function getCloudinaryImageCount() {
  const { count, error } = await supabase
    .from("cloud_images")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Get cloud count error:", error);
    return 0;
  }

  return count || 0;
}

// 删除云端图片
export async function deleteCloudImage(public_id: string): Promise<boolean> {
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

// 清空所有云端图片
export async function clearAllCloudImages(): Promise<boolean> {
  console.log("Clearing all cloud images");

  const { error } = await supabase.from("cloud_images").delete().neq("id", 0); // 删除所有记录

  if (error) {
    console.error("Clear error:", error);
    throw new Error(error.message);
  }

  return true;
}
