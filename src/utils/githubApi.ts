const TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const REPO = import.meta.env.VITE_GITHUB_REPO || "Tian-anna/literacy-cards";

// 调试：检查环境变量
console.log("🔧 GitHub API 配置:");
console.log("  TOKEN 存在:", !!TOKEN);
console.log("  TOKEN 长度:", TOKEN ? TOKEN.length : 0);
console.log("  REPO:", REPO);

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

// 检查文件是否已存在
async function checkFileExists(path: string): Promise<boolean> {
  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${TOKEN}`,
    },
  });
  return res.status === 200;
}

export async function uploadImageToGitHub(file: File): Promise<string> {
  console.log("🚀 uploadImageToGitHub 开始");
  console.log("  文件名:", file.name);
  console.log("  TOKEN:", TOKEN ? "已设置" : "未设置");

  if (!TOKEN) {
    throw new Error(
      "GitHub Token 未设置，请在 GitHub Actions secrets 中配置 UPLOAD_TOKEN",
    );
  }

  const base64 = await fileToBase64(file);
  const content = base64.split(",")[1];

  // 使用时间戳前缀避免重复
  const fileName = `${Date.now()}_${file.name}`;
  const path = `images/${fileName}`;

  console.log("  上传路径:", path);

  // 检查是否已存在（防止重复上传）
  const exists = await checkFileExists(path);
  if (exists) {
    console.log("  ⚠️ 文件已存在，跳过上传");
    return `https://raw.githubusercontent.com/${REPO}/main/${path}`;
  }

  const url = `https://api.github.com/repos/${REPO}/contents/${path}`;

  console.log("  发送 PUT 请求...");

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "添加图片: " + file.name,
      content: content,
    }),
  });

  console.log("  响应状态:", res.status);

  if (!res.ok) {
    const error = await res.json();
    console.error("  错误详情:", error);
    throw new Error(error.message || `上传失败 (${res.status})`);
  }

  const data = await res.json();
  console.log("  上传成功:", data.content.download_url);
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
        message: "删除图片",
        sha: sha,
      }),
    });

    if (!res.ok) throw new Error("删除失败");
    console.log("已删除 GitHub 文件:", fileName);
  } catch (error) {
    console.error("删除 GitHub 文件失败:", error);
    throw error;
  }
}
