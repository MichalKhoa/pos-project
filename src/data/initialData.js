export const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'Všechny položky' }
];

export const COLOR_OPTIONS = [
  '#2563eb', // Royal Blue
  '#1d4ed8', // Ocean Blue
  '#0284c7', // Vibrant Sky Blue
  '#0369a1', // Sky Navy
  '#0891b2', // Deep Cyan
  '#0f766e', // Dark Teal
  '#059669', // Teal Mint
  '#047857', // Emerald Green
  '#15803d', // Forest Green
  '#4d7c0f', // Warm Olive
  '#65a30d', // Vibrant Lime
  '#b45309', // Amber Ochre
  '#d97706', // Rich Amber
  '#c2410c', // Rust Orange
  '#ea580c', // Dark Orange
  '#dc2626', // Crimson Red
  '#b91c1c', // Deep Red
  '#be123c', // Ruby Rose
  '#9f1239', // Deep Wine
  '#db2777', // Deep Fuchsia
  '#a21caf', // Plum Magenta
  '#7c3aed', // Royal Violet
  '#6d28d9', // Deep Purple
  '#4f46e5', // Indigo
  '#475569', // Slate Gray
  '#334155', // Dark Slate
  '#78350f', // Espresso Brown
  '#1e293b'  // Graphite Black
];

export const DEFAULT_PRESETS = [
  {
    id: 'preset-clothes',
    name: 'Oblečení',
    icon: 'Shirt',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#2563eb',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-shoes',
    name: 'Boty',
    icon: 'Footprints',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#6d28d9',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-socks',
    name: 'Ponožky',
    icon: 'Layers',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#047857',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-underwear',
    name: 'Spodní prádlo',
    icon: 'Heart',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#be123c',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-home',
    name: 'Domácí potřeby',
    icon: 'Home',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#0891b2',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-open-1',
    name: 'Volný Prodej Zboží',
    icon: 'Package',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#d97706',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-open-2',
    name: 'Dárkový Poukaz',
    icon: 'Gift',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 0,
    category: 'all',
    color: '#b91c1c',
    trackStock: false,
    stockQuantity: 0
  }
];

export const DEFAULT_STORE_CONFIG = {
  storeName: 'Himmel Home s.r.o.',
  street: 'Václavské náměstí 15',
  city: '110 00 Praha 1',
  ico: '12345678',
  dic: 'CZ12345678',
  registerNo: 'Pokladna #01',
  defaultVat: 21,
  receiptFooter: 'Děkujeme za váš nákup! www.himmelhome.cz',
  currencySymbol: 'Kč',
  printerPaperWidth: '80', // '58' or '80' mm thermal receipt printer
  autoPrintReceipt: false, // Auto-print receipt on finished transaction
  presetGridColumns: 'auto', // Grid density: 'auto', '3', '4', '5', '6' columns
  presetDensity: 'standard', // 'compact', 'standard', 'large'
  presetButtonStyle: 'left-stripe', // 'left-stripe', 'color-fill'
  showPresetVat: true, // Show VAT percentage badge on preset buttons
  eetEnabled: true, // EET Ready mode indicator
  defaultLanguage: 'cs'
};
