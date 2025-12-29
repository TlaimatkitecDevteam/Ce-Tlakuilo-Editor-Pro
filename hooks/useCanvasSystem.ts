
import { useState, useRef, useEffect, useCallback } from 'react';
import { INITIAL_W, INITIAL_H, MAX_HISTORY } from '../constants';
import { LayerType, TextData, CanvasSize, Point } from '../types';

export class Layer {
    id: string;
    name: string;
    type: LayerType;
    visible: boolean = true;
    opacity: number = 100;
    blendMode: GlobalCompositeOperation = 'source-over';
    x: number = 0;
    y: number = 0;
    rotation: number = 0;
    scaleX: number = 1;
    scaleY: number = 1;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    textData: TextData | null = null;

    constructor(name: string, width: number, height: number, type: LayerType = 'raster') {
        this.id = crypto.randomUUID();
        this.name = name;
        this.type = type;
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error("Could not create canvas context");
        this.ctx = ctx;
    }

    clone(): Layer {
        const l = new Layer(this.name, this.canvas.width, this.canvas.height, this.type);
        l.id = this.id;
        l.visible = this.visible;
        l.opacity = this.opacity;
        l.blendMode = this.blendMode;
        l.x = this.x;
        l.y = this.y;
        l.rotation = this.rotation;
        l.scaleX = this.scaleX;
        l.scaleY = this.scaleY;
        l.textData = this.textData ? { ...this.textData } : null;
        l.ctx.drawImage(this.canvas, 0, 0);
        return l;
    }
}

const workerBlob = new Blob([`
    self.onmessage = function(e) {
        const { id, imageData, type, val, weights } = e.data;
        const data = imageData.data; const w = imageData.width; const h = imageData.height;
        if (['convolution', 'blur', 'sharpen', 'edge_detect', 'emboss'].includes(type) && weights) {
            const side = Math.round(Math.sqrt(weights.length)); const halfSide = Math.floor(side / 2); const src = new Uint8ClampedArray(data);
            for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (let cy = 0; cy < side; cy++) { for (let cx = 0; cx < side; cx++) {
                    const scy = y + cy - halfSide; const scx = x + cx - halfSide;
                    if (scy >= 0 && scy < h && scx >= 0 && scx < w) { const off = (scy * w + scx) * 4; const wt = weights[cy * side + cx]; r += src[off] * wt; g += src[off + 1] * wt; b += src[off + 2] * wt; a += src[off + 3] * wt; }
                }}
                const off = (y * w + x) * 4; data[off] = r; data[off+1] = g; data[off+2] = b; data[off+3] = src[off+3];
            }}
        } else {
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i+1], b = data[i+2];
                if (type === 'brightness') { const f = val; data[i] += f; data[i+1] += f; data[i+2] += f; }
                else if (type === 'grayscale') { const v = 0.3 * r + 0.59 * g + 0.11 * b; data[i] = v; data[i+1] = v; data[i+2] = v; }
                else if (type === 'invert') { data[i] = 255 - r; data[i+1] = 255 - g; data[i+2] = 255 - b; }
                else if (type === 'contrast') { const f = (259 * (val + 255)) / (255 * (259 - val)); data[i] = f * (r - 128) + 128; data[i+1] = f * (g - 128) + 128; data[i+2] = f * (b - 128) + 128; }
                else if (type === 'pixelate') { 
                    const size = val > 1 ? Math.floor(val) : 1;
                    if(size > 1) {
                        for (let y = 0; y < h; y += size) {
                            for (let x = 0; x < w; x += size) {
                                let r = 0, g = 0, b = 0, a = 0, count = 0;
                                for (let dy = 0; dy < size && y + dy < h; dy++) { for (let dx = 0; dx < size && x + dx < w; dx++) {
                                    const off = ((y + dy) * w + (x + dx)) * 4; r += data[off]; g += data[off+1]; b += data[off+2]; a += data[off+3]; count++;
                                }}
                                r = r/count; g = g/count; b = b/count; a = a/count;
                                for (let dy = 0; dy < size && y + dy < h; dy++) { for (let dx = 0; dx < size && x + dx < w; dx++) {
                                    const off = ((y + dy) * w + (x + dx)) * 4; data[off] = r; data[off+1] = g; data[off+2] = b; data[off+3] = a;
                                }}
                            }
                        }
                    }
                }
            }
        }
        self.postMessage({ id, imageData, success: true }, [imageData.data.buffer]);
    };
`], { type: 'application/javascript' });

