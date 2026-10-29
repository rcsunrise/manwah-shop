
export interface MaskRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MaskStroke {
  points: Point[];
  width: number;
  tool?: 'brush' | 'eraser' | 'rect' | 'polygon';
}

export interface ImageAttachment {
  id: string;
  file?: File;
  previewUrl: string;
  base64Data: string; // Raw base64 without prefix
  mimeType: string;
  width: number;
  height: number;
  isAiOptimized?: boolean;
  originalBackup?: ImageAttachment;
  maskRects?: MaskRect[];
  maskStrokes?: MaskStroke[];
  maskDataUrl?: string;
  maskOverlayUrl?: string;
}

export type SupportedAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9'; 
export type UIAspRatioOption = SupportedAspectRatio | 'Auto' | '8:5' | '21:9' | '2:1' | 'Custom'; 

export type Resolution = '1K' | '2K' | '4K' | '512px';
export type ModelType =
  | 'google/gemini-3-pro-image'
  | 'gemini-3-pro-image'
  | 'gemini-3.1-flash-image'
  | 'gemini-2.5-flash-image'
  | 'gemini-nano-banana-2.1-preview'
  | 'openai/gpt-image-2'
  | 'gpt-image-2'
  | 'openai/gpt-image-2-c'
  | 'gpt-image-2-c'
  | 'openai/gpt-image-2.5-flare-c'
  | 'gpt-image-2.5-flare-c'
  | 'openai/gpt-image-2.5-sunburst-c'
  | 'gpt-image-2.5-sunburst-c'
  | 'gemini-3-pro'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-3-flash'
  | 'gemini-3.1-flash-lite-preview'
  | 'openai/gpt-image-1'
  | 'openai/gpt-image-1.5'
  | 'routerhub/flux'
  | 'routerhub/midjourney';

export interface GenerationConfig {
  prompt: string;
  aspectRatio: UIAspRatioOption | string; 
  resolution: Resolution;
  model: ModelType;
  seed?: number;
}

export interface GeneratedResult {
  imageUrl: string;
  prompt: string;
  timestamp: number;
  duration?: number;
  aspectRatio?: string;
}

export type ChannelStatus = 'idle' | 'waiting' | 'generating' | 'success' | 'error';

export interface GenerationTask {
  id: string;
  channelId: number;
  channelName: string;
  status: ChannelStatus;
  result: GeneratedResult | null;
  error?: string;
  startTime?: number;
  model?: ModelType;
  resolution?: Resolution;
  duration?: number;
  pointsUsed?: number;
  dimensions?: { width: number, depth: number, height: number };
  measurements?: {
    pixelWFront: number;
    pixelWSide: number;
    pixelHSide: number;
    calculatedD: number;
    calculatedH: number;
    mmPerPx: number;
  };
  labelAlignmentMode?: 'default' | 'locked';
  isBetaRedraw?: boolean;
}

export interface ProcessingChannel {
  id: number;
  name: string;
  images: ImageAttachment[];
  isEnabled: boolean;
  status: ChannelStatus;
  result: GeneratedResult | null;
  error?: string;
  measurements?: {
    pixelWFront: number;
    pixelWSide: number;
    pixelHSide: number;
    calculatedD: number;
    calculatedH: number;
    mmPerPx: number;
  };
}

// New Types for Storage and Templates
export interface PromptTemplate {
  id: string;
  name: string;
  content: string;
  role?: string; // Saved role context
  timestamp: number;
}

export interface HistoryItem {
  id: string;
  imageUrl: string; // Base64
  prompt: string;
  roleUsed?: string;
  model: ModelType;
  timestamp: number;
  size: number; // Size in bytes
  duration?: number;
  aspectRatio?: string;
}

export interface PHYAttribute {
  name: string;
  value: number; // 0-100
  label: string;
  description: string;
}

export interface LocalDimension {
  part: string;
  value: string;
  description?: string;
}

export interface AEPData {
  trendScore: number;
  style: string;
  l2_structure: string[];
  l3_material: string[];
  phy: {
    glossiness: number;
    roughness: number;
    visualWeight: number;
  };
  marketingCopy: string;
  marketingStory?: string; // New field for emotional narrative
  keywords: string[]; // Extracted keywords for prompt generation
  dimensionEstimate?: {
    estW: number;
    estD: number;
    estH: number;
    confidence: number;
    category: string;
  };
  localDimensions?: LocalDimension[];
}

export interface StorageStats {
  usedBytes: number;
  fileCount: number;
}

export interface Profile {
  id: string;
  username: string;
  role: 'admin' | 'user';
  employee_id?: string;
  quota_limit: number;
  quota_used: number;
}

export interface AdminNote {
  id: number;
  content: string;
  updated_at: string;
  updated_by_name: string;
}

export const MAX_HISTORY_TASKS = 20;