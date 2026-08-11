import {
  Shirt,
  Footprints,
  ShoppingBag,
  Gift,
  Package,
  Sparkles,
  Coffee,
  Utensils,
  Smartphone,
  Tag,
  Glasses,
  Home,
  Shield,
  Car,
  Smile,
  Heart,
  Scissors,
  Wrench,
  Layers,
  Star,
  HelpCircle,
  Percent,
  Award
} from 'lucide-react';

export const PRESET_ICON_MAP = {
  Shirt,
  Footprints,
  ShoppingBag,
  Gift,
  Package,
  Sparkles,
  Coffee,
  Utensils,
  Smartphone,
  Home,
  Tag,
  Glasses,
  Scissors,
  Heart,
  Wrench,
  Layers,
  Star,
  Smile,
  Car,
  Percent,
  Award,
  HelpCircle
};

export const PRESET_ICON_LABELS = {
  Shirt: 'Oblečení / Móda',
  Footprints: 'Obuv / Boty',
  ShoppingBag: 'Tašky / Kabelky',
  Gift: 'Dárkový Poukaz',
  Package: 'Volný Prodej / Balík',
  Sparkles: 'Šperky / Doplňky',
  Coffee: 'Nápoje / Káva',
  Utensils: 'Občerstvení / Jídlo',
  Smartphone: 'Elektronika / Mobily',
  Home: 'Domácí Potřeby',
  Tag: 'Štítek / Obecné',
  Glasses: 'Optika / Módní doplňky',
  Scissors: 'Služby / Úpravy',
  Heart: 'Kosmetika / Péče',
  Wrench: 'Nářadí / Opravy',
  Layers: 'Textil / Ponožky',
  Star: 'Oblíbené / Akce',
  Smile: 'Hračky / Děti',
  Car: 'Auto-Moto',
  Percent: 'Sleva / Akce',
  Award: 'Prémiové / Speciální',
  HelpCircle: 'Různé / Ostatní'
};

export function getPresetIconComponent(iconKey) {
  if (!iconKey || !PRESET_ICON_MAP[iconKey]) return null;
  return PRESET_ICON_MAP[iconKey];
}
