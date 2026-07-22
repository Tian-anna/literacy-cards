import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gkctlseoxnutwfcbckxx.supabase.co";

// ============================================
// 生产环境（GitHub Pages）必须用硬编码，因为 import.meta.env 在构建后不存在
// 开发环境可以用 .env，但这里统一用硬编码避免部署问题
// ============================================
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_xS9XVNVcTJGxJIsYeydXwQ_IvEmsIZd";

// 容错：即使 key 有问题也不让页面崩溃
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY || "dummy-key-for-build",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "dummy-key-for-build") {
  console.warn("⚠️ Supabase ANON KEY 未配置，云端功能将不可用");
}

export type { SupabaseClient } from "@supabase/supabase-js";
