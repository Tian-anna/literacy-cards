// src/utils/supabase.ts（或你的路径）

import { createClient } from "@supabase/supabase-js";

// ============================================
// ❌ 错误：sb_publishable_ 不能用于数据库查询
// const SUPABASE_KEY = "sb_publishable_xS9XVNVcTJGxJIsYeydXwQ_IvEmsIZd";
// ============================================

// ✅ 正确：使用 anon key（JWT 格式，以 eyJ 开头）
const SUPABASE_URL = "https://gkctlseoxnutwfcbckxx.supabase.co";

// 从环境变量读取，如果没有则使用空字符串（避免构建错误）
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// 如果环境变量也没有，尝试使用你提供的 key（但注意：这个 key 格式不对，需要去 Supabase 控制台获取正确的 anon key）
// const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIs..."

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  db: {
    schema: "public",
  },
});

// 检查初始化状态
if (!SUPABASE_ANON_KEY) {
  console.error(
    "❌ Supabase ANON KEY 未配置！请在 .env 文件中设置 VITE_SUPABASE_ANON_KEY",
  );
} else if (!SUPABASE_ANON_KEY.startsWith("eyJ")) {
  console.warn("⚠️ Supabase KEY 格式可能不正确，anon key 应该以 eyJ 开头");
}

// 导出类型供其他文件使用
export type { SupabaseClient } from "@supabase/supabase-js";
