
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Move, Brush, Eraser, Type, Crop, Lasso, Wand2, Pipette, Stamp, Banana, 
    Sparkles, RefreshCw, Undo, Redo, Download, Upload, FilePlus, Settings, Layout, 
    Scaling, Layers, Sliders, Cpu, Trash2, Eye, EyeOff, RotateCw, Monitor, Instagram,
    Check, X, Bold, Italic, Loader2, Key, Info, Hand, BoxSelect, ImagePlus, PenTool, 
    Shuffle, Wand, Sun, SunDim, Contrast, Activity, ScanLine, Box, Aperture, 
    GripHorizontal, Palette, ZoomIn, Underline, AlignLeft, AlignCenter, AlignRight,
    Plus, PaintBucket, Droplets, BoxSelect as RectIcon, Search, ExternalLink
} from 'lucide-react';
import { useCanvasSystem } from './hooks/useCanvasSystem';
import { FloatingPanel } from './components/FloatingPanel';
import { GeminiService } from './services/geminiService';
import { 
    INITIAL_W, INITIAL_H, PROJECT_PRESETS, BG_PRESETS, CROP_RATIOS, FONTS 
} from './constants';
import { PanelsConfig, BrushProps, AIState, TextData, PanelState, ToolType, LayerType, GroundingSource } from './types';

const gemini = new GeminiService();

