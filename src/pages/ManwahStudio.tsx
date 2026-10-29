import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Sliders, 
  Download, 
  RefreshCw, 
  Plus, 
  Check, 
  Trash2, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  ShieldCheck, 
  Box,
  LayoutGrid,
  Wand2,
  SlidersHorizontal,
  History,
  FolderPlus,
  ArrowRight,
  Maximize2,
  X,
  FileImage,
  MonitorPlay,
  Settings,
  Users,
  UserCircle,
  ChevronRight,
  Eye,
  ZoomIn,
  ZoomOut,
  MoveVertical,
  Move,
  RotateCcw,
  Hand,
  Minimize2,
  Edit2,
  AlertTriangle,
  Loader2,
  Armchair,
  Package
} from 'lucide-react';
import { supabase, uploadImageToSupabase } from '../lib/supabase';
import { dbService } from '../services/dbService';
import { generateImageFromRouterHub } from '../services/routerHubService';
import { HistoryModal } from '../components/HistoryModalNew';
import { HistoryItem } from '../types';

// 预设家具产品接口
export interface ProductItem {
  id: string;
  name: string;
  category: 'sofa' | 'chair' | 'table' | 'dining' | 'bed' | 'other';
  categoryLabel: string;
  imageUrl: string;
  description: string;
  tags?: string[];
  isCustom?: boolean;
}

// 默认占位图：避免外部链接失效显示损坏图标
const FALLBACK_PRODUCT_IMG = '/presets/products/sofa_burgundy.jpg';

// 官方精选高质量预设家具素材（本地常驻持久化，不依赖外部链接）
export const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-sofa-burgundy',
    name: 'MH 勃艮第红真皮沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_burgundy.jpg',
    description: '精选质感真皮面料，搭配优雅勃艮第红，扶手内侧经典拉扣设计，融合意式现代与复古美学，金属高脚稳固支撑。',
    tags: ['经典热销', '意式奢华'],
    isCustom: false
  },
  {
    id: 'prod-sofa-saddle',
    name: 'MH 意式奢华马鞍扣真皮沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_saddle_leather.jpg',
    description: '精选优质头层牛皮，触感温润细腻。独特的马鞍皮扣带设计，融合意式现代美学，宽大饱满的软包填充带来极致包裹感。',
    tags: ['意式匠造', '马鞍皮扣'],
    isCustom: false
  },
  {
    id: 'prod-sofa-executive',
    name: 'MH 尊享系列真皮沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_executive.jpg',
    description: '精选优质真皮面料，分段式靠背与饱满坐垫设计，提供极佳的承托力与舒适度，扶手处点缀金属饰条，彰显现代轻奢质感。',
    tags: ['商务尊享', '头层牛皮'],
    isCustom: false
  },
  {
    id: 'prod-sofa-orange',
    name: 'MH 暖橘弧光布艺沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_warm_orange.jpg',
    description: '精选亲肤微绒面料，温暖橘调搭配圆润饱满的弧形线条，尽显现代意式慵懒风，配备舒适腰枕，打造温馨惬意客厅。',
    tags: ['温暖雅致', '弧形设计'],
    isCustom: false
  },
  {
    id: 'prod-sofa-recliner',
    name: 'MH 舒享织物多功能沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_fabric_recliner.jpg',
    description: '精选亲肤质感织物面料，双侧配备可调节功能脚托，人体工学分段式靠背设计，带来极致的包裹感与舒适坐感。',
    tags: ['功能头等舱', '多档调节'],
    isCustom: false
  },
  {
    id: 'prod-sofa-italian-wide',
    name: '意式极简宽体真皮沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_italian_wide.jpg',
    description: '精选优质皮质包裹，沉稳配色，搭配饱满拉点靠背与宽大扶手设计，兼顾承托力与舒适度，尽显现代意式奢华质感。',
    tags: ['意式极简', '大座深'],
    isCustom: false
  },
  {
    id: 'prod-sofa-boucle',
    name: 'MH 奶油风舒柔云朵沙发',
    category: 'sofa',
    categoryLabel: '豪华沙发',
    imageUrl: '/presets/products/sofa_cream_boucle.jpg',
    description: '柔糯亲肤质感布艺，搭配饱满云朵造型与低重心座感设计，温柔治愈，完美契合奶油风与现代原木风空间。',
    tags: ['奶油风', '云朵坐感'],
    isCustom: false
  },
  {
    id: 'prod-chair-lounge',
    name: 'MH 头等舱真皮电动单椅',
    category: 'chair',
    categoryLabel: '休闲单椅',
    imageUrl: '/presets/products/chair_lounge_recliner.jpg',
    description: '头层牛皮包覆，电动智能躺角调节，贴合人体脊椎工学弧度，独享沉浸式放松时光。',
    tags: ['电动躺椅', '独享休闲'],
    isCustom: false
  },
  {
    id: 'prod-table-slate',
    name: 'MH 轻奢大理石岩板茶几',
    category: 'table',
    categoryLabel: '雅致茶几',
    imageUrl: '/presets/products/table_marble_slate.jpg',
    description: '耐磨耐高温奢华岩板台面，金属精工底座，高低错落双子星造型，提升客厅空间层次感。',
    tags: ['岩板轻奢', '现代简约'],
    isCustom: false
  },
  {
    id: 'prod-dining-modern',
    name: 'MH 意式极简岩板餐桌椅',
    category: 'dining',
    categoryLabel: '臻选餐桌',
    imageUrl: '/presets/products/table_dining_modern.jpg',
    description: '食品级超薄岩板桌面，搭配流线型金属桌腿与人体工学餐椅，打造优雅舒适的家庭就餐环境。',
    tags: ['意式餐厨', '岩板台面'],
    isCustom: false
  },
  {
    id: 'prod-bed-luxury',
    name: 'MH 尊享真皮储物软床',
    category: 'bed',
    categoryLabel: '软床寝具',
    imageUrl: '/presets/products/bed_leather_luxury.jpg',
    description: '头层牛皮齐边床头设计，高回弹饱满靠包，静音气动高箱大储物空间，静享安心深度睡眠。',
    tags: ['真皮软床', '大容量储物'],
    isCustom: false
  }
];

// 预设经典空间实景示范图（本地常驻持久化，不依赖外部链接）
export const SAMPLE_SCENES: any[] = [
  {
    name: '意式复古暖调客厅',
    url: '/presets/scenes/scene_italian_warm.jpg',
    desc: '空间以米白与深棕为主调，意式皮革沙发搭配黑色造型茶几与黑白提花脚凳。多层次暖色点光源与透光纱帘交相辉映，烘托出优雅温馨的高质感居家氛围。'
  },
  {
    name: '暖调奶油风原木客餐厅',
    url: '/presets/scenes/scene_cream_wood.jpg',
    desc: '以米白与自然木色为主调，搭配蓝调地毯与复古椅作点缀。造型独特的纸艺落地灯与柔和局部光源交相辉映，营造出极具治愈感的温馨生活氛围。'
  },
  {
    name: '现代简约风客餐厅空间',
    url: '/presets/scenes/scene_modern_minimal.jpg',
    desc: '空间通透开阔，采用灰色大理石纹地砖搭配纯白墙面，简约的吊顶与射灯设计营造出明亮的光影效果，原木色玻璃门为现代冷色调空间注入一丝自然温馨。'
  },
  {
    name: '现代温馨轻奢客厅实景',
    url: '/presets/scenes/scene_modern_luxury.jpg',
    desc: '空间以暖咖色与米白色为主调，皮质沙发搭配木质格栅背景墙，尽显现代雅致。多层次的暖色灯光与线性灯带交织，营造出温馨舒适的居家氛围。'
  },
  {
    name: '治愈系温润奶油风客厅',
    url: '/presets/scenes/scene_healing_cream.jpg',
    desc: '空间以柔和的奶油白与原木色为主调，大面积落地窗引入充沛自然光。搭配温暖的局部照明与红色软装点缀，营造出治愈且富有生活气息的温馨居室氛围。'
  },
  {
    name: '品质通透现代客餐厅',
    url: '/presets/scenes/scene_open_living.jpg',
    desc: '开放式客餐厅设计，大平层通透采光，大理石地砖与自然暖光融合，呈现宽广舒适的品质家居环境。'
  }
];

// 客户端资产缓存版本号（递增此版本号可彻底自动刷新客户端过期的旧缓存与裂图）
const ASSET_CACHE_VERSION = '20261012_v3';

// 官方预设家具及场景字典速查映射表（高内聚、绝对可靠的本地静态路径）
const PRODUCT_PRESET_MAP: Record<string, string> = {
  'prod-sofa-burgundy': '/presets/products/sofa_burgundy.jpg',
  'prod-sofa-saddle': '/presets/products/sofa_saddle_leather.jpg',
  'prod-sofa-executive': '/presets/products/sofa_executive.jpg',
  'prod-sofa-orange': '/presets/products/sofa_warm_orange.jpg',
  'prod-sofa-recliner': '/presets/products/sofa_fabric_recliner.jpg',
  'prod-sofa-italian-wide': '/presets/products/sofa_italian_wide.jpg',
  'prod-sofa-boucle': '/presets/products/sofa_cream_boucle.jpg',
  'prod-chair-lounge': '/presets/products/chair_lounge_recliner.jpg',
  'prod-table-slate': '/presets/products/table_marble_slate.jpg',
  'prod-dining-modern': '/presets/products/table_dining_modern.jpg',
  'prod-bed-luxury': '/presets/products/bed_leather_luxury.jpg',
};

const SCENE_PRESET_MAP: Record<string, string> = {
  '意式复古暖调客厅': '/presets/scenes/scene_italian_warm.jpg',
  '暖调奶油风原木客餐厅': '/presets/scenes/scene_cream_wood.jpg',
  '现代简约风客餐厅空间': '/presets/scenes/scene_modern_minimal.jpg',
  '现代温馨轻奢客厅实景': '/presets/scenes/scene_modern_luxury.jpg',
  '治愈系温润奶油风客厅': '/presets/scenes/scene_healing_cream.jpg',
  '品质通透现代客餐厅': '/presets/scenes/scene_open_living.jpg',
};

// 检查链接是否为失效/损坏/旧云存储/SVG占位
export const isBrokenImageUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string' || !url.trim()) return true;
  if (url.includes('supabase.co')) return true; // 所有旧 Supabase 链接均已在云端 404
  if (url.startsWith('data:image/svg')) return true; // 旧版占位符
  if (url.includes('placeholder')) return true;
  return false;
};

// 自动检测并修复失效/损坏的素材链接
export const healProductImageUrl = (p: ProductItem): string => {
  if (!p) return '/presets/products/sofa_burgundy.jpg';
  
  // 1. 如果匹配官方预设 ID，始终强制返回官方高精本地素材路径
  if (p.id && PRODUCT_PRESET_MAP[p.id]) {
    return PRODUCT_PRESET_MAP[p.id];
  }

  // 2. 如果包含已知失效外部链接、旧云端储存桶或占位图
  if (isBrokenImageUrl(p.imageUrl)) {
    const name = p.name || '';
    if (name.includes('勃艮第红')) return '/presets/products/sofa_burgundy.jpg';
    if (name.includes('马鞍扣')) return '/presets/products/sofa_saddle_leather.jpg';
    if (name.includes('尊享')) return '/presets/products/sofa_executive.jpg';
    if (name.includes('暖橘') || name.includes('弧光')) return '/presets/products/sofa_warm_orange.jpg';
    if (name.includes('舒享') || name.includes('多功能')) return '/presets/products/sofa_fabric_recliner.jpg';
    if (name.includes('宽体') || name.includes('极简')) return '/presets/products/sofa_italian_wide.jpg';
    if (name.includes('云朵') || name.includes('奶油')) return '/presets/products/sofa_cream_boucle.jpg';
    if (p.category === 'chair' || name.includes('单椅') || name.includes('躺椅')) return '/presets/products/chair_lounge_recliner.jpg';
    if (p.category === 'table' || name.includes('茶几')) return '/presets/products/table_marble_slate.jpg';
    if (p.category === 'dining' || name.includes('餐桌')) return '/presets/products/table_dining_modern.jpg';
    if (p.category === 'bed' || name.includes('床')) return '/presets/products/bed_leather_luxury.jpg';
    return '/presets/products/sofa_burgundy.jpg';
  }

  return p.imageUrl;
};

export const healSceneImageUrl = (s: any): string => {
  if (!s) return '/presets/scenes/scene_italian_warm.jpg';
  const name = s?.name || '';
  if (SCENE_PRESET_MAP[name]) {
    return SCENE_PRESET_MAP[name];
  }
  if (isBrokenImageUrl(s?.url)) {
    if (name.includes('奶油风') || name.includes('原木')) return '/presets/scenes/scene_cream_wood.jpg';
    if (name.includes('现代简约') || name.includes('大理石')) return '/presets/scenes/scene_modern_minimal.jpg';
    if (name.includes('轻奢') || name.includes('现代温馨')) return '/presets/scenes/scene_modern_luxury.jpg';
    if (name.includes('治愈系') || name.includes('温润')) return '/presets/scenes/scene_healing_cream.jpg';
    if (name.includes('品质') || name.includes('通透')) return '/presets/scenes/scene_open_living.jpg';
    return '/presets/scenes/scene_italian_warm.jpg';
  }
  return s.url;
};

// 旧版示范素材 ID/URL 列表
const OLD_SAMPLE_PRODUCT_IDS = ['mh-s01', 'mh-s02', 'mh-c01', 'mh-c02', 'mh-t01', 'mh-d01', 'mh-b01'];
const OLD_SAMPLE_SCENE_URLS: string[] = [];