const workerUrl = URL.createObjectURL(workerBlob);

export const useCanvasSystem = () => {
    const [layers, setLayers] = useState<Layer[]>([]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
    const [canvasSize, setCanvasSize] = useState<CanvasSize>({ w: INITIAL_W, h: INITIAL_H });
    const [tool, setTool] = useState('move');
    const [zoom, setZoom] = useState(0.2);
    const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
    const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
    
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const history = useRef<Layer[][]>([]);
    const historyIdx = useRef(-1);
    const isDrawing = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0, cx: 0, cy: 0, isPan: false });
    const workerRef = useRef<Worker | null>(null);

    const saveState = useCallback((newLayers: Layer[]) => {
        const snapshot = newLayers.map(l => l.clone());
        const newHist = history.current.slice(0, historyIdx.current + 1);
        newHist.push(snapshot);
        if (newHist.length > MAX_HISTORY) newHist.shift();
        history.current = newHist;
        historyIdx.current = newHist.length - 1;
    }, []);

    const createNewProject = useCallback((w: number, h: number) => {
        setCanvasSize({ w, h });
        setPan({ x: 0, y: 0 });
        setZoom(Math.min((window.innerWidth * 0.7) / w, (window.innerHeight * 0.7) / h));
        const bg = new Layer('Fondo', w, h);
        bg.ctx.fillStyle = '#ffffff';
        bg.ctx.fillRect(0, 0, w, h);
        const initial = [bg];
        setLayers(initial);
        setActiveLayerId(bg.id);
        history.current = [];
        historyIdx.current = -1;
        saveState(initial);
    }, [saveState]);

    useEffect(() => {
        workerRef.current = new Worker(workerUrl);
        workerRef.current.onmessage = (e) => {
            const { id, imageData, success } = e.data;
            if (success) {
                setLayers(prev => {
                    const newLayers = prev.map(l => {
                        if (l.id === id) {
                            const nc = l.clone();
                            nc.ctx.putImageData(imageData, 0, 0);
                            return nc;
                        }
                        return l;
                    });
                    saveState(newLayers);
                    return newLayers;
                });
            }
        };
        createNewProject(INITIAL_W, INITIAL_H);
        return () => workerRef.current?.terminate();
    }, [createNewProject, saveState]);

    const undo = useCallback(() => {
        if (historyIdx.current > 0) {
            historyIdx.current--;
            setLayers(history.current[historyIdx.current].map(l => l.clone()));
        }
    }, []);

    const redo = useCallback(() => {
        if (historyIdx.current < history.current.length - 1) {
            historyIdx.current++;
            setLayers(history.current[historyIdx.current].map(l => l.clone()));
        }
    }, []);

    const renderTextToLayer = useCallback((layer: Layer, data: TextData) => {
        const { text, font, size, color, bold, italic, align } = data;
        const fontStr = `${italic ? 'italic' : ''} ${bold ? 'bold' : ''} ${size}px "${font}"`;
        layer.ctx.font = fontStr;
        const metrics = layer.ctx.measureText(text);
        const textW = metrics.width;
        const textH = size * 1.2;
        const padding = 20;
        
        layer.canvas.width = Math.ceil(textW + padding * 2);
        layer.canvas.height = Math.ceil(textH + padding * 2);
        layer.ctx = layer.canvas.getContext('2d')!;
        
        layer.ctx.font = fontStr;
        layer.ctx.textBaseline = 'middle';
        layer.ctx.textAlign = align;
        layer.ctx.fillStyle = color;
        
        const drawX = padding + (align === 'center' ? textW / 2 : align === 'right' ? textW : 0);
        const drawY = layer.canvas.height / 2;
        layer.ctx.fillText(text, drawX, drawY);
    }, []);

    const addLayer = useCallback((type: LayerType = 'empty', img: HTMLImageElement | null = null, txtData: TextData | null = null) => {
        setLayers(prev => {
            const l = new Layer(
                type === 'img' ? 'Imagen' : type === 'text' ? 'Texto' : 'Capa ' + (prev.length + 1),
                canvasSize.w,
                canvasSize.h,
                type
            );
            if (type === 'img' && img) {
                l.canvas.width = img.width;
                l.canvas.height = img.height;
                l.ctx.drawImage(img, 0, 0);
                l.x = (canvasSize.w - img.width) / 2;
                l.y = (canvasSize.h - img.height) / 2;
            } else if (type === 'text' && txtData) {
                l.textData = txtData;
                renderTextToLayer(l, txtData);
                l.x = (canvasSize.w - l.canvas.width) / 2;
                l.y = (canvasSize.h - l.canvas.height) / 2;
            }
            const nl = [...prev, l];
            setActiveLayerId(l.id);
            saveState(nl);
            return nl;
        });
    }, [canvasSize, renderTextToLayer, saveState]);

    const updateLayer = useCallback((id: string, updates: Partial<Layer>, save: boolean = false) => {
        setLayers(prev => {
            const nl = prev.map(l => {
                if (l.id === id) {
                    const cloned = Object.assign(Object.create(Object.getPrototypeOf(l)), l);
                    Object.assign(cloned, updates);
                    if (cloned.type === 'text' && updates.textData) {
                        renderTextToLayer(cloned, updates.textData);
                    }
                    return cloned;
                }
                return l;
            });
            if (save) saveState(nl);
            return nl;
        });
    }, [renderTextToLayer, saveState]);

    const applyFilter = useCallback((type: string, val: number) => {
        if (!activeLayerId) return;
        setLayers(current => {
            const l = current.find(x => x.id === activeLayerId);
            if (!l) return current;
            const imageData = l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height);
            let weights = null;
            if (type === 'blur') weights = [1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9];
            else if (type === 'sharpen') weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
            workerRef.current?.postMessage({ 
                id: l.id, 
                imageData, 
                type: type === 'blur' || type === 'sharpen' ? 'convolution' : type, 
                val, 
                weights 
            }, [imageData.data.buffer]);
            return current;
        });
    }, [activeLayerId]);

    const setBackground = useCallback((type: 'transparent' | 'color' | 'image', value?: any) => {
        setLayers(prev => {
            const newLayers = [...prev];
            let bgLayer = newLayers.find(l => l.name === 'Fondo');
            if (!bgLayer) {
                bgLayer = new Layer('Fondo', canvasSize.w, canvasSize.h);
                newLayers.unshift(bgLayer);
            } else {
                const idx = newLayers.indexOf(bgLayer);
                bgLayer = bgLayer.clone();
                newLayers[idx] = bgLayer;
            }
            
            bgLayer.ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
            if (type === 'color') {
                bgLayer.ctx.fillStyle = value;
                bgLayer.ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
            } else if (type === 'image' && value) {
                const scale = Math.max(canvasSize.w / value.width, canvasSize.h / value.height);
                const x = (canvasSize.w / 2) - (value.width / 2) * scale;
                const y = (canvasSize.h / 2) - (value.height / 2) * scale;
                bgLayer.ctx.drawImage(value, x, y, value.width * scale, value.height * scale);
            }
            
            saveState(newLayers);
            return newLayers;
        });
    }, [canvasSize, saveState]);

    return {
        layers, setLayers, activeLayerId, setActiveLayerId, canvasSize, setCanvasSize,
        tool, setTool, zoom, setZoom, pan, setPan, mainCanvasRef,
        isDrawing, lastMouse, undo, redo, addLayer, updateLayer, applyFilter, saveState, 
        createNewProject, setBackground, lassoPoints, setLassoPoints
    };
};
