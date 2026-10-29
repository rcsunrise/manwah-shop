import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Undo2, MousePointer2, Sparkles } from './IconsNew';
import { Eraser, Square, PenTool, Pentagon } from 'lucide-react';
import { MaskRect, MaskStroke, Point } from '../types';

interface ProductChannelMaskProps {
  imageUrl: string;
  initialRects?: MaskRect[];
  initialStrokes?: MaskStroke[];
  onClose: () => void;
  onSave: (cleanImageBlob: Blob, maskImageBlob: Blob, rects: MaskRect[], maskDataUrl: string, maskOverlayUrl: string, strokes?: MaskStroke[]) => void;
  onQuickWhiteBackground?: () => void;
}

export const ProductChannelMask: React.FC<ProductChannelMaskProps> = ({
  imageUrl,
  initialRects,
  initialStrokes,
  onClose,
  onSave,
  onQuickWhiteBackground
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<MaskRect[]>(initialRects || []);
  const [strokes, setStrokes] = useState<MaskStroke[]>(initialStrokes || []);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<MaskStroke | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(0.05);
  const [selectedTool, setSelectedTool] = useState<'brush' | 'eraser' | 'rect' | 'polygon'>('brush');
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [hoverClientPos, setHoverClientPos] = useState<{x: number, y: number} | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Draw canvas
  useEffect(() => {
    if (!image || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match image aspect ratio but fit in container
    const container = containerRef.current;
    const containerRatio = container.clientWidth / container.clientHeight;
    const imageRatio = image.width / image.height;

    let drawWidth, drawHeight;
    if (imageRatio > containerRatio) {
      drawWidth = container.clientWidth;
      drawHeight = drawWidth / imageRatio;
    } else {
      drawHeight = container.clientHeight;
      drawWidth = drawHeight * imageRatio;
    }

    canvas.width = drawWidth;
    canvas.height = drawHeight;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Create offscreen canvas for uniform mask overlay
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;

    const drawStroke = (stroke: MaskStroke) => {
      if (stroke.tool === 'eraser') {
        overlayCtx.globalCompositeOperation = 'destination-out';
        overlayCtx.strokeStyle = 'black';
        overlayCtx.fillStyle = 'black';
      } else {
        overlayCtx.globalCompositeOperation = 'source-over';
        overlayCtx.strokeStyle = 'red';
        overlayCtx.fillStyle = 'red';
      }
      
      if (stroke.tool === 'polygon') {
        if (stroke.points.length === 0) return;
        overlayCtx.beginPath();
        stroke.points.forEach((point, index) => {
          const x = point.x * canvas.width;
          const y = point.y * canvas.height;
          if (index === 0) overlayCtx.moveTo(x, y);
          else overlayCtx.lineTo(x, y);
        });
        overlayCtx.closePath();
        overlayCtx.fill();
      } else if (stroke.tool === 'rect') {
        if (stroke.points.length === 0) return;
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        const x = Math.min(start.x, end.x) * canvas.width;
        const y = Math.min(start.y, end.y) * canvas.height;
        const w = Math.abs(start.x - end.x) * canvas.width;
        const h = Math.abs(start.y - end.y) * canvas.height;
        overlayCtx.fillRect(x, y, w, h);
      } else {
        overlayCtx.lineWidth = stroke.width * canvas.width;
        overlayCtx.lineCap = 'round';
        overlayCtx.lineJoin = 'round';
        overlayCtx.beginPath();
        stroke.points.forEach((point, index) => {
          const x = point.x * canvas.width;
          const y = point.y * canvas.height;
          if (index === 0) {
            overlayCtx.moveTo(x, y);
          } else {
            overlayCtx.lineTo(x, y);
          }
        });
        overlayCtx.stroke();
      }
    };

    strokes.forEach(drawStroke);
    if (currentStroke) {
      drawStroke(currentStroke);
    }
    if (selectedTool === 'polygon' && polygonPoints.length > 0) {
      overlayCtx.globalCompositeOperation = 'source-over';
      overlayCtx.strokeStyle = 'red';
      overlayCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      overlayCtx.lineWidth = 2;
      overlayCtx.beginPath();
      polygonPoints.forEach((point, index) => {
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        if (index === 0) overlayCtx.moveTo(x, y);
        else overlayCtx.lineTo(x, y);
      });
      if (hoverClientPos && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const hoverX = ((hoverClientPos.x - rect.left) / rect.width) * canvas.width;
        const hoverY = ((hoverClientPos.y - rect.top) / rect.height) * canvas.height;
        overlayCtx.lineTo(hoverX, hoverY);
      }
      overlayCtx.closePath();
      overlayCtx.stroke();
      overlayCtx.fill();

      const startX = polygonPoints[0].x * canvas.width;
      const startY = polygonPoints[0].y * canvas.height;
      overlayCtx.beginPath();
      overlayCtx.arc(startX, startY, Math.max(canvas.width, canvas.height) * 0.02, 0, Math.PI * 2);
      overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      overlayCtx.fill();
      overlayCtx.stroke();
    }

    // Draw overlay onto main canvas with 50% opacity
    ctx.globalAlpha = 0.5;
    ctx.drawImage(overlayCanvas, 0, 0);
    ctx.globalAlpha = 1.0;
  }, [image, strokes, currentStroke, polygonPoints, hoverClientPos, selectedTool]);

  const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };


  const updateHoverPos = (e: React.MouseEvent | React.TouchEvent) => {
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        return;
      }
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    setHoverClientPos({ x: clientX, y: clientY });
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    updateHoverPos(e);
    const pos = getMousePos(e);
    
    if (selectedTool === 'polygon') {
      if (polygonPoints.length > 0) {
        const firstPoint = polygonPoints[0];
        const dx = pos.x - firstPoint.x;
        const dy = pos.y - firstPoint.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 0.02) {
          setStrokes([...strokes, { points: polygonPoints, width: 0, tool: 'polygon' }]);
          setPolygonPoints([]);
          return;
        }
      }
      setPolygonPoints([...polygonPoints, pos]);
      return;
    }

    setIsDrawing(true);
    setCurrentStroke({ points: [pos], width: strokeWidth, tool: selectedTool });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    updateHoverPos(e);
    if (!isDrawing || !currentStroke) return;
    const pos = getMousePos(e);
    
    setCurrentStroke({
      ...currentStroke,
      points: [...currentStroke.points, pos]
    });
  };

  const handleEnd = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    if (currentStroke.points.length > 0) {
      setStrokes([...strokes, currentStroke]);
    }
    setCurrentStroke(null);
  };

  const handleUndo = () => {
    setStrokes(strokes.slice(0, -1));
  };

  const [previewMaskUrl, setPreviewMaskUrl] = useState<string | null>(null);

  const drawMaskStroke = (ctx: CanvasRenderingContext2D, stroke: MaskStroke, canvasWidth: number, canvasHeight: number) => {
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'black';
      ctx.fillStyle = 'black';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'white';
      ctx.fillStyle = 'white';
    }

    if (stroke.tool === 'polygon') {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * canvasWidth;
        const y = point.y * canvasHeight;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    } else if (stroke.tool === 'rect') {
      if (stroke.points.length === 0) return;
      const start = stroke.points[0];
      const end = stroke.points[stroke.points.length - 1];
      const x = Math.min(start.x, end.x) * canvasWidth;
      const y = Math.min(start.y, end.y) * canvasHeight;
      const w = Math.abs(start.x - end.x) * canvasWidth;
      const h = Math.abs(start.y - end.y) * canvasHeight;
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.lineWidth = stroke.width * canvasWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach((point, index) => {
        const x = point.x * canvasWidth;
        const y = point.y * canvasHeight;
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  };

  const generateMaskPreview = async () => {
    if (!image) return;
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;
    
    // Fill black background
    maskCtx.globalCompositeOperation = 'source-over';
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    strokes.forEach(stroke => drawMaskStroke(maskCtx, stroke, maskCanvas.width, maskCanvas.height));

    const dataUrl = maskCanvas.toDataURL('image/png');
    setPreviewMaskUrl(dataUrl);
  };

  const handleSave = async () => {
    if (!image) return;
    setIsSaving(true);

    try {
      const MAX_DIMENSION = 1536;
      let targetWidth = image.width;
      let targetHeight = image.height;
      if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round(targetHeight * (MAX_DIMENSION / targetWidth));
          targetWidth = MAX_DIMENSION;
        } else {
          targetWidth = Math.round(targetWidth * (MAX_DIMENSION / targetHeight));
          targetHeight = MAX_DIMENSION;
        }
      }

      // 1. Create clean image blob (original image)
      const cleanCanvas = document.createElement('canvas');
      cleanCanvas.width = targetWidth;
      cleanCanvas.height = targetHeight;
      const cleanCtx = cleanCanvas.getContext('2d');
      if (!cleanCtx) throw new Error('Could not get 2d context');
      cleanCtx.drawImage(image, 0, 0, targetWidth, targetHeight);
      
      const cleanBlob = await new Promise<Blob>((resolve, reject) => {
        cleanCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Failed to create clean blob')), 'image/jpeg', 0.80);
      });

      // 2. Create mask image blob
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = targetWidth;
      maskCanvas.height = targetHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) throw new Error('Could not get 2d context');
      
      // Fill black background
      maskCtx.globalCompositeOperation = 'source-over';
      maskCtx.fillStyle = 'black';
      maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      strokes.forEach(stroke => drawMaskStroke(maskCtx, stroke, maskCanvas.width, maskCanvas.height));

      const maskBlob = await new Promise<Blob>((resolve, reject) => {
        maskCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Failed to create mask blob')), 'image/png');
      });

      const maskDataUrl = maskCanvas.toDataURL('image/png');

      // 3. Create transparent overlay with red strokes
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = targetWidth;
      overlayCanvas.height = targetHeight;
      const overlayCtx = overlayCanvas.getContext('2d');
      if (overlayCtx) {
        const drawRedStroke = (stroke: MaskStroke) => {
          if (stroke.tool === 'eraser') {
            overlayCtx.globalCompositeOperation = 'destination-out';
            overlayCtx.strokeStyle = 'black';
            overlayCtx.fillStyle = 'black';
          } else {
            overlayCtx.globalCompositeOperation = 'source-over';
            overlayCtx.strokeStyle = 'red';
            overlayCtx.fillStyle = 'red';
          }
          
          if (stroke.tool === 'rect') {
            if (stroke.points.length === 0) return;
            const start = stroke.points[0];
            const end = stroke.points[stroke.points.length - 1];
            const x = Math.min(start.x, end.x) * targetWidth;
            const y = Math.min(start.y, end.y) * targetHeight;
            const w = Math.abs(start.x - end.x) * targetWidth;
            const h = Math.abs(start.y - end.y) * targetHeight;
            overlayCtx.fillRect(x, y, w, h);
          } else {
            overlayCtx.lineWidth = Math.max(2, stroke.width * targetWidth);
            overlayCtx.lineCap = 'round';
            overlayCtx.lineJoin = 'round';
            overlayCtx.beginPath();
            stroke.points.forEach((point, index) => {
              const x = point.x * targetWidth;
              const y = point.y * targetHeight;
              if (index === 0) overlayCtx.moveTo(x, y);
              else overlayCtx.lineTo(x, y);
            });
            overlayCtx.stroke();
          }
        };

        strokes.forEach(drawRedStroke);
      }
      const overlayDataUrl = overlayCanvas.toDataURL('image/png');

      onSave(cleanBlob, maskBlob, rects, maskDataUrl, overlayDataUrl, strokes);
    } catch (err) {
      console.error('Error generating mask:', err);
      alert('生成蒙版失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8">
      <div className="bg-brand-cream w-full max-w-5xl h-full max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-brand-taupe/20 bg-white/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/10 flex items-center justify-center text-brand-gold">
              <MousePointer2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-brand-charcoal">蒙版预处理 (Mask Pre-processor)</h2>
              <p className="text-xs text-stone-500">使用鼠标自由涂抹标记需要修改的区域</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 text-stone-400 hover:text-brand-charcoal transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex overflow-hidden">
          <div 
            ref={containerRef}
            className={`flex-1 bg-stone-100 relative overflow-hidden flex items-center justify-center ${previewMaskUrl ? 'hidden md:flex' : 'flex'} ${selectedTool === 'brush' || selectedTool === 'eraser' ? 'cursor-none' : 'cursor-crosshair'}`}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={(e) => {
              setHoverClientPos(null);
              handleEnd();
            }}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          >
            {!image && (
              <div className="absolute inset-0 flex items-center justify-center text-stone-400">
                加载图片中...
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              className="max-w-full max-h-full shadow-md"
              style={{ touchAction: 'none' }}
            />
            {hoverClientPos && (selectedTool === 'brush' || selectedTool === 'eraser') && canvasRef.current && (
              <div 
                className="fixed pointer-events-none rounded-full border border-black shadow-[0_0_0_1px_white] z-50 mix-blend-difference opacity-80"
                style={{
                  left: hoverClientPos.x,
                  top: hoverClientPos.y,
                  width: canvasRef.current.getBoundingClientRect().width * strokeWidth,
                  height: canvasRef.current.getBoundingClientRect().width * strokeWidth,
                  transform: 'translate(-50%, -50%)'
                }}
              />
            )}
          </div>

          {/* Preview Area */}
          {previewMaskUrl && (
            <div className="flex-1 bg-black relative overflow-hidden flex items-center justify-center border-l border-white/10">
              <div className="absolute top-4 left-4 text-white/50 text-sm font-medium z-10">
                蒙版预览 (Mask Preview)
              </div>
              <img 
                src={previewMaskUrl} 
                alt="Mask Preview" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-4 sm:p-6 bg-white border-t border-brand-taupe/20 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200">
              <button
                onClick={() => setSelectedTool('brush')}
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${selectedTool === 'brush' ? 'bg-white shadow-sm text-brand-gold' : 'text-stone-500 hover:text-stone-700'}`}
                title="画笔 (Brush)"
              >
                <PenTool className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedTool('rect')}
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${selectedTool === 'rect' ? 'bg-white shadow-sm text-brand-gold' : 'text-stone-500 hover:text-stone-700'}`}
                title="矩形 (Rectangle)"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedTool('polygon')}
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${selectedTool === 'polygon' ? 'bg-white shadow-sm text-brand-gold' : 'text-stone-500 hover:text-stone-700'}`}
                title="多边形 (Polygon)"
              >
                <Pentagon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedTool('eraser')}
                className={`p-2 rounded-lg flex items-center justify-center transition-colors ${selectedTool === 'eraser' ? 'bg-white shadow-sm text-brand-gold' : 'text-stone-500 hover:text-stone-700'}`}
                title="橡皮擦 (Eraser)"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-taupe text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              <Undo2 className="w-4 h-4" />
              撤销上一步
            </button>
            <div className="flex items-center gap-3 px-4 py-2 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-xs text-stone-500 font-medium">画笔大小</span>
              <input 
                type="range" 
                min="0.002" 
                max="0.2" 
                step="0.002" 
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                className="w-24 accent-brand-gold cursor-pointer"
              />
            </div>
            {onQuickWhiteBackground && (
              <button
                onClick={() => {
                  onQuickWhiteBackground();
                  handleSave();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors text-sm font-bold border border-blue-200"
              >
                <Sparkles className="w-4 h-4" />
                一键白底
              </button>
            )}
            <span className="text-xs text-stone-400">
              已绘制 {strokes.length} 个区域
            </span>
            {selectedTool === 'polygon' && polygonPoints.length > 2 && (
              <button
                onClick={() => {
                  setStrokes([...strokes, { points: polygonPoints, width: 0, tool: 'polygon' }]);
                  setPolygonPoints([]);
                }}
                className="px-3 py-1.5 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 rounded-lg text-xs font-bold transition-colors"
              >
                完成多边形 (Finish)
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => {
                if (previewMaskUrl) {
                  setPreviewMaskUrl(null);
                } else {
                  generateMaskPreview();
                }
              }}
              disabled={strokes.length === 0}
              className="px-6 py-2.5 rounded-xl text-brand-charcoal border border-brand-charcoal hover:bg-stone-50 transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewMaskUrl ? '关闭预览' : '预览蒙版'}
            </button>
            <button 
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-stone-500 hover:bg-stone-100 transition-colors text-sm font-bold"
            >
              取消
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving || !image}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-charcoal text-white hover:bg-black transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? '处理中...' : '保存并生成蒙版'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
