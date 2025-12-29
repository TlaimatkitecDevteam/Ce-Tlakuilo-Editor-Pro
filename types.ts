
export type LayerType = 'raster' | 'text' | 'empty' | 'img';

export interface TextData {
    text: string;
    font: string;
    size: number;
    color: string;
    bold: boolean;
    italic: boolean;
    align: 'left' | 'center' | 'right';
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

export interface AIState {
    loading: boolean;
    feedback: string;
}
