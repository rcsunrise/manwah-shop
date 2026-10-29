import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs';
import { supabaseAdmin, supabase } from './src/lib/supabase';
import {
  MODEL_REGISTRY,
  findModel,
  resolveProtocol,
  getUpstreamModelName,
  TransportProtocol
} from './server/ai/modelRegistry';

function fileLog(msg: string) {
  try { fs.appendFileSync('debug.log', msg + '\n'); } catch (e) {}
  console.log(msg);
}

// 针对 GPT 局部重绘 (Mask) 的 Sharp 自动归一化管道
// 规则：
// 1. image 与 mask 必须长宽完全一致（1:1 像素级尺寸对齐），格式须为带 Alpha 通道的 image/png
// 2. Alpha 通道语义：
//    A = 0（完全透明像素）：标记为重绘区 / 替换区（由 AI 重新填充）
//    A = 255（不透明像素）：标记为保护区 / 原样保留区（保留产品原貌）
// 3. 上传黑白灰度图会自动将低亮度背景反转为 Alpha=0 透明像素，确保 100% 规避 Invalid value for 'mask' 错误
async function normalizeImageAndMaskWithSharp(
  imageBuffer: Buffer,
  maskBuffer: Buffer
): Promise<{ normalizedImage: Buffer; normalizedMask: Buffer; width: number; height: number }> {
  const imgMeta = await sharp(imageBuffer).metadata();
  let width = imgMeta.width || 1024;
  let height = imgMeta.height || 1024;

  // 避免单边超大导致请求超限
  if (width > 2048 || height > 2048) {
    const resizedImg = await sharp(imageBuffer)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer({ resolveWithObject: true });
    width = resizedImg.info.width;
    height = resizedImg.info.height;
  }

  // 1. 规范化底图为 PNG
  const normalizedImage = await sharp(imageBuffer)
    .resize(width, height, { fit: 'fill' })
    .png()
    .toBuffer();

  // 2. 规范化蒙版为与底图严格 1:1 对齐且具备 Alpha 通道的 PNG
  const { data, info } = await sharp(maskBuffer)
    .resize(width, height, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 检测蒙版原本是否已具备 Alpha 透明通道
  let hasTransparentPixels = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) {
      hasTransparentPixels = true;
      break;
    }
  }

  for (let i = 0; i < data.length; i += 4) {
    if (hasTransparentPixels) {
      // 已有透明度：保留透明区域为重绘区(A=0)，不透明为保护区(A=255)
      data[i + 3] = data[i + 3] < 128 ? 0 : 255;
    } else {
      // 黑白/灰度蒙版：暗色(低亮度)像素反转为 Alpha=0 (重绘区)，亮色为 Alpha=255 (保护区)
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i + 3] = lum < 128 ? 0 : 255;
    }
  }

  const normalizedMask = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  }).png().toBuffer();

  return { normalizedImage, normalizedMask, width, height };
}

// 映射 OpenAI 标准尺寸规格
function getOpenAISize(aspectRatio: string, resolution: string): string {
  const res = (resolution || '1K').toUpperCase();
  const ratio = aspectRatio || '1:1';

  if (res === '512PX' || res === '512') {
    return '512x512';
  }
  if (res === '2K') {
    if (ratio === '3:4') return '1536x2048';
    if (ratio === '4:3') return '2048x1536';
    if (ratio === '16:9') return '2560x1440';
    if (ratio === '9:16') return '1440x2560';
    return '2048x2048';
  }
  if (res === '4K') {
    if (ratio === '3:4') return '3072x4096';
    if (ratio === '4:3') return '4096x3072';
    if (ratio === '16:9') return '3840x2160';
    if (ratio === '9:16') return '2160x3840';
    return '4096x4096';
  }
  // 1K 默认
  if (ratio === '3:4') return '768x1024';
  if (ratio === '4:3') return '1024x768';
  if (ratio === '16:9') return '1792x1024';
  if (ratio === '9:16') return '1024x1792';
  return '1024x1024';
}

// 自动检测提供商
function detectProvider(url: string | undefined): 'tiantoken' | 'routerhub' | 'vectorengine' | 'google' {
  if (!url) return 'tiantoken';
  const lower = url.toLowerCase();
  if (lower.includes('tiantoken')) return 'tiantoken';
  if (lower.includes('routerhub')) return 'routerhub';
  if (lower.includes('vectorengine')) return 'vectorengine';
  if (lower.includes('googleapis')) return 'google';
  return 'tiantoken';
}

// 构建鉴权头部（TianToken 统一采用 Bearer Token 及 Google 原生 Key 双头部鉴权）
function buildAuthHeaders(provider: string, apiKey: string, contentType: string | null = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (provider === 'tiantoken') {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['x-goog-api-key'] = apiKey;
  } else if (provider === 'routerhub' || provider === 'vectorengine') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  } else {
    headers['x-goog-api-key'] = apiKey;
  }
  return headers;
}


const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';

const modelPrices: Record<string, { input: number, output: number, per_image?: number }> = {
  // 基于汇率: 1 USD = 10,000 点
  
  'gemini-3.1-pro-preview': { input: 12500, output: 50000 }, // $1.25/$5 -> 12,500/50,000 pts per 1M
  'gemini-3.1-flash-preview': { input: 1400, output: 1400 }, // $0.14 -> 1,400 pts per 1M
  'gemini-2.0-flash': { input: 1000, output: 4000 },
  'gemini-1.5-pro': { input: 12500, output: 50000 },
  'gemini-1.5-flash': { input: 1000, output: 4000 },
  
  // 纯文本/语言模型转换费率 (按每 1M Tokens 计价)
  'gemini-2.5-flash-1k': { input: 4000, output: 4000, per_image: 400 },
  'gemini-3.1-flash-2k': { input: 14000, output: 14000, per_image: 400 },
  'gemini-2.5-flash': { input: 4000, output: 4000, per_image: 400 },
  'gemini-3.1-flash': { input: 1400, output: 1400, per_image: 400 },
  
  // 生图基础点数消耗 (per_image): gemini-3.1-flash-image (含 mapped 的 2.5 flash)：400 点 / 张
  'gemini-3-pro-image': { input: 0, output: 0, per_image: 400 }, 
  'gemini-3.1-flash-image': { input: 0, output: 0, per_image: 400 },
  'gemini-2.5-flash-image': { input: 0, output: 0, per_image: 400 },
  'google/gemini-3-pro-image': { input: 0, output: 0, per_image: 400 },
};

// Map unknown or slightly different model names to known price keys
function getPriceData(model: string) {
  if (modelPrices[model]) return modelPrices[model];
  
  const lower = model.toLowerCase();
  if (lower.includes('pro')) return modelPrices['gemini-1.5-pro'];
  if (lower.includes('flash')) return modelPrices['gemini-1.5-flash'];
  
  return { input: 1000, output: 4000 }; // 默认 Flash 计费
}

// Resolution multipliers for image generation
// 1K = 400, 2K = 1400, 4K = 5000
const resolutionMultipliers: Record<string, number> = {
  '512px': 0.5, 
  '1K': 1.0,    // 400 * 1.0 = 400
  '2K': 3.5,    // 400 * 3.5 = 1400
  '4K': 12.5    // 400 * 12.5 = 5000
};

