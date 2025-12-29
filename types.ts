export type LayerType = 'raster' | 'text' | 'empty' | 'img' | 'fill';

export interface TextData {
    text: string;
    font: string;
    size: number;
    color: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    align: 'left' | 'center' | 'right';
    strokeColor: string;
    strokeWidth: number;
    shadow: boolean;
}

export interface PanelState {
    visible: boolean;
    x: number;
    y: number;
    z: number;
}

export interface PanelsConfig {
    tools: PanelState;
    ai: PanelState;
    format: PanelState;
    layers: PanelState;
    settings: PanelState;
    resize: PanelState;
    [key: string]: PanelState;
}

export interface CanvasSize {
    w: number;
    h: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface BrushProps {
    size: number;
    color: string;
}

export interface GroundingSource {
    title?: string;
    uri: string;
}

export interface AIState {
    loading: boolean;
    feedback: string;
    sources?: GroundingSource[];
}

export type ToolType = 'move' | 'rect' | 'lasso' | 'wand' | 'crop' | 'brush' | 'eraser' | 'bucket' | 'gradient' | 'text' | 'shape' | 'stamp' | 'pipette' | 'hand' | 'zoom' | 'ai';