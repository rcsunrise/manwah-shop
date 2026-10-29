/**
 * TianToken (词元网关) 大模型能力矩阵与注册中心
 * 集中管理系统支持的模型规格、传输协议、分辨率与功能特性
 */

export type TransportProtocol = 'openai_images' | 'google_genai';

export interface ModelCapability {
  id: string; // 模型唯一标识 (如 openai/gpt-image-2, google/gemini-3-pro-image)
  alias: string; // 简化别名 (如 gpt-image-2, gemini-3-pro-image)
  protocol: TransportProtocol; // 传输协议: openai_images 或 google_genai
  name: string; // 展示名称
  description: string; // 功能描述
  supportedAspectRatios: string[]; // 支持的比例
  bestResolutions: string[]; // 最佳长边分辨率
  features: string[]; // 支持的特性
}

export const MODEL_REGISTRY: Record<string, ModelCapability> = {
  // ================= 1. GPT 图像渲染与局部重绘系列 (openai_images 协议) =================
  'openai/gpt-image-2': {
    id: 'openai/gpt-image-2',
    alias: 'gpt-image-2',
    protocol: 'openai_images',
    name: 'GPT Image 2',
    description: '文生图、图生图、材质融合',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    bestResolutions: ['512px', '1K', '2K', '4K'],
    features: ['text_to_image', 'image_to_image', 'material_fusion'],
  },
  'openai/gpt-image-2-c': {
    id: 'openai/gpt-image-2-c',
    alias: 'gpt-image-2-c',
    protocol: 'openai_images',
    name: 'GPT Image 2-C (局部重绘)',
    description: '高精局部 Mask 重绘、前后景分离',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    bestResolutions: ['1K', '2K', '4K'],
    features: ['mask_inpainting', 'foreground_background_separation', 'image_edit'],
  },
  'openai/gpt-image-2.5-flare-c': {
    id: 'openai/gpt-image-2.5-flare-c',
    alias: 'gpt-image-2.5-flare-c',
    protocol: 'openai_images',
    name: 'GPT Image 2.5 Flare-C (超清材质)',
    description: '超清材质增强、支持 Alpha 蒙版',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    bestResolutions: ['1K', '2K', '4K'],
    features: ['material_enhancement', 'alpha_mask_support', 'mask_inpainting'],
  },
  'openai/gpt-image-2.5-sunburst-c': {
    id: 'openai/gpt-image-2.5-sunburst-c',
    alias: 'gpt-image-2.5-sunburst-c',
    protocol: 'openai_images',
    name: 'GPT Image 2.5 Sunburst-C (旗舰渲染)',
    description: '旗舰级精细渲染、光影级 Mask 重绘',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    bestResolutions: ['1K', '2K', '4K'],
    features: ['flagship_rendering', 'lighting_mask_inpainting', 'alpha_mask_support'],
  },

  // ================= 2. Gemini 多模态原生图像系列 (google_genai 协议) =================
  'google/gemini-3-pro-image': {
    id: 'google/gemini-3-pro-image',
    alias: 'gemini-3-pro-image',
    protocol: 'google_genai',
    name: 'Gemini 3 Pro Image (旗舰级)',
    description: '深度多轮推演，超高精细度旗舰渲染',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16', 'Auto'],
    bestResolutions: ['1K', '2K', '4K'],
    features: ['deep_reasoning', 'ultra_high_precision', 'multi_reference'],
  },
  'gemini-3.1-flash-image': {
    id: 'gemini-3.1-flash-image',
    alias: 'gemini-3.1-flash-image',
    protocol: 'google_genai',
    name: 'Gemini 3.1 Flash Image (通用快响)',
    description: '工业级快响通用模型，多参考图融合',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16', 'Auto'],
    bestResolutions: ['1K', '2K', '4K'],
    features: ['fast_response', 'multi_reference_fusion', 'industrial_grade'],
  },
  'gemini-2.5-flash-image': {
    id: 'gemini-2.5-flash-image',
    alias: 'gemini-2.5-flash-image',
    protocol: 'google_genai',
    name: 'Gemini 2.5 Flash Image (秒级低耗)',
    description: '秒级低耗渲染',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16'],
    bestResolutions: ['1K'],
    features: ['low_latency', 'cost_effective'],
  },
  'gemini-nano-banana-2.1-preview': {
    id: 'gemini-nano-banana-2.1-preview',
    alias: 'gemini-nano-banana-2.1-preview',
    protocol: 'google_genai',
    name: 'Gemini Nano Banana 2.1 (快速预览)',
    description: '轻量多模态快速预览',
    supportedAspectRatios: ['1:1', '3:4', '4:3', '16:9', '9:16', 'Auto'],
    bestResolutions: ['1K', '2K', '4K'],
    features: ['lightweight_preview', 'auto_ratio_restoration'],
  },
};

