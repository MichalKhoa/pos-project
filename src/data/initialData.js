export const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'Všechny položky' }
];

export const COLOR_OPTIONS = [
  '#3b82f6', // Ocean Blue
  '#2563eb', // Royal Blue
  '#0284c7', // Sky Blue
  '#06b6d4', // Cyan
  '#0d9488', // Teal
  '#10b981', // Emerald Green
  '#16a34a', // Forest Green
  '#84cc16', // Lime Green
  '#eab308', // Gold Yellow
  '#f59e0b', // Vibrant Amber
  '#f97316', // Bright Orange
  '#ea580c', // Dark Orange
  '#ef4444', // Crimson Red
  '#dc2626', // Deep Red
  '#ec4899', // Hot Pink
  '#d946ef', // Magenta
  '#a855f7', // Electric Violet
  '#8b5cf6', // Deep Purple
  '#6366f1', // Indigo
  '#64748b', // Slate Gray
  '#475569', // Dark Slate
  '#78350f', // Espresso Brown
  '#0f172a'  // Midnight Black
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
    color: '#3b82f6',
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
    color: '#8b5cf6',
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
    color: '#10b981',
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
    color: '#ec4899',
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
    color: '#06b6d4',
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
    color: '#f59e0b',
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
    color: '#f43f5e',
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
  eetEnabled: true, // EET Ready mode indicator
  defaultLanguage: 'cs'
};
