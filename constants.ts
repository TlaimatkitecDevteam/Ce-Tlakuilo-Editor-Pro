
import { 
    Smartphone, Instagram, Facebook, Youtube, Monitor, Layout, 
    ShoppingBag, ShoppingCart, Globe, Briefcase, Printer, Megaphone, FileImage, 
    Sparkles, ArrowRight 
} from 'lucide-react';

export const INITIAL_W = 3840; 
export const INITIAL_H = 2160; 
export const MAX_HISTORY = 20;

export const PROJECT_PRESETS = {
    social: { 
        label: "Redes Sociales", 
        icon: Smartphone, 
        items: [
            { id: 'ig_post', label: 'Instagram Post', w: 1080, h: 1080, icon: Instagram },
            { id: 'ig_story', label: 'Instagram Story', w: 1080, h: 1920, icon: Smartphone },
            { id: 'fb_cover', label: 'Facebook Cover', w: 820, h: 312, icon: Facebook },
            { id: 'yt_thumb', label: 'YouTube Thumb', w: 1280, h: 720, icon: Youtube },
            { id: 'tw_header', label: 'Twitter Header', w: 1500, h: 500, icon: ArrowRight },
            { id: 'linkedin', label: 'LinkedIn Banner', w: 1584, h: 396, icon: Briefcase }
        ] 
    },
    ads: { 
        label: "Publicidad & Ads", 
        icon: Megaphone, 
        items: [
            { id: 'fb_ad', label: 'Facebook/IG Ad', w: 1200, h: 628, icon: Facebook },
            { id: 'google_med', label: 'Rectángulo Medio', w: 300, h: 250, icon: Layout },
            { id: 'google_leader', label: 'Leaderboard', w: 728, h: 90, icon: Layout },
            { id: 'google_sky', label: 'Skyscraper', w: 160, h: 600, icon: Layout }
        ] 
    },
    market: { 
        label: "Marketplace", 
        icon: ShoppingBag, 
        items: [
            { id: 'amz_main', label: 'Amazon Main', w: 1000, h: 1000, icon: ShoppingBag },
            { id: 'ml_main', label: 'Mercado Libre', w: 1200, h: 1200, icon: ShoppingCart },
            { id: 'shopify', label: 'Shopify', w: 2048, h: 2048, icon: Globe },
            { id: 'etsy', label: 'Etsy Listing', w: 2000, h: 2000, icon: Sparkles }
        ] 
    },
    web: { 
        label: "Web & Blog", 
        icon: Globe, 
        items: [
            { id: 'blog', label: 'Blog Post', w: 1200, h: 630, icon: FileImage },
            { id: 'fhd', label: 'Full HD 1080p', w: 1920, h: 1080, icon: Monitor },
            { id: '4k', label: '4K UHD', w: 3840, h: 2160, icon: Monitor },
            { id: 'og_image', label: 'OG Image', w: 1200, h: 630, icon: Globe }
        ] 
    },
    print: { 
        label: "Impresión & Postales", 
        icon: Printer, 
        items: [
            { id: 'a4', label: 'A4 (300dpi)', w: 2480, h: 3508, icon: FileImage },
            { id: 'postcard', label: 'Postal 4x6"', w: 1200, h: 1800, icon: FileImage },
            { id: 'card', label: 'Tarjeta Visita', w: 1050, h: 600, icon: Briefcase },
            { id: 'letter', label: 'Carta (Letter)', w: 2550, h: 3300, icon: FileImage }
        ] 
    }
};

export const BG_PRESETS = [
    'linear-gradient(to right, #ff7e5f, #feb47b)',
    'linear-gradient(to right, #43e97b, #38f9d7)',
    'linear-gradient(to right, #fa709a, #fee140)',
    '#ffffff', 
    '#000000', 
    '#1a1a1a'
];

export const CROP_RATIOS = [
    { label: 'Libre', val: null },
    { label: '1:1', val: 1 },
    { label: '16:9', val: 16/9 },
    { label: '4:3', val: 4/3 },
    { label: '9:16', val: 9/16 },
];

export const FONTS = [
    'Inter', 'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 
    'Impact', 'Comic Sans MS', 'Roboto', 'Playfair Display', 'Montserrat', 
    'Oswald', 'Merriweather'
];
