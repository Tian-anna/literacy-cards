import { addCloudImage, getCloudImages, getCloudImageCount } from "./api";

const CLOUD_NAME = "kqvg4iw";
const UPLOAD_PRESET = "literacy-cards";

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const res = await fetch(url, { method: "POST", body: formData });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || `上传失败 (${res.status})`);
  }

  const data = await res.json();

  // 同步到 Cloudflare D1
  await addCloudImage({
    name: file.name.replace(/\.[^/.]+$/, ""),
    url: data.secure_url,
    public_id: data.public_id,
    category: "云端",
  });

  return data.secure_url;
}

export async function getCloudinaryImages() {
  return getCloudImages();
}

export async function getCloudinaryImageCount() {
  return getCloudImageCount();
}
