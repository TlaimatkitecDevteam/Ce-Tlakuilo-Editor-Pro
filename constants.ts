
import { 
    Smartphone, Instagram, Facebook, Youtube, Monitor, Layout, 
    ShoppingBag, ShoppingCart, Globe, Briefcase, Printer, Megaphone, FileImage, Sparkles 
} from 'lucide-react';

export const INITIAL_W = 1920;
export const INITIAL_H = 1080;
export const MAX_HISTORY = 12;

export const PROJECT_PRESETS = {
    social: { 
        label: "Redes Sociales", 
        icon: Smartphone, 
        items: [
            { id: 'ig_post', label: 'Instagram Post', w: 1080, h: 1080, icon: Instagram },
            { id: 'ig_story', label: 'Instagram Story', w: 1080, h: 1920, icon: Smartphone },
            { id: 'fb_cover', label: 'Facebook Cover', w: 820, h: 312, icon: Facebook },
            { id: 'yt_thumb', label: 'YouTube Thumb', w: 1280, h: 720, icon: Youtube }
        ] 
    },
    web: { 
        label: "Web & Blog", 
        icon: Globe, 
        items: [
            { id: 'blog', label: 'Blog Post', w: 1200, h: 630, icon: FileImage },
            { id: 'fhd', label: 'Full HD 1080p', w: 1920, h: 1080, icon: Monitor },
            { id: '4k', label: '4K UHD', w: 3840, h: 2160, icon: Monitor }
        ] 
    },
    market: { 
        label: "Marketplace", 
        icon: ShoppingBag, 
        items: [
            { id: 'amz_main', label: 'Amazon Main', w: 1000, h: 1000, icon: ShoppingBag },
            { id: 'ml_main', label: 'Mercado Libre', w: 1200, h: 1200, icon: ShoppingCart }
        ] 
    }
};

export const BG_PRESETS = [
    'linear-gradient(to right, #ff7e5f, #feb47b)',
    'linear-gradient(to right, #43e97b, #38f9d7)',
    '#ffffff',
    '#000000',
    '#1a1a1a'
];

export const CROP_RATIOS = [
    { label: 'Libre', val: null },
    { label: '1:1', val: 1 },
    { label: '16:9', val: 16/9 },
    { label: '4:3', val: 4/3 }
];

export const FONTS = [
    'Inter', 'Arial', 'Verdana', 'Times New Roman', 'Roboto', 'Montserrat'
];
