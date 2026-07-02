import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import crypto from "crypto";

function generateSHA1(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex");
}

const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
) => {
  // 只允许 POST 请求
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const { public_id } = JSON.parse(event.body || "{}");

  if (!public_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing public_id" }),
    };
  }

  const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
  const API_KEY = process.env.CLOUDINARY_API_KEY;
  const API_SECRET = process.env.CLOUDINARY_API_SECRET;

  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return {
      statusCode: 500,
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

    if (result.result === "ok") {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, message: "Image deleted" }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: result }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: String(error) }),
    };
  }
};

export { handler };