const TransformHandles: React.FC<{ 
    layer: any, zoom: number, pan: {x:number, y:number}, canvasSize: {w:number, h:number}, 
    onTransform: (e: React.MouseEvent, type: string) => void 
}> = ({ layer, zoom, pan, canvasSize, onTransform }) => {
    if (!layer) return null;
    const cx = layer.x + layer.canvas.width / 2;
    const cy = layer.y + layer.canvas.height / 2;
    const screenX = (cx - canvasSize.w/2) * zoom + (window.innerWidth/2 + pan.x);
    const screenY = (cy - canvasSize.h/2) * zoom + (window.innerHeight/2 + pan.y);
    const w = layer.canvas.width * Math.abs(layer.scaleX) * zoom;
    const h = layer.canvas.height * Math.abs(layer.scaleY) * zoom;
    const style: React.CSSProperties = { 
        transform: `translate(${screenX - w / 2}px, ${screenY - h / 2}px) rotate(${layer.rotation}deg)`, 
        width: `${w}px`, 
        height: `${h}px`,
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 40
    };
    const handleStyle = "absolute w-3 h-3 bg-white border border-blue-600 rounded-full z-50 pointer-events-auto cursor-pointer";
    return (
        <div style={style}>
            <div className="absolute top-0 left-0 border border-blue-500 w-full h-full">
                <div className={`${handleStyle} -top-1.5 -left-1.5 cursor-nw-resize`} onMouseDown={(e)=>onTransform(e, 'tl')}></div>
                <div className={`${handleStyle} -top-1.5 -right-1.5 cursor-ne-resize`} onMouseDown={(e)=>onTransform(e, 'tr')}></div>
                <div className={`${handleStyle} -bottom-1.5 -left-1.5 cursor-sw-resize`} onMouseDown={(e)=>onTransform(e, 'bl')}></div>
                <div className={`${handleStyle} -bottom-1.5 -right-1.5 cursor-se-resize`} onMouseDown={(e)=>onTransform(e, 'br')}></div>
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-5 h-5 bg-white border border-blue-600 rounded-full cursor-grab flex items-center justify-center" onMouseDown={(e)=>onTransform(e, 'rotate')}><RotateCw size={12} className="text-blue-600"/></div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const sys = useCanvasSystem();
    const rightX = window.innerWidth - 270;
    
    const [panels, setPanels] = useState<PanelsConfig>({
        tools: { x: 10, y: 60, visible: true, z: 20 },
        ai: { x: 80, y: 60, visible: true, z: 15 },
        format: { x: 80, y: 400, visible: true, z: 14 },
        layers: { x: rightX, y: 60, visible: true, z: 13 },
        settings: { x: rightX, y: 360, visible: true, z: 12 },
        resize: { x: rightX, y: 660, visible: true, z: 11 }
    });

    const [modals, setModals] = useState({ newProject: false });
    const [brushProps, setBrushProps] = useState<BrushProps>({ size: 20, color: '#000000' });
    // Fix: Corrected shadow initialization and removed 'as any'
    const [textProps, setTextProps] = useState<TextData>({ 
        text: 'Nuevo Texto', font: 'Inter', size: 100, bold: false, italic: false, underline: false, align: 'left', color: '#ffffff', strokeColor: '#000000', strokeWidth: 0, shadow: false 
    });
    
    const [aiState, setAiState] = useState<AIState>({ loading: false, feedback: '', sources: [] });
    
    const [bgAiPrompt, setBgAiPrompt] = useState('');
    const [showBgAiInput, setShowBgAiInput] = useState(false);
    const [cloneSource, setCloneSource] = useState<{x: number, y: number} | null>(null);
    const [activeAiTab, setActiveAiTab] = useState('generate');
    const [activeFormatCat, setActiveFormatCat] = useState<keyof typeof PROJECT_PRESETS>('social');

    const draggingPanel = useRef<string | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const transformAction = useRef<{type: string} | null>(null);

    const bringToFront = (name: string) => {
        setPanels(prev => {
            const maxZ = Math.max(...(Object.values(prev) as PanelState[]).map(p => p.z)) + 1;
            return { ...prev, [name]: { ...prev[name], z: maxZ } };
        });
    };

    const togglePanel = (key: string) => {
        setPanels(prev => ({ ...prev, [key]: { ...prev[key], visible: !prev[key].visible } }));
    };

    // Fix: Added missing handleTransformStart function
    const handleTransformStart = (e: React.MouseEvent, type: string) => {
        e.stopPropagation();
        transformAction.current = { type };
        sys.lastMouse.current = { x: e.clientX, y: e.clientY, isPan: false, cx: 0, cy: 0 };
    };

    const getCanvasPos = (clientX: number, clientY: number) => {
        const r = sys.mainCanvasRef.current!.getBoundingClientRect();
        return {
            x: (clientX - r.left - (window.innerWidth / 2 + sys.pan.x)) / sys.zoom + sys.canvasSize.w / 2,
            y: (clientY - r.top - (window.innerHeight / 2 + sys.pan.y)) / sys.zoom + sys.canvasSize.h / 2
        };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button === 1 || sys.tool === 'hand') {
            sys.isDrawing.current = true;
            sys.lastMouse.current = { x: e.clientX, y: e.clientY, isPan: true, cx: 0, cy: 0 };
            return;
        }

        const pos = getCanvasPos(e.clientX, e.clientY);
        sys.lastMouse.current = { x: e.clientX, y: e.clientY, cx: pos.x, cy: pos.y, isPan: false };

        if (sys.tool === 'move' && sys.activeLayerId) {
            sys.isDrawing.current = true;
        } else if (sys.tool === 'crop') {
            sys.isDrawing.current = true;
            sys.setLassoPoints([pos]);
        } else if (sys.tool === 'pipette') {
            const ctx = sys.mainCanvasRef.current!.getContext('2d')!;
            const r = sys.mainCanvasRef.current!.getBoundingClientRect();
            const p = ctx.getImageData(e.clientX - r.left, e.clientY - r.top, 1, 1).data;
            const hex = "#" + ((1 << 24) + (p[0] << 16) + (p[1] << 8) + p[2]).toString(16).slice(1);
            setBrushProps(prev => ({ ...prev, color: hex }));
        } else if (['brush', 'eraser'].includes(sys.tool) && sys.activeLayerId) {
            const l = sys.layers.find(x => x.id === sys.activeLayerId);
            if (l && (l.type === 'raster' || l.type === 'empty' || l.type === 'img')) {
                sys.isDrawing.current = true;
                l.ctx.beginPath();
                l.ctx.moveTo(pos.x - l.x, pos.y - l.y);
            }
        } else if (sys.tool === 'stamp') {
            if (e.altKey) {
                setCloneSource({ x: pos.x, y: pos.y });
            } else if (sys.activeLayerId && cloneSource) {
                sys.isDrawing.current = true;
                const l = sys.layers.find(x => x.id === sys.activeLayerId);
                if (l) {
                    l.ctx.beginPath();
                    l.ctx.moveTo(pos.x - l.x, pos.y - l.y);
                }
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (transformAction.current && sys.activeLayerId) {
            const l = sys.layers.find(x => x.id === sys.activeLayerId);
            if (!l) return;
            const dx = e.clientX - sys.lastMouse.current.x;
            const dy = e.clientY - sys.lastMouse.current.y;
            if (transformAction.current.type === 'rotate') {
                const r = sys.mainCanvasRef.current!.getBoundingClientRect();
                const cx = (l.x + l.canvas.width/2 - sys.canvasSize.w/2)*sys.zoom + window.innerWidth/2 + sys.pan.x;
                const cy = (l.y + l.canvas.height/2 - sys.canvasSize.h/2)*sys.zoom + window.innerHeight/2 + sys.pan.y;
                sys.updateLayer(l.id, { rotation: Math.atan2(e.clientY - r.top - cy, e.clientX - r.left - cx) * 180 / Math.PI + 90 });
            } else {
                const delta = (dx - dy) * 0.01;
                let s = l.scaleX + delta;
                if(s < 0.1) s = 0.1;
                sys.updateLayer(l.id, { scaleX: s, scaleY: s });
            }
            sys.lastMouse.current = { ...sys.lastMouse.current, x: e.clientX, y: e.clientY };
            return;
        }

        if (sys.isDrawing.current) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            if (sys.lastMouse.current.isPan) {
                sys.setPan(p => ({ x: p.x + (e.clientX - sys.lastMouse.current.x), y: p.y + (e.clientY - sys.lastMouse.current.y) }));
                sys.lastMouse.current = { ...sys.lastMouse.current, x: e.clientX, y: e.clientY };
            } else if (sys.tool === 'move' && sys.activeLayerId) {
                const l = sys.layers.find(x => x.id === sys.activeLayerId);
                if (l) {
                    sys.updateLayer(l.id, { 
                        x: l.x + (pos.x - sys.lastMouse.current.cx), 
                        y: l.y + (pos.y - sys.lastMouse.current.cy) 
                    });
                    sys.lastMouse.current = { ...sys.lastMouse.current, cx: pos.x, cy: pos.y };
                }
            } else if (sys.tool === 'crop') {
                const start = sys.lassoPoints[0];
                sys.setLassoPoints([start, {x: pos.x, y: start.y}, pos, {x: start.x, y: pos.y}]);
            } else if (sys.activeLayerId && (sys.tool === 'brush' || sys.tool === 'eraser')) {
                const l = sys.layers.find(x => x.id === sys.activeLayerId);
                if (l) {
                    l.ctx.lineWidth = brushProps.size;
                    l.ctx.lineCap = 'round';
                    l.ctx.lineJoin = 'round';
                    l.ctx.strokeStyle = sys.tool === 'eraser' ? '#000' : brushProps.color;
                    l.ctx.globalCompositeOperation = sys.tool === 'eraser' ? 'destination-out' : 'source-over';
                    l.ctx.lineTo(pos.x - l.x, pos.y - l.y);
                    l.ctx.stroke();
                }
            } else if (sys.activeLayerId && sys.tool === 'stamp' && cloneSource) {
                const l = sys.layers.find(x => x.id === sys.activeLayerId);
                if (l) {
                    const ctx = l.ctx;
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(pos.x - l.x, pos.y - l.y, brushProps.size / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(l.canvas, pos.x - l.x - cloneSource.x, pos.y - l.y - cloneSource.y);
                    ctx.restore();
                }
            }
        }
    };

    const handlePointerUp = () => {
        if (sys.isDrawing.current || transformAction.current) {
            sys.saveState(sys.layers);
        }
        sys.isDrawing.current = false;
        transformAction.current = null;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!e.ctrlKey) {
            const delta = -e.deltaY;
            const newZoom = Math.min(Math.max(0.05, sys.zoom * Math.pow(1.0015, delta)), 50);
            sys.setZoom(newZoom);
        } else {
            sys.setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    };

    const handleAIAction = async (action: string, payload: any) => {
        const aiStudio = (window as any).aistudio;
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (!hasKey) {
            await aiStudio.openSelectKey();
        }

        setAiState({ loading: true, feedback: "", sources: [] });
        try {
            switch(action) {
                case 'generate':
                case 'bg': {
                    const url = await gemini.generateImage(payload);
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        if (action === 'bg') sys.setBackground('image', img);
                        else sys.addLayer('img', img);
                        setAiState({ loading: false, feedback: "Procesado correctamente." });
                    };
                    img.src = url;
                    break;
                }
                case 'bg-smart': {
                    const url = await gemini.generateSmartBackground(payload);
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        sys.setBackground('image', img);
                        setAiState({ loading: false, feedback: "Fondo inteligente generado con Google Search." });
                    };
                    img.src = url;
                    break;
                }
                case 'research': {
                    const result = await gemini.researchTopic(payload);
                    setAiState({ loading: false, feedback: result.text, sources: result.sources });
                    break;
                }
                case 'remix': {
                    const canvas = sys.mainCanvasRef.current!;
                    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    const url = await gemini.remixImage(base64, payload);
                    const img = new Image();
                    img.onload = () => {
                        sys.addLayer('img', img);
                        setAiState({ loading: false, feedback: "Remix completado." });
                    };
                    img.src = url;
                    break;
                }
                case 'analyze': {
                    const canvas = sys.mainCanvasRef.current!;
                    const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                    const analysis = await gemini.analyzeDesign(base64);
                    setAiState({ loading: false, feedback: analysis });
                    break;
                }
            }
        } catch (e: any) {
            setAiState({ loading: false, feedback: "Error: " + e.message, sources: [] });
        }
    };

    const executeCrop = () => {
        if (sys.lassoPoints.length < 3) return;
        const xs = sys.lassoPoints.map(p => p.x);
        const ys = sys.lassoPoints.map(p => p.y);
        const minX = Math.round(Math.min(...xs));
        const maxX = Math.round(Math.max(...xs));
        const minY = Math.round(Math.min(...ys));
        const maxY = Math.round(Math.max(...ys));
        const w = maxX - minX;
        const h = maxY - minY;
        if (w < 1 || h < 1) return;
        sys.setCanvasSize({ w, h });
        const newLayers = sys.layers.map(l => {
             const nl = l.clone();
             nl.x -= minX;
             nl.y -= minY;
             return nl;
        });
        sys.setLayers(newLayers);
        sys.setLassoPoints([]);
        sys.setTool('move');
        sys.saveState(newLayers);
    };

    useEffect(() => {
        const render = () => {
            const canvas = sys.mainCanvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width/2 + sys.pan.x, canvas.height/2 + sys.pan.y); 
            ctx.scale(sys.zoom, sys.zoom); 
            ctx.translate(-sys.canvasSize.w/2, -sys.canvasSize.h/2);
            ctx.fillStyle = '#1a1a1a'; 
            ctx.fillRect(0, 0, sys.canvasSize.w, sys.canvasSize.h);
            ctx.fillStyle = '#222'; 
            for(let i=0; i<sys.canvasSize.w; i+=40) 
                for(let j=0; j<sys.canvasSize.h; j+=40) 
                    if((i/40+j/40)%2===0) ctx.fillRect(i,j,40,40);
            sys.layers.forEach(l => { 
                if (l.visible) { 
                    ctx.save(); 
                    ctx.globalAlpha = l.opacity / 100; 
                    ctx.globalCompositeOperation = l.blendMode; 
                    const cx = l.x + l.canvas.width/2; 
                    const cy = l.y + l.canvas.height/2; 
                    ctx.translate(cx, cy); 
                    ctx.rotate(l.rotation * Math.PI / 180); 
                    ctx.scale(l.scaleX, l.scaleY); 
                    ctx.translate(-cx, -cy);
                    ctx.drawImage(l.canvas, l.x, l.y); 
                    ctx.restore(); 
                } 
            });
            if (sys.lassoPoints.length > 0) {
                ctx.save(); 
                ctx.strokeStyle = '#0b57d0'; 
                ctx.lineWidth = 2/sys.zoom; 
                ctx.setLineDash([5, 5]);
                ctx.beginPath(); 
                ctx.moveTo(sys.lassoPoints[0].x, sys.lassoPoints[0].y);
                for (let i = 1; i < sys.lassoPoints.length; i++) ctx.lineTo(sys.lassoPoints[i].x, sys.lassoPoints[i].y);
                if (sys.lassoPoints.length > 2) ctx.closePath();
                ctx.stroke(); 
                ctx.restore();
            }
            ctx.restore();
        };
        const frame = requestAnimationFrame(function loop() {
            render();
            requestAnimationFrame(loop);
        });
        return () => cancelAnimationFrame(frame);
    }, [sys.layers, sys.pan, sys.zoom, sys.canvasSize, sys.lassoPoints]);

    return (
        <div className="h-full w-full bg-[#121212] flex flex-col overflow-hidden relative" onPointerUp={handlePointerUp}>
            <header className="h-12 bg-[#1f1f1f] border-b border-[#333] flex items-center justify-between px-4 z-50 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-blue-500 flex items-center gap-2"><Cpu size={18}/> Ce Tlakuilo Pro</span>
                    <div className="h-4 w-[1px] bg-[#444]"></div>
                    <div className="flex gap-1">
                        <button className="p-1.5 hover:bg-[#333] rounded" onClick={sys.undo} title="Undo"><Undo size={16}/></button>
                        <button className="p-1.5 hover:bg-[#333] rounded" onClick={sys.redo} title="Redo"><Redo size={16}/></button>
                    </div>
                    <div className="h-4 w-[1px] bg-[#444] mx-1"></div>
                    {['format', 'resize', 'layers', 'settings'].map(p => (
                        <button 
                            key={p} 
                            className={`p-1.5 rounded flex items-center gap-2 text-xs font-bold uppercase transition-all ${panels[p].visible ? 'bg-blue-600 text-white' : 'hover:bg-[#333] text-gray-300'}`} 
                            onClick={() => togglePanel(p)}
                        >
                            {p === 'format' ? <Layout size={16}/> : p === 'resize' ? <Scaling size={16}/> : p === 'layers' ? <Layers size={16}/> : <Sliders size={16}/>}
                            <span className="hidden md:inline">{p}</span>
                        </button>
                    ))}
                    <button 
                        className={`p-1.5 rounded flex items-center gap-2 text-xs font-bold uppercase ${panels.ai.visible ? 'bg-blue-600 text-white' : 'hover:bg-[#333] text-gray-300'}`} 
                        onClick={() => togglePanel('ai')}
                    >
                        <Sparkles size={16}/> <span className="hidden md:inline">IA</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setModals({newProject: true})} className="flex items-center gap-2 bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded text-xs font-bold transition-all"><FilePlus size={14}/> Nuevo</button>
                    <label className="flex items-center gap-2 bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded text-xs font-bold cursor-pointer transition-all"><Upload size={14}/> Subir <input type="file" hidden onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) { const img = new Image(); img.onload = () => sys.addLayer('img', img); img.src = URL.createObjectURL(f); }
                    }}/></label>
                    <div className="h-4 w-[1px] bg-[#444] mx-1"></div>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-2" onClick={() => {
                        const a = document.createElement('a'); a.download='tlakuilo_design.png'; a.href=sys.mainCanvasRef.current!.toDataURL(); a.click();
                    }}><Download size={14}/> Exportar</button>
                </div>
            </header>

            <div className="flex-1 relative overflow-hidden" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onWheel={handleWheel}>
                <canvas ref={sys.mainCanvasRef} width={window.innerWidth} height={window.innerHeight - 48} className="block cursor-crosshair"/>
                
                {sys.activeLayerId && sys.tool === 'move' && (
                    <TransformHandles layer={sys.layers.find(x => x.id === sys.activeLayerId)} zoom={sys.zoom} pan={sys.pan} canvasSize={sys.canvasSize} onTransform={handleTransformStart} />
                )}

                {panels.tools.visible && (
                    <FloatingPanel x={panels.tools.x} y={panels.tools.y} title="" initialWidth={56} zIndex={panels.tools.z} onDragStart={(e) => { bringToFront('tools'); draggingPanel.current = 'tools'; dragOffset.current = { x: e.clientX - panels.tools.x, y: e.clientY - panels.tools.y }; }}>
                        <div className="flex flex-col gap-2 items-center pb-2">
                            <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Select</div>
                            {(['move', 'rect', 'lasso', 'wand', 'crop'] as ToolType[]).map(t => (
                                <button key={t} onClick={()=>sys.setTool(t)} className={`p-2 rounded ${sys.tool===t?'bg-blue-600 text-white shadow-lg':'hover:bg-[#333] text-gray-400'}`}>
                                    {t==='move'?<Move size={18}/>:t==='rect'?<BoxSelect size={18}/>:t==='lasso'?<Lasso size={18}/>:t==='wand'?<Wand2 size={18}/>:<Crop size={18}/>}
                                </button>
                            ))}
                            <div className="w-full h-[1px] bg-[#333] my-1"></div>
                            <div className="text-[8px] text-gray-500 font-bold uppercase mb-1">Draw</div>
                            {(['brush', 'eraser', 'bucket', 'gradient', 'text', 'shape', 'stamp'] as ToolType[]).map(t => (
                                <button key={t} onClick={()=>sys.setTool(t)} className={`p-2 rounded ${sys.tool===t?'bg-blue-600 text-white shadow-lg':'hover:bg-[#333] text-gray-400'}`}>
                                    {t==='brush'?<Brush size={18}/>:t==='eraser'?<Eraser size={18}/>:t==='bucket'?<PaintBucket size={18}/>:t==='gradient'?<Droplets size={18}/>:t==='text'?<Type size={18}/>:t==='shape'?<RectIcon size={18}/>:<Stamp size={18}/>}
                                </button>
                            ))}
                            <div className="w-full h-[1px] bg-[#333] my-1"></div>
                            <button onClick={()=>sys.setTool('pipette')} className={`p-2 rounded ${sys.tool==='pipette'?'bg-blue-600 text-white shadow-lg':'hover:bg-[#333] text-gray-400'}`}><Pipette size={18}/></button>
                            <button onClick={()=>sys.setTool('hand')} className={`p-2 rounded ${sys.tool==='hand'?'bg-blue-600 text-white shadow-lg':'hover:bg-[#333] text-gray-400'}`}><Hand size={18}/></button>
                            <div className="w-8 h-8 rounded-full overflow-hidden mt-2 border border-[#555] cursor-pointer relative">
                                <input type="color" className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer opacity-0" value={brushProps.color} onChange={e=>setBrushProps({...brushProps, color:e.target.value})}/>
                                <div className="w-full h-full" style={{backgroundColor: brushProps.color}}></div>
                            </div>
                        </div>
                    </FloatingPanel>
                )}

                {panels.ai.visible && (
                    <FloatingPanel x={panels.ai.x} y={panels.ai.y} title="IA Creativa" initialWidth={320} zIndex={panels.ai.z} onClose={()=>togglePanel('ai')} onDragStart={(e) => { bringToFront('ai'); draggingPanel.current = 'ai'; dragOffset.current = { x: e.clientX - panels.ai.x, y: e.clientY - panels.ai.y }; }}>
                        <div className="flex flex-col gap-4">
                            <div className="flex bg-[#2a2a2a] rounded p-1 overflow-x-auto no-scrollbar">
                                {['generate','research','text','palette','remix','tips'].map(tab => (
                                    <button key={tab} onClick={() => setActiveAiTab(tab)} className={`flex-1 min-w-[60px] text-[9px] font-bold py-1.5 rounded flex flex-col items-center gap-1 capitalize ${activeAiTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                        {tab === 'generate' && <ImagePlus size={12}/>}
                                        {tab === 'research' && <Search size={12}/>}
                                        {tab === 'text' && <PenTool size={12}/>}
                                        {tab === 'palette' && <Palette size={12}/>}
                                        {tab === 'remix' && <Shuffle size={12}/>}
                                        {tab === 'tips' && <Info size={12}/>}
                                        <span>{tab === 'research' ? 'Investigar' : tab}</span>
                                    </button>
                                ))}
                            </div>
                            {(activeAiTab === 'generate' || activeAiTab === 'research' || activeAiTab === 'text') && (
                                <div className="space-y-3">
                                    <textarea value={bgAiPrompt} onChange={(e) => setBgAiPrompt(e.target.value)} placeholder={activeAiTab === 'research' ? "Investiga tendencias para..." : "Describe tu visión artística..."} className="h-24 w-full text-xs bg-[#111] border border-[#333] rounded p-2 text-white" />
                                    <button 
                                        onClick={() => activeAiTab === 'research' ? handleAIAction('research', bgAiPrompt) : handleAIAction('generate', bgAiPrompt)} 
                                        disabled={aiState.loading || !bgAiPrompt} 
                                        className="w-full bg-blue-600 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2"
                                    >
                                        {aiState.loading ? <RefreshCw className="animate-spin" size={14}/> : (activeAiTab === 'research' ? <Search size={14}/> : <Sparkles size={14}/>)} 
                                        {activeAiTab === 'research' ? 'Investigar' : 'Ejecutar'}
                                    </button>
                                </div>
                            )}
                            {activeAiTab === 'tips' && (
                                <button onClick={() => handleAIAction('analyze', null)} disabled={aiState.loading} className="w-full bg-purple-600 text-white font-bold py-2 rounded text-xs">Analizar Composición</button>
                            )}
                            {aiState.feedback && (
                                <div className="space-y-3">
                                    <div className="bg-[#2a2a2a] border border-[#444] rounded p-3 text-xs text-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap">{aiState.feedback}</div>
                                    {aiState.sources && aiState.sources.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Fuentes de Grounding</p>
                                            <div className="flex flex-col gap-1">
                                                {aiState.sources.map((source, idx) => (
                                                    <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 truncate transition-colors bg-blue-400/5 p-1 rounded border border-blue-400/10">
                                                        <ExternalLink size={10} className="shrink-0" /><span className="truncate">{source.title || source.uri}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </FloatingPanel>
                )}

                {panels.format.visible && (
                    <FloatingPanel x={panels.format.x} y={panels.format.y} title="Formato" initialWidth={380} zIndex={panels.format.z} onClose={()=>togglePanel('format')} onDragStart={(e) => { bringToFront('format'); draggingPanel.current = 'format'; dragOffset.current = { x: e.clientX - panels.format.x, y: e.clientY - panels.format.y }; }}>
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-1 overflow-x-auto pb-2 border-b border-[#333]">
                                {Object.entries(PROJECT_PRESETS).map(([key, data]) => (
                                    <button key={key} onClick={() => setActiveFormatCat(key as any)} className={`px-2 py-1 rounded whitespace-nowrap text-[10px] font-bold flex items-center gap-1 ${activeFormatCat === key ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-400 hover:text-white'}`}>
                                        <data.icon size={12}/> {data.label}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                                {PROJECT_PRESETS[activeFormatCat].items.map(item => (
                                    <button key={item.id} onClick={() => sys.createNewProject(item.w, item.h)} className="flex flex-col items-center justify-center p-3 bg-[#2a2a2a] hover:bg-[#333] rounded border border-[#444] hover:border-blue-500 transition-all text-center">
                                        <item.icon size={20} className="mb-1 text-gray-500"/><span className="text-[10px] font-bold text-gray-200">{item.label}</span><span className="text-[9px] text-gray-500">{item.w} x {item.h}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </FloatingPanel>
                )}

                {panels.layers.visible && (
                    <FloatingPanel x={panels.layers.x} y={panels.layers.y} title="Capas" initialWidth={250} zIndex={panels.layers.z} onClose={()=>togglePanel('layers')} onDragStart={(e) => { bringToFront('layers'); draggingPanel.current = 'layers'; dragOffset.current = { x: e.clientX - panels.layers.x, y: e.clientY - panels.layers.y }; }}>
                         <div className="mb-2 p-2 bg-[#2a2a2a] rounded border border-[#444]">
                            <div className="text-[10px] font-bold text-gray-400 mb-2 flex items-center justify-between">
                                <span>FONDO DEL LIENZO</span>
                                <button onClick={()=>setShowBgAiInput(!showBgAiInput)} className={`transition-colors ${showBgAiInput ? 'text-blue-400' : 'text-gray-500 hover:text-blue-300'}`} title="Generar fondo con IA"><Sparkles size={12}/></button>
                            </div>
                            <div className="flex gap-1 mb-2 flex-wrap">
                                <button onClick={() => sys.setBackground('transparent')} className="p-1 rounded bg-[#333] text-gray-400 hover:text-white" title="Fondo transparente"><Eraser size={14}/></button>
                                {BG_PRESETS.map((bg, i) => (
                                    <button key={i} onClick={() => sys.setBackground('color', bg)} className="w-5 h-5 rounded-full border border-[#444] hover:scale-110 transition-transform" style={{background: bg}}></button>
                                ))}
                            </div>
                            {showBgAiInput && (
                                <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={bgAiPrompt} 
                                            onChange={(e) => setBgAiPrompt(e.target.value)}
                                            placeholder="Describir fondo..."
                                            className="w-full text-[10px] bg-[#111] border border-[#333] rounded p-2 pr-8 text-white focus:border-blue-500 outline-none"
                                        />
                                        <Search size={12} className="absolute right-2.5 top-2.5 text-gray-500 pointer-events-none" />
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => handleAIAction('bg', bgAiPrompt)}
                                            disabled={aiState.loading || !bgAiPrompt}
                                            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[9px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                        >
                                            {aiState.loading ? <RefreshCw className="animate-spin" size={10}/> : <Sparkles size={10}/>} IA
                                        </button>
                                        <button 
                                            onClick={() => handleAIAction('bg-smart', bgAiPrompt)}
                                            disabled={aiState.loading || !bgAiPrompt}
                                            className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-[9px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                            title="Usa Google Search para optimizar el fondo"
                                        >
                                            {aiState.loading ? <RefreshCw className="animate-spin" size={10}/> : <Search size={10}/>} Smart
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2 mb-2 pb-2 border-b border-[#333]">
                            <button className="flex-1 bg-[#333] hover:bg-[#444] text-[10px] py-1 rounded font-bold" onClick={()=>sys.addLayer('empty')}>+ CAPA</button>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                            {[...sys.layers].reverse().map(l => (
                                <div key={l.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${sys.activeLayerId===l.id ? 'bg-blue-600/30 border border-blue-500/50' : 'hover:bg-[#2a2a2a]'}`} onClick={()=>sys.setActiveLayerId(l.id)}>
                                    <button onClick={(e)=>{e.stopPropagation(); sys.updateLayer(l.id, {visible:!l.visible});}}>{l.visible?<Eye size={14}/>:<EyeOff size={14} className="text-gray-600"/>}</button>
                                    <span className="text-[11px] flex-1 truncate">{l.name}</span>
                                    <button onClick={(e)=>{e.stopPropagation(); sys.setLayers(prev => prev.filter(x=>x.id!==l.id)); sys.setActiveLayerId(null);}} className="text-gray-500 hover:text-red-400"><Trash2 size={12}/></button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-2 border-t border-[#333]">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Opacidad</span><span>{sys.layers.find(x=>x.id===sys.activeLayerId)?.opacity || 100}%</span></div>
                            <input type="range" min="0" max="100" value={sys.layers.find(x=>x.id===sys.activeLayerId)?.opacity || 100} onChange={(e)=>sys.updateLayer(sys.activeLayerId!, {opacity:parseInt(e.target.value)})} className="w-full h-1 bg-[#444] rounded-lg appearance-none"/>
                        </div>
                    </FloatingPanel>
                )}

                {panels.settings.visible && (
                    <FloatingPanel x={panels.settings.x} y={panels.settings.y} title="Propiedades" initialWidth={250} zIndex={panels.settings.z} onClose={()=>togglePanel('settings')} onDragStart={(e) => { bringToFront('settings'); draggingPanel.current = 'settings'; dragOffset.current = { x: e.clientX - panels.settings.x, y: e.clientY - panels.settings.y }; }}>
                        <div className="space-y-4">
                            {['brush', 'eraser', 'stamp'].includes(sys.tool) && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase"><span>Tamaño</span><span>{brushProps.size}px</span></div>
                                    <input type="range" min="1" max="200" value={brushProps.size} onChange={e=>setBrushProps({...brushProps, size:parseInt(e.target.value)})} className="w-full h-1 bg-[#333] rounded-lg appearance-none"/>
                                </div>
                            )}
                            {sys.tool === 'text' && (
                                <div className="space-y-3">
                                    <select className="w-full bg-[#222] text-xs border border-[#444] rounded p-1 text-white" value={textProps.font} onChange={(e) => setTextProps({...textProps, font: e.target.value})}>{FONTS.map(f => <option key={f} value={f}>{f}</option>)}</select>
                                    <div className="flex gap-2">
                                        <button onClick={()=>setTextProps({...textProps, bold: !textProps.bold})} className={`p-1.5 rounded ${textProps.bold ? 'bg-blue-600' : 'bg-[#333]'}`}><Bold size={14}/></button>
                                        <button onClick={()=>setTextProps({...textProps, italic: !textProps.italic})} className={`p-1.5 rounded ${textProps.italic ? 'bg-blue-600' : 'bg-[#333]'}`}><Italic size={14}/></button>
                                        <button onClick={()=>setTextProps({...textProps, underline: !textProps.underline})} className={`p-1.5 rounded ${textProps.underline ? 'bg-blue-600' : 'bg-[#333]'}`}><Underline size={14}/></button>
                                    </div>
                                    <input type="text" value={textProps.text} onChange={e=>setTextProps({...textProps, text: e.target.value})} className="w-full text-xs p-1.5 bg-[#111] border border-[#333] rounded text-white" placeholder="Escribe aquí..."/>
                                    <button onClick={()=>sys.addLayer('text', null, textProps)} className="w-full bg-blue-600 py-2 rounded text-xs font-bold text-white">Añadir Texto</button>
                                </div>
                            )}
                            {sys.activeLayerId && (
                                <div className="space-y-2 pt-2 border-t border-[#333]">
                                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-2">Ajustes Rápidos</div>
                                    <div className="grid grid-cols-2 gap-1">
                                        <button onClick={()=>sys.applyFilter('brightness', 15)} className="bg-[#333] hover:bg-[#444] text-[10px] py-1.5 rounded flex items-center justify-center gap-1"><Sun size={12}/> Brillo +</button>
                                        <button onClick={()=>sys.applyFilter('brightness', -15)} className="bg-[#333] hover:bg-[#444] text-[10px] py-1.5 rounded flex items-center justify-center gap-1"><SunDim size={12}/> Brillo -</button>
                                        <button onClick={()=>sys.applyFilter('contrast', 15)} className="bg-[#333] hover:bg-[#444] text-[10px] py-1.5 rounded flex items-center justify-center gap-1"><Contrast size={12}/> Contraste</button>
                                        <button onClick={()=>sys.applyFilter('grayscale', 0)} className="bg-[#333] hover:bg-[#444] text-[10px] py-1.5 rounded">B&N</button>
                                        <button onClick={()=>sys.applyFilter('blur', 0)} className="bg-[#333] hover:bg-[#444] text-[10px] py-1.5 rounded">Blur</button>
                                        <button onClick={()=>sys.applyFilter('pixelate', 15)} className="bg-[#333] hover:bg-[#444] text-[10px] py-1.5 rounded">Pixelar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </FloatingPanel>
                )}

                {sys.tool === 'crop' && (
                    <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-[#1f1f1f] border border-[#444] rounded-lg px-4 py-2 flex items-center gap-4 z-[60] shadow-2xl">
                         <span className="text-xs font-bold text-gray-400">RECORTE</span>
                         <button onClick={executeCrop} className="bg-green-600 hover:bg-green-500 text-white p-1.5 rounded"><Check size={16}/></button>
                         <button onClick={() => { sys.setLassoPoints([]); sys.setTool('move'); }} className="bg-[#333] hover:bg-red-600 text-white p-1.5 rounded"><X size={16}/></button>
                    </div>
                )}
            </div>

            {modals.newProject && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-300">
                    <div className="bg-[#2b2c2e] border border-[#444] rounded-2xl w-full max-w-4xl h-[70vh] flex overflow-hidden shadow-2xl">
                         <div className="w-64 bg-[#1f1f1f] border-r border-[#444] flex flex-col p-6">
                            <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-3"><Cpu size={24} className="text-blue-500"/> Nuevo</h2>
                            <div className="flex flex-col gap-2">
                                {Object.entries(PROJECT_PRESETS).map(([key, cat]) => (
                                    <button key={key} onClick={()=>setActiveFormatCat(key as any)} className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all font-bold text-sm ${activeFormatCat === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-[#333]'}`}>
                                        <cat.icon size={18}/> {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {PROJECT_PRESETS[activeFormatCat].items.map(p => (
                                    <button key={p.id} onClick={() => { sys.createNewProject(p.w, p.h); setModals({newProject: false}); }} className="bg-[#1f1f1f] border border-[#444] rounded-2xl p-6 flex flex-col items-center gap-3 hover:border-blue-500 hover:bg-blue-500/5 transition-all group text-left">
                                        <p.icon size={32} className="text-gray-500 group-hover:text-blue-500 transition-all"/>
                                        <div>
                                            <div className="text-sm font-bold text-white mb-1">{p.label}</div>
                                            <div className="text-[10px] text-gray-500 uppercase">{p.w}x{p.h} px</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-8 text-center">
                                <button onClick={()=>setModals({newProject: false})} className="text-gray-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest">Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div 
                className={`fixed inset-0 z-[9999] pointer-events-auto ${draggingPanel.current ? 'cursor-grabbing' : 'hidden'}`}
                onMouseMove={(e) => {
                    if (draggingPanel.current) {
                        const name = draggingPanel.current;
                        setPanels(prev => ({ 
                            ...prev, 
                            [name]: { 
                                ...prev[name], 
                                x: e.clientX - dragOffset.current.x, 
                                y: e.clientY - dragOffset.current.y 
                            } 
                        }));
                    }
                }} 
                onMouseUp={() => draggingPanel.current = null}
            />
        </div>
    );
};

export default App;
