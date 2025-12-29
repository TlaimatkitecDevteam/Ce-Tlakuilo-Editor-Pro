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
    const [textProps, setTextProps] = useState<TextData>({ 
        text: 'Nuevo Texto', font: 'Inter', size: 100, bold: false, italic: false, underline: false, align: 'left', color: '#ffffff', strokeColor: '#000000', strokeWidth: 0, shadow: false 
    });
    
    const [aiState, setAiState] = useState<AIState>({ loading: false, feedback: '', sources: [] });
    const [bgAiPrompt, setBgAiPrompt] = useState('');
    const [showBgAiInput, setShowBgAiInput] = useState(false);
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
        } else if (['brush', 'eraser'].includes(sys.tool) && sys.activeLayerId) {
            const l = sys.layers.find(x => x.id === sys.activeLayerId);
            if (l) {
                sys.isDrawing.current = true;
                l.ctx.beginPath();
                l.ctx.moveTo(pos.x - l.x, pos.y - l.y);
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
            }
        }
    };

    const handlePointerUp = () => {
        if (sys.isDrawing.current || transformAction.current) sys.saveState(sys.layers);
        sys.isDrawing.current = false;
        transformAction.current = null;
    };

    const handleAIAction = async (action: string, payload: any) => {
        const aiStudio = (window as any).aistudio;
        if (aiStudio && !(await aiStudio.hasSelectedApiKey())) await aiStudio.openSelectKey();

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
                        setAiState({ loading: false, feedback: "Completado." });
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
                    img.onload = () => { sys.addLayer('img', img); setAiState({ loading: false, feedback: "Remix completado." }); };
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
            ctx.restore();
        };
        const frame = requestAnimationFrame(function loop() { render(); requestAnimationFrame(loop); });
        return () => cancelAnimationFrame(frame);
    }, [sys.layers, sys.pan, sys.zoom, sys.canvasSize]);

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
                    {['format', 'layers', 'settings'].map(p => (
                        <button key={p} className={`p-1.5 rounded flex items-center gap-2 text-xs font-bold uppercase transition-all ${panels[p].visible ? 'bg-blue-600 text-white' : 'hover:bg-[#333] text-gray-300'}`} onClick={() => togglePanel(p)}>
                            {p === 'format' ? <Layout size={16}/> : p === 'layers' ? <Layers size={16}/> : <Sliders size={16}/>}
                            <span className="hidden md:inline">{p}</span>
                        </button>
                    ))}
                    <button className={`p-1.5 rounded flex items-center gap-2 text-xs font-bold uppercase ${panels.ai.visible ? 'bg-blue-600 text-white' : 'hover:bg-[#333] text-gray-300'}`} onClick={() => togglePanel('ai')}>
                        <Sparkles size={16}/> <span className="hidden md:inline">IA</span>
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setModals({newProject: true})} className="flex items-center gap-2 bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded text-xs font-bold transition-all"><FilePlus size={14}/> Nuevo</button>
                    <button className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-2" onClick={() => {
                        const a = document.createElement('a'); a.download='design.png'; a.href=sys.mainCanvasRef.current!.toDataURL(); a.click();
                    }}><Download size={14}/> Exportar</button>
                </div>
            </header>

            <div className="flex-1 relative overflow-hidden" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onWheel={(e) => {
                if (!e.ctrlKey) {
                    const newZoom = Math.min(Math.max(0.05, sys.zoom * Math.pow(1.0015, -e.deltaY)), 50);
                    sys.setZoom(newZoom);
                } else {
                    sys.setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
                }
            }}>
                <canvas ref={sys.mainCanvasRef} width={window.innerWidth} height={window.innerHeight - 48} className="block cursor-crosshair"/>
                
                {sys.activeLayerId && sys.tool === 'move' && (
                    <TransformHandles layer={sys.layers.find(x => x.id === sys.activeLayerId)} zoom={sys.zoom} pan={sys.pan} canvasSize={sys.canvasSize} onTransform={handleTransformStart} />
                )}

                {panels.tools.visible && (
                    <FloatingPanel x={panels.tools.x} y={panels.tools.y} title="" initialWidth={56} zIndex={panels.tools.z} onDragStart={(e) => { bringToFront('tools'); draggingPanel.current = 'tools'; dragOffset.current = { x: e.clientX - panels.tools.x, y: e.clientY - panels.tools.y }; }}>
                        <div className="flex flex-col gap-2 items-center pb-2">
                            {(['move', 'crop', 'brush', 'eraser', 'text', 'pipette', 'hand'] as ToolType[]).map(t => (
                                <button key={t} onClick={()=>sys.setTool(t)} className={`p-2 rounded ${sys.tool===t?'bg-blue-600 text-white shadow-lg':'hover:bg-[#333] text-gray-400'}`}>
                                    {t==='move'?<Move size={18}/>:t==='crop'?<Crop size={18}/>:t==='brush'?<Brush size={18}/>:t==='eraser'?<Eraser size={18}/>:t==='text'?<Type size={18}/>:t==='pipette'?<Pipette size={18}/>:<Hand size={18}/>}
                                </button>
                            ))}
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
                            <div className="flex bg-[#2a2a2a] rounded p-1">
                                {['generate','research','remix','tips'].map(tab => (
                                    <button key={tab} onClick={() => setActiveAiTab(tab)} className={`flex-1 text-[9px] font-bold py-1.5 rounded capitalize ${activeAiTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>{tab}</button>
                                ))}
                            </div>
                            <textarea value={bgAiPrompt} onChange={(e) => setBgAiPrompt(e.target.value)} placeholder="Instrucciones para la IA..." className="h-20 w-full text-xs bg-[#111] border border-[#333] rounded p-2 text-white" />
                            <button onClick={() => activeAiTab === 'research' ? handleAIAction('research', bgAiPrompt) : handleAIAction('generate', bgAiPrompt)} disabled={aiState.loading || !bgAiPrompt} className="w-full bg-blue-600 text-white font-bold py-2 rounded text-xs flex items-center justify-center gap-2">
                                {aiState.loading ? <RefreshCw className="animate-spin" size={14}/> : <Sparkles size={14}/>} Ejecutar
                            </button>
                            {aiState.feedback && (
                                <div className="bg-[#2a2a2a] border border-[#444] rounded p-3 text-xs text-gray-200 max-h-40 overflow-y-auto whitespace-pre-wrap">
                                    {aiState.feedback}
                                    {aiState.sources && aiState.sources.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-[#444] space-y-1">
                                            <p className="font-bold text-gray-500 uppercase text-[8px]">Fuentes:</p>
                                            {aiState.sources.map((s, i) => (
                                                <a key={i} href={s.uri} target="_blank" className="text-blue-400 block truncate flex items-center gap-1"><ExternalLink size={10}/> {s.title || s.uri}</a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </FloatingPanel>
                )}

                {panels.layers.visible && (
                    <FloatingPanel x={panels.layers.x} y={panels.layers.y} title="Capas" initialWidth={250} zIndex={panels.layers.z} onClose={()=>togglePanel('layers')} onDragStart={(e) => { bringToFront('layers'); draggingPanel.current = 'layers'; dragOffset.current = { x: e.clientX - panels.layers.x, y: e.clientY - panels.layers.y }; }}>
                         <div className="mb-2 p-2 bg-[#2a2a2a] rounded border border-[#444]">
                            <div className="text-[10px] font-bold text-gray-400 mb-2 flex items-center justify-between">
                                <span>FONDO</span>
                                <button onClick={()=>setShowBgAiInput(!showBgAiInput)} className="text-blue-400"><Sparkles size={12}/></button>
                            </div>
                            <div className="flex gap-1 mb-2">
                                {BG_PRESETS.map((bg, i) => (
                                    <button key={i} onClick={() => sys.setBackground('color', bg)} className="w-5 h-5 rounded-full border border-[#444]" style={{background: bg}}></button>
                                ))}
                            </div>
                            {showBgAiInput && (
                                <div className="space-y-2 mt-2">
                                    <input type="text" value={bgAiPrompt} onChange={(e) => setBgAiPrompt(e.target.value)} placeholder="Fondo inteligente..." className="w-full text-[10px] bg-[#111] border border-[#333] rounded p-1.5 text-white" />
                                    <div className="flex gap-1">
                                        <button onClick={() => handleAIAction('bg', bgAiPrompt)} disabled={aiState.loading} className="flex-1 bg-blue-600 text-white text-[9px] py-1 rounded">Normal</button>
                                        <button onClick={() => handleAIAction('bg-smart', bgAiPrompt)} disabled={aiState.loading} className="flex-1 bg-purple-600 text-white text-[9px] py-1 rounded flex items-center justify-center gap-1"><Search size={10}/> Smart</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button className="w-full bg-[#333] text-[10px] py-1 rounded mb-2 font-bold" onClick={()=>sys.addLayer('empty')}>+ NUEVA CAPA</button>
                        <div className="space-y-1 max-h-60 overflow-y-auto">
                            {[...sys.layers].reverse().map(l => (
                                <div key={l.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${sys.activeLayerId===l.id ? 'bg-blue-600/30' : 'hover:bg-[#2a2a2a]'}`} onClick={()=>sys.setActiveLayerId(l.id)}>
                                    <button onClick={()=>sys.updateLayer(l.id, {visible:!l.visible})}>{l.visible?<Eye size={14}/>:<EyeOff size={14}/>}</button>
                                    <span className="text-[11px] flex-1 truncate">{l.name}</span>
                                    <button onClick={()=>sys.setLayers(prev => prev.filter(x=>x.id!==l.id))}><Trash2 size={12}/></button>
                                </div>
                            ))}
                        </div>
                    </FloatingPanel>
                )}
            </div>

            <div className={`fixed inset-0 z-[9999] pointer-events-auto ${draggingPanel.current ? 'cursor-grabbing' : 'hidden'}`} onMouseMove={(e) => {
                if (draggingPanel.current) {
                    const name = draggingPanel.current;
                    setPanels(prev => ({ ...prev, [name]: { ...prev[name], x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y } }));
                }
            }} onMouseUp={() => draggingPanel.current = null} />
        </div>
    );
};

export default App;