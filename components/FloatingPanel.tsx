
import React, { useState } from 'react';
import { Minus, Plus, X, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';

interface FloatingPanelProps {
    x: number;
    y: number;
    title: string;
    onClose?: () => void;
    onDragStart: (e: React.PointerEvent) => void;
    children: React.ReactNode;
    initialWidth?: number;
    initialHeight?: number | string;
    initialMinimized?: boolean;
    zIndex?: number;
    allowMaximize?: boolean;
    sideMenu?: React.ReactNode;
}

export const FloatingPanel: React.FC<FloatingPanelProps> = ({ 
    x, y, title, onClose, onDragStart, children, 
    initialWidth = 256, initialHeight = 'auto', 
    initialMinimized = false, zIndex = 10, allowMaximize = true, sideMenu 
}) => {
    const [isMinimized, setIsMinimized] = useState(initialMinimized);
    const [isMaximized, setIsMaximized] = useState(false);
    const [size, setSize] = useState({ width: initialWidth, height: initialHeight });

    const toggleMaximize = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMaximized(!isMaximized);
        setIsMinimized(false);
    };

    const panelStyle: React.CSSProperties = isMaximized 
        ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '90vw', height: '80vh', zIndex: zIndex + 100 }
        : { left: x, top: y, width: size.width, height: isMinimized ? '32px' : size.height, zIndex };

    return (
        <div 
            className="absolute bg-[#1a1a1a] border border-[#333] rounded-lg shadow-2xl flex flex-col overflow-hidden transition-[width,height,transform] duration-200"
            style={panelStyle}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div 
                className="h-8 bg-[#2a2a2a] border-b border-[#333] flex items-center justify-between px-2 cursor-grab active:cursor-grabbing shrink-0 select-none"
                onPointerDown={isMaximized ? undefined : onDragStart}
            >
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                    <GripHorizontal size={12} className="opacity-40" />
                    {title}
                </div>
                <div className="flex items-center gap-1">
                    {allowMaximize && (
                        <button onClick={toggleMaximize} className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#333]">
                            {isMaximized ? <Minimize2 size={12}/> : <Maximize2 size={12}/>}
                        </button>
                    )}
                    <button onClick={() => setIsMinimized(!isMinimized)} className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#333]">
                        {isMinimized ? <Plus size={12}/> : <Minus size={12}/>}
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#333]">
                            <X size={14}/>
                        </button>
                    )}
                </div>
            </div>
            {!isMinimized && (
                <div className="flex-1 overflow-visible relative flex flex-col min-h-0">
                    <div className="p-3 flex-1 overflow-y-auto custom-scrollbar">
                        {children}
                    </div>
                    {sideMenu && (
                        <div className="absolute left-full top-0 ml-2 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl p-3 w-56 z-50">
                            {sideMenu}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