async function getUserApiConfig(userId: string) {
  if (!userId || userId === 'system') return null;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      dept_id,
      department_configs ( api_key, api_base_url, dept_name, routing_mode, method1_key )
    `)
    .eq('id', userId)
    .single();

  if (error || !data?.department_configs) return null;
  
  const department_configs = Array.isArray(data.department_configs) 
    ? data.department_configs[0] 
    : data.department_configs;

  return { ...data, department_configs };
}

// 基于 1 USD = 10,000 点的精细化计价函数
function getImagePoints(model: string, resolution: string): number {
  const modelKey = (model || '').toLowerCase();
  const res = (resolution || '1K').toUpperCase();

  // GPT 图像与重绘系列
  if (modelKey.includes('gpt-image') || modelKey.includes('openai')) {
    if (res === '512PX' || res === '512') return 800;
    if (res === '1K') return 1500;
    if (res === '2K') return 3000;
    if (res === '4K') return 6000;
    return 3000;
  }

  // Nano Banana 轻量预览模型
  if (modelKey.includes('nano') || modelKey.includes('banana')) {
    if (res === '1K') return 300;
    if (res === '2K') return 800;
    if (res === '4K') return 2500;
    return 300;
  }
  
  // Gemini 多模态原生图像 (1K = 400, 2K = 1400, 4K = 5000)
  const mult = resolutionMultipliers[resolution] || 1.0;
  return Math.round(400 * mult);
}

function isValidImageResponse(fetchResult: any): boolean {
  if (!fetchResult) return false;
  if (fetchResult.error) return false;
  if (fetchResult.candidates && fetchResult.candidates.length > 0) {
    const firstCandidate = fetchResult.candidates[0];
    const content = firstCandidate?.content;
    if (content && content.parts && content.parts.length > 0) {
      for (const part of content.parts) {
        if (part.inlineData && part.inlineData.data) {
          if (typeof part.inlineData.data === 'string' && part.inlineData.data.length > 100) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

async function normalizeImageResponse(data: any): Promise<any> {
  if (!data) {
    return { error: { message: "上游接口未返回任何数据" } };
  }

  if (data.error) {
    const msg = typeof data.error === 'string' ? data.error : data.error?.message || JSON.stringify(data.error);
    return { error: { message: msg } };
  }

  // 1. Standard Gemini candidates format
  if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0];
    const parts = candidate?.content?.parts;
    if (parts && Array.isArray(parts)) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data && part.inlineData.data.length > 100) {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: part.inlineData.mimeType || "image/jpeg",
                        data: part.inlineData.data
                      }
                    }
                  ]
                }
              }
            ]
          };
        }
        if (part.text) {
          const trimmedText = part.text.trim();
          if (trimmedText.startsWith("data:image/")) {
            const match = trimmedText.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (match) {
              return {
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          inlineData: {
                            mimeType: match[1],
                            data: match[2]
                          }
                        }
                      ]
                    }
                  }
                ]
              };
            }
          } else if (trimmedText.startsWith("http://") || trimmedText.startsWith("https://")) {
            try {
              const imgRes = await fetch(trimmedText);
              if (imgRes.ok) {
                const buffer = await imgRes.arrayBuffer();
                const b64 = Buffer.from(buffer).toString('base64');
                const contentType = imgRes.headers.get("content-type") || "image/png";
                return {
                  candidates: [
                    {
                      content: {
                        parts: [
                          {
                            inlineData: {
                              mimeType: contentType,
                              data: b64
                            }
                          }
                        ]
                      }
                    }
                  ]
                };
              }
            } catch (e) {}
          }
        }
      }
    }
  }

  // 2. OpenAI format data[0].b64_json or data[0].url
  if (data.data && Array.isArray(data.data) && data.data.length > 0) {
    const item = data.data[0];
    let b64 = item.b64_json;
    let mimeType = "image/png";

    if (!b64 && item.url) {
      try {
        const imgRes = await fetch(item.url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          b64 = Buffer.from(buffer).toString('base64');
          mimeType = imgRes.headers.get("content-type") || "image/png";
        }
      } catch (e) {}
    }

    if (b64 && b64.length > 100) {
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: b64
                  }
                }
              ]
            }
          }
        ]
      };
    }
  }

  // 3. Direct URL, base64 fields, or custom array structures (images, output, result)
  const extractUrlOrB64FromAny = async (val: any): Promise<{ mimeType: string, data: string } | null> => {
    if (!val) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith("data:image/")) {
        const match = trimmed.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
        if (match) {
          return { mimeType: match[1], data: match[2] };
        }
      }
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        try {
          const imgRes = await fetch(trimmed);
          if (imgRes.ok) {
            const buffer = await imgRes.arrayBuffer();
            const b64 = Buffer.from(buffer).toString('base64');
            const mimeType = imgRes.headers.get("content-type") || "image/png";
            return { mimeType, data: b64 };
          }
        } catch (e) {}
      }
      if (trimmed.length > 200 && !trimmed.includes(" ")) {
        const cleanB64 = trimmed.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
        return { mimeType: "image/png", data: cleanB64 };
      }
    }
    if (Array.isArray(val) && val.length > 0) {
      return await extractUrlOrB64FromAny(val[0]);
    }
    if (typeof val === 'object') {
      return await extractUrlOrB64FromAny(val.url || val.image_url || val.image || val.b64_json || val.base64 || val.output || val.result);
    }
    return null;
  };

  const extracted = await extractUrlOrB64FromAny(data.url || data.image_url || data.images || data.output || data.result || data.image || data.base64 || data.b64_json || (Array.isArray(data) ? data : null));
  if (extracted) {
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                inlineData: extracted
              }
            ]
          }
        }
      ]
    };
  }

  // 4. Text refusal or error message
  const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (candidateText) {
    return { error: { message: `上游模型未生成图片，返回文本说明: ${candidateText}` } };
  }

  if (data.message || data.msg) {
    return { error: { message: data.message || data.msg } };
  }

  return { error: { message: "生图失败：上游接口未成功返回有效的图像数据（可能由于敏感词拦截或接口过载）。" } };
}

async function chargeUser(userId: string, tokens: number, model: string, resolution: string | null, deptId: string | null, type: 'chat' | 'image_generation' = 'image_generation', inputTokens: number = 0, outputTokens: number = 0, providerMarker: string = '') {
  if (!userId || userId === 'system') return;
  
  let pointsToDeduct = 0;

  if (tokens === 0) {
    pointsToDeduct = 0;
  } else if (type === 'image_generation' && resolution) {
    pointsToDeduct = getImagePoints(model, resolution);
  } else {
    const priceData = getPriceData(model);
    // Chat billing: (Input * PricePer1M + Output * PricePer1M) / 1,000,000
    const inTokens = inputTokens || Math.round((tokens || 0) * 0.3);
    const outTokens = outputTokens || Math.round((tokens || 0) * 0.7);
    pointsToDeduct = Math.round((inTokens * priceData.input + outTokens * priceData.output) / 1000000);
    // 注意：此处 / 1,000,000 是因为 input/outputTokens 为实际数，而价格是每 1M tokens 的点数。
    // 价格已换算为点数（1 USD = 10,000 点），例如 $1.25 = 12,500 点。
    // 计算公式：(Token数 / 1,000,000) * 每百万Token点数
  }
  
  if (isNaN(pointsToDeduct)) pointsToDeduct = 0;

  try {
    // 1. 获取最新信息 (不再手动更新 quota_used，由数据库触发器维护)
    const { data: profile } = await supabaseAdmin.from('profiles').select('quota_used, dept_id').eq('id', userId).single();
    const finalDeptId = deptId || profile?.dept_id || null;
    
    // await supabaseAdmin.from('profiles').update({ quota_used: currentUsed + pointsToDeduct }).eq('id', userId);

    const now = new Date().toISOString();
    const modelResValue = resolution || (type === 'chat' ? 'Token' : 'Standard');
    let displayModel = model;

    if (providerMarker && providerMarker.includes('[生图未成功')) {
      // For failure logging, start exactly with '[生图未成功 - ...'
      displayModel = providerMarker.replace(/^- /, '');
    } else {
      const modelKey = model.toLowerCase();
      let modelPrefix = '';
      if (modelKey.includes('nano') || modelKey.includes('banana')) {
        modelPrefix = '[🍌Nano Banana·2.1] ';
      } else if (modelKey === 'gemini-3.1-flash-image') {
        modelPrefix = '[⚡新闪电·正式版] ';
      } else if (modelKey === 'gemini-3.1-flash-image-preview') {
        modelPrefix = '[⚡新闪电·预览版] ';
      } else if (modelKey === 'gemini-3-pro-image' || modelKey === 'google/gemini-3-pro-image') {
        modelPrefix = '[💎新旗舰·正式版] ';
      } else if (modelKey === 'gemini-3-pro-image-preview' || modelKey === 'google/gemini-3-pro-image-preview') {
        modelPrefix = '[💎新旗舰·预览版] ';
      } else if (modelKey.includes('2.5') || modelKey.includes('极速')) {
        modelPrefix = '[🚀极速版·v2.5] ';
      } else if (modelKey.includes('gpt-image-2.5')) {
        modelPrefix = '[🎨GPT·2.5旗舰] ';
      } else if (modelKey.includes('gpt-image-2')) {
        modelPrefix = '[🎨GPT·2.0] ';
      } else if (modelKey.includes('gpt-image-1.5')) {
        modelPrefix = '[渠道·1.5] ';
      } else if (modelKey.includes('gpt-image-1')) {
        modelPrefix = '[渠道·1.0] ';
      }
      
      displayModel = `${modelPrefix}${model}`;
      if (providerMarker) {
        displayModel = `${displayModel} ${providerMarker}`;
      }
    }

    // 2. 插入详细日志 usage_logs (主看板使用，必须成功)
    const { error: insertError } = await supabaseAdmin.from('usage_logs').insert([{
      user_id: userId,
      dept_id: finalDeptId, 
      tokens_used: pointsToDeduct,
      cost_usd: pointsToDeduct / 10000,
      model: displayModel,
      model_res: modelResValue,
      type: type,
      created_at: now
    }]);

    if (insertError) {
      console.error(`[Billing] Failed to insert usage_log for user ${userId} with deptId ${finalDeptId}. Error:`, insertError.message || insertError);
      
      // Fallback: It might be a foreign key constraint failure for an invalid dept_id. Try without dept_id.
      const { error: retryError } = await supabaseAdmin.from('usage_logs').insert([{
        user_id: userId,
        dept_id: null, 
        tokens_used: pointsToDeduct,
        cost_usd: pointsToDeduct / 10000,
        model: displayModel,
        model_res: modelResValue,
        type: type,
        created_at: now
      }]);
      
      if (retryError) {
         console.error(`[Billing] Critical retry failed for user ${userId}. Billing log LOST. Error:`, retryError.message || retryError);
      } else {
         console.warn(`[Billing] Fallback successful. Inserted billing log for user ${userId} with null dept_id. Please verify the user's department UUID.`);
      }
    }

    // 4. 滚动清理：保持 usage_logs 数据量在合理范围
    const { count } = await supabaseAdmin.from('usage_logs').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    if (count && count > 1000) {
      const { data: oldRecords } = await supabaseAdmin
        .from('usage_logs')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(Math.min(100, count - 1000));
      
      if (oldRecords && oldRecords.length > 0) {
        await supabaseAdmin.from('usage_logs').delete().in('id', oldRecords.map(r => r.id));
      }
    }

    console.log(`[Billing] Charged ${pointsToDeduct} points to user ${userId} for ${model}`);
  } catch (err) {
    console.error("[Billing] Critical error during charging:", err);
  }
}

const authenticateRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const xUserId = req.headers['x-user-id'] as string;
  
  // If we have a Bearer token, use it to get the real user identity
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        (req as any).user = user;
        return next();
      }
    } catch (e) {
      console.error("Auth middleware error:", e);
    }
  }

  // Fallback to x-user-id for non-JWT requests (legacy/convenience)
  if (xUserId) {
    (req as any).user = { id: xUserId };
    return next();
  }

  (req as any).user = { id: 'system' };
  next();
};

const upload = multer({ storage: multer.memoryStorage() });

async function getGlobalApiConfig() {
  try {
    const { data } = await supabaseAdmin.from('department_configs').select('api_base_url, api_key, routing_mode, method1_key').eq('dept_name', '全站系统').maybeSingle();
    if (data && data.api_key) {
      const activeProvider = detectProvider(data.api_base_url);
      return {
        apiKey: data.api_key,
        baseUrl: data.api_base_url || 'https://api.tiantoken.com',
        activeProvider,
        routingMode: data.routing_mode,
        method1Key: data.method1_key
      };
    }
  } catch (e) {
    console.warn("Failed to fetch global API config from department_configs", e);
  }
  return null;
}

