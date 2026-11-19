export const DEFAULT_CATEGORIES = [
  { id: 'all', name: 'Všechny položky' }
];

export const COLOR_OPTIONS = [
  '#475569', // Slate
  '#1e293b', // Graphite
  '#1d4ed8', // Blue
  '#0f766e', // Teal
  '#15803d', // Green
  '#4d7c0f', // Olive
  '#b45309', // Ochre
  '#c2410c', // Rust
  '#9f1239', // Wine
  '#78350f'  // Brown
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
    id: 'preset-accessories',
    name: 'Doplňky',
    icon: 'Watch',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#a16207',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-home-textile',
    name: 'Bytový textil',
    icon: 'Bed',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#7c3aed',
    trackStock: false,
    stockQuantity: 0
  },
  {
    id: 'preset-kitchen',
    name: 'Kuchyně',
    icon: 'UtensilsCrossed',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#c2410c',
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
    id: 'preset-drugstore',
    name: 'Drogerie',
    icon: 'Droplets',
    price: 0,
    isOpenPrice: true,
    isGeneralPreset: true,
    vat: 21,
    category: 'all',
    color: '#0d9488',
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
  },
  {
    id: 'preset-bag',
    name: 'Nákupní taška',
    icon: 'ShoppingBag',
    price: 15,
    costPrice: 6,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#475569',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-soap',
    name: 'Tekuté mýdlo 500 ml',
    icon: 'Droplet',
    price: 39,
    costPrice: 22,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#0e7490',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-shower-gel',
    name: 'Sprchový gel',
    icon: 'Bath',
    price: 59,
    costPrice: 34,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#1d4ed8',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-toothpaste',
    name: 'Zubní pasta',
    icon: 'Sparkles',
    price: 49,
    costPrice: 28,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#15803d',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-detergent',
    name: 'Prací gel 1,5 l',
    icon: 'Droplets',
    price: 129,
    costPrice: 78,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#4d7c0f',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-toilet-paper',
    name: 'Toaletní papír 8 ks',
    icon: 'Package',
    price: 89,
    costPrice: 52,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#64748b',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-sponges',
    name: 'Houbičky na nádobí 3 ks',
    icon: 'Brush',
    price: 29,
    costPrice: 15,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#b45309',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  },
  {
    id: 'preset-candle',
    name: 'Vonná svíčka',
    icon: 'Flame',
    price: 99,
    costPrice: 48,
    vat: 21,
    unit: 'ks',
    isWeighted: false,
    category: 'all',
    color: '#9f1239',
    trackStock: false,
    stockQuantity: 0,
    marginCoefficient: 1.4
  }
];

export const DEFAULT_STORE_CONFIG = {
  storeName: 'VoltFlow Store s.r.o.',
  street: 'Václavské náměstí 15',
  city: '110 00 Praha 1',
  ico: '12345678',
  dic: 'CZ12345678',
  registerNo: 'Pokladna #01',
  defaultVat: 21,
  receiptFooter: 'Děkujeme za váš nákup!',
  receiptFooterLines: 'Děkujeme za váš nákup!\nReklamace možná do 14 dnů s účtenkou.',
  receiptTopMargin: 1,
  receiptBottomMargin: 3,
  receiptCopies: 1,
  receiptEncoding: 'CP852',
  stripDiacritics: false,
  receiptSeparatorStyle: 'dashed',
  receiptSeparatorSpacing: 'standard',
  receiptTitleStyle: 'banner',
  receiptBoldStoreName: true,
  receiptBoldItemNames: true,
  receiptBoldPrices: true,
  receiptBoldTotal: true,
  receiptBoldFooter: false,
  receiptShowStoreContact: true,
  receiptStorePhone: '',
  receiptStoreEmail: '',
  receiptVatPayerStatus: 'payer',
  receiptItemDensity: 'standard',
  receiptShowItemSku: false,
  receiptShowItemVat: true,
  receiptShowItemDiscount: true,
  receiptTaxMatrixStyle: 'detailed',
  receiptQrCodeType: 'spayd',
  receiptQrCodeUrl: '',
  receiptCustomHeader: '',
  receiptShowBranding: true,
  receiptShowCashier: true,
  currencySymbol: 'Kč',
  printerPaperWidth: '80', // '58' or '80' mm thermal receipt printer
  autoPrintReceipt: false, // Auto-print receipt on finished transaction
  presetGridColumns: 'auto', // Grid density: 'auto', '3', '4', '5', '6' columns
  presetDensity: 'standard', // 'compact', 'standard', 'large'
  presetButtonStyle: 'tinted', // 'tinted', 'color-fill'
  cartItemStyle: 'elevated-card', // 'elevated-card', 'divided-row', 'rounded-tile'
  showPresetVat: false, // Show VAT percentage badge on preset buttons
  enableB2bInvoicing: false, // Hide B2B corporate invoice toggle in payment modal by default
  inventoryEnabled: false, // Hide Inventory & stock tracking module by default
  eetEnabled: false, // EET Ready mode indicator (disabled by default for local counter testing)
  defaultLanguage: 'cs',
  buttonAnimationMode: 'instant', // 'instant' (default, no transform lag on touch) or 'animated'
  registerLayout: 'two_column', // 'two_column' (default, wide preset grid + cart) or 'three_column' (classic manual keypad + presets + cart)
  shiftWidgetPosition: 'bottom_presets', // 'bottom_presets' (slim bar under presets), 'under_cart' (docked under cart), or 'keypad' (under keypad in left col)
  fontSize: 'lg', // 'sm' (14px), 'md' (16px), 'lg' (18px), 'xl' (20px)
  autoOpenTouchKeyboard: false // Auto-invoke Windows Touch Keyboard on input focus
};
