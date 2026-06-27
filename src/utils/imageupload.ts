const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const REPO = import.meta.env.VITE_GITHUB_REPO || "Tian-anna/literacy-cards";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 获取文件 SHA（删除时需要）
async function getFileSha(path: string): Promise<string> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${TOKEN}`,
    },
  });

  if (!res.ok) throw new Error("获取文件信息失败");

  const data = await res.json();
  return data.sha;
}

export async function uploadImageToGitHub(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  const content = base64.split(",")[1];

  const path = `images/${Date.now()}_${file.name}`;
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "添加图片",
      content: content,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "上传失败");
  }

  const data = await res.json();
  return data.content.download_url;
}

// 删除 GitHub 上的文件
export async function deleteImageFromGitHub(fileName: string): Promise<void> {
  const path = `images/${fileName}`;

  try {
    const sha = await getFileSha(path);

    const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "删除重复图片",
        sha: sha,
      }),
    });

    if (!res.ok) throw new Error("删除失败");
    console.log("已删除:", fileName);
  } catch (error) {
    console.error("删除失败:", error);
    throw error;
  }
}