async function resolveApiConfig(userUuid: string) {
  let apiKey = process.env.TIANTOKEN_API_KEY || process.env.ROUTERHUB_API_KEY;
  let baseUrl = "https://api.tiantoken.com";
  let deptId = null;
  let provider = 'tiantoken';
  let routingMode = 1;
  let method1Key = null;

  const isKeyInvalid = (key: string | undefined) => !key || key.includes('在这里填入') || key.includes('placeholder') || key.trim() === '';

  // 1. Check department config first
  if (userUuid !== 'system') {
    const configData = await getUserApiConfig(userUuid);
    if (configData && configData.department_configs) {
      const isGlobalFallbackDept = configData.department_configs.dept_name === '全站系统';
      
      // Explicitly for non-global departments: do not fallback to global if key is invalid,
      // return their config as-is so it gets blocked properly.
      if (!isGlobalFallbackDept || (isGlobalFallbackDept && !isKeyInvalid(configData.department_configs.api_key))) {
        deptId = configData.dept_id;
        const dUrl = configData.department_configs.api_base_url || baseUrl;
        const dProvider = detectProvider(dUrl);
        return {
          apiKey: configData.department_configs.api_key,
          baseUrl: dUrl,
          deptId,
          provider: dProvider,
          routingMode: configData.department_configs.routing_mode,
          method1Key: configData.department_configs.method1_key
        };
      }
    }
  }

  // 2. Check global API Config from department_configs '全站系统'
  const globalConfig = await getGlobalApiConfig();
  if (globalConfig && globalConfig.apiKey && !isKeyInvalid(globalConfig.apiKey)) {
    return {
      apiKey: globalConfig.apiKey,
      baseUrl: globalConfig.baseUrl,
      deptId: null,
      provider: globalConfig.activeProvider,
      routingMode: globalConfig.routingMode,
      method1Key: globalConfig.method1Key
    };
  }

  // 3. Fallback to .env Defaults
  if (isKeyInvalid(apiKey) && !isKeyInvalid(process.env.GEMINI_API_KEY)) {
    return {
      apiKey: process.env.GEMINI_API_KEY,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      deptId: null,
      provider: 'google',
      routingMode: 1,
      method1Key: null
    };
  }

  return { apiKey, baseUrl, deptId, provider, routingMode, method1Key };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  
  // 确保本地 uploads 和 presets 静态目录存在并挂载静态服务，防止外部存储桶失效导致素材丢失
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const presetsDir = path.join(process.cwd(), 'public', 'presets');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(presetsDir)) fs.mkdirSync(presetsDir, { recursive: true });
  app.use('/uploads', express.static(uploadsDir));
  app.use('/presets', express.static(presetsDir));

  app.use(authenticateRequest);

  // === 增强：素材上传 API (双重安全防线：本地文件系统永久持久化 + Supabase Storage 云端备份) ===
  app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
      let fileBuffer: Buffer;
      let fileName: string;
      let mimeType: string;

      if (req.file) {
        fileBuffer = req.file.buffer;
        fileName = req.file.originalname || `upload_${Date.now()}.png`;
        mimeType = req.file.mimetype || 'image/png';
      } else if (req.body && req.body.base64) {
        const base64Data = req.body.base64.replace(/^data:image\/\w+;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');
        fileName = req.body.fileName || `upload_${Date.now()}.png`;
        mimeType = req.body.mimeType || 'image/png';
      } else {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'png';
      const cleanBaseName = path.basename(fileName, '.' + fileExt).replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
      const uniqueFileName = `${cleanBaseName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      // 1. 本地磁盘持久化保存 (100% 不受外部云存储或网络影响)
      const localFilePath = path.join(uploadsDir, uniqueFileName);
      fs.writeFileSync(localFilePath, fileBuffer);
      const localUrl = `/uploads/${uniqueFileName}`;

      // 2. 同时异步/安全同步至 Supabase Storage (作为云端异地备份)
      const storagePath = `user_uploads/${uniqueFileName}`;
      let cloudUrl: string | null = null;
      try {
        const { data: buckets } = await supabaseAdmin.storage.listBuckets();
        const assetsBucket = buckets?.find((b: any) => b.name === 'assets');
        if (!assetsBucket) {
          await supabaseAdmin.storage.createBucket('assets', { public: true });
        }

        const { error } = await supabaseAdmin.storage
          .from('assets')
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true
          });

        if (!error) {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('assets')
            .getPublicUrl(storagePath);
          cloudUrl = publicUrlData?.publicUrl || null;
        }
      } catch (e) {
        console.warn('Supabase cloud backup warning (non-fatal, local saved):', e);
      }

      console.log('✅ 素材双重持久化成功:', { localUrl, cloudUrl });
      return res.json({ 
        url: localUrl, 
        localUrl, 
        cloudUrl: cloudUrl || localUrl, 
        path: storagePath 
      });
    } catch (err: any) {
      console.error('Upload image endpoint error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // === 优化：云端同步读取与保存用户自定义选配与演示例图 (三重持久化保险：表 + Storage Bucket + 本地文件系统) ===
  const appDataDir = path.join(process.cwd(), 'data', 'app_config');
  try { if (!fs.existsSync(appDataDir)) fs.mkdirSync(appDataDir, { recursive: true }); } catch (e) {}

  app.get('/api/app-data/get', async (req, res) => {
    try {
      const key = req.query.key as string;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      
      // 1. 优先从 Supabase 数据库 system_settings 表读取
      let resultValue: string | null = null;
      try {
        const { data, error } = await supabaseAdmin.from('system_settings').select('value').eq('key', key).maybeSingle();
        if (data && data.value !== null && data.value !== undefined) {
          resultValue = data.value;
        }
      } catch (e) {}

      // 2. 如果数据库没读到，从 Supabase Storage assets/config 读取
      if (resultValue === null) {
        try {
          const { data: fileData, error: fileError } = await supabaseAdmin.storage.from('assets').download(`config/${key}.json`);
          if (fileData && !fileError) {
            resultValue = await fileData.text();
          }
        } catch (e) {}
      }

      // 3. 如果云端都没读到，从本地文件系统读取
      if (resultValue === null) {
        try {
          const filePath = path.join(appDataDir, `${key}.json`);
          if (fs.existsSync(filePath)) {
            resultValue = fs.readFileSync(filePath, 'utf-8');
          }
        } catch (e) {}
      }

      return res.json({ value: resultValue });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/app-data/save', async (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key) return res.status(400).json({ error: 'Missing key' });
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      
      // 1. 保存至本地文件系统 (实时兜底)
      try {
        const filePath = path.join(appDataDir, `${key}.json`);
        fs.writeFileSync(filePath, valueStr, 'utf-8');
      } catch (e) {}

      // 2. 保存至 Supabase Storage assets/config
      try {
        const buffer = Buffer.from(valueStr, 'utf-8');
        await supabaseAdmin.storage.from('assets').upload(`config/${key}.json`, buffer, {
          contentType: 'application/json',
          upsert: true
        });
      } catch (e) {}

      // 3. 保存至 system_settings 表
      try {
        await supabaseAdmin.from('system_settings').upsert([{
          key,
          value: valueStr
        }]).select();
      } catch (e) {}

      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

app.post('/api/analyze_product', upload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Missing image file' });
      }

      // Convert image to base64
      const imageBase64 = file.buffer.toString('base64');
      const mimeType = file.mimetype;

      const userUuid = (req as any).user?.id || 'system';
      const apiConfig = await resolveApiConfig(userUuid);
      const apiKey = apiConfig.apiKey;
      const baseUrl = apiConfig.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
      const provider = apiConfig.provider;

      if (!apiKey || apiKey.includes('在这里填入') || apiKey.includes('placeholder')) {
        return res.status(401).json({ error: 'API Key not configured correctly' });
      }

      const prompt = `Analyze this furniture product image.
Return ONLY a valid JSON object with the following fields:
- "name": A concise, premium name for the product.
- "category": The category, MUST be exactly one of: "sofa", "chair", "table", "dining", "bed", or "other".
- "description": A short description of the product's features, material, and style (in Chinese).
Example JSON format:
{
  "name": "MH 云朵真皮沙发",
  "category": "sofa",
  "description": "头层牛皮包裹，意式极简设计，舒适百搭。"
}
Do not include markdown blocks, just raw JSON.`;

      let cleanBase = baseUrl.replace(/\/+$/, '').replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '');
      let visionModel = provider === 'routerhub' ? 'google/gemini-3.5-flash' : 'gemini-3.5-flash';

      let targetUrl = `${cleanBase}/v1beta/models/${visionModel}:generateContent`;
      if (provider === 'google' || cleanBase.includes('googleapis.com')) {
        targetUrl += `?key=${apiKey}`;
      }

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64
                }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      };

      const headers: any = { "Content-Type": "application/json" };
      if (provider === "routerhub" || provider === "vectorengine") {
          headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
          headers["x-goog-api-key"] = apiKey;
      }

      const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API returned ${response.status}: ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let parsed = {};
      try {
        const jsonStr = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse Gemini output:', generatedText);
        // Provide a default fallback
        parsed = {
          name: "自动识别家具",
          category: "other",
          description: "未能成功解析AI生成的特征描述。"
        };
      }

      res.json(parsed);
    } catch (error: any) {
      console.error('Analyze product error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/analyze_scene', upload.single('image'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Missing image file' });
      }

      // Convert image to base64
      const imageBase64 = file.buffer.toString('base64');
      const mimeType = file.mimetype;

      const userUuid = (req as any).user?.id || 'system';
      const apiConfig = await resolveApiConfig(userUuid);
      const apiKey = apiConfig.apiKey;
      const baseUrl = apiConfig.baseUrl || "https://generativelanguage.googleapis.com/v1beta";
      const provider = apiConfig.provider;

      if (!apiKey || apiKey.includes('在这里填入') || apiKey.includes('placeholder')) {
        return res.status(401).json({ error: 'API Key not configured correctly' });
      }

      const prompt = `Analyze this interior design room/scene photo.
Return ONLY a valid JSON object with the following fields:
- "name": A concise, attractive name for the room/scene (in Chinese, e.g., "意式轻奢客厅实景", "现代极简主卧空间", "北欧风阳光阳台").
- "desc": A short description of the lighting, decor style, and space characteristics (in Chinese).
Example JSON format:
{
  "name": "现代简约高层客厅实景",
  "desc": "采光极佳，以米灰色为主色调，木质落地窗与现代射灯交相辉映。"
}
Do not include markdown blocks, just raw JSON.`;

      let cleanBase = baseUrl.replace(/\/+$/, '').replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '');
      let visionModel = provider === 'routerhub' ? 'google/gemini-3.5-flash' : 'gemini-3.5-flash';

      let targetUrl = `${cleanBase}/v1beta/models/${visionModel}:generateContent`;
      if (provider === 'google' || cleanBase.includes('googleapis.com')) {
        targetUrl += `?key=${apiKey}`;
      }

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: imageBase64
                }
              },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      };

      const headers: any = { "Content-Type": "application/json" };
      if (provider === "routerhub" || provider === "vectorengine") {
          headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
          headers["x-goog-api-key"] = apiKey;
      }

      const response = await fetch(targetUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API returned ${response.status}: ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      let generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      let parsed = {};
      try {
        const jsonStr = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse Gemini scene output:', generatedText);
        parsed = {
          name: "客户现场实景空间",
          desc: "优质现场实景空间图，支持AI智能空间融合与搭配。"
        };
      }

      res.json(parsed);
    } catch (error: any) {
      console.error('Analyze scene error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route for uploading mask and clean image
  app.post('/api/pre_process/mask', upload.fields([{ name: 'clean_image', maxCount: 1 }, { name: 'mask_image', maxCount: 1 }]), async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const cleanImageFile = files['clean_image']?.[0];
      const maskImageFile = files['mask_image']?.[0];

      if (!cleanImageFile || !maskImageFile) {
        return res.status(400).json({ error: 'Missing clean_image or mask_image' });
      }

      const timestamp = Date.now();
      const cleanImagePath = `assets/clean_${timestamp}.jpg`;
      const maskImagePath = `masks/mask_${timestamp}.png`;

      // 采用 Sharp Alpha 通道归一化管道处理底图与蒙版，确保 1:1 像素尺寸对齐与 Alpha 语义规范
      let cleanImageBuffer = cleanImageFile.buffer;
      let maskImageBuffer = maskImageFile.buffer;

      try {
        const normalized = await normalizeImageAndMaskWithSharp(cleanImageFile.buffer, maskImageFile.buffer);
        cleanImageBuffer = normalized.normalizedImage;
        maskImageBuffer = normalized.normalizedMask;
      } catch (err) {
        console.warn('Sharp alpha mask normalization failed, using fallback buffers:', err);
      }

      // Get public URLs or use dummy ones if placeholder
      let cleanImageUrl = '';
      let maskImageUrl = '';
      let logData: any = [{ id: 'dummy', created_at: new Date().toISOString() }];
      
      const isPlaceholder = !supabaseUrl || supabaseUrl.includes('placeholder.supabase.co');
      
      if (isPlaceholder) {
        cleanImageUrl = `dummy_clean_${Date.now()}.png`;
        maskImageUrl = `dummy_mask_${Date.now()}.png`;
      } else {
        // Ensure buckets exist - simplified and safer
        const ensureBucket = async (name: string) => {
          try {
            const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
            if (listError) {
              console.warn(`Error listing buckets while ensuring ${name}:`, listError.message);
              return;
            }
            if (buckets && !buckets.find(b => b.name === name)) {
              console.log(`Creating missing bucket: ${name}`);
              await supabaseAdmin.storage.createBucket(name, { public: true });
            }
          } catch (e) {
            console.warn(`Caught error in ensureBucket(${name}):`, e);
          }
        };

        await ensureBucket('assets');
        await ensureBucket('masks');

        // 1. Upload clean image to Supabase Storage
        const { data: cleanData, error: cleanError } = await supabaseAdmin.storage
          .from('assets')
          .upload(cleanImagePath, cleanImageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (cleanError) {
          console.error('Clean image upload error:', cleanError);
          throw new Error(`Failed to upload clean image: ${cleanError.message}`);
        }

        // 2. Upload mask image to Supabase Storage
        const { data: maskData, error: maskError } = await supabaseAdmin.storage
          .from('masks')
          .upload(maskImagePath, maskImageBuffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (maskError) {
          console.error('Mask image upload error:', maskError);
          throw new Error(`Failed to upload mask image: ${maskError.message}`);
        }

        // Get public URLs
        cleanImageUrl = supabaseAdmin.storage.from('assets').getPublicUrl(cleanImagePath).data.publicUrl;
        maskImageUrl = supabaseAdmin.storage.from('masks').getPublicUrl(maskImagePath).data.publicUrl;

        // 3. Insert into pre_process_logs table - USE supabaseAdmin to bypass RLS issues
        const { data: realLogData, error: logError } = await supabaseAdmin
          .from('pre_process_logs')
          .insert([
            {
              plugin_id: 'mhyf_mask_tool_v1',
              clean_image_url: cleanImageUrl,
              mask_image_url: maskImageUrl,
              created_at: new Date().toISOString()
            }
          ])
          .select();

        if (logError) {
          console.warn('Pre-process log insertion error (ignoring to prevent failure):', logError);
        }
        if (realLogData) logData = realLogData;
      }

      res.json({
        success: true,
        data: {
          clean_image_url: cleanImageUrl,
          mask_image_url: maskImageUrl,
          log: logData[0]
        }
      });
    } catch (error: any) {
      console.error('Error in mask pre-processing:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // API Route to proxy to API Gateway
  // Endpoint: /api/gateway/generate-image
  app.post('/api/gateway/generate-image', async (req, res) => {
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    const safeSetHeader = (key: string, value: string) => {
      if (!res.headersSent) {
        try {
          res.setHeader(key, value);
        } catch (e) {}
      }
    };

    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) {
        try {
          res.write(' ');
        } catch (err) {}
      }
    }, 10000);

    const sendJsonResponse = (status: number, payload: any) => {
      clearInterval(heartbeatInterval);
      if (!res.writableEnded) {
        if (!res.headersSent) {
          res.status(status);
        }
        res.write(JSON.stringify(payload));
        res.end();
      }
    };

    try {
      let {
        prompt,
        model = "google/gemini-3-pro-image",
        generationIntent = "text_to_image",
        aspectRatio = "1:1",
        images = [],
        mask = null,
        resolution = "2K",
        seed,
        concurrency = 1
      } = req.body;
      const user = (req as any).user;
      const userUuid = user?.id || 'system';

      console.log(`[⚡词元网关调度] 发起生图作业请求 - Model: ${model}, Resolution: ${resolution}, AspectRatio: ${aspectRatio}, Intent: ${generationIntent}`);

      if ((model === 'gemini-2.5-flash' || model === 'gemini-2.5-flash-image' || model?.includes('2.5')) && (resolution === '2K' || resolution === '4K' || resolution?.toLowerCase() === '2k' || resolution?.toLowerCase() === '4k')) {
        console.log(`[⚡词元网关调度] 极速版 (v2.5 Flash) 请求项选用了 2K/4K 渲染精度，底层业务逻辑将其映射并平滑升级至 gemini-3.1-flash-image 引擎执行。`);
        model = 'gemini-3.1-flash-image';
      }

      const protocol = resolveProtocol(model);
      let logResolution = resolution;
      let apiAspectRatio = aspectRatio;
      let targetW: number | null = null;
      let targetH: number | null = null;

      if (typeof aspectRatio === 'string') {
          const customRatioMatch = aspectRatio.match(/^(\d+):(\d+)$/);
          if (customRatioMatch) {
              const w = parseInt(customRatioMatch[1], 10);
              const h = parseInt(customRatioMatch[2], 10);
              if (w > 100 && h > 100) {
                  targetW = w;
                  targetH = h;
                  logResolution = aspectRatio; // Record exact dimensions like 3974:1533
                  
                  const ratio = w / h;
                  const supported = [{ id: '1:1', val: 1 }, { id: '3:4', val: 0.75 }, { id: '4:3', val: 1.33 }, { id: '9:16', val: 0.56 }, { id: '16:9', val: 1.77 }];
                  apiAspectRatio = supported.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).id;
              }
          }
      }

      // 1. DYNAMIC CONFIG FETCHING
      let { apiKey, baseUrl, deptId, provider, routingMode, method1Key } = await resolveApiConfig(userUuid);
      safeSetHeader("X-Proxy-Provider", provider || "tiantoken");
      
      const isKeyInvalid = (key: string | undefined) => !key || key.includes('在这里填入') || key.includes('placeholder') || key.trim() === '';

      if (isKeyInvalid(apiKey)) {
        return sendJsonResponse(401, { error: { message: "系统或所属部门未配置有效的 API KEY，请联系管理员在控制面板设置。" } });
      }

      if (baseUrl && !baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
      }
      
      // For Gemini native calls via RouterHub/VectorEngine, we specifically need /v1beta
      if (baseUrl.includes('routerhub') || baseUrl.includes('vectorengine')) {
        if (!baseUrl.includes('/v1beta')) {
           if (baseUrl.includes('/v1')) {
              baseUrl = baseUrl.replace('/v1', '/v1beta');
           } else {
              baseUrl = baseUrl.replace(/\/+$/, '') + '/v1beta';
           }
        }
      }

      // === SYSTEM TRIGGER HOOK: LINEART TRANSFORM ===
      let dynamicImageControlStrength: number | undefined = undefined;
      let dynamicNegativePrompt: string | undefined = undefined;

      if (prompt && (prompt.includes('[SYSTEM_TRIGGER:LINEART_TRANSFORM]') || prompt.includes('[SYSTEM_TRIGGER:PATENT_ISOLATION]'))) {
        try {
          console.log("[Pipeline] 检测到高级系统钩子，自动触发 Stage 1 (多模态理解与高级逻辑推演)...");
          
          if (images.length === 0) {
             throw new Error("高级处理需要上传参考图片");
          }

          let stage1Instruction = '';
          let userPrompt = prompt;

          if (prompt.includes('[SYSTEM_TRIGGER:PATENT_ISOLATION]')) {
             stage1Instruction = `You are the Lead Industrial Furniture AI Analyst at MANWAH. Analyze the sketch or image.
- PATENT ISOLATION AND BACKGROUND PURGING (STRICT):
  1. If the prompt contains '[SYSTEM_TRIGGER:PATENT_ISOLATION]', it means the output is for official patent review. The background must be absolutely sterile and flat pure white (#FFFFFF).
  2. ANTI-FLOOR RULE: Explicitly forbid the engine from rendering a "floor", "ground plane", "horizon line", or "studio backdrops". The sofa must appear floating in a vacuum, grounded ONLY by microscopic ambient occlusion shadows strictly limited to the absolute bottom tip of the legs.
  3. NO ARTIFACTS OR ACCIDENTAL MORPHING: The industrial details—such as control panels, recliners, metal mechanisms, or logos—must be preserved down to the pixel level. Do NOT add decorative wrinkles, puffiness, or change button placements.
  4. Force keywords into Stage 2 prompt: "Product isolated on absolute pure white background #FFFFFF, commercial photography cut-out, sharp crisp edges, zero floor reflection, zero gray gradients, microscopic ambient occlusion contact shadow, untouched manufacturer hardware details."
Output ONLY the finalized premium English prompt for generating a photorealistic commercial render.`;
             userPrompt = prompt.replace('[SYSTEM_TRIGGER:PATENT_ISOLATION]', '').trim();
          } else {
             stage1Instruction = `You are the Lead Industrial Furniture AI Analyst at MANWAH. Analyze the sketch: freeze the exact seat count (e.g. 'Strictly 2-seater straight, NO sectional extension'), detect vertical seam lines for 'double-needle contrast stitching', and identify recliners/headrests.
- ABSOLUTE CAMERA PERSPECTIVE LOCK (STRICT):
  1. The camera viewpoint MUST strictly mimic the input sketch's exact 3/4 angled isometric/perspective view. 
  2. CRITICAL: Do NOT auto-correct or change the camera angle to a flat, centered straight-front view. The left armrest side profile must be visibly extruded and foreshortened in 3D depth as drawn.
  3. Force keywords into Stage 2 prompt: "Captured from a cinematic 3/4 angled perspective view, dynamic three-quarter studio product shot showing left armrest depth, angled sofa silhouette, perfect 3D depth forecasting."
- DETECT BACKREST CORNER DETAILS: If the sketch shows pointed folds, triangular lines, or ear-like protrusions at the top corners of the backrest (as seen in image_6ded06), it STRICTLY indicates premium "pinch-pleated tailored corners (pinched ears)" and "radiating natural cushion compression wrinkles". 
- You MUST force-inject these exact keywords into the output prompt: "distinct pinch-pleat tailoring on the upper corners of the backrest cushions, heavy organic vertical compression wrinkles along the back seams, ultra-plump volumetric filling". 
- NEVER let the generation engine smooth out these structural corners.
- ADAPTIVE SEAM SEMANTICS (RESET GLOBAL WEIGHTS):
  1. DO NOT force "upward/downward tufting curves" onto linear geometric designs.
  2. If the sketch features sharp, straight diagonal intersecting lines (as seen in image_904fa0), class it as "Modern Geometric Tech Style". 
  3. These lines must be rendered STRICTLY as "elegant, flush, double-needle contrast topstitching lines" (明车缝工艺) embedded on a taut, smooth leather panel, exactly like the pristine purple reference. 
  4. FORBID destructive deep puckering, crater-like tufting, or artificial leather blooming around these straight lines. Keep the cushion surfaces firm and tailored.
Output ONLY the finalized premium English prompt for generating a photorealistic commercial render.`;
             userPrompt = prompt.replace('[SYSTEM_TRIGGER:LINEART_TRANSFORM]', '').trim();
          }

          let cleanBase = baseUrl.replace(/\/+$/, '').replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '');
          let stage1Model = provider === 'routerhub' ? 'google/gemini-2.5-flash' : 'gemini-2.5-flash';
          const stage1Url = `${cleanBase}/v1beta/models/${stage1Model}:generateContent${provider === 'google' ? `?key=${apiKey}` : ''}`;
          
          const stage1Payload = {
            systemInstruction: {
              parts: [{ text: stage1Instruction }]
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: images[0].mimeType,
                      data: images[0].data
                    }
                  },
                  { text: userPrompt }
                ]
              }
            ],
            generationConfig: { temperature: 0.2 }
          };

          const stage1Headers: any = { "Content-Type": "application/json" };
          if (provider === "routerhub" || provider === "vectorengine") {
             stage1Headers["Authorization"] = `Bearer ${apiKey}`;
          } else {
             stage1Headers["x-goog-api-key"] = apiKey;
          }

          const stage1Res = await fetch(stage1Url, {
            method: 'POST',
            headers: stage1Headers,
            body: JSON.stringify(stage1Payload)
          });

          if (stage1Res.ok) {
            const stage1Data = await stage1Res.json();
            const highPrecisionPrompt = stage1Data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (highPrecisionPrompt) {
               prompt = highPrecisionPrompt.trim();
               console.log("[Pipeline] Stage 1 智能解构完成。生成的黄金提示词为:", prompt);
               dynamicImageControlStrength = 0.95;
               dynamicNegativePrompt = "sectional, corner sofa, extra seats, distorted mechanism, low-res leather";
            }
          } else {
             console.log("[Pipeline] Stage 1 请求失败，启动安全降级", await stage1Res.text());
          }
        } catch (stage1Err) {
          console.error("[Pipeline] 线稿转绘底层链路报错，启动安全降级:", stage1Err);
        }
      }
      // === END SYSTEM TRIGGER HOOK ===

      // 2. PRE-GENERATION QUOTA CHECK
      if (userUuid !== 'system') {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('quota_limit, quota_used')
          .eq('id', userUuid)
          .single();

        if (profile) {
          const limit = profile.quota_limit || 0;
          const currentUsed = profile.quota_used || 0;
          const estimatedTokens = getImagePoints(model, resolution);

          if (limit > 0 && (limit - currentUsed) < estimatedTokens) {
             return sendJsonResponse(402, { 
               error: '余额不足', 
               message: `本次操作按计划需 ${(estimatedTokens / 10000).toFixed(4)}W 额度，您的余额不足，请联系管理员充值。` 
             });
          }
        }
      }

      // Typical Google AI format for generateContent
      const parts = [];
      if (images && images.length > 0) {
        for (const img of images) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data
            }
          });
        }
      }
      parts.push({ text: prompt });

      const generationConfig: any = {
        outputFormat: "image/jpeg",
        // Pass standard aspect ratios or handle as needed
      };

      // Not all models support all parameters, but try to pass them safely
      generationConfig.imageConfig = {
        aspectRatio: apiAspectRatio
      };
      
      if (seed !== undefined) {
         generationConfig.seed = seed;
      }
      if (['512px', '1K', '2K', '4K'].includes(resolution)) {
         generationConfig.imageConfig.imageSize = resolution;
      }

      const payload = {
        contents: [
          {
            role: "user",
            parts: parts
          }
        ],
        generationConfig: generationConfig
      };

      const headers: any = { 
        "Content-Type": "application/json",
      };
      
      if (provider === "routerhub" || provider === "vectorengine") {
         headers["Authorization"] = `Bearer ${apiKey}`;
         safeSetHeader("X-Proxy-Provider", provider);
      } else {
         headers["x-goog-api-key"] = apiKey;
         safeSetHeader("X-Proxy-Provider", "google");
      }

      const doFetch = async (currentBaseUrl: string, currentApiKey: string, currentProvider: string) => {
        let cleanBase = currentBaseUrl.replace(/\/+$/, '').replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '');
        let targetUrl = '';
        let isMultipart = false;
        let formData: FormData | null = null;
        let reqPayload: any = null;

        const upstreamModel = getUpstreamModelName(model, protocol, currentProvider);

        if (protocol === 'google_genai') {
          // 分流 A (Google GenAI) ──> POST https://api.tiantoken.com/v1beta/models/{model}:generateContent
          targetUrl = `${cleanBase}/v1beta/models/${upstreamModel}:generateContent`;
          if (currentProvider === "google") {
            targetUrl += `?key=${currentApiKey}`;
          }

          const parts: any[] = [];
          if (images && images.length > 0) {
            for (const img of images) {
              parts.push({
                inlineData: {
                  mimeType: img.mimeType || "image/jpeg",
                  data: img.data
                }
              });
            }
          }
          if (mask && mask.data) {
            parts.push({
              inlineData: {
                mimeType: mask.mimeType || "image/png",
                data: mask.data
              }
            });
          }
          parts.push({ text: prompt });

          const genConfig: any = {
            responseModalities: ["IMAGE"],
            outputFormat: "image/png",
            imageConfig: {
              aspectRatio: apiAspectRatio,
              imageSize: ['512px', '1K', '2K', '4K'].includes(resolution) ? resolution : '2K'
            }
          };
          if (seed !== undefined) {
            genConfig.seed = seed;
          }

          reqPayload = {
            contents: [
              {
                role: "user",
                parts: parts
              }
            ],
            generationConfig: genConfig
          };
        } else {
          // OpenAI 系列传输协议 (openai_images)
          const sizeStr = getOpenAISize(apiAspectRatio, resolution);
          const hasMaskOrImages = (mask && mask.data) || (images && images.length > 0) || generationIntent === 'image_edit';

          if (hasMaskOrImages && images && images.length > 0) {
            // 分流 B (OpenAI Edits) ──> POST https://api.tiantoken.com/v1/images/edits (Multipart/form-data)
            targetUrl = `${cleanBase}/v1/images/edits`;
            isMultipart = true;
            formData = new FormData();
            formData.append('model', upstreamModel);
            formData.append('prompt', prompt);
            formData.append('n', String(concurrency || 1));
            formData.append('size', sizeStr);

            if (dynamicImageControlStrength !== undefined) formData.append('image_control_strength', String(dynamicImageControlStrength));
            if (dynamicNegativePrompt !== undefined) formData.append('negative_prompt', dynamicNegativePrompt);

            const imgBuffer = Buffer.from(images[0].data, 'base64');
            if (mask && mask.data) {
              const maskBuffer = Buffer.from(mask.data, 'base64');
              const { normalizedImage, normalizedMask } = await normalizeImageAndMaskWithSharp(imgBuffer, maskBuffer);
              formData.append('image', new Blob([normalizedImage], { type: 'image/png' }), 'image.png');
              formData.append('mask', new Blob([normalizedMask], { type: 'image/png' }), 'mask.png');
            } else {
              const normalizedImage = await sharp(imgBuffer).png().toBuffer();
              formData.append('image', new Blob([normalizedImage], { type: 'image/png' }), 'image.png');
            }
          } else {
            // 分流 C (OpenAI Gen) ──> POST https://api.tiantoken.com/v1/images/generations (JSON)
            targetUrl = `${cleanBase}/v1/images/generations`;
            reqPayload = {
              model: upstreamModel,
              prompt: prompt,
              n: concurrency || 1,
              size: sizeStr
            };
            if (seed !== undefined) reqPayload.seed = seed;
            if (dynamicImageControlStrength !== undefined) reqPayload.image_control_strength = dynamicImageControlStrength;
            if (dynamicNegativePrompt !== undefined) reqPayload.negative_prompt = dynamicNegativePrompt;
          }
        }

        const fetchHeaders: any = buildAuthHeaders(currentProvider, currentApiKey, isMultipart ? null : 'application/json');

        fileLog(`[Gateway Dispatch] Provider: ${currentProvider}, Protocol: ${protocol}, Model: ${upstreamModel}, TargetUrl: ${targetUrl}, isMultipart: ${isMultipart}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000);

        let resObj;
        try {
          resObj = await fetch(targetUrl, {
            method: "POST",
            headers: fetchHeaders,
            body: isMultipart ? formData : JSON.stringify(reqPayload),
            signal: controller.signal
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          if (fetchErr.name === 'AbortError') {
             throw new Error(`Upstream error: timeout after 300 seconds (5 minutes)`);
          }
          throw fetchErr;
        }
        
        clearTimeout(timeoutId);

        fileLog(`[Gateway Upstream Status] ${resObj.status}`);

        const text = await resObj.text();
        fileLog(`[Gateway Fetched Text] ` + text.substring(0, 300));
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonErr) {
          if (resObj.status === 404) {
             throw new Error(`Upstream returned 404 (Not Found). Please check if the model "${model}" is supported by this endpoint. URL: ${targetUrl}`);
          }
          throw new Error(`Invalid JSON response from upstream (${resObj.status}): ${text.substring(0, 100)}`);
        }

        if (!resObj.ok) {
          const errStatus = resObj.status;
          throw new Error(`[Status ${errStatus}] ` + (data.error?.message || data.message || resObj.statusText || `Upstream error ${resObj.status}`));
        }
        
        // Normalize response into standard Gemini format or error object
        data = await normalizeImageResponse(data);
        return data;
      };

      try {
        let fetchResult;
        let usedProvider = provider;
        const generateStartTime = Date.now();
        try {
          fetchResult = await doFetch(baseUrl, apiKey, provider);
        } catch (initialErr: any) {
          const errMsg = initialErr.message || "";
          let lastErr = initialErr;

          // 双路由容灾重试：TianToken 或 VectorEngine 失败时无感切换至备用灾备线路 (https://api.routerhub.ai)
          if (provider === 'tiantoken' || provider === 'vectorengine' || baseUrl.includes('tiantoken') || baseUrl.includes('vectorengine')) {
            let fallbackKey = method1Key || process.env.ROUTERHUB_API_KEY || 'sk-rh-v1-lCElzmEF4ZyXMk9HS2RgBfWAqKPbq5UL3Ro9JVXk5JE';
            
            if (!fallbackKey) {
              const globalConfig = await getGlobalApiConfig();
              if (globalConfig) {
                 fallbackKey = globalConfig.method1Key || (globalConfig.activeProvider === 'routerhub' ? globalConfig.apiKey : null);
              }
            }

            if (fallbackKey && fetchResult === undefined) {
              console.log(`[O&M: 容灾热切换] TianToken/主线路异常 (${errMsg}). 正在自动无感热切换至灾备线路 https://api.routerhub.ai...`);
              usedProvider = "routerhub";
              try {
                fetchResult = await doFetch("https://api.routerhub.ai", fallbackKey, "routerhub");
                console.log(`[O&M: 容灾热切换成功] RouterHub 灾备线路成功完成生图作业！`);
              } catch (fallbackErr: any) {
                console.error(`[O&M: 容灾线路失败] RouterHub 灾备重试也失败: ${fallbackErr.message}`);
                lastErr = fallbackErr;
              }
            } else {
              lastErr = initialErr;
            }
          }

          // If still no result, try Model Auto-Healing pool
          if (!fetchResult) {
            const errString = (lastErr && lastErr.message) ? lastErr.message : errMsg;
            const isRateLimitOrChannelErr = errString.includes("429") || errString.includes("503") || errString.includes("404") || errString.includes("上游负载已饱和") || errString.includes("No available channel") || errString.includes("bad_response_status_code") || errString.includes("upstream_error") || errString.includes("model_not_found");
            
            if (isRateLimitOrChannelErr) {
              const originalModel = model;
              const healingModel = protocol === 'openai_images' ? "gemini-3.1-flash-image" : "gpt-image-2";
              console.log(`[O&M: 智能自愈池] 模型 ${originalModel} 通道异常 (${errString})。无感切换至自愈备用模型: ${healingModel}...`);
              
              const prevModel = model;
              model = healingModel;
              try {
                let healingUrl = usedProvider === "routerhub" ? "https://api.routerhub.ai" : baseUrl;
                let healingKey = usedProvider === "routerhub" ? (process.env.ROUTERHUB_API_KEY || method1Key || apiKey) : apiKey;
                fetchResult = await doFetch(healingUrl, healingKey, usedProvider);
                console.log(`[O&M: 智能自愈成功] 成功使用 ${healingModel} 恢复渲染交付！`);
              } catch (healingErr: any) {
                model = prevModel;
                console.error(`[O&M: 智能自愈失败] 备用模型也失败: ${healingErr.message}`);
                throw new Error(`主线路异常: ${errMsg}. 备用线路异常: ${healingErr.message}`);
              }
            } else {
              console.error(`[O&M: Upstream Error] Provider ${usedProvider} failed on ${baseUrl}: ${errString}`);
              throw lastErr;
            }
          }
        }
        
        const generateEndTime = Date.now();
        const durationSec = ((generateEndTime - generateStartTime) / 1000).toFixed(1);

        safeSetHeader("X-Proxy-Provider", usedProvider);

        // Normalize image response
        if (fetchResult) {
          fetchResult = await normalizeImageResponse(fetchResult);
        }

        // Validate image response success and structure before charging
        const isSuccessfulResponse = isValidImageResponse(fetchResult);

        let pointsDeducted = 0;
        // Billing Logic using consolidated helper - log failures as 0 points with clear warning tags
        if (userUuid && userUuid !== 'system' && (req.method==='POST')) {
          if (!isSuccessfulResponse) {
            pointsDeducted = 0;
            let errReason = "上游接口无返回或格式异常";
            if (fetchResult && fetchResult.error && fetchResult.error.message) {
              errReason = fetchResult.error.message;
            }
            if (errReason.length > 50) {
              errReason = errReason.substring(0, 47) + "...";
            }
            const providerMarker = `- [生图未成功 - ${errReason}] (耗时 ${durationSec}s)`;
            await chargeUser(userUuid, 0, model, logResolution, deptId, 'image_generation', 0, 0, providerMarker);
            console.warn(`[Billing Logged] Failed image generation recorded as 0 points for user ${userUuid}.`);
          } else {
            pointsDeducted = getImagePoints(model, resolution);
            
            let providerMarker = `(耗时 ${durationSec}s)`;
            if (provider === 'vectorengine' && usedProvider === 'routerhub') {
               providerMarker = `- V转R (耗时 ${durationSec}s)`;
            } else if (usedProvider === 'vectorengine') {
               providerMarker = `- V (耗时 ${durationSec}s)`;
            } else if (usedProvider === 'routerhub') {
               providerMarker = `- R (耗时 ${durationSec}s)`;
            }
            await chargeUser(userUuid, pointsDeducted, model, logResolution, deptId, 'image_generation', 0, 0, providerMarker);
          }
        }

        // If the upstream didn't fail with an explicit error but did not return a valid image, supply a helpful error message
        if (!isSuccessfulResponse && fetchResult && !fetchResult.error) {
          fetchResult = {
            error: {
              message: "生图失败：上游接口未成功返回有效的图像数据（可能由于敏感词拦截或接口过载）。"
            }
          };
        }

        if (isSuccessfulResponse && fetchResult && fetchResult.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
           if (targetW && targetH) {
               const originalBase64 = fetchResult.candidates[0].content.parts[0].inlineData.data;
               const buffer = Buffer.from(originalBase64, 'base64');
               try {
                   const resizedBuffer = await sharp(buffer)
                        .resize(targetW, targetH, { fit: 'cover' })
                        .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
                        .toBuffer();
                   fetchResult.candidates[0].content.parts[0].inlineData.data = resizedBuffer.toString('base64');
                   fetchResult.candidates[0].content.parts[0].inlineData.mimeType = "image/jpeg";
                   console.log(`[Cover Resizing] Resized requested custom dimension ${targetW}x${targetH} successfully.`);
               } catch (resizeErr) {
                   console.error("[Cover Resizing] Error during resize:", resizeErr);
               }
           }
        }

        if (!isSuccessfulResponse) {
          console.log(`[⚡新闪电·正式版] 生图作业失败，扣除点数：0`);
          return sendJsonResponse(400, { ...fetchResult, points_deducted: pointsDeducted });
        }

        console.log(`[⚡新闪电·正式版] 生图作业圆满成功，返回数据。扣除点数：${pointsDeducted}`);
        return sendJsonResponse(200, { ...fetchResult, points_deducted: pointsDeducted });
      } catch (e: any) {
        console.error("[⚡新闪电·正式版] API proxy error:", e);
        return sendJsonResponse(500, { error: { message: e.message } });
      }
    } catch (outerError: any) {
      console.error("[⚡新闪电·正式版] Outer API proxy error:", outerError);
      return sendJsonResponse(500, { error: { message: outerError.message } });
    }
  });


  // API Route for Admin to test API connection
  app.post('/api/admin/test-connection', express.json(), async (req, res) => {
    try {
      let { baseUrl, apiKey, provider } = req.body;
      if (!baseUrl || !apiKey) {
        return res.status(400).json({ success: false, message: "Missing baseUrl or apiKey" });
      }
      if (typeof apiKey === 'string') apiKey = apiKey.trim();
      
      let targetUrl = `${baseUrl.replace(/\/+$/, '')}`;
      if (provider === "tiantoken" || provider === "routerhub" || provider === "vectorengine" || targetUrl.includes('generative')) {
          targetUrl = targetUrl.replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '');
      }
      
      let testMethod = 'POST';
      let body: any = JSON.stringify({
         contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
         generationConfig: { maxOutputTokens: 2 }
      });
      
      if (provider === "tiantoken") {
          targetUrl += "/v1beta/models/gemini-2.5-flash:generateContent";
          testMethod = 'POST';
      } else if (provider === "routerhub" || provider === "vectorengine") {
          targetUrl += "/v1/models";
          testMethod = 'GET';
          body = undefined;
      } else {
          targetUrl += "/v1beta/models/gemini-1.5-flash:generateContent";
          if (provider === "google" || targetUrl.includes('generativelanguage.googleapis.com')) {
             targetUrl += `?key=${apiKey}`;
          }
      }
      
      const headers: any = buildAuthHeaders(provider, apiKey, testMethod === 'GET' ? null : 'application/json');

      const fetchOptions: any = { headers, method: testMethod };
      if (body) fetchOptions.body = body;

      const response = await fetch(targetUrl, fetchOptions);
      if (!response.ok) {
          const errText = await response.text();
          let parsedErr = errText;
          try {
             let j = JSON.parse(errText);
             if (j.error && j.error.message) parsedErr = j.error.message;
          } catch(e) {}
          return res.status(200).json({ success: false, status: response.status, message: `(${response.status}) ${parsedErr.slice(0, 300)}` });
      }
      const data = await response.json();
      return res.json({ success: true, message: "通信测试成功" });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err.message });
    }
  });

  // API Route to refund points for failed image generation
  app.post('/api/admin/refund-log', express.json(), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = authHeader.split(' ')[1];
      const { data: { user: adminUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
      if (verifyError || !adminUser) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check admin/dept_admin role
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, dept_id')
        .eq('id', adminUser.id)
        .single();
        
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'dept_admin')) {
        return res.status(403).json({ error: 'Forbidden: Requires admin or dept_admin' });
      }

      const { logId, comment = "生图失败，人工纠偏核减" } = req.body;
      if (!logId) {
        return res.status(400).json({ error: 'Missing logId' });
      }

      // 1. Fetch the usage log
      const { data: log, error: logError } = await supabaseAdmin
        .from('usage_logs')
        .select('*')
        .eq('id', logId)
        .single();

      if (logError || !log) {
        return res.status(404).json({ error: 'Log not found' });
      }

      // 2. Department isolation check for dept_admin
      if (adminProfile.role === 'dept_admin') {
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('dept_id')
          .eq('id', log.user_id)
          .single();

        if (!userProfile || userProfile.dept_id !== adminProfile.dept_id) {
          return res.status(403).json({ error: 'Forbidden: You can only refund users from your own department' });
        }
      }

      // 3. Double-refund prevention
      if (log.tokens_used <= 0) {
        return res.status(400).json({ error: 'This log has already been refunded or holds 0 points' });
      }

      // 4. Fetch user's current profile balance/use
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('quota_used, username')
        .eq('id', log.user_id)
        .single();

      if (profileError || !userProfile) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      const refundPoints = log.tokens_used;
      const originUsed = userProfile.quota_used || 0;
      const targetUsed = Math.max(0, originUsed - refundPoints);

      // 5. Update user profile to deduct their quota_used
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ quota_used: targetUsed })
        .eq('id', log.user_id);

      if (profileUpdateError) {
        throw new Error(`Profile update failed: ${profileUpdateError.message}`);
      }

      // 6. Update usage log to set tokens_used and cost_usd to 0, and prepend a tag
      const updatedModelName = `[已核退-${comment}] ` + log.model;
      const { error: logUpdateError } = await supabaseAdmin
        .from('usage_logs')
        .update({
          tokens_used: 0,
          cost_usd: 0,
          model: updatedModelName.slice(0, 250) // prevent overflow if string is long
        })
        .eq('id', logId);

      if (logUpdateError) {
        // Rollback user balance if database update failed
        await supabaseAdmin.from('profiles').update({ quota_used: originUsed }).eq('id', log.user_id);
        throw new Error(`Usage log update failed: ${logUpdateError.message}`);
      }

      console.log(`[Billing Audit] Refunded user ${userProfile.username} (${log.user_id}) for log ${logId}: ${refundPoints} points refunded.`);

      return res.json({
        success: true,
        message: `成功退还 ${userProfile.username} ${refundPoints}点额度，已核回为 0 点。`,
        pointsReturned: refundPoints
      });

    } catch (err: any) {
      console.error("Refund endpoint failed:", err);
      return res.status(500).json({ error: err.message || 'Internal server error during refund' });
    }
  });

  // API Route for Admin or Dept Admin to create a user account
  app.post('/api/admin/create-user', async (req, res) => {
    try {
      // Extract Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = authHeader.split(' ')[1];
      const { data: { user: adminUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
      if (verifyError || !adminUser) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Check admin/dept_admin role
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, dept_id')
        .eq('id', adminUser.id)
        .single();
        
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'dept_admin')) {
         return res.status(403).json({ error: 'Forbidden: Requires admin or dept_admin' });
      }

      const { employeeId, password, username, quotaLimit, dept_id } = req.body;

      if (!employeeId || !password) {
        return res.status(400).json({ error: 'Missing employeeId or password.' });
      }

      let targetDeptId = dept_id;
      if (adminProfile.role === 'dept_admin') {
         targetDeptId = adminProfile.dept_id; // lock to their department
      }

      // 1. Create auth user with Admin SDK
      const authResponse = await supabaseAdmin.auth.admin.createUser({
        email: `${employeeId}@manwah.com`, // using manwah.com as domain or yourcompany
        password: password,
        email_confirm: true 
      });

      if (authResponse.error) {
        return res.status(400).json({ error: authResponse.error.message });
      }

      // 2. The trigger creates the profile, we just need to update it with the extra info
      if (authResponse.data?.user?.id) {
        const updatePayload: any = { 
          employee_id: employeeId, 
          username: username || employeeId, 
          quota_limit: quotaLimit ? parseInt(quotaLimit) : 100000 
        };
        
        if (targetDeptId) {
           updatePayload.dept_id = targetDeptId;
        }

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update(updatePayload)
          .eq('id', authResponse.data.user.id);

        if (profileError) {
           console.error("Profile update error:", profileError);
           // Warning: non-fatal, but logged
        }
      }

      return res.status(200).json({ success: true, user: authResponse.data.user });
    } catch (e: any) {
      console.error("Create user error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // API Route for Admin to reset a user's password
  app.post('/api/admin/reset-password', async (req, res) => {
    try {
      const { userId, newPassword } = req.body;

      if (!userId || !newPassword) {
        return res.status(400).json({ error: 'Missing userId or newPassword.' });
      }

      // Check admin status of requester
      const adminId = req.headers['x-user-id'] as string;
      if (!adminId) {
         return res.status(401).json({ error: 'Unauthorized.' });
      }
      
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, dept_id')
        .eq('id', adminId)
        .single();
        
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'dept_admin')) {
         return res.status(403).json({ error: 'Forbidden.' });
      }

      // If dept_admin, verify target user belongs to the same department
      if (adminProfile.role === 'dept_admin') {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('dept_id')
          .eq('id', userId)
          .single();
        
        if (!targetProfile || targetProfile.dept_id !== adminProfile.dept_id) {
          return res.status(403).json({ error: 'Forbidden: You can only manage users in your own department.' });
        }
      }

      const authResponse = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (authResponse.error) {
        return res.status(400).json({ error: authResponse.error.message });
      }

      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("Reset password error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // API Route for Admin to delete a user
  app.delete('/api/admin/users/:userId', async (req, res) => {
    try {
      const { userId } = req.params;

      // Check admin status of requester
      const adminId = req.headers['x-user-id'] as string;
      if (!adminId) {
         return res.status(401).json({ error: 'Unauthorized.' });
      }
      
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, dept_id')
        .eq('id', adminId)
        .single();
        
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'dept_admin')) {
         return res.status(403).json({ error: 'Forbidden.' });
      }

      // If dept_admin, verify target user belongs to the same department
      if (adminProfile.role === 'dept_admin') {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('dept_id')
          .eq('id', userId)
          .single();
        
        if (!targetProfile || targetProfile.dept_id !== adminProfile.dept_id) {
          return res.status(403).json({ error: 'Forbidden: You can only delete users in your own department.' });
        }
      }

      // Delete the user from auth.users
      const authResponse = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (authResponse.error) {
        return res.status(400).json({ error: authResponse.error.message });
      }
      
      // Delete from profiles
      await supabaseAdmin.from('profiles').delete().eq('id', userId);

      return res.status(200).json({ success: true });
    } catch (e: any) {
      console.error("Delete user error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/ai/test-connection', async (req, res) => {
    const userUuid = req.headers['x-user-uuid'] as string;

    if (!userUuid) {
      return res.status(400).json({ status: 'error', message: '缺少 x-user-uuid 头信息' });
    }

    try {
      // 1. JWT Authentication and Role Validation
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
      }
      const token = authHeader.split(' ')[1];
      const { data: { user: adminUser }, error: verifyError } = await supabaseAdmin.auth.getUser(token);
      if (verifyError || !adminUser) {
        return res.status(401).json({ status: 'error', message: 'Invalid token' });
      }

      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, dept_id')
        .eq('id', adminUser.id)
        .single();
        
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'dept_admin')) {
         return res.status(403).json({ status: 'error', message: 'Forbidden' });
      }

      // 2. Validate Target User's Department
      const { data: targetUser } = await supabaseAdmin.from('profiles').select('dept_id').eq('id', userUuid).single();
      if (adminProfile.role === 'dept_admin' && adminProfile.dept_id !== targetUser?.dept_id) {
         return res.status(403).json({ status: 'error', message: '您无权测试其他部门的数据' });
      }

      // 3. 获取该用户的部门 API 配置
      const config = await getUserApiConfig(userUuid);
      if (!config || !config.department_configs?.api_key || 
          config.department_configs.api_key.includes('***') || 
          config.department_configs.api_key.includes('你的真实KEY') ||
          config.department_configs.api_key.trim() === '') {
        return res.status(404).json({ status: 'error', message: '未找到有效部门 API 配置' });
      }

      let baseUrl = config.department_configs.api_base_url || 'https://api.routerhub.ai';
      if (baseUrl && !baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
      }

      let testUrl = '';
      const apiKey = config.department_configs.api_key;
      
      let testMethod = 'POST';
      let body: any = JSON.stringify({
         contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
         generationConfig: { maxOutputTokens: 1 }
      });

      // Construct a robust test URL for listing models or testing connection
      if (baseUrl.includes('tiantoken')) {
        testUrl = baseUrl.replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '') + '/v1beta/models/gemini-2.5-flash:generateContent';
        testMethod = 'POST';
      } else if (baseUrl.includes('routerhub') || baseUrl.includes('vectorengine')) {
        testUrl = baseUrl.replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '') + '/v1/models';
        testMethod = 'GET';
        body = undefined;
      } else if (baseUrl.includes('googleapis.com')) {
        testUrl = baseUrl.replace(/\/+$/, '') + '/v1beta/models/gemini-1.5-flash:generateContent';
        testUrl += `?key=${apiKey}`;
      } else {
        testUrl = baseUrl.replace(/\/+$/, '') + '/v1beta/models/gemini-1.5-flash:generateContent';
      }

      console.log(`[O&M: TestConnection] User: ${userUuid}, Provider: ${config.department_configs.dept_name}, Testing URL: ${testUrl}`);

      // 4. 发起一个极简的测试请求
      try {
        const fetchOptions: any = {
          method: testMethod,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'x-goog-api-key': apiKey 
          }
        };
        if (body) {
          fetchOptions.body = body;
        }

        const testRes = await fetch(testUrl, fetchOptions);

        if (testRes.ok) {
          res.json({ 
            status: 'success', 
            deptName: config.department_configs.dept_name,
            message: '连接成功' 
          });
        } else {
          const errText = await testRes.text();
          console.warn(`[TestConnection] Failed. Status: ${testRes.status}, Response: ${errText.substring(0, 200)}`);
          
          let errStr = 'Key 无效或接口无响应';
          try {
            const errData = JSON.parse(errText);
            errStr = errData.error?.message || errData.message || errStr;
          } catch {
            if (testRes.status === 401) errStr = 'API Key 认证失败 (401)';
            if (testRes.status === 404) errStr = '接口路径未找到 (404)';
            if (testRes.status === 405) errStr = '请求方法不被允许 (405)';
          }
          
          res.status(200).json({ // Return 200 so the frontend can display the failed status nicely
            status: 'failed', 
            message: errStr
          });
        }
      } catch (fetchErr: any) {
        console.error(`[TestConnection] Fetch error:`, fetchErr);
        res.status(200).json({ 
          status: 'failed', 
          message: `网络无法连接: ${fetchErr.message}` 
        });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ status: 'error', message: '服务器无法触达 API 地址' });
    }
  });

  // Generic proxy for standard GoogleGenAI frontend SDK requests
  app.use(['/v1beta', '/v1alpha', '/v1'], async (req, res) => {
    // 简单获取传递来的请求模型信息为了记录日志
    const originalUrl = req.originalUrl;
    const modelMatch = originalUrl.match(/models\/([^\:]+)/);
    const model = modelMatch ? modelMatch[1] : 'unknown-model';
    
    // Use authenticated identity
    const user = (req as any).user;
    const userUuid = user?.id || 'system';

    try {
      const isKeyInvalid = (key: string | undefined) => !key || key.includes('在这里填入') || key.includes('placeholder') || key.trim() === '';

      if (userUuid !== 'system') {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('quota_limit, quota_used')
          .eq('id', userUuid)
          .single();

        if (profile) {
          const limit = profile.quota_limit || 0; 
          if ((profile.quota_used || 0) >= limit && limit > 0) {
             return res.status(403).json({ error: { message: "您的配额已耗尽，请联系管理员充值" } });
          }
        }
      }

      let { apiKey, baseUrl, deptId, provider, routingMode, method1Key } = await resolveApiConfig(userUuid);

      if (isKeyInvalid(apiKey)) {
        return res.status(401).json({ error: { message: "API Key is missing or invalid." } });
      }

      if (baseUrl && !baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
      }
      
      // Remove /v1beta, /v1, etc since this proxy appends req.originalUrl (e.g. /v1beta/models/...)
      if (provider === "tiantoken" || provider === "routerhub" || provider === "vectorengine" || baseUrl.includes('generative')) {
        baseUrl = baseUrl.replace(/\/v1beta\/?$/, '').replace(/\/v1\/?$/, '');
      }

      // Clean up the URL to replace the proxy key with the real key
      const urlObj = new URL(`${baseUrl.replace(/\/+$/, '')}${req.originalUrl}`);
      
      // Only set key in query for direct Google calls
      if (provider === "google") {
        urlObj.searchParams.set("key", apiKey as string);
      }
      
      const targetUrl = urlObj.toString();
      console.log(`[O&M: API Proxy] Provider: ${provider}, Model: ${model}, User: ${userUuid}, Target: ${targetUrl}`);
      
      const headers: any = {
        "Content-Type": req.headers["content-type"] || "application/json",
      };
      
      if (provider === "tiantoken") {
          headers["Authorization"] = `Bearer ${apiKey}`;
          headers["x-goog-api-key"] = apiKey as string;
      } else if (provider === "routerhub" || provider === "vectorengine") {
          headers["Authorization"] = `Bearer ${apiKey}`;
      } else {
          headers["x-goog-api-key"] = apiKey as string;
      }
      
      const fetchOptions: RequestInit = {
        method: req.method,
        headers
      };

      // 提取 prompt 文本，用于估算 token（如果需要）
      let requestBodyJson = null;

      if (req.method !== 'GET' && req.method !== 'HEAD') {
         // 注意：Express 的 req.body 已经是 parsed 对象 (由于 app.use(express.json()))
         requestBodyJson = req.body;
         fetchOptions.body = JSON.stringify(req.body);
      }

      // Timeout explicitly set to 150 seconds for VectorEngine as requested
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);
      fetchOptions.signal = controller.signal;

      let response: Response;
      let usedProvider = provider;
      try {
        response = await fetch(targetUrl, fetchOptions);
        if (!response.ok && (provider === 'tiantoken' || provider === 'vectorengine' || baseUrl.includes('tiantoken') || baseUrl.includes('vectorengine'))) {
           // In Hybrid mode (routingMode === 2), we throw for ANY error (e.g. 401, 403, 404) to trigger fallback.
           // Otherwise for 5xx, 429, 400, 404, 402, 503
           if (routingMode === 2 || response.status >= 500 || response.status === 429 || response.status === 401 || response.status === 400 || response.status === 404 || response.status === 402) {
               throw new Error(`${provider} Error Status: ${response.status}`);
           }
        }
      } catch (err: any) {
        if (provider === 'tiantoken' || provider === 'vectorengine' || baseUrl.includes('tiantoken') || baseUrl.includes('vectorengine')) {
            let fallbackKey = process.env.ROUTERHUB_API_KEY;
            
            if (routingMode === 2 && method1Key && typeof method1Key === 'string' && method1Key.trim() !== '') {
               fallbackKey = method1Key;
               console.log(`[O&M: Proxy 容灾热切换] ${provider} 响应异常: ${err.message}。正在通过部门灾备配置重试...`);
            } else if (!fallbackKey) {
               const globalConfig = await getGlobalApiConfig();
               if (globalConfig) {
                  if (globalConfig.routingMode === 2 && globalConfig.method1Key) {
                     fallbackKey = globalConfig.method1Key;
                  } else if (globalConfig.apiKey && globalConfig.activeProvider === 'routerhub') {
                     fallbackKey = globalConfig.apiKey;
                  }
               }
               if (!fallbackKey) {
                  fallbackKey = 'sk-rh-v1-lCElzmEF4ZyXMk9HS2RgBfWAqKPbq5UL3Ro9JVXk5JE';
               }
            }
            
            if (fallbackKey) {
               usedProvider = "routerhub";
               console.log(`[O&M: Proxy Fallback] 正在自动通过 RouterHub 灾备线路重试...`);
               
               // Construct fallback RouterHub URL
               const fallbackUrlObj = new URL(`https://api.routerhub.ai${req.originalUrl}`);
               
               // Replace Headers
               const fallbackHeaders = { ...headers, "Authorization": `Bearer ${fallbackKey}` };
               delete fallbackHeaders["x-goog-api-key"];
               
               const fbOptions: RequestInit = {
                   ...fetchOptions,
                   headers: fallbackHeaders
               };
               delete fbOptions.signal;
               
               response = await fetch(fallbackUrlObj.toString(), fbOptions);
            } else {
               clearTimeout(timeoutId);
               throw err;
            }
        } else {
            clearTimeout(timeoutId);
            throw err;
        }
      } finally {
        clearTimeout(timeoutId);
      }
      
      response.headers.forEach((value, key) => {
        if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
          if (!res.headersSent) {
            try { res.setHeader(key, value); } catch (e) {}
          }
        }
      });
      if (!res.headersSent) {
        try { res.setHeader("X-Proxy-Provider", baseUrl.includes("routerhub") ? "routerhub" : "google"); } catch (e) {}
      }
      if (!res.headersSent) {
        try { res.status(response.status); } catch (e) {}
      }
      
      // 流式/分块读取代理响应，并尝试从中截获 usageMetadata 
      // 这适用于 SSE 流
      if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let promptTokens = 0;
          let candidateTokens = 0;
          let totalTokens = 0;
          let isAborted = false;

          req.on('close', () => {
            isAborted = true;
            reader.cancel().catch(() => {});
          });

          async function pump() {
            try {
              if (isAborted) return;
              const { done, value } = await reader.read();
              if (done) { 
                 if (!res.writableEnded) res.end(); 
                 
                 // Billing for chat using consolidated helper
                 if (userUuid && userUuid !== 'system' && req.method === 'POST') {
                    // Fallback estimation if usageMetadata was missed in chunks
                    if (totalTokens === 0) {
                       totalTokens = 1500; // estimated avg
                       promptTokens = 500;
                       candidateTokens = 1000;
                    }
                    
                    let providerMarker = '';
                    if (provider === 'vectorengine' && usedProvider === 'routerhub') {
                       providerMarker = '- V转R';
                    } else if (usedProvider === 'vectorengine') {
                       providerMarker = '- V';
                    } else if (usedProvider === 'routerhub') {
                       providerMarker = '- R';
                    }
                    
                    await chargeUser(userUuid, totalTokens, model, null, deptId, 'chat', promptTokens, candidateTokens, providerMarker);
                 }
                 return; 
              }
              
              const chunkStr = decoder.decode(value, { stream: true });
              
              // Robust parsing for usageMetadata in both normal and streaming JSON
              const pCountMatch = chunkStr.match(/"promptTokenCount"\s*:\s*(\d+)/);
              const cCountMatch = chunkStr.match(/"candidatesTokenCount"\s*:\s*(\d+)/);
              const tCountMatch = chunkStr.match(/"totalTokenCount"\s*:\s*(\d+)/);
              
              if (pCountMatch) promptTokens = parseInt(pCountMatch[1], 10);
              if (cCountMatch) candidateTokens = parseInt(cCountMatch[1], 10);
              if (tCountMatch) totalTokens = parseInt(tCountMatch[1], 10);
              
              if (!res.writableEnded) {
                res.write(value, (err) => {
                  if (err) {
                    reader.cancel().catch(() => {});
                  }
                });
                pump();
              }
            } catch (err: any) {
              console.error("Pump error:", err.message);
              if (!res.writableEnded && !isAborted) {
                if (!res.headersSent) {
                  res.status(500).json({ error: err.message });
                } else {
                  res.end();
                }
              }
            }
          }
          pump();
      } else {
          if (!res.writableEnded) res.end();
      }
    } catch (err: any) {
      console.error("Generic proxy error:", err);
      if (err.code === 'EPIPE' || err.message?.includes('EPIPE')) {
        console.warn("Detected EPIPE in generic proxy: client closed connection.");
        return;
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : undefined
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  // Set long timeout for VectorEngine/Proxy requests
  server.timeout = 300000;
  server.keepAliveTimeout = 300000;
}

startServer();
