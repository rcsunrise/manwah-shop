// services/routerHubService.ts

import { supabase } from "../lib/supabase";

// 1. 定义请求参数的类型
export interface GenerateImageRequest {
  prompt: string;
  model?: string; // 例如: "gemini-3.1-flash-image"
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | string;
  resolution?: string;
  seed?: number;
  images?: { mimeType: string; data: string }[];
}

// 2. 核心调用函数 (现在通过我们自己的后端代理)
export const generateImageFromRouterHub = async ({
  prompt,
  model = "gemini-3.1-flash-image",
  aspectRatio = "1:1",
  resolution = "1K",
  seed,
  images = [],
}: GenerateImageRequest): Promise<string> => {
  // 构造我们后端的 API URL (RouterHub Path)
  const url = `/api/gateway/generate-image`;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token || localStorage.getItem('token') || '';
    const userId = sessionData?.session?.user?.id || 'system';

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": userId,
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // 最多支持 3 张参考图片上传与融合
    const safeImages = images.slice(0, 3);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt, model, aspectRatio, resolution, seed, images: safeImages }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text.trim());
    } catch (e) {
      data = {};
    }

    if (!response.ok || data.error) {
      const errMsg = data.message || (typeof data.error === 'string' ? data.error : data.error?.message) || response.statusText || 'API 请求失败';
      throw new Error(errMsg);
    }

    // 3. 解析返回结果 - 增强多格式支持 (Gemini, OpenAI DALL-E, Replicate, Custom Proxy)
    let rootData = data;
    if (Array.isArray(data)) {
      rootData = data[0] || {};
    }

    // A. 标准 Gemini inlineData
    const part = rootData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    if (part?.inlineData && part.inlineData.data) {
      const base64String = part.inlineData.data;
      const mimeType = part.inlineData.mimeType || "image/png";
      if (base64String.startsWith("data:image/")) return base64String;
      return `data:${mimeType};base64,${base64String}`;
    }

    // B. OpenAI / VectorEngine b64_json 格式
    const openAiItem = rootData.data?.[0];
    if (openAiItem) {
      if (openAiItem.b64_json) {
        const b64 = openAiItem.b64_json;
        if (b64.startsWith("data:image/")) return b64;
        return `data:image/png;base64,${b64}`;
      }
      if (openAiItem.url) {
        return openAiItem.url;
      }
    }

    // C. 检查多种直接字段和数组字段 (images, output, result, url, image_url, image, base64, b64_json)
    const tryExtractUrlOrB64 = (val: any): string | null => {
      if (!val) return null;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:image/")) {
          return trimmed;
        }
        if (trimmed.length > 200 && !trimmed.includes(" ")) {
          return `data:image/png;base64,${trimmed}`;
        }
      }
      if (Array.isArray(val) && val.length > 0) {
        return tryExtractUrlOrB64(val[0]);
      }
      if (typeof val === 'object') {
        return tryExtractUrlOrB64(val.url || val.image_url || val.image || val.b64_json || val.base64 || val.output || val.result);
      }
      return null;
    };

    const directFound = tryExtractUrlOrB64(rootData.url || rootData.image_url || rootData.images || rootData.output || rootData.result || rootData.image || rootData.base64 || rootData.b64_json || rootData);
    if (directFound) {
      return directFound;
    }

    // D. 检查返回的文本是否为 Base64 或 URL，或者提供清晰的模型文字说明
    const textPart = rootData.candidates?.[0]?.content?.parts?.find((p: any) => p.text);
    if (textPart?.text) {
      const trimmed = textPart.text.trim();
      const extractedFromText = tryExtractUrlOrB64(trimmed);
      if (extractedFromText) return extractedFromText;
      throw new Error(`模型返回了文字说明而非图片: ${trimmed}`);
    }

    console.error("API response missing image data:", JSON.stringify(data));
    const finalErr = rootData.error?.message || rootData.message || "API 未返回有效的图像数据，请检查所选模型当前频道状态。";
    throw new Error(finalErr);
  } catch (error) {
    console.error("调用代理服务失败:", error);
    throw error;
  }
};
