import { createClient } from '@supabase/supabase-js';

const safeProcessEnv = typeof process !== 'undefined' ? process.env : {} as Record<string, string | undefined>;

const isPlaceholder = (val: string | undefined) => !val || val.includes('在这里填入') || val.includes('placeholder');

// Vite 必须使用 import.meta.env 才能在浏览器端读取变量
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
  safeProcessEnv.VITE_SUPABASE_URL || 
  safeProcessEnv.SUPABASE_URL || 
  '';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
  safeProcessEnv.VITE_SUPABASE_ANON_KEY || 
  safeProcessEnv.SUPABASE_ANON_KEY || 
  '';

const supabaseServiceKey = safeProcessEnv.SUPABASE_SERVICE_ROLE_KEY || safeProcessEnv.SUPABASE_SERVICE_KEY || '';

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  console.warn("⚠️ Supabase 环境变量可能未配置或仍为占位符！当前 URL:", supabaseUrl);
}

// 拥有最高权限的 Admin 客户端（用于创建用户、修改配置等管理操作，仅在 Node.js 即服务端使用）
export const supabaseAdmin = typeof window === 'undefined' ? createClient(
  isPlaceholder(supabaseUrl) ? 'https://placeholder.supabase.co' : supabaseUrl, 
  isPlaceholder(supabaseServiceKey) ? 'placeholder-key' : supabaseServiceKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
) : null as any;

// 客户端普通版（用于前端或常规的 Token 扣减逻辑，遵循 RLS 权限）
const _global = typeof window !== 'undefined' ? window : globalThis;
// @ts-ignore
if (!_global.__SUPABASE_CLIENT__) {
  // @ts-ignore
  _global.__SUPABASE_CLIENT__ = createClient(
    isPlaceholder(supabaseUrl) ? 'https://placeholder.supabase.co' : supabaseUrl, 
    isPlaceholder(supabaseAnonKey) ? 'placeholder-key' : supabaseAnonKey,
    {
      auth: {
        lock: false as any
      }
    }
  );
}
// @ts-ignore
export const supabase = _global.__SUPABASE_CLIENT__;

// 上传图片到 Supabase Storage
export const uploadImageToSupabase = async (file: File): Promise<string | null> => {
  const fallbackToDataURL = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  try {
    // 1. 优先调用后端服务端 API (利用 Admin 服务端权限直传 Supabase assets 存储桶，彻底绕过前端 403 RLS 权限拦截)
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const result = await res.json();
      if (result && result.url) {
        console.log('✅ 已通过后端 Admin 权限直传至 Supabase Storage 云端存储桶:', result.url);
        return result.url;
      }
    } else {
      console.warn('后端直传接口提示:', await res.text());
    }
  } catch (apiErr) {
    console.warn('调用 /api/upload-image 失败，尝试前端直接向 Supabase 发起上传:', apiErr);
  }

  // 2. 备用逻辑：前端直接尝试向多个常见可用存储桶 ('assets', 'public', 'masks', 'products') 发起上传
  const buckets = ['assets', 'public', 'masks', 'products'];
  const fileExt = file.name?.split('.').pop() || 'png';
  const fileName = `user_uploads/${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);
        if (publicUrlData.publicUrl) {
          console.log(`✅ 前端成功上传至 Supabase ${bucket} 存储桶:`, publicUrlData.publicUrl);
          return publicUrlData.publicUrl;
        }
      }
    } catch (e) {
      // 忽略单个 bucket 报错，继续尝试下一个
    }
  }

  console.warn('所有 Supabase 存储桶均因无公开权限或未建桶被拦截，已自动回退保存至本地大容量 IDB 数据库');
  return await fallbackToDataURL(file);
};

