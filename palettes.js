/* ==========================================================================
   COUNTERS PALETTES, PICKER INSTRUMENTS & COLOR CONTRAST HELPERS
   Shared source of truth imported by both app.js and the palettes.html lab.
   ========================================================================== */

// Preset counter palettes. Counters store a slot index (0-7), so switching
// palettes recolors existing counters. Every color in a palette must take the
// same text color at 4.5:1 so cards never mix black and white text (enforced
// in tests/e2e/accessibility.spec.js).
export const PALETTES = {
  bold: {
    label: "Bold",
    colors: [
      "#0a54dd", // Royal blue
      "#c73511", // Red-orange
      "#c81876", // Magenta
      "#7e37f8", // Violet
      "#5a8012", // Grass green
      "#a25f11", // Amber
      "#158186", // Teal
      "#aa19ce", // Purple
    ],
    names: [
      "Royal blue",
      "Red-orange",
      "Magenta",
      "Violet",
      "Grass green",
      "Amber",
      "Teal",
      "Purple",
    ],
  },
  pastel: {
    label: "Pastel",
    colors: [
      "#93ddfa", // Sky
      "#fdc399", // Apricot
      "#fdb2c8", // Pink
      "#c1d0fb", // Periwinkle
      "#b6dfa0", // Leaf green
      "#e9cf87", // Butter
      "#86e6d3", // Mint
      "#d4b3fc", // Lilac
    ],
    names: [
      "Sky",
      "Apricot",
      "Pink",
      "Periwinkle",
      "Leaf green",
      "Butter",
      "Mint",
      "Lilac",
    ],
  },
  vintage: {
    label: "Vintage",
    colors: [
      "#7da2c9", // Denim
      "#d48871", // Terracotta
      "#d99fa7", // Dusty rose
      "#b1a1d1", // Mauve
      "#9bb48e", // Sage
      "#d8b260", // Mustard
      "#77b1b0", // Dusty teal
      "#a475af", // Plum
    ],
    names: [
      "Denim",
      "Terracotta",
      "Dusty rose",
      "Mauve",
      "Sage",
      "Mustard",
      "Dusty teal",
      "Plum",
    ],
  },
  nautical: {
    label: "Nautical",
    colors: [
      "#0f2a5f", // Navy
      "#8b320b", // Red lead
      "#730533", // Signal red
      "#5c6b76", // Storm grey
      "#294c2a", // Kelp
      "#72511e", // Brass
      "#115e5e", // Deep sea
      "#453065", // Twilight
    ],
    names: [
      "Navy",
      "Red lead",
      "Signal red",
      "Storm grey",
      "Kelp",
      "Brass",
      "Deep sea",
      "Twilight",
    ],
  },
  vaporwave: {
    label: "Vaporwave",
    colors: [
      "#01cdfe", // Cyan
      "#fd7f82", // Coral
      "#ff71ce", // Hot pink
      "#8c9cfb", // Periwinkle
      "#fffb96", // Lemon
      "#fda573", // Sunset orange
      "#05ffa1", // Mint
      "#b967ff", // Purple
    ],
    names: [
      "Cyan",
      "Coral",
      "Hot pink",
      "Periwinkle",
      "Lemon",
      "Sunset orange",
      "Mint",
      "Purple",
    ],
  },
  colorblind: {
    // Designed to stay distinguishable with deuteranopia, protanopia, and
    // tritanopia: black text lets lightness vary, which survives color blindness
    label: "Accessible",
    colors: [
      "#85e1f8", // Sky
      "#c37d31", // Caramel
      "#f6a696", // Salmon
      "#94b4f4", // Periwinkle
      "#bcfbbb", // Mint
      "#d4db4c", // Citron
      "#349984", // Teal
      "#9b72ef", // Violet
    ],
    names: [
      "Sky",
      "Caramel",
      "Salmon",
      "Periwinkle",
      "Mint",
      "Citron",
      "Teal",
      "Violet",
    ],
  },
};