export default function ManwahStudio() {
  const navigate = useNavigate();
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('role').eq('id', user.id).single()
          .then(({ data }) => {
            if (data?.role === 'admin' || data?.role === 'dept_admin') {
              setIsAdmin(true);
            }
          });
      }
    });
  }, []);

  const settingsItems = [
    { id: 'dashboard', label: '控制台', icon: <LayoutGrid size={15} />, path: '/dashboard' },
    ...(isAdmin ? [
      { id: 'users', label: '员工管理', icon: <Users size={15} />, path: '/admin/users' },
      { id: 'billing', label: '数据审计', icon: <LayoutGrid size={15} />, path: '/admin/billing' }
    ] : []),
    { id: 'profile', label: '个人中心', icon: <UserCircle size={15} />, path: '/profile' }
  ];

  // 选品相关状态（版本化控制：如果是新版本或检测到旧缓存损坏，自动无缝切换至高质感官方预设库）
  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const ver = localStorage.getItem('MANWAH_ASSETS_VERSION');
      if (ver === ASSET_CACHE_VERSION) {
        const saved = localStorage.getItem('MANWAH_CUSTOM_PRODUCTS');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed
              .filter(p => p && p.id && !OLD_SAMPLE_PRODUCT_IDS.includes(p.id))
              .map(p => ({ ...p, imageUrl: healProductImageUrl(p) }));
            if (clean.length > 0) return clean;
          }
        }
      }
    } catch (e) {}
    return INITIAL_PRODUCTS;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(() => {
    try {
      const ver = localStorage.getItem('MANWAH_ASSETS_VERSION');
      if (ver === ASSET_CACHE_VERSION) {
        const saved = localStorage.getItem('MANWAH_CUSTOM_PRODUCTS');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed
              .filter(p => p && p.id && !OLD_SAMPLE_PRODUCT_IDS.includes(p.id))
              .map(p => ({ ...p, imageUrl: healProductImageUrl(p) }));
            if (clean.length > 0) return clean[0];
          }
        }
      }
    } catch (e) {}
    return INITIAL_PRODUCTS.length > 0 ? INITIAL_PRODUCTS[0] : null;
  });
  const [selectionMode, setSelectionMode] = useState<'catalog' | 'ai' | 'custom'>('catalog');

  // 客户场景图相关状态（版本化控制）
  const [sampleScenes, setSampleScenes] = useState<any[]>(() => {
    try {
      const ver = localStorage.getItem('MANWAH_ASSETS_VERSION');
      if (ver === ASSET_CACHE_VERSION) {
        const saved = localStorage.getItem('MANWAH_CUSTOM_SCENES');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed
              .filter(s => s && s.url && !OLD_SAMPLE_SCENE_URLS.includes(s.url))
              .map(s => ({ ...s, url: healSceneImageUrl(s) }));
            if (clean.length > 0) return clean;
          }
        }
      }
    } catch (e) {}
    return SAMPLE_SCENES;
  });
  const [sceneImageUrl, setSceneImageUrl] = useState<string>(() => {
    try {
      const ver = localStorage.getItem('MANWAH_ASSETS_VERSION');
      if (ver === ASSET_CACHE_VERSION) {
        const savedCurr = localStorage.getItem('MANWAH_CURRENT_SCENE_URL');
        if (savedCurr && !OLD_SAMPLE_SCENE_URLS.includes(savedCurr) && !isBrokenImageUrl(savedCurr)) {
          return savedCurr;
        }
        const saved = localStorage.getItem('MANWAH_CUSTOM_SCENES');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const clean = parsed
              .filter(s => s && s.url && !OLD_SAMPLE_SCENE_URLS.includes(s.url))
              .map(s => ({ ...s, url: healSceneImageUrl(s) }));
            if (clean.length > 0) return clean[0].url;
          }
        }
      }
    } catch (e) {}
    return SAMPLE_SCENES.length > 0 ? SAMPLE_SCENES[0].url : '/presets/scenes/scene_italian_warm.jpg';
  });

  useEffect(() => {
    if (sceneImageUrl && !isBrokenImageUrl(sceneImageUrl)) {
      try {
        localStorage.setItem('MANWAH_CURRENT_SCENE_URL', sceneImageUrl);
      } catch (e) {}
    }
  }, [sceneImageUrl]);
  const [customProductImage, setCustomProductImage] = useState<string | null>(null);

  // === 弹窗确认框与上传加载状态 ===
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [uploadingProductImg, setUploadingProductImg] = useState<boolean>(false);
  const [uploadingSceneImg, setUploadingSceneImg] = useState<boolean>(false);

  // === 持久化更新辅助函数 ===
  const updateProductsList = (newProducts: ProductItem[] | ((prev: ProductItem[]) => ProductItem[])) => {
    setProducts(prev => {
      const nextRaw = typeof newProducts === 'function' ? newProducts(prev) : newProducts;
      const next = (nextRaw || []).filter(p => p && p.id);
      try {
        localStorage.setItem('MANWAH_CUSTOM_PRODUCTS', JSON.stringify(next));
      } catch (e) {}
      dbService.saveAppData('MANWAH_CUSTOM_PRODUCTS', next).catch(() => {});
      // 同步持久化保存至 Supabase 数据后端 system_settings 表
      fetch('/api/app-data/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'MANWAH_CUSTOM_PRODUCTS', value: JSON.stringify(next) })
      }).catch(() => {});
      return next;
    });
  };

  const updateSampleScenesList = (newScenes: any[] | ((prev: any[]) => any[])) => {
    setSampleScenes(prev => {
      const nextRaw = typeof newScenes === 'function' ? newScenes(prev) : newScenes;
      const next = (nextRaw || []).filter(s => s && s.url);
      try {
        localStorage.setItem('MANWAH_CUSTOM_SCENES', JSON.stringify(next));
      } catch (e) {}
      dbService.saveAppData('MANWAH_CUSTOM_SCENES', next).catch(() => {});
      // 同步持久化保存至 Supabase 数据后端 system_settings 表
      fetch('/api/app-data/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'MANWAH_CUSTOM_SCENES', value: JSON.stringify(next) })
      }).catch(() => {});
      return next;
    });
  };

  // === 预设素材（选品库）编辑/新增状态 ===
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'sofa',
    imageUrl: '',
    description: '',
    tagsStr: ''
  });

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      category: selectedCategory === 'all' ? 'sofa' : selectedCategory,
      imageUrl: '',
      description: '',
      tagsStr: '现代简约, 高品质'
    });
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (e: React.MouseEvent, p: ProductItem) => {
    e.stopPropagation();
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      description: p.description || '',
      tagsStr: (p.tags || []).join(', ')
    });
    setProductModalOpen(true);
  };

  const handleDeleteProduct = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: '确认删除家具素材',
      message: '确定要删除这款预设家具素材吗？删除后不仅本地生效，并且会从当前选配素材库中永久移除。',
      onConfirm: () => {
        updateProductsList(prev => {
          const next = prev.filter(p => p.id !== id);
          if (selectedProduct?.id === id) {
            setSelectedProduct(next[0] || null);
          }
          return next;
        });
        try {
          supabase.from('products').delete().eq('id', id).then();
        } catch (err) {}
        setConfirmDialog(null);
      }
    });
  };

  const handleSaveProduct = () => {
    if (!productForm.name.trim() || !productForm.imageUrl.trim()) {
      setConfirmDialog({
        isOpen: true,
        title: '提示：信息不完整',
        message: '请至少填写产品名称和图片链接（或从右侧选择本地图片上传）',
        onConfirm: () => setConfirmDialog(null)
      });
      return;
    }
    const tags = productForm.tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    
    if (editingProduct) {
      updateProductsList(prev => prev.map(p => {
        if (p.id === editingProduct.id) {
          const updated: ProductItem = {
            ...p,
            name: productForm.name.trim(),
            category: productForm.category as any,
            categoryLabel: getCategoryLabel(productForm.category),
            imageUrl: productForm.imageUrl.trim(),
            description: productForm.description.trim(),
            tags
          };
          if (selectedProduct?.id === p.id) {
            setSelectedProduct(updated);
          }
          try {
            supabase.from('products').upsert([{
              id: updated.id,
              name: updated.name,
              category: updated.category,
              image_url: updated.imageUrl,
              description: updated.description
            }]).then();
          } catch (err) {}
          return updated;
        }
        return p;
      }));
    } else {
      const newP: ProductItem = {
        id: `custom-${Date.now()}`,
        name: productForm.name.trim(),
        category: productForm.category as any,
        categoryLabel: getCategoryLabel(productForm.category),
        imageUrl: productForm.imageUrl.trim(),
        description: productForm.description.trim(),
        tags,
        isCustom: true
      };
      updateProductsList(prev => [newP, ...prev]);
      setSelectedProduct(newP);
      try {
        supabase.from('products').insert([{
          id: newP.id,
          name: newP.name,
          category: newP.category,
          image_url: newP.imageUrl,
          description: newP.description
        }]).then();
      } catch (err) {}
    }
    setProductModalOpen(false);
  };

  const handleProductModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingProductImg(true);
      try {
        const url = await uploadImageToSupabase(file);
        if (url) {
          setProductForm(prev => ({ ...prev, imageUrl: url }));
        } else {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) {
              setProductForm(prev => ({ ...prev, imageUrl: evt.target.result as string }));
            }
          };
          reader.readAsDataURL(file);
        }
      } finally {
        setUploadingProductImg(false);
      }
    }
  };

  const handleResetProducts = () => {
    setConfirmDialog({
      isOpen: true,
      title: '一键恢复系统默认家具库',
      message: '确定要重置家具选品库为官方系统默认素材吗？您自定义添加或修改的数据将清空重置。',
      onConfirm: () => {
        localStorage.setItem('MANWAH_ASSETS_VERSION', ASSET_CACHE_VERSION);
        localStorage.setItem('MANWAH_CUSTOM_PRODUCTS', JSON.stringify(INITIAL_PRODUCTS));
        dbService.saveAppData('MANWAH_CUSTOM_PRODUCTS', INITIAL_PRODUCTS).catch(() => {});
        fetch('/api/app-data/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'MANWAH_CUSTOM_PRODUCTS', value: JSON.stringify(INITIAL_PRODUCTS) })
        }).catch(() => {});
        setProducts(INITIAL_PRODUCTS);
        setSelectedProduct(INITIAL_PRODUCTS[0]);
        setConfirmDialog(null);
      }
    });
  };

  // === 预设场景图（演示例图）编辑/新增状态 ===
  const [sceneModalOpen, setSceneModalOpen] = useState<boolean>(false);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number | null>(null);
  const [sceneForm, setSceneForm] = useState({
    name: '',
    url: '',
    desc: ''
  });

  const handleOpenAddScene = () => {
    setEditingSceneIndex(null);
    setSceneForm({ name: '', url: '', desc: '现代精装空间实景' });
    setSceneModalOpen(true);
  };

  const handleOpenEditScene = (e: React.MouseEvent, index: number, sc: any) => {
    e.stopPropagation();
    setEditingSceneIndex(index);
    setSceneForm({
      name: sc.name || '',
      url: sc.url || '',
      desc: sc.desc || ''
    });
    setSceneModalOpen(true);
  };

  const handleDeleteScene = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setConfirmDialog({
      isOpen: true,
      title: '确认删除示范场景',
      message: '确定要删除这个预设演示场景图吗？删除后将从当前快速演示例图中移除。',
      onConfirm: () => {
        updateSampleScenesList(prev => {
          const next = prev.filter((_, idx) => idx !== index);
          if (sceneImageUrl === prev[index]?.url) {
            if (next.length > 0 && next[0]) {
              setSceneImageUrl(next[0].url || '');
              try { localStorage.setItem('MANWAH_CURRENT_SCENE_URL', next[0].url || ''); } catch (e) {}
            } else {
              setSceneImageUrl('');
              try { localStorage.removeItem('MANWAH_CURRENT_SCENE_URL'); } catch (e) {}
            }
          }
          return next;
        });
        setConfirmDialog(null);
      }
    });
  };

  const handleSaveScene = () => {
    if (!sceneForm.name.trim() || !sceneForm.url.trim()) {
      setConfirmDialog({
        isOpen: true,
        title: '提示：信息不完整',
        message: '请填写场景名称和图片链接（或从本地选择空间照片上传）',
        onConfirm: () => setConfirmDialog(null)
      });
      return;
    }
    if (editingSceneIndex !== null) {
      updateSampleScenesList(prev => prev.map((sc, idx) => {
        if (idx === editingSceneIndex) {
          const updated = {
            ...sc,
            name: sceneForm.name.trim(),
            url: sceneForm.url.trim(),
            desc: sceneForm.desc.trim()
          };
          if (sceneImageUrl === sc.url) {
            setSceneImageUrl(updated.url);
          }
          return updated;
        }
        return sc;
      }));
    } else {
      const newSc = {
        name: sceneForm.name.trim(),
        url: sceneForm.url.trim(),
        desc: sceneForm.desc.trim()
      };
      updateSampleScenesList(prev => [...prev, newSc]);
      setSceneImageUrl(newSc.url);
    }
    setSceneModalOpen(false);
  };

  const handleSceneModalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingSceneImg(true);
      try {
        const url = await uploadImageToSupabase(file);
        if (url) {
          setSceneForm(prev => ({ ...prev, url: url }));
        } else {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) {
              setSceneForm(prev => ({ ...prev, url: evt.target.result as string }));
            }
          };
          reader.readAsDataURL(file);
        }
      } finally {
        setUploadingSceneImg(false);
      }
    }
  };

  const handleResetScenes = () => {
    setConfirmDialog({
      isOpen: true,
      title: '恢复默认示范场景',
      message: '确定要重置快速演示例图为系统默认示范场景吗？您自定义新增的图片将会重置。',
      onConfirm: () => {
        localStorage.setItem('MANWAH_ASSETS_VERSION', ASSET_CACHE_VERSION);
        localStorage.setItem('MANWAH_CUSTOM_SCENES', JSON.stringify(SAMPLE_SCENES));
        localStorage.setItem('MANWAH_CURRENT_SCENE_URL', SAMPLE_SCENES[0].url);
        dbService.saveAppData('MANWAH_CUSTOM_SCENES', SAMPLE_SCENES).catch(() => {});
        fetch('/api/app-data/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'MANWAH_CUSTOM_SCENES', value: JSON.stringify(SAMPLE_SCENES) })
        }).catch(() => {});
        setSampleScenes(SAMPLE_SCENES);
        setSceneImageUrl(SAMPLE_SCENES.length > 0 ? SAMPLE_SCENES[0].url : '');
        setConfirmDialog(null);
      }
    });
  };

  // 折叠手风琴与独立展开状态
  const [openSections, setOpenSections] = useState<{ selection: boolean; scene: boolean; advanced: boolean }>({
    selection: true,
    scene: true,
    advanced: false
  });
  const toggleSection = (key: 'selection' | 'scene' | 'advanced') => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const openSection = openSections.selection ? 'selection' : openSections.scene ? 'scene' : 'advanced';

  // 高级设置状态
  const [engineModel, setEngineModel] = useState<string>('google/gemini-3-pro-image');
  const [resolution, setResolution] = useState<string>('2K');
  const [promptConstraint, setPromptConstraint] = useState<string>(
    '保持原图中的挂画不变。移除2号窗区域内的主体物品、现有家具、地毯与装饰物（画面中人物、客厅全部沙发、地毯、餐厅餐桌、餐椅。其他保持不变），保留原有装修风格。将1号窗内全部家具/主体放置至2号窗内“移除家具、地毯及装饰物”的区域。保持图2呈现的原有空间光影观感与画面尺寸，保留整体细节与外观，维持比例和透视关系，自然营造柔和光影效果。Remove the main objects, existing furniture, carpets, and decorations from the space within window 2, while preserving the original decorating style. Place all the furniture from window 1 into the "Remove Furniture, Carpets, and Decorations" space within window 2. Maintain the original spatial lighting perception and image size as shown in Figure 2. Preserve overall details and appearance, maintain proportions and perspective, and naturally create a soft lighting effect.'
  );

  // 图像生成与处理状态
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('auto');
  const [detectedSceneRatio, setDetectedSceneRatio] = useState<string>('4:3');
  const [generationElapsed, setGenerationElapsed] = useState<number>(0);
  const [activeHistoryItem, setActiveHistoryItem] = useState<HistoryItem | null>(null);

  // 自动监测“2. 客户实景空间”中当前选中或上传的图片比例
  useEffect(() => {
    if (!sceneImageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        const supported = [
          { id: '1:1', val: 1 },
          { id: '3:4', val: 0.75 },
          { id: '4:3', val: 1.33 },
          { id: '9:16', val: 0.56 },
          { id: '16:9', val: 1.77 }
        ];
        const closest = supported.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).id;
        setDetectedSceneRatio(closest);
      }
    };
    img.onerror = () => {};
    img.src = sceneImageUrl;
  }, [sceneImageUrl]);

  // 对比滑块位置 (0-100)
  const [compareSliderPos, setCompareSliderPos] = useState<number>(50);
  const [isComparing, setIsComparing] = useState<boolean>(false);

  // 弹窗控制与历史数据
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);

  // 加载历史记录
  const loadHistory = async () => {
    try {
      const items = await dbService.getHistory();
      setHistoryItems(items);
    } catch (err) {
      console.warn('Failed to fetch history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [showHistoryModal]);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    let timer: any = null;
    if (isGenerating) {
      timer = setInterval(() => {
        setGenerationElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setGenerationElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  // 新产品上传表单状态
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState<'sofa' | 'chair' | 'table' | 'dining' | 'bed' | 'other'>('sofa');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductImg, setNewProductImg] = useState('');

  // 批量上传状态
  const [bulkUploadTasks, setBulkUploadTasks] = useState<{id: string, file: File, preview: string, status: 'pending'|'uploading'|'analyzing'|'done'|'error', progress?: number, name?: string}[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkEntryType, setBulkEntryType] = useState<'product' | 'scene'>('product');

  // 图像放大查看/视窗大小选项与拖曳状态
  const [previewModalImage, setPreviewModalImage] = useState<{ url: string; title?: string; desc?: string } | null>(null);
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [isDraggingScene, setIsDraggingScene] = useState<boolean>(false);
  const [isDraggingCustom, setIsDraggingCustom] = useState<boolean>(false);
  const [isDraggingBulk, setIsDraggingBulk] = useState<boolean>(false);

  // 窗口与面板边缘下拉缩放及拖动控制状态
  const [enableEdgeResize, setEnableEdgeResize] = useState<boolean>(true);
  const [selectionHeight, setSelectionHeight] = useState<number>(280);
  const [sceneHeight, setSceneHeight] = useState<number>(240);
  const [advancedHeight, setAdvancedHeight] = useState<number>(380);
  const [canvasHeight, setCanvasHeight] = useState<number>(540);
  const [bulkHeight, setBulkHeight] = useState<number>(240);

  const [resizingTarget, setResizingTarget] = useState<string | null>(null);
  const [resizingStartY, setResizingStartY] = useState<number>(0);
  const [resizingStartHeight, setResizingStartHeight] = useState<number>(0);

  // 画布中效果图与参考图的鼠标滚轮缩放及拖曳漫游状态
  const [canvasZoom, setCanvasZoom] = useState<number>(1);
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isCanvasDragging, setIsCanvasDragging] = useState<boolean>(false);
  const [canvasDragStart, setCanvasDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // 缩略图滚轮实时缩放比例映射表 (imgUrl -> scale)
  const [thumbnailScaleMap, setThumbnailScaleMap] = useState<Record<string, number>>({});

  const startResize = (e: React.MouseEvent, target: string, currentHeight: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingTarget(target);
    setResizingStartY(e.clientY);
    setResizingStartHeight(currentHeight);
  };

  const handleThumbnailWheel = (e: React.WheelEvent, imgUrl: string) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setThumbnailScaleMap(prev => {
      const current = prev[imgUrl] || 1;
      const next = Math.max(0.5, Math.min(3.5, current + delta));
      return { ...prev, [imgUrl]: next };
    });
  };

  const handleCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setCanvasZoom(prev => {
      const next = Math.max(0.5, Math.min(5, prev + delta));
      if (next === 1) setCanvasPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (canvasZoom > 1) {
      e.preventDefault();
      setIsCanvasDragging(true);
      setCanvasDragStart({ x: e.clientX - canvasPan.x, y: e.clientY - canvasPan.y });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isCanvasDragging && canvasZoom > 1) {
      setCanvasPan({
        x: e.clientX - canvasDragStart.x,
        y: e.clientY - canvasDragStart.y
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsCanvasDragging(false);
  };

  // 移动端 Touch 触控优化：支持 Pinch 捏合缩放与 1:1 默认下流畅单指页面垂直滚动
  const touchStartRef = useRef<{ dist: number; zoom: number; panX: number; panY: number; startX: number; startY: number } | null>(null);

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      // 双指 Pinch 捏合
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = {
        dist,
        zoom: canvasZoom,
        panX: canvasPan.x,
        panY: canvasPan.y,
        startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        startY: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
    } else if (e.touches.length === 1 && canvasZoom > 1) {
      // 图片在放大状态下，单指平移拖拽视窗
      setIsCanvasDragging(true);
      setCanvasDragStart({
        x: e.touches[0].clientX - canvasPan.x,
        y: e.touches[0].clientY - canvasPan.y
      });
      touchStartRef.current = {
        dist: 0,
        zoom: canvasZoom,
        panX: canvasPan.x,
        panY: canvasPan.y,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY
      };
    } else {
      // 默认 1:1 视角下，单指触摸不拦截，允许浏览器整页自然滑动
      touchStartRef.current = null;
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchStartRef.current && touchStartRef.current.dist > 0) {
      // 双指 Pinch 捏合实时缩放：阻止默认全屏缩放
      if (e.cancelable) e.preventDefault();
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleRatio = currentDist / touchStartRef.current.dist;
      const newZoom = Math.max(0.5, Math.min(5, touchStartRef.current.zoom * scaleRatio));
      setCanvasZoom(newZoom);
      if (newZoom === 1) {
        setCanvasPan({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && canvasZoom > 1) {
      // 图片已放大状态下单指平移
      if (e.cancelable) e.preventDefault();
      setCanvasPan({
        x: e.touches[0].clientX - canvasDragStart.x,
        y: e.touches[0].clientY - canvasDragStart.y
      });
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      if (e.touches.length === 0) {
        setIsCanvasDragging(false);
      }
      touchStartRef.current = null;
    }
  };

  // 移动端对比模式滑动手势识别 (防止阻碍整页上下滚动)
  const compareTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleCompareTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      compareTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      handleTouchOrMouseMove(e.touches[0].clientX);
    }
  };

  const handleCompareTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && compareTouchStartRef.current) {
      const deltaX = Math.abs(e.touches[0].clientX - compareTouchStartRef.current.x);
      const deltaY = Math.abs(e.touches[0].clientY - compareTouchStartRef.current.y);
      if (deltaX > deltaY) {
        // 主要横向左右拖动对比滑块时阻止原生页面滑屏
        if (e.cancelable) e.preventDefault();
        handleTouchOrMouseMove(e.touches[0].clientX);
      }
    }
  };

  useEffect(() => {
    if (!resizingTarget) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resizingStartY;
      if (resizingTarget === 'selection') {
        setSelectionHeight(Math.max(160, Math.min(1000, resizingStartHeight + deltaY)));
      } else if (resizingTarget === 'scene') {
        setSceneHeight(Math.max(120, Math.min(800, resizingStartHeight + deltaY)));
      } else if (resizingTarget === 'advanced') {
        setAdvancedHeight(Math.max(150, Math.min(800, resizingStartHeight + deltaY)));
      } else if (resizingTarget === 'canvas') {
        setCanvasHeight(Math.max(380, Math.min(1400, resizingStartHeight + deltaY)));
      } else if (resizingTarget === 'bulk') {
        setBulkHeight(Math.max(150, Math.min(800, resizingStartHeight + deltaY)));
      }
    };

    const handleMouseUp = () => {
      setResizingTarget(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingTarget, resizingStartY, resizingStartHeight]);

  useEffect(() => {
    window.addEventListener('mouseup', handleCanvasMouseUp);
    return () => window.removeEventListener('mouseup', handleCanvasMouseUp);
  }, []);

  // 引用
  const compareContainerRef = useRef<HTMLDivElement>(null);

  // 从本地IDB (5GB大容量存储) 及 Supabase 加载持久化产品和场景，自动自愈与升级素材库
  useEffect(() => {
    async function loadPersistentData() {
      // 0. 版本检查与一键无损迁移：如果是旧版本或缓存污染，自动重置为高质感官方预设库
      const localVersion = localStorage.getItem('MANWAH_ASSETS_VERSION');
      if (localVersion !== ASSET_CACHE_VERSION) {
        localStorage.setItem('MANWAH_ASSETS_VERSION', ASSET_CACHE_VERSION);
        localStorage.setItem('MANWAH_CUSTOM_PRODUCTS', JSON.stringify(INITIAL_PRODUCTS));
        localStorage.setItem('MANWAH_CUSTOM_SCENES', JSON.stringify(SAMPLE_SCENES));
        localStorage.setItem('MANWAH_CURRENT_SCENE_URL', SAMPLE_SCENES[0].url);
        dbService.saveAppData('MANWAH_CUSTOM_PRODUCTS', INITIAL_PRODUCTS).catch(() => {});
        dbService.saveAppData('MANWAH_CUSTOM_SCENES', SAMPLE_SCENES).catch(() => {});
        setProducts(INITIAL_PRODUCTS);
        setSelectedProduct(INITIAL_PRODUCTS[0]);
        setSampleScenes(SAMPLE_SCENES);
        setSceneImageUrl(SAMPLE_SCENES[0].url);
        return;
      }

      try {
        const idbProducts = await dbService.getAppData('MANWAH_CUSTOM_PRODUCTS');
        if (Array.isArray(idbProducts) && idbProducts.length > 0) {
          const clean = idbProducts
            .filter(p => p && p.id && !OLD_SAMPLE_PRODUCT_IDS.includes(p.id))
            .map(p => ({ ...p, imageUrl: healProductImageUrl(p) }));
          if (clean.length > 0) {
            setProducts(clean);
            setSelectedProduct(prev => prev ? { ...prev, imageUrl: healProductImageUrl(prev) } : clean[0]);
            try { localStorage.setItem('MANWAH_CUSTOM_PRODUCTS', JSON.stringify(clean)); } catch (e) {}
          } else {
            setProducts(INITIAL_PRODUCTS);
            setSelectedProduct(INITIAL_PRODUCTS[0]);
          }
        }
        const idbScenes = await dbService.getAppData('MANWAH_CUSTOM_SCENES');
        if (Array.isArray(idbScenes) && idbScenes.length > 0) {
          const clean = idbScenes
            .filter(s => s && s.url && !OLD_SAMPLE_SCENE_URLS.includes(s.url))
            .map(s => ({ ...s, url: healSceneImageUrl(s) }));
          if (clean.length > 0) {
            setSampleScenes(clean);
            setSceneImageUrl(prev => {
              if (prev && !isBrokenImageUrl(prev) && clean.some(s => s.url === prev)) return prev;
              const savedCurr = localStorage.getItem('MANWAH_CURRENT_SCENE_URL');
              if (savedCurr && !isBrokenImageUrl(savedCurr) && clean.some(s => s && s.url === savedCurr)) return savedCurr;
              return clean[0].url;
            });
            try { localStorage.setItem('MANWAH_CUSTOM_SCENES', JSON.stringify(clean)); } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('IDB fetch notice:', err);
      }

      try {
        // 从 Supabase 数据后端及云端存储读取用户自定义数据并自动自愈
        const resProd = await fetch('/api/app-data/get?key=MANWAH_CUSTOM_PRODUCTS');
        if (resProd.ok) {
          const { value } = await resProd.json();
          if (value !== null && value !== undefined) {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (Array.isArray(parsed) && parsed.length > 0) {
              const clean = parsed
                .filter((p: any) => p && p.id && !OLD_SAMPLE_PRODUCT_IDS.includes(p.id))
                .map((p: any) => ({ ...p, imageUrl: healProductImageUrl(p) }));
              if (clean.length > 0) {
                setProducts(clean);
                setSelectedProduct(prev => prev ? { ...prev, imageUrl: healProductImageUrl(prev) } : clean[0]);
                try { localStorage.setItem('MANWAH_CUSTOM_PRODUCTS', JSON.stringify(clean)); } catch (e) {}
              }
            }
          }
        }
        const resScene = await fetch('/api/app-data/get?key=MANWAH_CUSTOM_SCENES');
        if (resScene.ok) {
          const { value } = await resScene.json();
          if (value !== null && value !== undefined) {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            if (Array.isArray(parsed) && parsed.length > 0) {
              const clean = parsed
                .filter((s: any) => s && s.url && !OLD_SAMPLE_SCENE_URLS.includes(s.url))
                .map((s: any) => ({ ...s, url: healSceneImageUrl(s) }));
              if (clean.length > 0) {
                setSampleScenes(clean);
                setSceneImageUrl(prev => {
                  if (prev && !isBrokenImageUrl(prev) && clean.some(s => s.url === prev)) return prev;
                  const savedCurr = localStorage.getItem('MANWAH_CURRENT_SCENE_URL');
                  if (savedCurr && !isBrokenImageUrl(savedCurr) && clean.some(s => s && s.url === savedCurr)) return savedCurr;
                  return clean[0].url;
                });
                try { localStorage.setItem('MANWAH_CUSTOM_SCENES', JSON.stringify(clean)); } catch (e) {}
              }
            }
          }
        }
      } catch (err) {
        console.warn('Supabase app-data fetch notice:', err);
      }
    }
    loadPersistentData();
  }, []);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'sofa': return '豪华沙发';
      case 'chair': return '休闲单椅';
      case 'table': return '雅致茶几';
      case 'dining': return '臻选餐桌';
      case 'bed': return '软床寝具';
      default: return '家居精品';
    }
  };

  // 分类过滤产品列表
  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  // 优化：处理场景图片上传，自动同步云端保存至后端数据库，彻底避免换域名丢失
  const processAndSaveSceneImage = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setSceneImageUrl(evt.target.result as string);
        setGeneratedImageUrl(null);
      }
    };
    reader.readAsDataURL(file);

    try {
      const url = await uploadImageToSupabase(file);
      if (url) {
        const newSc = {
          name: `现场实景-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
          url: url,
          desc: '用户实传现场图'
        };
        updateSampleScenesList(prev => {
          if (prev.some(s => s && s.url === url)) return prev;
          return [newSc, ...prev];
        });
        setSceneImageUrl(url);
      }
    } catch (e) {
      console.error('Scene upload sync error:', e);
    }
  };

  const handleSceneUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAndSaveSceneImage(file);
  };

  const handleDropScene = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingScene(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processAndSaveSceneImage(file);
  };

  // 优化：处理带图选配自定义图片上传，自动同步云端保存至后端数据库
  const processAndSaveCustomProduct = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setCustomProductImage(evt.target.result as string);
        setSelectedProduct(null);
      }
    };
    reader.readAsDataURL(file);

    try {
      const url = await uploadImageToSupabase(file);
      if (url) {
        const newProd: ProductItem = {
          id: `prod-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: `自传选品-${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
          category: selectedCategory === 'all' ? 'sofa' : selectedCategory as any,
          categoryLabel: getCategoryLabel(selectedCategory === 'all' ? 'sofa' : selectedCategory),
          imageUrl: url,
          description: '用户实拍/自传选配素材',
          tags: ['自传', '选配'],
          isCustom: true
        };
        updateProductsList(prev => {
          if (prev.some(p => p.imageUrl === url)) return prev;
          return [newProd, ...prev];
        });
        setSelectedProduct(newProd);
      }
    } catch (e) {
      console.error('Product upload sync error:', e);
    }
  };

  const handleCustomProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processAndSaveCustomProduct(file);
  };

  const handleDropCustom = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingCustom(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processAndSaveCustomProduct(file);
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newTasks = files.map(file => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const
      }));
      setBulkUploadTasks(prev => [...prev, ...newTasks]);
    }
  };

  const handleDropBulk = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingBulk(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      const newTasks = files.map(file => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'pending' as const
      }));
      setBulkUploadTasks(prev => [...prev, ...newTasks]);
    }
  };

  const startBulkUpload = async () => {
    setIsBulkUploading(true);
    const tasksToProcess = bulkUploadTasks
      .map((task, idx) => ({ task, idx }))
      .filter(item => item.task.status === 'pending' || item.task.status === 'error');

    const processSingleTask = async (item: { task: typeof bulkUploadTasks[0]; idx: number }) => {
      const { task, idx: i } = item;
      // Update status to uploading
      setBulkUploadTasks(prev => {
        const copy = [...prev];
        if (copy[i]) copy[i] = { ...copy[i], status: 'uploading' };
        return copy;
      });

      try {
        // Upload to Supabase
        const imageUrl = await uploadImageToSupabase(task.file);
        if (!imageUrl) throw new Error('Upload failed');

        // Update status to analyzing
        setBulkUploadTasks(prev => {
          const copy = [...prev];
          if (copy[i]) copy[i] = { ...copy[i], status: 'analyzing' };
          return copy;
        });

        // Analyze via API
        const formData = new FormData();
        formData.append('image', task.file);
        
        let token = localStorage.getItem('token') || '';
        let userId = 'system';
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.access_token) {
            token = sessionData.session.access_token;
          }
          if (sessionData?.session?.user?.id) {
            userId = sessionData.session.user.id;
          }
        } catch (authErr) {
          console.warn('Notice: Failed to get Supabase session during bulk upload:', authErr);
        }

        let analyzedData: any = {};
        const apiEndpoint = bulkEntryType === 'scene' ? '/api/analyze_scene' : '/api/analyze_product';
        try {
          const analyzeRes = await fetch(apiEndpoint, {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'x-user-id': userId
            }
          });
          if (analyzeRes.ok) {
            try {
              analyzedData = await analyzeRes.json();
            } catch (e) {
              console.warn(`Failed to parse ${apiEndpoint} response:`, e);
            }
          } else {
            console.warn(`${apiEndpoint} API returned non-OK status:`, analyzeRes.status);
          }
        } catch (apiErr) {
          console.warn(`Notice: Failed to reach ${apiEndpoint} API, falling back to default info:`, apiErr);
        }
        
        if (bulkEntryType === 'scene') {
          const newSc = {
            name: analyzedData.name || task.file.name.replace(/\.[^/.]+$/, ""),
            url: imageUrl,
            desc: analyzedData.desc || analyzedData.description || '现场实景空间图'
          };
          updateSampleScenesList(prev => {
            if (prev.some(s => s && s.url === imageUrl)) return prev;
            return [newSc, ...prev];
          });
          setSceneImageUrl(imageUrl);
          setBulkUploadTasks(prev => {
            const copy = [...prev];
            if (copy[i]) copy[i] = { ...copy[i], status: 'done', name: newSc.name };
            return copy;
          });
        } else {
          // Add to DB
          const newProd: ProductItem = {
            id: `custom-${Date.now()}-${i}`,
            name: analyzedData.name || task.file.name.replace(/\.[^/.]+$/, ""),
            category: analyzedData.category || 'other',
            categoryLabel: getCategoryLabel(analyzedData.category || 'other'),
            imageUrl: imageUrl,
            description: analyzedData.description || 'MH优质家居实景搭配产品',
            tags: ['AI识别', '新品'],
            isCustom: true
          };

          try {
            await supabase.from('products').insert([{
              name: newProd.name,
              category: newProd.category,
              image_url: newProd.imageUrl,
              description: newProd.description
            }]);
          } catch (dbErr) {
            console.warn('Syncing to Supabase products table:', dbErr);
          }

          // Add to local state
          updateProductsList(prev => [newProd, ...prev]);

          // Mark as done
          setBulkUploadTasks(prev => {
            const copy = [...prev];
            if (copy[i]) copy[i] = { ...copy[i], status: 'done', name: newProd.name };
            return copy;
          });
        }

      } catch (err) {
        console.error('Bulk upload error:', err);
        setBulkUploadTasks(prev => {
          const copy = [...prev];
          if (copy[i]) copy[i] = { ...copy[i], status: 'error' };
          return copy;
        });
      }
    };

    // 分批并发处理 (并发度 3)
    const concurrency = 3;
    for (let i = 0; i < tasksToProcess.length; i += concurrency) {
      const batch = tasksToProcess.slice(i, i + concurrency);
      await Promise.all(batch.map(item => processSingleTask(item)));
    }
    setIsBulkUploading(false);
  };


  // 添加新产品到 Supabase & 本地
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newProductImg) {
      setConfirmDialog({
        isOpen: true,
        title: '提示：信息不完整',
        message: '请填写产品名称并提供产品图片！',
        onConfirm: () => setConfirmDialog(null)
      });
      return;
    }

    const newProd: ProductItem = {
      id: `custom-${Date.now()}`,
      name: newProductName,
      category: newProductCategory,
      categoryLabel: getCategoryLabel(newProductCategory),
      imageUrl: newProductImg,
      description: newProductDesc || '专选MH优质家居实景搭配产品',
      tags: ['店长推荐', '新上映'],
      isCustom: true
    };

    try {
      await supabase.from('products').insert([
        {
          name: newProductName,
          category: newProductCategory,
          image_url: newProductImg,
          description: newProductDesc
        }
      ]);
    } catch (err) {
      console.warn('Syncing to Supabase products table:', err);
    }

    updateProductsList(prev => [newProd, ...prev]);
    setSelectedProduct(newProd);
    setShowAddProductModal(false);
    setNewProductName('');
    setNewProductImg('');
    setNewProductDesc('');
  };

  // 触发 AI 核心生成融合
  const handleGenerateFusion = async () => {
    if (!sceneImageUrl) {
      setErrorMessage('请先上传或选择客户家里的实景空间图片！');
      return;
    }

    const startTime = Date.now();
    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationProgress(15);
    setGenerationStatus('正在提取客户客厅场景空间结构与光影透视...');

    try {
      // 组装核心选品 Prompt
      let productDetails = '';
      if (selectionMode === 'ai') {
        productDetails = '针对当前空间，AI 智能推荐匹配一款意式轻奢高品质现代奢华真皮沙发组合，质感舒适饱满。';
      } else if (selectionMode === 'custom' && customProductImage) {
        productDetails = '参考客户上传的家具图片样式，提取其造型轮廓、色彩材质与质感，无缝融入当前空间。';
      } else if (selectedProduct) {
        productDetails = `将选中产品【${selectedProduct.name}】（特征描述：${selectedProduct.description}）精准摆放入客厅中央焦点位置。`;
      } else {
        productDetails = '选用一款极简高品质沙发无缝替换现有家具。';
      }

      // 组装最终全流程 Prompt
      const fullPrompt = `高精室内家居实景融合设计方案。
原始场景特征：保留场景中的壁画、地板、墙面结构及自然采光方向。
目标产品家具融合：${productDetails}
系统硬性控制指令：${promptConstraint}
要求生成超逼真 8K 室内设计效果图，光影、阴影与地面反光自然衔接，无违和感。`;

      setGenerationProgress(45);
      setGenerationStatus('正在处理图片数据...');

      // Prepare images
      const images = [];
      
      const fetchImageAsBase64 = async (url: string) => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              // result format: data:image/png;base64,iVBORw...
              const match = result.match(/^data:(image\/[^;]+);base64,(.*)$/);
              if (match) {
                resolve({ mimeType: match[1], data: match[2] });
              } else {
                reject(new Error("Invalid data URL"));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("Could not fetch image to base64:", e);
          return null;
        }
      };

      if (sceneImageUrl) {
        const base64Img = await fetchImageAsBase64(sceneImageUrl);
        if (base64Img) images.push(base64Img);
      }
      
      // If we have a custom product image or a selected product image, we could add it
      let productImgToUse = null;
      if (selectionMode === 'custom' && customProductImage) {
        productImgToUse = customProductImage;
      } else if (selectedProduct) {
        productImgToUse = selectedProduct.imageUrl;
      }
      
      if (productImgToUse) {
         const pImg = await fetchImageAsBase64(productImgToUse);
         if (pImg) images.push(pImg);
      }

      setGenerationStatus('Gemini API 高精理解组装中，正在调用渲染引擎...');

      setGenerationProgress(70);
      setGenerationStatus('正在生成最终实景融合高清效果图...');

      const targetRatio = aspectRatio === 'auto' ? detectedSceneRatio : aspectRatio;

      const resultImage = await generateImageFromRouterHub({
        prompt: fullPrompt,
        model: engineModel,
        aspectRatio: targetRatio,
        resolution: resolution,
        images: images
      });

      const durationSec = Math.round((Date.now() - startTime) / 1000);
      setGenerationProgress(100);
      setGenerationStatus(`实景融合完成！耗时 ${durationSec}s`);
      setGeneratedImageUrl(resultImage);

      const newHistItem: HistoryItem = {
        id: `fusion-${Date.now()}`,
        prompt: fullPrompt,
        imageUrl: resultImage,
        model: engineModel as any,
        timestamp: Date.now(),
        size: 0,
        duration: durationSec,
        aspectRatio: targetRatio
      };
      setActiveHistoryItem(newHistItem);

      // 保存至历史记录
      try {
        await dbService.saveToHistory(newHistItem);
        loadHistory();
      } catch (err) {
        console.warn('Saved to history warning:', err);
      }

    } catch (error: any) {
      console.error('Fusion error:', error);
      setErrorMessage(error.message || '生成融合作业失败，请检查网络或配置重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  // 下载保存效果图
  const handleDownloadResult = () => {
    if (!generatedImageUrl) return;
    const a = document.createElement('a');
    a.href = generatedImageUrl;
    a.download = `MH-智慧门店-实景融合方案-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 对比滑块拖拽逻辑
  const handleTouchOrMouseMove = (clientX: number) => {
    if (!compareContainerRef.current) return;
    const rect = compareContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let posPercentage = (x / rect.width) * 100;
    if (posPercentage < 0) posPercentage = 0;
    if (posPercentage > 100) posPercentage = 100;
    setCompareSliderPos(posPercentage);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800 flex flex-col font-sans">
      
      {/* ---------------- 顶部高级品牌 Navbar ---------------- */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3 sticky top-0 z-30 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-[#B28C5A] to-[#E2D1B3] rounded-xl flex items-center justify-center text-white font-serif font-bold text-base sm:text-lg shadow-sm">
            MH
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide">MH 智慧门店</h1>
              <span className="hidden sm:inline-block bg-slate-100 text-[#B28C5A] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#B28C5A]/30">
                V1.0 导购系统
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400">实景融合 · 赋能家具门店促单转化</p>
          </div>
        </div>

        {/* ---------------- 页眉中央导航胶囊 (桌面端/平板端展示) ---------------- */}
        <div className="hidden sm:flex items-center bg-slate-100/90 p-1 rounded-full border border-slate-200 shadow-inner">
          <button
            onClick={() => navigate('/manwah')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all bg-[#B28C5A] text-white shadow-sm whitespace-nowrap"
          >
            <MonitorPlay size={15} strokeWidth={2.5} />
            <span>工作流</span>
          </button>

          <div className="w-[1px] h-4 bg-slate-300/80 mx-1" />

          <div className="relative">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 whitespace-nowrap"
            >
              <Settings size={15} />
              <span>设置</span>
              <ChevronDown size={13} className={`transition-transform duration-200 ${showSettingsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* 设置下拉菜单 */}
            {showSettingsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettingsDropdown(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    系统设置
                  </div>
                  {settingsItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        navigate(item.path);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-slate-600 hover:bg-slate-50 hover:text-[#B28C5A]"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            onClick={() => setEnableEdgeResize(!enableEdgeResize)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-xs ${
              enableEdgeResize
                ? 'bg-slate-50 text-[#B28C5A] border-[#B28C5A]/40'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
            }`}
            title="点击切换：开启或关闭各个窗口/面板底部的边缘下拉调整高度功能"
          >
            <MoveVertical size={15} className={enableEdgeResize ? 'text-[#B28C5A]' : 'text-slate-400'} />
            <span className="hidden md:inline">{enableEdgeResize ? '允许边缘拉伸: 开' : '允许边缘拉伸: 关'}</span>
            <span className="md:hidden">拉伸</span>
          </button>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
          >
            <History size={15} className="text-[#B28C5A]" />
            <span className="hidden sm:inline">历史方案</span>
            <span className="sm:hidden">历史</span>
          </button>

          {/* 移动端独立设置下拉按钮 */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              <Settings size={15} className="text-[#B28C5A]" />
              <span>设置</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${showSettingsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showSettingsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettingsDropdown(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                    系统设置
                  </div>
                  {settingsItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setShowSettingsDropdown(false);
                        navigate(item.path);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all text-slate-600 hover:bg-slate-50 hover:text-[#B28C5A]"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowAddProductModal(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-[#B28C5A] text-xs font-bold border border-[#B28C5A]/30 transition-all"
          >
            <FolderPlus size={15} />
            <span>✨ 录入新家具</span>
          </button>
        </div>
      </header>

      {/* ---------------- 核心工作区 (30% / 70% 黄金分割布局) ---------------- */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 pb-24 sm:pb-6">
        
        {/* ================= 左侧控制中心 (30% 屏宽: md:col-span-4 lg:col-span-4 xl:col-span-4) ================= */}
        <section className="md:col-span-4 lg:col-span-4 xl:col-span-4 flex flex-col gap-4">
          
          {/* ----- 折叠面板 1: 选配产品 (家具图册) ----- */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleSection('selection')}
              className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/60 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white text-[#B28C5A] flex items-center justify-center font-bold text-xs shadow-2xs border border-slate-200/60">
                  1
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-800">选配产品</h3>
                  <p className="text-[11px] text-slate-400">挑选家具款式或智能推荐</p>
                </div>
              </div>
              {openSections.selection ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {openSections.selection && (
            <div className="p-4 space-y-4">
              
              {/* 选品三轨道 Tab 切换 */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-xl">
                <button
                  onClick={() => setSelectionMode('catalog')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    selectionMode === 'catalog'
                      ? 'bg-white text-[#B28C5A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LayoutGrid size={15} />
                  <span>家具图册</span>
                </button>

                <button
                  onClick={() => setSelectionMode('ai')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    selectionMode === 'ai'
                      ? 'bg-white text-[#B28C5A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Wand2 size={15} />
                  <span>✨ 智能搭配</span>
                </button>

                <button
                  onClick={() => setSelectionMode('custom')}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    selectionMode === 'custom'
                      ? 'bg-white text-[#B28C5A] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Upload size={15} />
                  <span>➕ 自选图</span>
                </button>
              </div>

              {/* 轨道 1: 家具图册 */}
              {selectionMode === 'catalog' && (
                <div className="space-y-3">
                  {/* 分类过滤 Tab 与新增/重置按钮 */}
                  <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1" style={{ touchAction: 'pan-x' }}>
                      {[
                        { id: 'all', label: '全部' },
                        { id: 'sofa', label: '沙发' },
                        { id: 'chair', label: '单椅' },
                        { id: 'table', label: '茶几' },
                        { id: 'dining', label: '餐桌' },
                        { id: 'bed', label: '软床' }
                      ].map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                            selectedCategory === cat.id
                              ? 'bg-[#B28C5A] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={handleOpenAddProduct}
                        className="px-2 py-1 bg-[#B28C5A]/10 hover:bg-[#B28C5A] text-[#B28C5A] hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                        title="录入新家具/自定义预设图库"
                      >
                        <Plus size={13} /> 家具
                      </button>
                      <button
                        onClick={handleResetProducts}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        title="一键恢复官方默认家具库"
                      >
                        <RotateCcw size={13} />
                      </button>
                    </div>
                  </div>

                  {/* 产品 Grid 网格 */}
                  <div 
                    className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 custom-scrollbar transition-all"
                    style={{ maxHeight: `${selectionHeight}px`, minHeight: '160px', touchAction: 'pan-y' }}
                  >
                    {filteredProducts.length === 0 ? (
                      <div className="col-span-2 py-10 flex flex-col items-center justify-center text-slate-400 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 my-2">
                        <Package size={32} className="mb-2 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">家具图册暂无款式</span>
                        <span className="text-[10px] text-slate-400 mt-1">您可点击右上角“+ 家具”上传，或通过“➕ 自选图”添加</span>
                      </div>
                    ) : (
                      filteredProducts.map(p => {
                        const isSelected = selectedProduct?.id === p.id;
                        return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProduct(p)}
                          className={`group relative rounded-xl border p-2 cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'border-[#B28C5A] bg-amber-50/40 ring-2 ring-[#B28C5A]/20'
                              : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          <div data-wheel-zoom="true" style={{ touchAction: 'pan-y' }} className="relative aspect-4/3 rounded-lg overflow-hidden bg-slate-100 mb-2">
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              onWheel={(e) => handleThumbnailWheel(e, p.imageUrl)}
                              style={{
                                transform: `scale(${thumbnailScaleMap[p.imageUrl] || 1})`,
                                transition: 'transform 0.15s ease-out'
                              }}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                const healed = healProductImageUrl(p);
                                if (healed && healed !== p.imageUrl) {
                                  e.currentTarget.src = healed;
                                } else {
                                  e.currentTarget.src = FALLBACK_PRODUCT_IMG;
                                }
                              }}
                              className="w-full h-full object-cover group-hover:scale-105"
                            />
                            {(thumbnailScaleMap[p.imageUrl] || 1) !== 1 && (
                              <span
                                onClick={(e) => { e.stopPropagation(); setThumbnailScaleMap(prev => ({ ...prev, [p.imageUrl]: 1 })); }}
                                className="absolute bottom-1 right-1 bg-black/75 hover:bg-black text-white text-[9px] px-1.5 py-0.5 rounded z-10 cursor-pointer shadow-xs font-mono"
                                title="点击恢复 100% 原始大小"
                              >
                                {Math.round((thumbnailScaleMap[p.imageUrl] || 1) * 100)}% ↺
                              </span>
                            )}
                            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewModalImage({ url: p.imageUrl, title: p.name, desc: p.description });
                                  setPreviewZoom(1);
                                }}
                                className="w-6 h-6 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center shadow-xs"
                                title="放大预览"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleOpenEditProduct(e, p)}
                                className="w-6 h-6 bg-[#B28C5A]/90 hover:bg-[#B28C5A] text-white rounded-full flex items-center justify-center shadow-xs"
                                title="编辑此预设素材"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteProduct(e, p.id)}
                                className="w-6 h-6 bg-red-600/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xs"
                                title="删除此素材"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-[#B28C5A] text-white rounded-full flex items-center justify-center shadow-xs">
                                <Check size={12} strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#B28C5A] block mb-0.5">
                              {p.categoryLabel}
                            </span>
                            <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{p.name}</h4>
                            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{p.description}</p>
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              )}

              {/* 轨道 2: ✨ 智能搭配 */}
              {selectionMode === 'ai' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-[#B28C5A] font-bold text-xs">
                    <Sparkles size={16} />
                    <span>AI 智能空间选配</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    无需手动挑选！启动融合后，AI 将自动分析您上传的客餐厅实景（采光、空间余量、整体风格），为您匹配推荐最合适的 MH 豪华家具组合。
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    <span>优先搭配曼华门店当季高质感畅销单品</span>
                  </div>
                </div>
              )}

              {/* 轨道 3: ➕ 自选图 */}
              {selectionMode === 'custom' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">上传客户手机相册中的心仪家具或参考款式：</p>
                  <label
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCustom(true); }}
                    onDragLeave={() => setIsDraggingCustom(false)}
                    onDrop={handleDropCustom}
                    className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isDraggingCustom
                        ? 'border-[#B28C5A] bg-amber-50/50 scale-[1.01]'
                        : 'border-slate-200 hover:border-[#B28C5A] bg-slate-50/60 hover:bg-slate-50'
                    }`}
                  >
                    {customProductImage ? (
                      <div data-wheel-zoom="true" className="relative w-full aspect-video rounded-lg overflow-hidden group">
                        <img
                          src={customProductImage}
                          alt="自定义家具"
                          onWheel={(e) => handleThumbnailWheel(e, customProductImage)}
                          style={{
                            transform: `scale(${thumbnailScaleMap[customProductImage] || 1})`,
                            transition: 'transform 0.15s ease-out'
                          }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/presets/products/sofa_burgundy.jpg';
                          }}
                          className="w-full h-full object-cover"
                        />
                        {(thumbnailScaleMap[customProductImage] || 1) !== 1 && (
                          <span
                            onClick={(e) => { e.stopPropagation(); setThumbnailScaleMap(prev => ({ ...prev, [customProductImage]: 1 })); }}
                            className="absolute bottom-1 left-1 bg-black/75 hover:bg-black text-white text-[9px] px-1.5 py-0.5 rounded z-10 cursor-pointer shadow-xs font-mono"
                            title="点击恢复 100% 原始大小"
                          >
                            {Math.round((thumbnailScaleMap[customProductImage] || 1) * 100)}% ↺
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewModalImage({ url: customProductImage, title: '自定义上传参考家具', desc: '用户自主上传选配素材' });
                            setPreviewZoom(1);
                          }}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          title="放大查看"
                        >
                          <Eye size={14} />
                        </button>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold pointer-events-none">
                          点击更换图片
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="text-[#B28C5A] mb-1" />
                        <span className="text-xs font-bold text-slate-700">点击或拖拽上传参考家具图</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">支持 PNG / JPG / WEBP 格式</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleCustomProductUpload} className="hidden" />
                  </label>
                </div>
              )}

            </div>
            )}

            {openSections.selection && enableEdgeResize && (
              <div
                onMouseDown={(e) => startResize(e, 'selection', selectionHeight)}
                className="h-3.5 bg-slate-50 hover:bg-[#B28C5A]/15 cursor-ns-resize flex items-center justify-center border-t border-slate-200 transition-all group select-none"
                title="按住鼠标拖拽：自由调整选品区展示高度"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 group-hover:text-[#B28C5A] font-bold">
                  <SlidersHorizontal size={11} className="group-hover:scale-110 transition-transform" />
                  <span>拖拽拉伸 ({Math.round(selectionHeight)}px)</span>
                </div>
              </div>
            )}
          </div>

          {/* ----- 折叠面板 2: 拍我家 (上传现场实景) ----- */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleSection('scene')}
              className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/60 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white text-[#B28C5A] flex items-center justify-center font-bold text-xs shadow-2xs border border-slate-200/60">
                  2
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-800">拍我家</h3>
                  <p className="text-[11px] text-slate-400">上传客户房间或客餐厅实景</p>
                </div>
              </div>
              {openSections.scene ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {openSections.scene && (
              <div 
                className="p-4 space-y-3 overflow-y-auto custom-scrollbar transition-all"
                style={{ maxHeight: `${sceneHeight}px`, minHeight: '140px', touchAction: 'pan-y' }}
              >
                <label
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingScene(true); }}
                  onDragLeave={() => setIsDraggingScene(false)}
                  onDrop={handleDropScene}
                  className={`border-2 border-dashed rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                    isDraggingScene
                      ? 'border-[#B28C5A] bg-amber-50/50 scale-[1.01]'
                      : 'border-slate-200 hover:border-[#B28C5A] bg-slate-50/40 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-[#B28C5A]/10 flex items-center justify-center text-[#B28C5A] shrink-0">
                    <Upload size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-800 block truncate">点击或拖拽上传客户现场实景图</span>
                    <span className="text-[10px] text-slate-400 block">支持 PNG / JPG / WEBP 现场空间照片，上传后自动保存</span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleSceneUpload} className="hidden" />
                </label>

                {/* 预设示范场景 */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2 border-b border-slate-100 pb-1">
                    <span className="text-[11px] font-bold text-slate-500 block">快速演示试用例图 ({sampleScenes.length})：</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleOpenAddScene}
                        className="px-2 py-0.5 bg-[#B28C5A]/10 hover:bg-[#B28C5A] text-[#B28C5A] hover:text-white rounded-md text-[11px] font-bold transition-colors flex items-center gap-1"
                        title="自上传/添加新的场景图片"
                      >
                        <Plus size={12} /> 场景
                      </button>
                      <button
                        onClick={handleResetScenes}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        title="恢复系统默认示范场景"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {sampleScenes.length === 0 ? (
                      <div className="col-span-3 py-6 flex flex-col items-center justify-center text-slate-400 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 my-1">
                        <ImageIcon size={28} className="mb-1.5 text-slate-300" />
                        <span className="text-xs font-bold text-slate-600">快速示范区域暂无例图素材</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">您可点击右上方“+ 场景”上传保存常用客户客餐厅空间例图</span>
                      </div>
                    ) : (
                      sampleScenes.map((sc, idx) => (
                        <div
                        key={idx}
                        onClick={() => {
                          setSceneImageUrl(sc.url);
                          setGeneratedImageUrl(null);
                        }}
                        style={{ touchAction: 'pan-y' }}
                        className={`group relative aspect-4/3 rounded-lg overflow-hidden cursor-pointer border ${
                          sceneImageUrl === sc.url ? 'border-[#B28C5A] ring-2 ring-[#B28C5A]/20' : 'border-slate-200 opacity-80 hover:opacity-100'
                        }`}
                        data-wheel-zoom="true"
                      >
                        <img
                          src={sc.url || undefined}
                          alt={sc.name}
                          onWheel={(e) => handleThumbnailWheel(e, sc.url)}
                          style={{
                            transform: `scale(${thumbnailScaleMap[sc.url] || 1})`,
                            transition: 'transform 0.15s ease-out'
                          }}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            const healed = healSceneImageUrl(sc);
                            if (healed && healed !== sc.url) {
                              e.currentTarget.src = healed;
                            } else {
                              e.currentTarget.src = '/presets/scenes/scene_italian_warm.jpg';
                            }
                          }}
                          className="w-full h-full object-cover"
                        />
                        {(thumbnailScaleMap[sc.url] || 1) !== 1 && (
                          <span
                            onClick={(e) => { e.stopPropagation(); setThumbnailScaleMap(prev => ({ ...prev, [sc.url]: 1 })); }}
                            className="absolute bottom-1 left-1 bg-black/75 hover:bg-black text-white text-[9px] px-1 py-0.5 rounded z-10 cursor-pointer shadow-xs font-mono"
                            title="点击恢复 100% 原始大小"
                          >
                            {Math.round((thumbnailScaleMap[sc.url] || 1) * 100)}% ↺
                          </span>
                        )}
                        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewModalImage({ url: sc.url, title: sc.name, desc: sc.desc || '快速演示试用例图' });
                              setPreviewZoom(1);
                            }}
                            className="w-6 h-6 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center shadow-xs"
                            title="放大预览"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditScene(e, idx, sc)}
                            className="w-6 h-6 bg-[#B28C5A]/90 hover:bg-[#B28C5A] text-white rounded-full flex items-center justify-center shadow-xs"
                            title="编辑此演示场景"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteScene(e, idx)}
                            className="w-6 h-6 bg-red-600/90 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xs"
                            title="删除此演示场景"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[9px] text-white truncate text-center">
                          {sc.name}
                        </div>
                      </div>
                    )))}
                  </div>
                </div>
              </div>
            )}

            {openSections.scene && enableEdgeResize && (
              <div
                onMouseDown={(e) => startResize(e, 'scene', sceneHeight)}
                className="h-3.5 bg-slate-50 hover:bg-[#B28C5A]/15 cursor-ns-resize flex items-center justify-center border-t border-slate-200 transition-all group select-none"
                title="按住鼠标拖拽：自由调整实景展示区高度"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 group-hover:text-[#B28C5A] font-bold">
                  <SlidersHorizontal size={11} className="group-hover:scale-110 transition-transform" />
                  <span>拖拽拉伸 ({Math.round(sceneHeight)}px)</span>
                </div>
              </div>
            )}
          </div>

          {/* ----- 折叠面板 3: ⚙️ 高级调优 (参数微调) ----- */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all">
            <button
              onClick={() => toggleSection('advanced')}
              className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/60 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white text-[#B28C5A] flex items-center justify-center font-bold text-xs shadow-2xs border border-slate-200/60">
                  3
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-800">⚙️ 高级调优</h3>
                  <p className="text-[11px] text-slate-400">渲染品质与微调偏好说明</p>
                </div>
              </div>
              {openSections.advanced ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </button>

            {openSections.advanced && (
              <div 
                className="p-4 space-y-4 overflow-y-auto custom-scrollbar transition-all"
                style={{ maxHeight: `${advancedHeight}px`, minHeight: '140px' }}
              >
                {/* 词元 TianToken 大模型全矩阵选型 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span>词元（TianToken）调度模型</span>
                      <span className="text-[10px] text-[#B28C5A] font-mono bg-[#B28C5A]/10 px-1.5 py-0.2 rounded font-bold">双协议支持</span>
                    </label>
                  </div>

                  {/* 模型列表 */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <span>💎 Gemini 原生多模态系列</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'google/gemini-3-pro-image', name: 'Gemini 3 Pro Image', badge: '旗舰级', desc: '深度多轮推演，超高精细度旗舰渲染' },
                        { id: 'gemini-3.1-flash-image', name: 'Gemini 3.1 Flash', badge: '快响通用', desc: '工业级快响通用模型，多参考图融合' },
                        { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash', badge: '秒级低耗', desc: '秒级低耗渲染，快速预览草图' },
                        { id: 'gemini-nano-banana-2.1-preview', name: 'Nano Banana 2.1', badge: '轻量预览', desc: '轻量多模态快速预览，自适应比例' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setEngineModel(m.id)}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            engineModel === m.id
                              ? 'border-[#B28C5A] bg-amber-50/60 text-[#B28C5A] ring-1 ring-[#B28C5A]/30 shadow-xs'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate">{m.name}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100/70 text-amber-800 font-bold shrink-0">{m.badge}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">{m.desc}</span>
                        </button>
                      ))}
                    </div>

                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 pt-1">
                      <span>🎨 GPT 材质与局部重绘系列</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'openai/gpt-image-2', name: 'GPT Image 2', badge: '全能', desc: '文生图、图生图、材质融合' },
                        { id: 'openai/gpt-image-2-c', name: 'GPT Image 2-C', badge: '局部重绘', desc: '高精局部 Mask 重绘、前后景分离' },
                        { id: 'openai/gpt-image-2.5-flare-c', name: 'GPT Image 2.5 Flare-C', badge: '超清材质', desc: '超清材质增强、支持 Alpha 蒙版' },
                        { id: 'openai/gpt-image-2.5-sunburst-c', name: 'GPT Image 2.5 Sunburst-C', badge: '旗舰光影', desc: '旗舰级精细渲染、光影级 Mask 重绘' },
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setEngineModel(m.id)}
                          className={`p-2 rounded-xl border text-left transition-all ${
                            engineModel === m.id
                              ? 'border-[#B28C5A] bg-amber-50/60 text-[#B28C5A] ring-1 ring-[#B28C5A]/30 shadow-xs'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs truncate">{m.name}</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-100/70 text-indigo-800 font-bold shrink-0">{m.badge}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 分辨率档位规范 (512px / 1K / 2K / 4K) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">渲染精度档位 (长边像素映射)</label>
                    <span className="text-[10px] font-mono text-slate-400">当前: {resolution}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { res: '512px', label: '极速草样', tag: '低耗' },
                      { res: '1K', label: '标准沟通', tag: '快速' },
                      { res: '2K', label: '商业高清', tag: '推荐' },
                      { res: '4K', label: '旗舰巨幅', tag: '极清' },
                    ].map(r => (
                      <button
                        key={r.res}
                        type="button"
                        onClick={() => setResolution(r.res)}
                        className={`p-1.5 rounded-xl border text-center transition-all ${
                          resolution === r.res
                            ? 'border-[#B28C5A] bg-amber-50/70 text-[#B28C5A] font-bold ring-1 ring-[#B28C5A]/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-mono font-bold leading-none">{r.res}</div>
                        <div className="text-[9px] text-slate-400 scale-90 mt-0.5">{r.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 出图尺寸比例 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">出图尺寸比例</label>
                    {aspectRatio === 'auto' && (
                      <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <span>⚡ 默认跟随实景原图 ({detectedSceneRatio})</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {[
                      { ratio: 'auto', label: '跟随实景', icon: '🖼️', sub: detectedSceneRatio },
                      { ratio: '4:3', label: '标准横向', icon: '🖥️' },
                      { ratio: '16:9', label: '宽屏展映', icon: '🎬' },
                      { ratio: '1:1', label: '正方形', icon: '⏹️' },
                      { ratio: '3:4', label: '竖版立面', icon: '📱' },
                      { ratio: '9:16', label: '竖屏海报', icon: '📲' },
                    ].map((item) => (
                      <button
                        key={item.ratio}
                        type="button"
                        onClick={() => setAspectRatio(item.ratio)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                          aspectRatio === item.ratio
                            ? 'border-[#B28C5A] bg-amber-50/50 text-[#B28C5A] font-bold shadow-xs ring-1 ring-[#B28C5A]/30'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item.ratio === 'auto' && (
                          <span className="absolute -top-1.5 -right-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full shadow-2xs">
                            默认
                          </span>
                        )}
                        <span className="text-base leading-none">{item.icon}</span>
                        <span className="text-[11px] font-bold mt-1">
                          {item.ratio === 'auto' ? `自动 (${item.sub || '4:3'})` : item.ratio}
                        </span>
                        <span className="text-[9px] text-slate-400 scale-90">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI 定制要求 (Prompt Engine) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">AI 定制要求与细节说明</label>
                    <span className="text-[10px] text-slate-400 font-normal">
                      💡 支持右下角拖拽下拉扩展
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={promptConstraint}
                    onChange={(e) => setPromptConstraint(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#B28C5A] transition-colors resize-y min-h-[120px] max-h-[600px] leading-relaxed custom-scrollbar shadow-inner"
                    placeholder="例如：保持原有地板与墙面颜色不变，仅替换客厅中央的主沙发为选中款式..."
                  />
                  <span className="text-[10px] text-slate-400 mt-1.5 block">可在此补充对光影、材质、地面反光或窗帘色彩的具体微调意愿，AI 将精准呈现。</span>
                </div>
              </div>
            )}

            {openSections.advanced && enableEdgeResize && (
              <div
                onMouseDown={(e) => startResize(e, 'advanced', advancedHeight)}
                className="h-3.5 bg-slate-50 hover:bg-[#B28C5A]/15 cursor-ns-resize flex items-center justify-center border-t border-slate-200 transition-all group select-none"
                title="按住鼠标拖拽：自由调整高级调优区展示高度"
              >
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 group-hover:text-[#B28C5A] font-bold">
                  <SlidersHorizontal size={11} className="group-hover:scale-110 transition-transform" />
                  <span>拖拽拉伸 ({Math.round(advancedHeight)}px)</span>
                </div>
              </div>
            )}
          </div>

          {/* ================= 网页端左侧专属：AI 极光算力融合引擎 (极光紫/流光蓝双阶过渡动效) ================= */}
          <div className="hidden sm:block bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden group">
            {/* 极光流光背景渲染 */}
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-violet-500/30 transition-all duration-700" />
            <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/30 transition-all duration-700" />
            
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wide text-indigo-100 flex items-center gap-1.5">
                  <span>AI 空间重构算力引擎</span>
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 font-bold border border-indigo-400/30">
                {engineModel.split('/').pop()} • {resolution}
              </span>
            </div>

            <div className="bg-white/5 backdrop-blur-md p-3 rounded-xl border border-white/10 mb-4 relative z-10">
              <div className="text-[11px] text-slate-200 flex items-center justify-between gap-2">
                <span className="truncate">
                  选定方案: <strong className="text-amber-300 font-bold ml-1">{selectionMode === 'ai' ? '✨ 智能搭配选品' : selectionMode === 'custom' ? '🖼️ 客户自选参考图' : selectedProduct?.name || '曼华豪华客厅沙发'}</strong>
                </span>
                <span className="shrink-0 text-emerald-400 font-bold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">✓ 算力就绪</span>
              </div>
            </div>

            {/* 流光微渐变 + 呼吸动效大按钮 */}
            <button
              onClick={handleGenerateFusion}
              disabled={isGenerating}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:via-indigo-500 hover:to-blue-500 active:scale-[0.98] text-white font-extrabold text-sm shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer relative z-10 border border-white/20 overflow-hidden group/btn"
            >
              {/* 扫光动效条 */}
              <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover/btn:translate-x-[300%] transition-transform duration-1000 ease-in-out" />
              
              <Sparkles className="w-5 h-5 text-amber-200 animate-pulse shrink-0" />
              <span className="tracking-wide">{isGenerating ? '⚡ AI 极速算力重构中...' : generatedImageUrl ? '🔄 重新生成实景方案' : '✨ 一键实景融合 (AI 极速换装)'}</span>
            </button>
          </div>

        </section>

        {/* ================= 右侧沉浸画布 (70% 屏宽: md:col-span-8 lg:col-span-8 xl:col-span-8) ================= */}
        <section 
          className="md:col-span-8 lg:col-span-8 xl:col-span-8 flex flex-col justify-between bg-white rounded-3xl border border-slate-200/80 p-4 md:p-6 shadow-xs relative transition-all"
          style={{ minHeight: `${canvasHeight}px` }}
        >
          
          {/* 画布顶部 Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">
                {generatedImageUrl ? '✨ AI 实景方案效果' : '沉浸式家具实景融合画布'}
              </span>
              {generatedImageUrl && (
                <div className="flex items-center gap-1.5 ml-1 font-mono text-[10px] flex-wrap">
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    🕒 {activeHistoryItem ? new Date(activeHistoryItem.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  {activeHistoryItem?.duration && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                      ⚡ 耗时 {activeHistoryItem.duration}s
                    </span>
                  )}
                  {activeHistoryItem?.aspectRatio && (
                    <span className="bg-[#B28C5A]/10 text-[#B28C5A] font-bold px-2 py-0.5 rounded-full">
                      📐 {activeHistoryItem.aspectRatio}
                    </span>
                  )}
                </div>
              )}
            </div>

            {generatedImageUrl && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsComparing(!isComparing)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
                    isComparing ? 'bg-[#B28C5A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ArrowRight size={14} />
                  <span>{isComparing ? '退出对比' : '滑动前后对比'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 画布核心展示区 - 移动端触控优化: 1:1默认下允许页面垂直滑动 pan-y */}
          <div 
            data-wheel-zoom="true"
            style={{ touchAction: canvasZoom > 1 ? 'none' : 'pan-y', overscrollBehavior: 'contain' }}
            className={`flex-1 my-4 flex items-center justify-center relative rounded-2xl overflow-hidden bg-slate-900/5 min-h-[420px] ${canvasZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onWheel={handleCanvasWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onTouchStart={handleCanvasTouchStart}
            onTouchMove={handleCanvasTouchMove}
            onTouchEnd={handleCanvasTouchEnd}
          >
            {!isGenerating && (
              <div className="absolute top-3 left-3 z-20 bg-black/75 hover:bg-black/90 backdrop-blur-md text-white px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs shadow-lg transition-all select-none">
                <ZoomIn size={14} className="text-[#B28C5A]" />
                <span className="font-mono">{Math.round(canvasZoom * 100)}%</span>
                <button onClick={() => setCanvasZoom(prev => Math.max(0.5, prev - 0.25))} className="p-1 hover:bg-white/20 rounded" title="缩小">➖</button>
                <button onClick={() => setCanvasZoom(prev => Math.min(5, prev + 0.25))} className="p-1 hover:bg-white/20 rounded" title="放大">➕</button>
                {canvasZoom !== 1 && (
                  <button onClick={() => { setCanvasZoom(1); setCanvasPan({ x: 0, y: 0 }); }} className="px-1.5 py-0.5 bg-[#B28C5A] hover:bg-[#A17C4B] rounded text-[10px] font-bold" title="重置视角">1:1</button>
                )}
                <span className="text-[10px] text-slate-300 border-l border-white/20 pl-2 hidden sm:inline">鼠标滚轮实时缩放 · 拖拽移动视角</span>
              </div>
            )}
            
            {/* 错误提示 */}
            {errorMessage && (
              <div className="absolute top-4 left-4 right-4 z-20 bg-rose-50 text-rose-700 border border-rose-200 p-3 rounded-xl text-xs flex items-center justify-between shadow-md animate-fade-in">
                <span>{errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="font-bold text-rose-500 hover:text-rose-800">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* 生成中 Processing 状态 */}
            {isGenerating && (
              <div className="absolute top-4 right-4 z-40 bg-slate-900/95 text-white backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-indigo-500/50 flex flex-col gap-2 w-72 animate-fade-in pointer-events-auto">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin shrink-0" />
                    <span className="text-xs font-bold text-indigo-300">🚀 AI 实景算力极速重构中</span>
                  </div>
                  <span className="text-[11px] font-mono bg-white/10 text-slate-200 px-2 py-0.5 rounded-full">耗时 {generationElapsed}s</span>
                </div>
                <p className="text-[11px] text-slate-300 line-clamp-1">{generationStatus}</p>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                  <div className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 transition-all duration-300 rounded-full" style={{ width: `${generationProgress}%` }} />
                </div>
                <div className="text-[9px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/10">
                  <span>不影响您点选预览其他记录</span>
                  <span className="text-indigo-300">比例: {aspectRatio === 'auto' ? `实景原图(${detectedSceneRatio})` : aspectRatio}</span>
                </div>
              </div>
            )}

            {/* 展示 1: 滑动对比模式 */}
            {generatedImageUrl && isComparing ? (
              <div
                ref={compareContainerRef}
                onMouseMove={(e) => handleTouchOrMouseMove(e.clientX)}
                onTouchStart={handleCompareTouchStart}
                onTouchMove={handleCompareTouchMove}
                onTouchEnd={() => { compareTouchStartRef.current = null; }}
                style={{ touchAction: 'pan-y' }}
                className="relative w-full h-full min-h-[420px] select-none cursor-ew-resize overflow-hidden rounded-2xl"
              >
                <div style={{ transform: `scale(${canvasZoom}) translate(${canvasPan.x / canvasZoom}px, ${canvasPan.y / canvasZoom}px)`, transition: isCanvasDragging ? 'none' : 'transform 0.15s ease-out', width: '100%', height: '100%' }} className="relative w-full h-full">
                  {/* 底图: AI 融合生成图 */}
                  <img src={generatedImageUrl} alt="MH实景效果图" className="absolute inset-0 w-full h-full object-cover" />

                  {/* 上层图: 原始场景图 (根据位置裁剪) */}
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-white shadow-xl"
                    style={{ width: `${compareSliderPos}%` }}
                  >
                    {sceneImageUrl ? (
                      <img 
                        src={sceneImageUrl} 
                        alt="原始客户空间" 
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/presets/scenes/scene_italian_warm.jpg';
                        }}
                        className="absolute inset-0 w-full h-full object-cover max-w-none" 
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 text-xs">暂无原图</div>
                    )}
                    <span className="absolute top-3 left-3 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-xs z-10">
                      客户现场原实景
                    </span>
                  </div>
                </div>

                <span className="absolute top-3 right-3 bg-[#B28C5A] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xs z-10">
                  ✨ MH AI 融合效果
                </span>

                {/* 对比滑块中轴指针 */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-[#B28C5A] shadow-lg flex items-center justify-center font-bold text-xs pointer-events-none z-10"
                  style={{ left: `${compareSliderPos}%` }}
                >
                  ↔
                </div>
              </div>
            ) : generatedImageUrl ? (
              /* 展示 2: 生成效果图结果 */
              <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden group flex items-center justify-center">
                <div style={{ transform: `scale(${canvasZoom}) translate(${canvasPan.x / canvasZoom}px, ${canvasPan.y / canvasZoom}px)`, transition: isCanvasDragging ? 'none' : 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
                  <img src={generatedImageUrl} alt="MH 实景融合效果图" className="w-full h-full object-cover" />
                </div>
                <div className="absolute top-3 right-3 bg-[#B28C5A] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                  ✨ 实景融合效果图
                </div>
              </div>
            ) : (
              /* 展示 3: 客户原始场景预览与选品浮层 */
              <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden group flex items-center justify-center bg-slate-900/10">
                <div style={{ transform: `scale(${canvasZoom}) translate(${canvasPan.x / canvasZoom}px, ${canvasPan.y / canvasZoom}px)`, transition: isCanvasDragging ? 'none' : 'transform 0.15s ease-out', width: '100%', height: '100%' }}>
                  {sceneImageUrl ? (
                    <img 
                      src={sceneImageUrl} 
                      alt="客户原始空间" 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/presets/scenes/scene_italian_warm.jpg';
                      }}
                      className="w-full h-full object-cover opacity-95" 
                    />
                  ) : (
                    <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-100/60 rounded-2xl border-2 border-dashed border-slate-200">
                      <ImageIcon size={48} className="mb-3 text-slate-400 opacity-60 animate-pulse" />
                      <p className="text-sm font-bold text-slate-600">暂无实景底图</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">上方“拍我家”已清空。请点击或拖拽上传客户现场照片，或添加示例用例</p>
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />

                {/* 选中的产品浮层贴图提示 */}
                {selectionMode === 'catalog' && selectedProduct && (
                  <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-md p-3 rounded-2xl border border-white/50 shadow-xl flex items-center gap-3 animate-fade-in max-w-xs z-10">
                    <div data-wheel-zoom="true" className="relative group/thumb shrink-0">
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/presets/products/sofa_burgundy.jpg';
                        }}
                        onWheel={(e) => handleThumbnailWheel(e, selectedProduct.imageUrl)}
                        style={{
                          transform: `scale(${thumbnailScaleMap[selectedProduct.imageUrl] || 1})`,
                          transition: 'transform 0.15s ease-out'
                        }}
                        className="w-12 h-12 rounded-xl object-cover cursor-pointer"
                        onClick={() => {
                          setPreviewModalImage({ url: selectedProduct.imageUrl, title: selectedProduct.name, desc: selectedProduct.description });
                          setPreviewZoom(1);
                        }}
                        title="鼠标滚轮缩放缩略图，点击放大查看全图"
                      />
                      {(thumbnailScaleMap[selectedProduct.imageUrl] || 1) !== 1 && (
                        <span
                          onClick={(e) => { e.stopPropagation(); setThumbnailScaleMap(prev => ({ ...prev, [selectedProduct.imageUrl]: 1 })); }}
                          className="absolute -top-2 -right-2 bg-black/80 text-white text-[8px] px-1 py-0.5 rounded z-20 cursor-pointer shadow-xs font-mono"
                          title="点击恢复"
                        >
                          {Math.round((thumbnailScaleMap[selectedProduct.imageUrl] || 1) * 100)}%
                        </span>
                      )}
                      <div 
                        onClick={() => {
                          setPreviewModalImage({ url: selectedProduct.imageUrl, title: selectedProduct.name, desc: selectedProduct.description });
                          setPreviewZoom(1);
                        }}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white cursor-pointer"
                      >
                        <Eye size={12} />
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#B28C5A] font-bold block">拟换装家具</span>
                      <h4 className="text-xs font-bold text-slate-800 truncate">{selectedProduct.name}</h4>
                      <span className="text-[9px] text-slate-400 block">滚轮缩放 / 点击查看大图</span>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ================= 新增：对生成结果优化换装台 ================= */}
          {generatedImageUrl && (
            <div className="mt-4 p-4 bg-gradient-to-r from-[#F9FAFB] via-white to-amber-50/20 rounded-2xl border border-slate-200/80 shadow-xs animate-fade-in">
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#B28C5A]" />
                  <h4 className="text-xs font-bold text-slate-800">✨ 效果图优化与二次换装</h4>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">支持修改需求 · 把当前图转为新底图继续选配</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. 设为底图空间 */}
                <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 hover:border-[#B28C5A]/60 transition-all shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>🖼️ 把此图作为新客厅底图</span>
                      <span className="text-[9px] bg-[#B28C5A]/10 text-[#B28C5A] px-1.5 py-0.2 rounded font-mono">迭代素材</span>
                    </span>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">将当前图自动转为新底图，可在此基础上继续叠加选新沙发或换硬装</p>
                  </div>
                  <button
                    onClick={() => {
                      setSceneImageUrl(generatedImageUrl);
                      setErrorMessage('✅ 已将当前效果图载入为新的客户场景底图！您可以挑选新产品或展开左侧选择其他家具进行新一轮换装融合！');
                    }}
                    className="shrink-0 px-3.5 py-2 bg-gradient-to-r from-[#B28C5A] to-[#C9A066] hover:from-[#A17C4B] hover:to-[#B89057] text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    🚀 转为底图
                  </button>
                </div>

                {/* 2. 修改需求重新出图 */}
                <div className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3 hover:border-[#B28C5A]/60 transition-all shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>✏️ 修改细节需求重新出图</span>
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">微调重构</span>
                    </span>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">自动把生成此图时的意向载入至高级调优，方便追加修改意见后重新生成</p>
                  </div>
                  <button
                    onClick={() => {
                      if (activeHistoryItem) {
                        setPromptConstraint(activeHistoryItem.prompt);
                      }
                      setOpenSections(prev => ({ ...prev, advanced: true }));
                      setErrorMessage('✅ 定制要求区已在下方左侧“高级调优”为您展开！您可以在原有描述上直接添加您的修改意见！');
                    }}
                    className="shrink-0 px-3.5 py-2 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    📋 修改意向
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= 网页端专属：画布下沿核心操作台 (极光紫微渐变 + 悬浮相册保存按钮) ================= */}
          <div className="hidden sm:flex mt-4 p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-xl border border-indigo-500/30 items-center justify-between gap-4 relative overflow-hidden group">
            <div className="flex items-center gap-3 min-w-0 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-400/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-400/30">
                    AI 极速换装就绪
                  </span>
                </div>
                <div className="text-xs text-slate-300 truncate mt-1">
                  当前选定: <strong className="text-white font-bold">{selectionMode === 'ai' ? '✨ 智能搭配选品' : selectionMode === 'custom' ? '🖼️ 客户自选参考图' : selectedProduct?.name || '极简沙发'}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative z-10">
              {generatedImageUrl && (
                <button
                  onClick={handleDownloadResult}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer shadow-sm"
                >
                  <Download size={15} />
                  <span>💾 保存到相册</span>
                </button>
              )}

              <button
                onClick={handleGenerateFusion}
                disabled={isGenerating}
                className="flex items-center justify-center gap-2.5 px-7 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:via-indigo-500 hover:to-blue-500 active:scale-95 text-white text-sm font-extrabold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all disabled:opacity-50 cursor-pointer border border-white/20 overflow-hidden group/btn2"
              >
                <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover/btn2:translate-x-[300%] transition-transform duration-1000 ease-in-out" />
                <Sparkles size={18} className="text-amber-200 animate-pulse shrink-0" />
                <span className="tracking-wide">{isGenerating ? '⚡ AI 实时渲染中...' : generatedImageUrl ? '🔄 重新生成方案' : '✨ 一键实景融合 (AI 极速换装)'}</span>
              </button>
            </div>
          </div>

          {/* ================= 历史方案快览 (独立选取预览) ================= */}
          {historyItems.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B28C5A]" />
                  <span className="text-xs font-bold text-slate-700">历史方案快览</span>
                  <span className="text-[10px] text-slate-400">(点击任意项即可立刻预览，与后台正在进行的 AI 生成不冲突)</span>
                </div>
                <button
                  onClick={() => setShowHistoryModal(true)}
                  className="text-xs font-bold text-[#B28C5A] hover:underline flex items-center gap-1"
                >
                  <span>全部方案 ({historyItems.length})</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                {historyItems.slice(0, 8).map((item) => {
                  const isCurrent = generatedImageUrl === item.imageUrl;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setGeneratedImageUrl(item.imageUrl);
                        setActiveHistoryItem(item);
                        setIsComparing(false);
                      }}
                      className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden cursor-pointer border-2 transition-all group/hist ${
                        isCurrent ? 'border-[#B28C5A] ring-2 ring-[#B28C5A]/30 scale-105 shadow-md' : 'border-slate-200 hover:border-[#B28C5A]/60 opacity-80 hover:opacity-100'
                      }`}
                      title={`生成于 ${new Date(item.timestamp).toLocaleTimeString()}${item.duration ? ` · 耗时${item.duration}s` : ''}`}
                    >
                      <img src={item.imageUrl} alt="hist" className="w-full h-full object-cover" />
                      {item.duration && (
                        <span className="absolute bottom-0.5 right-0.5 bg-black/75 text-emerald-400 font-mono text-[8px] px-1 rounded backdrop-blur-2xs">
                          {item.duration}s
                        </span>
                      )}
                      {isCurrent && (
                        <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-[#B28C5A] text-white flex items-center justify-center text-[8px]">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {enableEdgeResize && (
            <div
              onMouseDown={(e) => startResize(e, 'canvas', canvasHeight)}
              className="h-4 mt-3 -mx-4 md:-mx-6 -mb-4 md:-mb-6 rounded-b-3xl bg-slate-50 hover:bg-[#B28C5A]/15 cursor-ns-resize flex items-center justify-center border-t border-slate-200 transition-all group select-none"
              title="按住鼠标拖拽：自由调整画布窗口整体高度"
            >
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 group-hover:text-[#B28C5A] font-bold">
                <SlidersHorizontal size={13} className="group-hover:scale-110 transition-transform" />
                <span>鼠标下拉：拉伸/缩放画布窗体高度 ({Math.round(canvasHeight)}px)</span>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* ---------------- 移动端底部悬浮吸顶操作条 (同步极光流光 UI) ---------------- */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 px-4 pt-3 pb-safe shadow-2xl flex flex-col gap-2.5 text-white">
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
            <span className="text-[11px] text-slate-300 font-bold truncate">
              当前: <strong className="text-amber-300">{selectionMode === 'ai' ? '✨ 智能搭配选品' : selectionMode === 'custom' ? '🖼️ 客户参考图' : selectedProduct?.name || '极简沙发'}</strong>
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
            换装就绪
          </span>
        </div>
        
        <div className="flex items-center gap-2.5 w-full pb-3">
          {generatedImageUrl && (
            <button
              onClick={handleDownloadResult}
              className="px-4 py-3.5 rounded-xl bg-white/15 active:bg-white/25 text-white text-xs font-bold border border-white/20 flex items-center justify-center gap-1.5 shrink-0"
              title="保存效果图"
            >
              <Download size={16} />
              <span>保存</span>
            </button>
          )}
          <button
            onClick={handleGenerateFusion}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 active:from-violet-700 active:to-blue-700 text-white text-sm font-extrabold shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all disabled:opacity-50 border border-white/20"
          >
            <Sparkles size={18} className="text-amber-200 animate-pulse" />
            <span>{isGenerating ? '⚡ AI 正在算力重构...' : generatedImageUrl ? '🔄 重新换装生成' : '✨ 一键实景融合'}</span>
          </button>
        </div>
      </div>

      {/* ---------------- 历史记录模态框 ---------------- */}
      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        historyItems={historyItems}
        onHistoryUpdated={loadHistory}
        onUsePrompt={(promptStr) => setPromptConstraint(promptStr)}
        onSelectImage={(item) => {
          setGeneratedImageUrl(item.imageUrl);
          setActiveHistoryItem(item);
          setShowHistoryModal(false);
        }}
      />

      {/* ---------------- 新增产品录入模态框 ---------------- */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200 animate-fade-in max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-4">
                <h3 className="text-sm font-bold text-stone-900">批量录入新资产</h3>
                <div className="flex bg-stone-100 p-0.5 rounded-xl border border-stone-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isBulkUploading && bulkEntryType !== 'product') {
                        setBulkEntryType('product');
                        setBulkUploadTasks([]);
                      }
                    }}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      bulkEntryType === 'product'
                        ? 'bg-white text-[#B28C5A] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span className="flex items-center gap-1"><Armchair size={13} /> 产品选配库</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isBulkUploading && bulkEntryType !== 'scene') {
                        setBulkEntryType('scene');
                        setBulkUploadTasks([]);
                      }
                    }}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      bulkEntryType === 'scene'
                        ? 'bg-white text-[#B28C5A] shadow-xs'
                        : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    <span className="flex items-center gap-1"><ImageIcon size={13} /> 客户实景空间</span>
                  </button>
                </div>
              </div>
              <button onClick={() => {
                setShowAddProductModal(false);
                setBulkUploadTasks([]);
              }} className="text-stone-400 hover:text-stone-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingBulk(true); }}
                onDragLeave={() => setIsDraggingBulk(false)}
                onDrop={handleDropBulk}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all ${
                  isDraggingBulk
                    ? 'border-[#B28C5A] bg-[#F9F5EF]/50 scale-[1.01]'
                    : 'border-stone-200 hover:border-[#B28C5A] bg-stone-50'
                }`}
              >
                <Upload size={32} className="text-[#B28C5A] mb-3" />
                <p className="text-sm font-bold text-stone-700">
                  {bulkEntryType === 'product' ? '点击或拖拽选取多张产品图片' : '点击或拖拽选取多张客户实景空间图'}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {bulkEntryType === 'product'
                    ? '支持批量上传，AI 自动并发识别产品分类及特征存入产品库'
                    : '支持批量上传，AI 自动并发识别空间风格与光照特征存入实景库'}
                </p>
                <label className="mt-4 px-6 py-2 rounded-xl text-xs font-bold text-white bg-[#B28C5A] hover:bg-[#9B7748] cursor-pointer shadow-xs transition-colors">
                  选择图片
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkFileSelect} />
                </label>
              </div>

              {bulkUploadTasks.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-stone-700">待处理队列 ({bulkUploadTasks.length})</span>
                    <div className="flex items-center gap-2">
                      {!isBulkUploading && (
                        <button
                          type="button"
                          onClick={() => setBulkUploadTasks([])}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-lg text-xs font-bold transition-colors"
                        >
                          清空队列
                        </button>
                      )}
                      {!isBulkUploading && bulkUploadTasks.some(t => t.status === 'pending' || t.status === 'error') && (
                        <button
                          type="button"
                          onClick={startBulkUpload}
                          className="px-3 py-1.5 bg-[#B28C5A] hover:bg-[#9B7748] text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                        >
                          <Sparkles size={14} /> {bulkEntryType === 'product' ? '开始 AI 并发识别与上传' : '开始 AI 识别并录入实景空间'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div 
                    className="overflow-y-auto pr-2 space-y-2 custom-scrollbar transition-all"
                    style={{ maxHeight: `${bulkHeight}px`, minHeight: '160px' }}
                  >
                    {bulkUploadTasks.map(task => (
                      <div key={task.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100 group">
                        <div data-wheel-zoom="true" className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-stone-200">
                          <img
                            src={task.preview}
                            alt="preview"
                            onWheel={(e) => handleThumbnailWheel(e, task.preview)}
                            style={{
                              transform: `scale(${thumbnailScaleMap[task.preview] || 1})`,
                              transition: 'transform 0.15s ease-out'
                            }}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = FALLBACK_PRODUCT_IMG;
                            }}
                            className="w-full h-full object-cover"
                          />
                          {(thumbnailScaleMap[task.preview] || 1) !== 1 && (
                            <span
                              onClick={(e) => { e.stopPropagation(); setThumbnailScaleMap(prev => ({ ...prev, [task.preview]: 1 })); }}
                              className="absolute bottom-0.5 left-0.5 bg-black/75 hover:bg-black text-white text-[8px] px-1 py-0.5 rounded z-20 cursor-pointer shadow-xs font-mono"
                              title="点击恢复"
                            >
                              {Math.round((thumbnailScaleMap[task.preview] || 1) * 100)}%
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewModalImage({ url: task.preview, title: task.name || task.file.name, desc: `队列状态: ${task.status === 'done' ? '录入成功' : '等待处理'}` });
                              setPreviewZoom(1);
                            }}
                            className="absolute inset-0 bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="放大预览"
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-stone-800 truncate">
                            {task.name || task.file.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {task.status === 'pending' && <span className="text-[10px] text-stone-400 bg-stone-200 px-2 py-0.5 rounded">等待中</span>}
                            {task.status === 'uploading' && <span className="text-[10px] text-[#B28C5A] bg-[#F9F5EF] px-2 py-0.5 rounded flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> 上传存储中</span>}
                            {task.status === 'analyzing' && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1"><Wand2 size={10} className="animate-spin" /> AI 并发分析中</span>}
                            {task.status === 'done' && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1"><Check size={10} /> 录入成功</span>}
                            {task.status === 'error' && <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1"><X size={10} /> 处理失败</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBulkUploadTasks(prev => prev.filter(p => p.id !== task.id))}
                          className="w-6 h-6 flex items-center justify-center text-stone-400 hover:text-red-500 rounded-md hover:bg-stone-200 shrink-0"
                          disabled={isBulkUploading && (task.status === 'uploading' || task.status === 'analyzing')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {enableEdgeResize && bulkUploadTasks.length > 0 && (
                <div
                  onMouseDown={(e) => startResize(e, 'bulk', bulkHeight)}
                  className="h-3.5 mt-4 -mx-6 -mb-6 rounded-b-3xl bg-stone-100 hover:bg-[#B28C5A]/20 cursor-ns-resize flex items-center justify-center border-t border-stone-200 transition-all group select-none"
                  title="按住鼠标拖拽：自由调整上传队列展示窗口高度"
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-500 group-hover:text-[#B28C5A] font-bold">
                    <SlidersHorizontal size={11} className="group-hover:scale-110 transition-transform" />
                    <span>拉伸队列列表高度 ({Math.round(bulkHeight)}px)</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 图像高清放大/视窗调整预览模态框 (Lightbox Modal) ---------------- */}
      {previewModalImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewModalImage(null)}
        >
          <div 
            className="relative bg-stone-900/90 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶栏信息与控制器 */}
            <div className="flex items-center justify-between p-4 bg-stone-900/80 border-b border-white/10 text-white z-10 shrink-0">
              <div className="min-w-0 pr-4">
                <h4 className="text-sm font-bold truncate">{previewModalImage.title || '图像放大预览'}</h4>
                {previewModalImage.desc && <p className="text-xs text-stone-400 truncate mt-0.5">{previewModalImage.desc}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="缩小视窗 (Zoom Out)"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs font-mono px-2 text-stone-300">{Math.round(previewZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(prev => Math.min(3, prev + 0.25))}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="放大视窗 (Zoom In)"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(1)}
                  className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                  title="重置视窗尺寸"
                >
                  1:1 默认
                </button>
                <a
                  href={previewModalImage.url}
                  download="MH_Image_Preview.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-[#B28C5A] hover:bg-[#9B7748] text-white transition-colors ml-2"
                  title="下载原图"
                >
                  <Download size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModalImage(null)}
                  className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors ml-1"
                  title="关闭预览"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 图像视窗主体（允许滚动翻查与缩放展示） */}
            <div 
              data-wheel-zoom="true"
              onWheel={(e) => {
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.2 : 0.2;
                setPreviewZoom(prev => Math.max(0.5, Math.min(4, prev + delta)));
              }}
              style={{ touchAction: previewZoom > 1 ? 'none' : 'pan-y', overscrollBehavior: 'contain' }}
              className="flex-1 overflow-hidden p-6 flex items-center justify-center min-h-[500px] bg-stone-950/50"
            >
              <div 
                className="transition-transform duration-200 ease-out flex items-center justify-center"
                style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center' }}
              >
                <img
                  src={previewModalImage.url || undefined}
                  alt={previewModalImage.title || '预览'}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/presets/products/sofa_burgundy.jpg';
                  }}
                  className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/5"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 预设家具素材（精准选配库）编辑/新增模态框 ---------------- */}
      {productModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setProductModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-100 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-[#F9F5EF] border-b border-stone-200">
              <div className="flex items-center gap-2 text-[#B28C5A] font-bold">
                {editingProduct ? <Edit2 size={18} /> : <Plus size={18} />}
                <h3 className="text-base text-stone-800 font-bold">
                  {editingProduct ? `编辑预设素材：${editingProduct.name}` : '添加自定义预设家具素材'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  产品名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：MH 意式极简云朵真皮沙发"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A] focus:ring-1 focus:ring-[#B28C5A]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  所属分类
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { id: 'sofa', label: '沙发' },
                    { id: 'chair', label: '单椅' },
                    { id: 'table', label: '茶几' },
                    { id: 'dining', label: '餐桌' },
                    { id: 'bed', label: '软床' }
                  ].map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setProductForm(prev => ({ ...prev, category: c.id }))}
                      className={`py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        productForm.category === c.id
                          ? 'border-[#B28C5A] bg-[#B28C5A]/10 text-[#B28C5A] font-bold'
                          : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  素材图片 (URL链接或本地上传) <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={productForm.imageUrl}
                      onChange={(e) => setProductForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="粘贴图片URL，或从右侧本地上传..."
                      className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A]"
                    />
                    <label className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium cursor-pointer transition-colors shrink-0 flex items-center gap-1">
                      {uploadingProductImg ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-[#B28C5A]" />
                          <span>正在上传...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>本地图片</span>
                        </>
                      )}
                      <input type="file" accept="image/*" disabled={uploadingProductImg} onChange={handleProductModalFileUpload} className="hidden" />
                    </label>
                  </div>
                  {productForm.imageUrl && (
                    <div className="relative aspect-16/9 w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center">
                      <img
                        src={productForm.imageUrl}
                        alt="预设素材预览"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = FALLBACK_PRODUCT_IMG;
                        }}
                        className="max-h-48 w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  设计特色与材质描述
                </label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简单记录材质、颜色、风格特征，便于AI匹配与推荐..."
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A] resize-y min-h-[70px] max-h-[300px] custom-scrollbar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  风格标签 (用逗号分隔)
                </label>
                <input
                  type="text"
                  value={productForm.tagsStr}
                  onChange={(e) => setProductForm(prev => ({ ...prev, tagsStr: e.target.value }))}
                  placeholder="例如：意式极简, 头层牛皮, 悬浮床"
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-stone-50 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setProductModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                className="px-5 py-2 bg-[#B28C5A] hover:bg-[#9B7748] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>{editingProduct ? '保存修改' : '确认添加'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 快速演示试用例图 编辑/新增模态框 ---------------- */}
      {sceneModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSceneModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-stone-100 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-[#F9F5EF] border-b border-stone-200">
              <div className="flex items-center gap-2 text-[#B28C5A] font-bold">
                {editingSceneIndex !== null ? <Edit2 size={18} /> : <Plus size={18} />}
                <h3 className="text-base text-stone-800 font-bold">
                  {editingSceneIndex !== null ? '编辑预设演示图' : '新增示范场景图片'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSceneModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  场景名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sceneForm.name}
                  onChange={(e) => setSceneForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如：法式奶油风温馨客厅"
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  图片链接或本地文件 <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sceneForm.url}
                      onChange={(e) => setSceneForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="粘贴图片URL，或从本地上传..."
                      className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A]"
                    />
                    <label className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-medium cursor-pointer transition-colors shrink-0 flex items-center gap-1">
                      {uploadingSceneImg ? (
                        <>
                          <Loader2 size={13} className="animate-spin text-[#B28C5A]" />
                          <span>正在上传...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>上传图片</span>
                        </>
                      )}
                      <input type="file" accept="image/*" disabled={uploadingSceneImg} onChange={handleSceneModalFileUpload} className="hidden" />
                    </label>
                  </div>
                  {sceneForm.url && (
                    <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center">
                      <img
                        src={sceneForm.url}
                        alt="场景预览"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = '/presets/scenes/scene_italian_warm.jpg';
                        }}
                        className="max-h-48 w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  空间说明或特征
                </label>
                <textarea
                  rows={2}
                  value={sceneForm.desc}
                  onChange={(e) => setSceneForm(prev => ({ ...prev, desc: e.target.value }))}
                  placeholder="例如：原设需替换旧家具，大理石地面空间..."
                  className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-[#B28C5A] resize-y min-h-[60px] max-h-[300px] custom-scrollbar"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-stone-50 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setSceneModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveScene}
                className="px-5 py-2 bg-[#B28C5A] hover:bg-[#9B7748] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Check size={14} strokeWidth={2.5} />
                <span>{editingSceneIndex !== null ? '保存修改' : '确认新增'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 通用弹窗确认框（替代 window.confirm 以确保在任何浏览/iframe环境直接生效） ---------------- */}
      {confirmDialog && confirmDialog.isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setConfirmDialog(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-stone-100 flex flex-col transform animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-[#B28C5A]">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-stone-800">{confirmDialog.title}</h3>
              <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-stone-50 border-t border-stone-200">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-800 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.onConfirm()}
                className={`flex-1 px-4 py-2 ${
                  confirmDialog.title.includes('提示') 
                    ? 'bg-[#B28C5A] hover:bg-[#9B7748]' 
                    : 'bg-red-600 hover:bg-red-700'
                } text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1`}
              >
                <Check size={14} />
                <span>{confirmDialog.title.includes('提示') ? '我知道了' : '确定执行'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
