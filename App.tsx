
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    Move, Brush, Eraser, Type, Crop, Lasso, Wand2, Pipette, Stamp, Banana, 
    Sparkles, RefreshCw, Undo, Redo, Download, Upload, FilePlus, Settings, Layout, 
    Scaling, Layers, Sliders, Cpu, Trash2, Eye, EyeOff, RotateCw, Monitor, Instagram,
    Check, X, Bold, Italic, Loader2, Key, Info
} from 'lucide-react';
import { useCanvasSystem } from './hooks/useCanvasSystem';
import { FloatingPanel } from './components/FloatingPanel';
import { GeminiService } from './services/geminiService';
import { 
    INITIAL_W, INITIAL_H, PROJECT_PRESETS, BG_PRESETS, CROP_RATIOS, FONTS 
} from './constants';
import { PanelsConfig, BrushProps, AIState, TextData, PanelState } from './types';

const gemini = new GeminiService();

// Extend window for aistudio types - using the expected global AIStudio type to avoid declaration conflicts
declare global {
  interface Window {
    aistudio: AIStudio;
  }
}

const App: React.FC = () => {
    const sys = useCanvasSystem();
    const isMobile = window.innerWidth < 768;
    
    // UI State
    const [panels, setPanels] = useState<PanelsConfig>({
        tools: { x: 12, y: 60, visible: true, z: 20 },
        ai: { x: 80, y: 60, visible: true, z: 15 },
        format: { x: 80, y: 180, visible: false, z: 14 },
        layers: { x: window.innerWidth - 262, y: 60, visible: true, z: 13 },
        settings: { x: window.innerWidth - 262, y: 380, visible: true, z: 12 },
        resize: { x: window.innerWidth - 262, y: 600, visible: false, z: 11 }
    });
    const [modals, setModals] = useState({ newProject: false, apiKey: false });
    const [isKeySelected, setIsKeySelected] = useState(false);
    const [brushProps, setBrushProps] = useState<BrushProps>({ size: 20, color: '#000000' });
    const [textProps, setTextProps] = useState<TextData>({ 
        text: 'Nuevo Texto', font: 'Inter', size: 80, bold: false, italic: false, color: '#ffffff', align: 'left' 
    });
    const [aiState, setAiState] = useState<AIState>({ loading: false, feedback: '' });
    const [bgAiPrompt, setBgAiPrompt] = useState('');
    
    // Drag Panel Refs
    const draggingPanel = useRef<keyof PanelsConfig | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Check API Key on mount
    useEffect(() => {
        const checkKey = async () => {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsKeySelected(hasKey);
            if (!hasKey) {
                setModals(prev => ({ ...prev, apiKey: true }));
            }
        };
        checkKey();
    }, []);

    const handleOpenKeySelection = async () => {
        await window.aistudio.openSelectKey();
        setIsKeySelected(true);
        setModals(prev => ({ ...prev, apiKey: false }));
    };

    // Render Loop
    useEffect(() => {
        let frame: number;
        const render = () => {
            const canvas = sys.mainCanvasRef.current;
            if (!canvas) { frame = requestAnimationFrame(render); return; }
            const ctx = canvas.getContext('2d');
            if (!ctx) { frame = requestAnimationFrame(render); return; }

            // Clear Background
            ctx.fillStyle = '#0f0f0f';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Workspace Transform
            ctx.save();
            ctx.translate(canvas.width / 2 + sys.pan.x, canvas.height / 2 + sys.pan.y);
            ctx.scale(sys.zoom, sys.zoom);
            ctx.translate(-sys.canvasSize.w / 2, -sys.canvasSize.h / 2);

            // Workspace Border
            ctx.shadowBlur = 20 / sys.zoom;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, sys.canvasSize.w, sys.canvasSize.h);
            ctx.shadowBlur = 0;

            // Transparency Grid
            ctx.fillStyle = '#222';
            const gridSize = 40;
            for (let i = 0; i < sys.canvasSize.w; i += gridSize) {
                for (let j = 0; j < sys.canvasSize.h; j += gridSize) {
                    if ((i / gridSize + j / gridSize) % 2 === 0) {
                        ctx.fillRect(i, j, gridSize, gridSize);
                    }
                }
            }

            // Draw Layers
            sys.layers.forEach(l => {
                if (l.visible) {
                    ctx.save();
                    ctx.globalAlpha = l.opacity / 100;
                    ctx.globalCompositeOperation = l.blendMode;
                    const cx = l.x + l.canvas.width / 2;
                    const cy = l.y + l.canvas.height / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate(l.rotation * Math.PI / 180);
                    ctx.scale(l.scaleX, l.scaleY);
                    ctx.translate(-cx, -cy);
                    ctx.drawImage(l.canvas, l.x, l.y);
                    ctx.restore();
                }
            });

            // Active Layer Outline
            if (sys.activeLayerId && sys.tool === 'move') {
                const l = sys.layers.find(x => x.id === sys.activeLayerId);
                if (l) {
                    ctx.save();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 2 / sys.zoom;
                    const cx = l.x + l.canvas.width / 2;
                    const cy = l.y + l.canvas.height / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate(l.rotation * Math.PI / 180);
                    ctx.scale(l.scaleX, l.scaleY);
                    ctx.translate(-cx, -cy);
                    ctx.strokeRect(l.x, l.y, l.canvas.width, l.canvas.height);
                    ctx.restore();
                }
            }

            ctx.restore();
            frame = requestAnimationFrame(render);
        };
        frame = requestAnimationFrame(render);
        return () => cancelAnimationFrame(frame);
    }, [sys]);

    // Input Handling
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
        
        if (['brush', 'eraser'].includes(sys.tool) && sys.activeLayerId) {
            sys.isDrawing.current = true;
            const l = sys.layers.find(x => x.id === sys.activeLayerId);
            if (l) {
                l.ctx.beginPath();
                l.ctx.moveTo(pos.x - l.x, pos.y - l.y);
            }
        } else if (sys.tool === 'move') {
            sys.isDrawing.current = true;
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!sys.isDrawing.current) return;
        if (sys.lastMouse.current.isPan) {
            sys.setPan(p => ({ x: p.x + (e.clientX - sys.lastMouse.current.x), y: p.y + (e.clientY - sys.lastMouse.current.y) }));
            sys.lastMouse.current = { ...sys.lastMouse.current, x: e.clientX, y: e.clientY };
            return;
        }
        const pos = getCanvasPos(e.clientX, e.clientY);
        const l = sys.layers.find(x => x.id === sys.activeLayerId);
        if (!l) return;

        if (['brush', 'eraser'].includes(sys.tool)) {
            l.ctx.lineWidth = brushProps.size;
            l.ctx.lineCap = 'round';
            l.ctx.lineJoin = 'round';
            l.ctx.strokeStyle = sys.tool === 'eraser' ? '#000' : brushProps.color;
            l.ctx.globalCompositeOperation = sys.tool === 'eraser' ? 'destination-out' : 'source-over';
            l.ctx.lineTo(pos.x - l.x, pos.y - l.y);
            l.ctx.stroke();
        } else if (sys.tool === 'move') {
            sys.updateLayer(l.id, { 
                x: l.x + (pos.x - sys.lastMouse.current.cx), 
                y: l.y + (pos.y - sys.lastMouse.current.cy) 
            });
            sys.lastMouse.current = { ...sys.lastMouse.current, cx: pos.x, cy: pos.y };
        }
    };

    const handlePointerUp = () => {
        if (sys.isDrawing.current) {
            sys.saveState(sys.layers);
        }
        sys.isDrawing.current = false;
    };

    const handleAI = async (action: string, payload: any) => {
        if (!isKeySelected) {
            setModals(prev => ({ ...prev, apiKey: true }));
            return;
        }

        setAiState(prev => ({ ...prev, loading: true, feedback: '' }));
        try {
            switch(action) {
                case 'generate':
                case 'bg': {
                    const ratio = sys.canvasSize.w / sys.canvasSize.h;
                    let aspectRatio = "1:1";
                    if (ratio >= 1.7) aspectRatio = "16:9"; else if (ratio >= 1.3) aspectRatio = "4:3"; else if (ratio <= 0.6) aspectRatio = "9:16"; else if (ratio <= 0.8) aspectRatio = "3:4";
                    
                    const url = await gemini.generateImage(payload, aspectRatio);
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        if (action === 'bg') sys.setBackground('image', img);
                        else sys.addLayer('img', img);
                        setAiState({ loading: false, feedback: 'Proceso de IA finalizado.' });
                    };
                    img.src = url;
                    break;
                }
                case 'remix': {
                    const canvas = sys.mainCanvasRef.current!;
                    // Get only current workspace area for remix
                    const temp = document.createElement('canvas');
                    temp.width = 1024; temp.height = 1024 * (sys.canvasSize.h / sys.canvasSize.w);
                    const tctx = temp.getContext('2d')!;
                    // Simplified: just taking current full view might be better
                    const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                    const url = await gemini.remixImage(base64, payload);
                    const img = new Image();
                    img.onload = () => {
                        sys.addLayer('img', img);
                        setAiState({ loading: false, feedback: 'Remix completado' });
                    };
                    img.src = url;
                    break;
                }
                case 'text': {
                    const ideas = await gemini.generateTextIdeas(payload.topic, payload.type);
                    setAiState({ loading: false, feedback: ideas.join('\n') });
                    break;
                }
                case 'palette': {
                    const colors = await gemini.generatePalette(payload);
                    setAiState({ loading: false, feedback: `Paleta sugerida:\n${colors.join(', ')}` });
                    break;
                }
                case 'analyze': {
                    const canvas = sys.mainCanvasRef.current!;
                    const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                    const result = await gemini.analyzeDesign(base64);
                    setAiState({ loading: false, feedback: result || 'Análisis no disponible.' });
                    break;
                }
            }
        } catch (e: any) {
            if (e.message.includes("Requested entity was not found")) {
                setIsKeySelected(false);
                setModals(prev => ({ ...prev, apiKey: true }));
            }
            setAiState({ loading: false, feedback: '⚠️ ' + e.message });
        }
    };

    const startDragPanel = (e: React.PointerEvent, name: keyof PanelsConfig) => {
        setPanels(prev => {
            // Fix: Cast values of prev to PanelState[] to access 'z' property as Object.values often defaults to unknown[]
            const maxZ = Math.max(...(Object.values(prev) as PanelState[]).map(p => p.z)) + 1;
            return { ...prev, [name]: { ...prev[name], z: maxZ } };
        });
        draggingPanel.current = name;
        dragOffset.current = { x: e.clientX - panels[name].x, y: e.clientY - panels[name].y };
    };

    useEffect(() => {
        const handleMove = (e: PointerEvent) => {
            if (draggingPanel.current) {
                setPanels(prev => ({
                    ...prev,
                    [draggingPanel.current!]: { 
                        ...prev[draggingPanel.current!], 
                        x: e.clientX - dragOffset.current.x, 
                        y: e.clientY - dragOffset.current.y 
                    }
                }));
            }
        };
        const handleUp = () => { draggingPanel.current = null; };
        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, []);

    return (
        <div className="h-full w-full bg-[#0f0f0f] flex flex-col overflow-hidden relative">
            {/* Header */}
            <header className="h-12 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-4 z-50">
                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 text-blue-500 font-bold shrink-0">
                        <Cpu size={20} />
                        <span className="hidden sm:inline">CE TLAKUILO PRO</span>
                    </div>
                    {aiState.loading && (
                        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full animate-pulse">
                            <Loader2 size={12} className="text-blue-400 animate-spin" />
                            <span className="text-[10px] text-blue-300 font-bold">IA Trabajando...</span>
                        </div>
                    )}
                    <div className="h-4 w-[1px] bg-[#333]"></div>
                    <div className="flex gap-1">
                        <button className="p-1.5 hover:bg-[#333] rounded transition-colors" onClick={sys.undo} title="Deshacer"><Undo size={16}/></button>
                        <button className="p-1.5 hover:bg-[#333] rounded transition-colors" onClick={sys.redo} title="Rehacer"><Redo size={16}/></button>
                    </div>
                    <div className="h-4 w-[1px] bg-[#333]"></div>
                    <div className="flex gap-2">
                        {['format', 'layers', 'ai', 'settings'].map(p => (
                            <button 
                                key={p}
                                onClick={() => setPanels(prev => ({...prev, [p]: {...prev[p as keyof PanelsConfig], visible: !prev[p as keyof PanelsConfig].visible}}))}
                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all ${panels[p as keyof PanelsConfig].visible ? 'bg-blue-600 text-white shadow-lg' : 'bg-[#333] text-gray-400 hover:text-white'}`}
                            >
                                {p === 'format' ? <Layout size={14}/> : p === 'layers' ? <Layers size={14}/> : p === 'ai' ? <Sparkles size={14}/> : <Sliders size={14}/>}
                                <span className="hidden md:inline">{p}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isKeySelected && (
                        <button onClick={() => setModals(m => ({...m, apiKey: true}))} className="text-yellow-500 p-2 hover:bg-[#333] rounded" title="Falta API Key">
                            <Key size={18} className="animate-bounce" />
                        </button>
                    )}
                    <button onClick={() => setModals({ ...modals, newProject: true })} className="bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-2 transition-all">
                        <FilePlus size={14}/> PROYECTO
                    </button>
                    <button onClick={() => {
                        const a = document.createElement('a');
                        a.download = 'ce-tlakuilo-design.png';
                        a.href = sys.mainCanvasRef.current!.toDataURL();
                        a.click();
                    }} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-2 transition-all">
                        <Download size={14}/> EXPORTAR
                    </button>
                </div>
            </header>

            {/* Canvas Area */}
            <main 
                className="flex-1 relative bg-[#0f0f0f] overflow-hidden cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <canvas 
                    ref={sys.mainCanvasRef} 
                    width={window.innerWidth} 
                    height={window.innerHeight - 48}
                />

                {/* Toolbar */}
                {panels.tools.visible && (
                    <FloatingPanel 
                        title="Herramientas" 
                        x={panels.tools.x} 
                        y={panels.tools.y} 
                        initialWidth={52} 
                        onDragStart={(e) => startDragPanel(e as any, 'tools')} 
                        allowMaximize={false}
                        sideMenu={
                            ['brush', 'eraser'].includes(sys.tool) ? (
                                <div className="space-y-3">
                                    <div className="text-[10px] uppercase font-bold text-gray-500">{sys.tool === 'brush' ? 'Pincel' : 'Borrador'}</div>
                                    <div className="flex justify-between text-[10px]"><span>Grosor</span><span>{brushProps.size}px</span></div>
                                    <input type="range" min="1" max="200" value={brushProps.size} onChange={e => setBrushProps({...brushProps, size: parseInt(e.target.value)})} className="w-full accent-blue-500"/>
                                    {sys.tool === 'brush' && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px]">Color</span>
                                            <input type="color" value={brushProps.color} onChange={e => setBrushProps({...brushProps, color: e.target.value})} className="h-6 w-6 border-0 p-0 bg-transparent rounded cursor-pointer"/>
                                        </div>
                                    )}
                                </div>
                            ) : sys.tool === 'text' ? (
                                <div className="space-y-3">
                                    <div className="text-[10px] uppercase font-bold text-gray-500">Texto</div>
                                    <select value={textProps.font} onChange={e => setTextProps({...textProps, font: e.target.value})} className="w-full bg-[#2a2a2a] text-xs p-1 border border-[#333] rounded">
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                    <input type="number" value={textProps.size} onChange={e => setTextProps({...textProps, size: parseInt(e.target.value)})} className="w-full bg-[#2a2a2a] text-xs p-1 border border-[#333] rounded"/>
                                    <textarea value={textProps.text} onChange={e => setTextProps({...textProps, text: e.target.value})} className="w-full bg-[#2a2a2a] text-xs p-1 border border-[#333] rounded h-16"/>
                                    <button onClick={() => sys.addLayer('text', null, textProps)} className="w-full bg-blue-600 py-1.5 rounded text-[10px] font-bold">AÑADIR TEXTO</button>
                                </div>
                            ) : sys.tool === 'ai' ? (
                                <div className="text-[10px] text-blue-400 p-1 font-bold">Utiliza el panel de IA Creativa para estas funciones.</div>
                            ) : null
                        }
                    >
                        <div className="flex flex-col gap-2">
                            {[
                                {id:'move', i:Move}, {id:'brush', i:Brush}, {id:'eraser', i:Eraser}, 
                                {id:'text', i:Type}, {id:'lasso', i:Lasso}, {id:'wand', i:Wand2}, 
                                {id:'pipette', i:Pipette}, {id:'stamp', i:Stamp}, {id:'ai', i:Sparkles}
                            ].map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => sys.setTool(t.id)}
                                    className={`p-2 rounded transition-all ${sys.tool === t.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:bg-[#333] hover:text-white'}`}
                                >
                                    <t.i size={18} />
                                </button>
                            ))}
                            <div className="h-0.5 bg-[#333] my-1"></div>
                            <div className="w-8 h-8 rounded border border-[#333] overflow-hidden relative group cursor-pointer shadow-inner">
                                <input type="color" value={brushProps.color} onChange={e => setBrushProps({...brushProps, color: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer"/>
                                <div className="w-full h-full" style={{backgroundColor: brushProps.color}}></div>
                            </div>
                        </div>
                    </FloatingPanel>
                )}

                {/* Layer Panel */}
                {panels.layers.visible && (
                    <FloatingPanel title="CAPAS" x={panels.layers.x} y={panels.layers.y} initialWidth={240} onDragStart={(e) => startDragPanel(e as any, 'layers')}>
                        <div className="space-y-3">
                            <div className="bg-[#222] p-2 rounded-lg border border-[#333] space-y-2">
                                <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1"><Sparkles size={10}/> Fondos Generativos</div>
                                <div className="flex gap-1">
                                    <input 
                                        value={bgAiPrompt} 
                                        onChange={e => setBgAiPrompt(e.target.value)}
                                        className="flex-1 bg-[#1a1a1a] text-[10px] p-1.5 rounded border border-[#333] outline-none focus:border-blue-500" 
                                        placeholder="Concepto de fondo..."
                                        onKeyDown={e => e.key === 'Enter' && handleAI('bg', bgAiPrompt)}
                                    />
                                    <button 
                                        onClick={() => handleAI('bg', bgAiPrompt)}
                                        className="p-1.5 bg-blue-600 rounded hover:bg-blue-500 transition-colors"
                                        disabled={aiState.loading}
                                    >
                                        {aiState.loading ? <RefreshCw size={14} className="animate-spin"/> : <Check size={14} className="text-white"/>}
                                    </button>
                                </div>
                                <div className="flex gap-1 justify-center">
                                    {BG_PRESETS.map(c => (
                                        <button key={c} onClick={() => sys.setBackground('color', c)} className="w-4 h-4 rounded-full border border-[#444] hover:scale-125 transition-all shadow-md" style={{background: c}}></button>
                                    ))}
                                </div>
                            </div>
                            
                            <button onClick={() => sys.addLayer('empty')} className="w-full bg-[#333] hover:bg-[#444] py-1.5 rounded text-[10px] font-bold transition-all">+ NUEVA CAPA</button>
                            
                            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {[...sys.layers].reverse().map(l => (
                                    <div 
                                        key={l.id} 
                                        onClick={() => sys.setActiveLayerId(l.id)}
                                        className={`flex items-center gap-2 p-2 rounded group transition-all cursor-pointer ${sys.activeLayerId === l.id ? 'bg-blue-600/20 border border-blue-600/30' : 'hover:bg-[#2a2a2a] border border-transparent'}`}
                                    >
                                        <button onClick={(e) => { e.stopPropagation(); sys.updateLayer(l.id, {visible: !l.visible}) }}>
                                            {l.visible ? <Eye size={14} className="text-gray-400 group-hover:text-white"/> : <EyeOff size={14} className="text-gray-600"/>}
                                        </button>
                                        <span className={`text-[11px] flex-1 truncate ${sys.activeLayerId === l.id ? 'text-blue-400 font-bold' : 'text-gray-400'}`}>{l.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); sys.setLayers(prev => prev.filter(x => x.id !== l.id)) }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all">
                                            <Trash2 size={12}/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </FloatingPanel>
                )}

                {/* AI Creative Panel */}
                {panels.ai.visible && (
                    <FloatingPanel title="IA CREATIVA" x={panels.ai.x} y={panels.ai.y} initialWidth={280} onDragStart={(e) => startDragPanel(e as any, 'ai')}>
                        <div className="space-y-4">
                            <div className="flex bg-[#2a2a2a] p-1 rounded gap-1">
                                {['GEN', 'EDIT', 'TEXT', 'PALETTE'].map(t => (
                                    <button 
                                        key={t} 
                                        className="flex-1 py-1 text-[9px] font-bold text-gray-400 hover:text-white rounded hover:bg-[#333] transition-all"
                                        onClick={() => setAiState(s => ({...s, feedback: `Modo ${t} seleccionado.`}))}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="space-y-2">
                                <textarea 
                                    className="w-full h-24 bg-[#2a2a2a] border border-[#333] rounded p-2 text-xs text-white focus:border-blue-500 outline-none resize-none" 
                                    placeholder="Describe tu visión creativa (ej: 'Astronauta en campo de flores, estilo cinematográfico')..."
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAI('generate', (e.target as HTMLTextAreaElement).value); } }}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => handleAI('generate', (document.querySelector('textarea') as HTMLTextAreaElement).value)}
                                        disabled={aiState.loading}
                                        className="bg-blue-600 hover:bg-blue-500 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        {aiState.loading ? <RefreshCw className="animate-spin" size={14}/> : <Sparkles size={14}/>}
                                        GENERAR
                                    </button>
                                    <button 
                                        onClick={() => handleAI('remix', (document.querySelector('textarea') as HTMLTextAreaElement).value)}
                                        disabled={aiState.loading}
                                        className="bg-purple-600 hover:bg-purple-500 py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                                    >
                                        <RotateCw size={14}/>
                                        REMIX
                                    </button>
                                </div>
                                <button 
                                    onClick={() => handleAI('analyze', '')}
                                    disabled={aiState.loading}
                                    className="w-full bg-[#333] hover:bg-[#444] py-2 rounded text-[10px] font-bold flex items-center justify-center gap-2 transition-all border border-[#444]"
                                >
                                    <Info size={14}/>
                                    ANALIZAR DISEÑO
                                </button>
                            </div>

                            {aiState.feedback && (
                                <div className="p-3 bg-blue-900/10 border border-blue-500/20 rounded text-[10px] text-blue-300 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar font-medium">
                                    {aiState.feedback}
                                </div>
                            )}
                        </div>
                    </FloatingPanel>
                )}

                {/* Properties Panel */}
                {panels.settings.visible && (
                    <FloatingPanel title="PROPIEDADES" x={panels.settings.x} y={panels.settings.y} initialWidth={240} onDragStart={(e) => startDragPanel(e as any, 'settings')}>
                        {sys.activeLayerId ? (
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-[10px] text-gray-500 font-bold mb-2 uppercase">Opacidad</div>
                                    <input 
                                        type="range" 
                                        min="0" max="100" 
                                        value={sys.layers.find(l => l.id === sys.activeLayerId)?.opacity || 100}
                                        onChange={e => sys.updateLayer(sys.activeLayerId!, { opacity: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-[#333] rounded-lg appearance-none accent-blue-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        {id:'blur', l:'Desenfoque'}, {id:'sharpen', l:'Enfocar'}, 
                                        {id:'brightness', l:'Brillo', v:15}, {id:'contrast', l:'Contraste', v:15}, 
                                        {id:'grayscale', l:'B&N'}, {id:'pixelate', l:'Pixelar', v:12}
                                    ].map(f => (
                                        <button 
                                            key={f.id} 
                                            onClick={() => sys.applyFilter(f.id, f.v || 0)}
                                            className="bg-[#2a2a2a] hover:bg-[#333] py-2 rounded text-[10px] text-gray-300 font-medium transition-all border border-[#333]"
                                        >
                                            {f.l}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-[10px] text-gray-500 italic">Selecciona una capa para editar sus propiedades.</div>
                        )}
                    </FloatingPanel>
                )}

                {/* API Key Modal */}
                {modals.apiKey && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] backdrop-blur-md">
                        <div className="bg-[#1a1a1a] p-8 rounded-3xl w-[420px] border border-[#333] shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-6 text-blue-500">
                                <Key size={32} />
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-white">Gemini Pro API</h2>
                            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                                Para utilizar las funciones avanzadas de generación y análisis de Ce Tlakuilo Pro, es necesario configurar tu propia API Key pagada.
                            </p>
                            <div className="space-y-3 w-full">
                                <button 
                                    onClick={handleOpenKeySelection} 
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                                >
                                    CONFIGURAR API KEY
                                </button>
                                <a 
                                    href="https://ai.google.dev/gemini-api/docs/billing" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block text-xs text-blue-400 hover:text-blue-300 font-medium"
                                >
                                    Saber más sobre facturación
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* New Project Modal */}
                {modals.newProject && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
                        <div className="bg-[#1a1a1a] p-8 rounded-2xl w-[400px] border border-[#333] shadow-2xl">
                            <h2 className="text-xl font-bold mb-6 text-white text-center">NUEVO LIENZO</h2>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <button onClick={() => { sys.createNewProject(1080, 1080); setModals({newProject: false, apiKey: false}) }} className="flex flex-col items-center gap-3 p-4 bg-[#2a2a2a] rounded-xl hover:bg-blue-600/10 border border-transparent hover:border-blue-500/30 transition-all group">
                                    <Instagram className="text-gray-400 group-hover:text-pink-500" size={32}/>
                                    <span className="text-xs font-bold text-gray-300">SQUARE (1:1)</span>
                                </button>
                                <button onClick={() => { sys.createNewProject(1920, 1080); setModals({newProject: false, apiKey: false}) }} className="flex flex-col items-center gap-3 p-4 bg-[#2a2a2a] rounded-xl hover:bg-blue-600/10 border border-transparent hover:border-blue-500/30 transition-all group">
                                    <Monitor className="text-gray-400 group-hover:text-blue-500" size={32}/>
                                    <span className="text-xs font-bold text-gray-300">LANDSCAPE (16:9)</span>
                                </button>
                            </div>
                            <button onClick={() => setModals(m => ({...m, newProject: false}))} className="w-full py-2 text-xs text-gray-500 hover:text-white transition-all">VOLVER AL EDITOR</button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
