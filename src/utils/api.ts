const API_BASE = "https://literacy-cards-api.tian-anna.workers.dev";

export async function getCloudImages() {
  const res = await fetch(`${API_BASE}/api/images`);
  if (!res.ok) throw new Error("获取失败");
  return res.json();
}

export async function getCloudImageCount(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/images/count`);
  if (!res.ok) throw new Error("获取失败");
  const data = await res.json();
  return data.count || 0;
}

export async function addCloudImage(image: {
  name: string;
  url: string;
  public_id: string;
  category?: string;
}) {
  const res = await fetch(`${API_BASE}/api/images`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(image),
  });
  if (!res.ok) throw new Error("添加失败");
  return res.json();
}
