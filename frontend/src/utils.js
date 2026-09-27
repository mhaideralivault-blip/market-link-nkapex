// ---- form validation ----
export const isValidEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const isValidName = (value = '') => value.trim().length >= 2 && /^[\p{L}][\p{L}\s.'-]*$/u.test(value.trim());
export const isValidPhone = (value = '') => value.replace(/\D/g, '').length >= 7 && /^[\d+\-\s()]{7,20}$/.test(value.trim());

export const PASSWORD_RULES = [
  { key: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { key: 'num', label: 'One number', test: (v) => /\d/.test(v) },
  { key: 'special', label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];
export const passwordIssues = (value = '') => PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
export const isStrongPassword = (value = '') => passwordIssues(value).length === 0;

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
export const money = (n) => `$${Number(n || 0).toFixed(2)}`;
export const daysText = (days = []) => (days.length ? days.map((day) => cap(day.slice(0, 3))).join(', ') : 'Not set');

export const directionsLinks = (lat, lng) => ({
  osm: `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`,
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
});

const EMOJI = { vegetables: '🥕', fruits: '🍎', dairy: '🥛', 'baked goods': '🥖', 'eggs & poultry': '🥚', 'meat & seafood': '🐟', 'honey & preserves': '🍯', 'herbs & spices': '🌿', 'grains & pulses': '🌾' };
export const categoryEmoji = (name = '') => EMOJI[name.toLowerCase()] || '🥬';

// CSS class for the gradient shown when a product has no photo.
export const phClass = (name = '') => {
  const k = name.toLowerCase();
  if (k.includes('veg')) return 'ph-veg';
  if (k.includes('fruit')) return 'ph-fruit';
  if (k.includes('dairy')) return 'ph-dairy';
  if (k.includes('bak')) return 'ph-bake';
  if (k.includes('egg') || k.includes('poultry')) return 'ph-egg';
  return 'ph-default';
};

// "Today", "Tomorrow" or "Sat 26 Sep": the next day a market/stall is open.
const DAY_INDEX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
export const nextOpenLabel = (days = []) => {
  const open = days.map((day) => DAY_INDEX[day]).filter((n) => n !== undefined);
  if (!open.length) return '';
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    if (open.includes(d.getDay())) {
      if (i === 0) return 'Today';
      if (i === 1) return 'Tomorrow';
      return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    }
  }
  return '';
};

// "5 min ago", "3 h ago", "2 d ago"
export const timeAgo = (date) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};
export const shortDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

// Freshness badges a grower can attach to a product (keep in sync with backend Product.TAGS).
export const TAGS = [
  ['organic', 'Organic'],
  ['pesticide-free', 'Pesticide-free'],
  ['seasonal', 'Seasonal'],
  ['fresh-picked', 'Fresh-picked'],
  ['handmade', 'Handmade'],
  ['small-batch', 'Small batch'],
  ['vegan', 'Vegan'],
  ['gluten-free', 'Gluten-free'],
];
export const tagLabel = (v) => TAGS.find(([k]) => k === v)?.[1] || v;
// "today", "yesterday", "3 days ago" for a harvest / production date
export const harvestText = (date) => {
  const days = Math.round((Date.now() - new Date(date).getTime()) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

// Readable URLs: /products/sourdough-loaf instead of /products/6ab5...; old id links keep working.
export const productPath = (p) => `/products/${p.slug || p._id}`;
export const farmerPath = (f) => `/farmers/${f?.farmerProfile?.slug || f?.slug || f?._id}`;
export const marketPath = (m) => `/markets/${m.slug || m._id}`;
