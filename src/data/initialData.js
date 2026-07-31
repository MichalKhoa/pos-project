export const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'Všechny položky' },
  { id: 'living', name: 'Obývák & Dekorace' },
  { id: 'kitchen', name: 'Kuchyně & Jídelna' },
  { id: 'bath', name: 'Koupelna' },
  { id: 'custom', name: 'Rychlý prodej' }
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
    id: 'preset-1',
    name: 'Svíčka Vonná Premium',
    price: 249,
    vat: 21,
    category: 'living',
    color: '#8b5cf6'
  },
  {
    id: 'preset-2',
    name: 'Váza Keramická bílá',
    price: 389,
    vat: 21,
    category: 'living',
    color: '#3b82f6'
  },
  {
    id: 'preset-3',
    name: 'Hrnek Keramický 350ml',
    price: 149,
    vat: 21,
    category: 'kitchen',
    color: '#10b981'
  },
  {
    id: 'preset-4',
    name: 'Sada Příborů 24ks',
    price: 699,
    vat: 21,
    category: 'kitchen',
    color: '#f59e0b'
  },
  {
    id: 'preset-5',
    name: 'Ručník Bavlna 50x100',
    price: 199,
    vat: 21,
    category: 'bath',
    color: '#06b6d4'
  },
  {
    id: 'preset-6',
    name: 'Dávkovač Mýdla Sklo',
    price: 229,
    vat: 21,
    category: 'bath',
    color: '#ec4899'
  },
  {
    id: 'preset-7',
    name: 'Eko Čistící Prostředek',
    price: 119,
    vat: 21,
    category: 'bath',
    color: '#14b8a6'
  },
  {
    id: 'preset-8',
    name: 'Polštář Dekorativní',
    price: 299,
    vat: 21,
    category: 'living',
    color: '#a855f7'
  },
  {
    id: 'preset-open-1',
    name: 'Volný Prodej Zboží',
    price: 0,
    isOpenPrice: true,
    vat: 21,
    category: 'custom',
    color: '#f59e0b'
  },
  {
    id: 'preset-open-2',
    name: 'Dárkový Poukaz (Libovolná částka)',
    price: 0,
    isOpenPrice: true,
    vat: 0,
    category: 'custom',
    color: '#ec4899'
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
  eetEnabled: true, // EET Ready mode indicator
  defaultLanguage: 'cs'
};