/**
 * 别名到模型 ID 的映射字典
 */
const ALIAS_MAP: Record<string, string> = {
  'gpt-image-2': 'openai/gpt-image-2',
  'gpt-image-2-c': 'openai/gpt-image-2-c',
  'gpt-image-2.5-flare-c': 'openai/gpt-image-2.5-flare-c',
  'gpt-image-2.5-sunburst-c': 'openai/gpt-image-2.5-sunburst-c',
  'gemini-3-pro-image': 'google/gemini-3-pro-image',
  'gemini-3-pro': 'google/gemini-3-pro-image',
  'gemini-3.1-pro': 'google/gemini-3-pro-image',
  'gemini-2.5-pro': 'google/gemini-3-pro-image',
  'gemini-3.1-flash': 'gemini-3.1-flash-image',
  'gemini-3-flash': 'gemini-3.1-flash-image',
  'gemini-2.5-flash': 'gemini-2.5-flash-image',
  'gemini-2.5-flash-image': 'gemini-2.5-flash-image',
  'google/gemini-2.5-flash-image': 'gemini-2.5-flash-image',
  'google/gemini-3.1-flash-image': 'gemini-3.1-flash-image',
  'gemini-nano-banana': 'gemini-nano-banana-2.1-preview',
  'gemini-nano-banana-2.1': 'gemini-nano-banana-2.1-preview',
};

/**
 * 查找模型规格
 */
export function findModel(modelKey: string): ModelCapability | undefined {
  if (!modelKey) return MODEL_REGISTRY['google/gemini-3-pro-image'];
  const trimmed = modelKey.trim();
  if (MODEL_REGISTRY[trimmed]) return MODEL_REGISTRY[trimmed];
  const canonical = ALIAS_MAP[trimmed.toLowerCase()];
  if (canonical && MODEL_REGISTRY[canonical]) return MODEL_REGISTRY[canonical];

  // 模糊匹配
  const lower = trimmed.toLowerCase();
  for (const [id, cap] of Object.entries(MODEL_REGISTRY)) {
    if (id.toLowerCase() === lower || cap.alias.toLowerCase() === lower) {
      return cap;
    }
  }

  return undefined;
}

/**
 * 解析模型传输协议 (openai_images | google_genai)
 */
export function resolveProtocol(modelKey: string): TransportProtocol {
  const model = findModel(modelKey);
  if (model) {
    return model.protocol;
  }
  const lower = (modelKey || '').toLowerCase();
  if (lower.includes('gpt-image') || lower.includes('dall-e') || lower.includes('openai')) {
    return 'openai_images';
  }
  return 'google_genai';
}

/**
 * 获取请求上游时使用的标准模型名
 * - TianToken (词元网关): 不带厂商前缀 (如 gemini-3-pro-image, gemini-3.1-flash-image, gemini-nano-banana-2.1-preview, gpt-image-2, gpt-image-2-c)
 * - RouterHub (灾备线路): 带厂商前缀 (如 google/gemini-3-pro-image, google/gemini-3.1-flash-image, openai/gpt-image-2)
 */
export function getUpstreamModelName(modelKey: string, protocol: TransportProtocol, provider: string): string {
  const model = findModel(modelKey);
  const cleanAlias = model
    ? (model.alias || model.id.replace(/^(google|openai)\//, ''))
    : modelKey.replace(/^(google|openai)\//, '');

  if (provider === 'routerhub') {
    if (protocol === 'openai_images') {
      // RouterHub OpenAI 图像端点需带 openai/ 前缀，且 -c 变体平滑映射至基础型号
      const baseGpt = cleanAlias.replace(/-c$/, '');
      return `openai/${baseGpt}`;
    } else {
      // RouterHub Gemini 端点需带 google/ 前缀
      if (cleanAlias.includes('nano-banana')) {
        return 'google/gemini-nano-banana-2.1';
      }
      return `google/${cleanAlias}`;
    }
  }

  // 默认词元网关 (tiantoken) / vectorengine / google：统一使用无前缀 alias
  if (cleanAlias === 'gemini-2.5-flash-image') {
    // 词元网关 /v1/models 中无独立 gemini-2.5-flash-image 通道，平滑映射至 gemini-3.1-flash-image
    return 'gemini-3.1-flash-image';
  }
  return cleanAlias;
}

