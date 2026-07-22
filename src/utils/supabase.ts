import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gkctlseoxnutwfcbckxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_xS9XVNVcTJGxJIsYeydXwQ_IvEmsIZd";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 导出类型供其他文件使用
export type { SupabaseClient } from "@supabase/supabase-js";