// One distinct Web Audio instrument per color palette (zero external audio assets)
export const PALETTE_INSTRUMENTS = {
  bold: {
    id: "marimba",
    label: "Marimba",
    fundType: "sine",
    overType: "triangle",
    overMult: 4,
    detuneCents: 0,
    octaveShift: 0,
    attack: 0.01,
    decay: 0.28,
    peakVol: 0.085,
    sustainVol: 0.0085,
    overPeak: 0.28,
    overSustain: 0.06,
    overDecay: 0.14,
    filterHz: 3200,
    swellFilterHz: 4800,
    filterQ: 0.8,
    pop: { startMult: 1.15, endMult: 0.32, dur: 0.11, vol: 0.15 },
  },
  pastel: {
    id: "celesta",
    label: "Music box",
    fundType: "sine",
    overType: "sine",
    overMult: 3,
    detuneCents: 0,
    octaveShift: 12,
    attack: 0.008,
    decay: 0.45,
    peakVol: 0.07,
    sustainVol: 0.007,
    overPeak: 0.22,
    overSustain: 0.08,
    overDecay: 0.4,
    filterHz: 5200,
    swellFilterHz: 7500,
    filterQ: 0.7,
    pop: { startMult: 1.35, endMult: 0.55, dur: 0.09, vol: 0.13 },
  },
  vintage: {
    id: "rhodes",
    label: "Electric piano",
    fundType: "sine",
    overType: "sine",
    overMult: 2,
    detuneCents: 3,
    octaveShift: 0,
    attack: 0.012,
    decay: 0.38,
    peakVol: 0.08,
    sustainVol: 0.008,
    overPeak: 0.32,
    overSustain: 0.1,
    overDecay: 0.26,
    filterHz: 1800,
    swellFilterHz: 3400,
    filterQ: 1.0,
    pop: { startMult: 0.95, endMult: 0.3, dur: 0.12, vol: 0.15 },
  },
  nautical: {
    id: "brass",
    label: "Warm brass",
    fundType: "sawtooth",
    overType: "triangle",
    overMult: 1,
    detuneCents: -4,
    octaveShift: 0,
    attack: 0.045,
    decay: 0.35,
    peakVol: 0.075,
    sustainVol: 0.0075,
    overPeak: 0.45,
    overSustain: 0.35,
    overDecay: 0.35,
    filterHz: 900,
    swellFilterHz: 3200,
    filterQ: 1.8,
    pop: { startMult: 0.85, endMult: 0.24, dur: 0.13, vol: 0.16 },
  },
  vaporwave: {
    id: "synth",
    label: "Retro synth",
    fundType: "sawtooth",
    overType: "sawtooth",
    overMult: 1,
    detuneCents: 8,
    octaveShift: 0,
    attack: 0.03,
    decay: 0.36,
    peakVol: 0.06,
    sustainVol: 0.006,
    overPeak: 0.7,
    overSustain: 0.65,
    overDecay: 0.36,
    filterHz: 1400,
    swellFilterHz: 4600,
    filterQ: 2.2,
    pop: { startMult: 1.5, endMult: 0.22, dur: 0.11, vol: 0.14 },
  },
  colorblind: {
    id: "vibraphone",
    label: "Vibraphone",
    fundType: "sine",
    overType: "triangle",
    overMult: 2,
    detuneCents: 0,
    octaveShift: 0,
    attack: 0.012,
    decay: 0.35,
    peakVol: 0.08,
    sustainVol: 0.008,
    overPeak: 0.18,
    overSustain: 0.09,
    overDecay: 0.35,
    filterHz: 4200,
    swellFilterHz: 6000,
    filterQ: 0.7,
    pop: { startMult: 1.1, endMult: 0.38, dur: 0.1, vol: 0.15 },
  },
};

// Slots keep a counter's color family across palettes (slot 0 is bluish in
// every palette, and so on), so slot order isn't rainbow order. Pickers show
// swatches sorted by hue instead, with near-greys last.
export const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.08) return 999; // near-grey: sort last
  const d = max - min;
  const h =
    max === r
      ? ((g - b) / d) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

export const sortColorsByHue = (hexes) =>
  [...hexes].sort((a, b) => hueOf(a) - hueOf(b));

// Convert HSL (0-360, 0-100, 0-100) to #rrggbb
export const hslToHex = (h, s, l) => {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) =>
    Math.round(
      255 * (lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))),
    );
  return (
    "#" +
    [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("")
  );
};

// WCAG relative luminance and contrast ratio for #rrggbb colors
export const relativeLuminance = (hex) => {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

export const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
};

// Mix a #rrggbb color toward another by t (0-1)
export const mixHex = (hex, toward, t) =>
  "#" +
  [1, 3, 5]
    .map((i) => {
      const from = parseInt(hex.slice(i, i + 2), 16);
      const to = parseInt(toward.slice(i, i + 2), 16);
      return Math.round(from + (to - from) * t)
        .toString(16)
        .padStart(2, "0");
    })
    .join("");

// Black or white text, whichever contrasts more with a #rrggbb background
export const getReadableTextColor = (hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const whiteContrast = contrastRatio(hex, "#ffffff");
  // Prefer white whenever it passes WCAG AA (4.5:1). White only gains contrast
  // under the card header's dark overlay, while black loses it, so a color
  // where black barely wins on the body could still fail in the header.
  if (whiteContrast >= 4.5) return "#ffffff";
  // Otherwise (light custom colors) use pure black, which beats near-black.
  return whiteContrast >= contrastRatio(hex, "#000000") ? "#ffffff" : "#000000";
};

// Convert #rrggbb to { h, s, l } (0-360, 0-100, 0-100)
export const hexToHsl = (hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return { h: 205, s: 82, l: 58 };
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
};

export const getHeaderTextColor = (hex, text) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return text;
  const header = mixHex(hex, "#000000", 0.12);
  if (contrastRatio(header, text) >= 4.5) return text;
  return contrastRatio(header, "#ffffff") >= contrastRatio(header, "#000000")
    ? "#ffffff"
    : "#000000";
};

export const getReadableInk = (hex, surface, toward, start) => {
  for (let t = start; t < 1; t += 0.05) {
    const ink = mixHex(hex, toward, t);
    if (contrastRatio(ink, surface) >= 4.5) return ink;
  }
  return toward;
};

export const getInkOnLightTint = (hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#000000";
  return getReadableInk(hex, mixHex("#ffffff", hex, 0.1), "#000000", 0.15);
};

export const getInkOnDarkTint = (hex, start = 0) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  return getReadableInk(hex, mixHex("#16171d", hex, 0.15), "#ffffff", start);
};
