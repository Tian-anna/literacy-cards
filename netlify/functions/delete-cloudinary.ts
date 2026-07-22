// netlify/delete-cloudinary.ts
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/types";
import crypto from "crypto";

function generateSHA1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  // ========== 修复 1：CORS 头添加 Content-Type ==========
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // 处理预检请求 (OPTIONS)
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  // 只允许 POST 请求
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // ========== 修复 2：添加 JSON 解析错误处理 ==========
  let body: any;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { public_id } = body;

  if (!public_id) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing public_id" }),
    };
  }

  // ========== 修复 3：添加示例图片保护 ==========
  const lower = public_id.toLowerCase();
  if (
    lower === "sample" ||
    lower.startsWith("sample/") ||
    lower.startsWith("samples/") ||
    lower.startsWith("cld-sample")
  ) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: "Cannot delete Cloudinary sample images" }),
    };
  }

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Missing Cloudinary credentials" }),
    };
  }

  try {
    // 生成签名
    const timestamp = Math.round(Date.now() / 1000);
    const signatureString = `public_id=${public_id}&timestamp=${timestamp}${API_SECRET}`;
    const signature = generateSHA1(signatureString);

    // 调用 Cloudinary API 删除图片
    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id,
          signature,
          timestamp,
          api_key: API_KEY,
        }),
      },
    );

    const result = await cloudinaryRes.json();

    // ========== 修复 4：处理 "not found" 情况（图片可能已被删除）==========
    if (result.result === "ok" || result.result === "not found") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: "Image deleted",
          result,
          public_id,
        }),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: result,
          public_id,
        }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: String(error),
        public_id,
      }),
    };
  }
};

export { handler };
