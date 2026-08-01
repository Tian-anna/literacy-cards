// netlify/delete-cloudinary.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export const handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
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

  // 检查示例图片
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

  try {
    // 使用 Cloudinary SDK 删除，SDK 自动处理签名
    const result = await cloudinary.uploader.destroy(public_id, {
      invalidate: true,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result,
        public_id,
      }),
    };
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
