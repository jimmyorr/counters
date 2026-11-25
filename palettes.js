/* ==========================================================================
   COUNTERS PALETTES, PICKER INSTRUMENTS & SHARED COLOR / ACCENT ENGINE
   Single source of truth imported by app.js, debug.js, and tests.
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

// Automatic bird placeholder names assigned to newly created counters
export const COUNTER_PLACEHOLDER_LABELS = [
  "Crane",
  "Egret",
  "Finch",
  "Flicker",
  "Gull",
  "Heron",
  "Jay",
  "Junco",
  "Kite",
  "Lark",
  "Magpie",
  "Merlin",
  "Piper",
  "Plover",
  "Puffin",
  "Robin",
  "Sparrow",
  "Starling",
  "Swift",
  "Tern",
  "Vesper",
  "Wren",
];

export const CARD_HEADER_BLACK_MIX = 0.12;

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

export const getCardHeaderHex = (hex) =>
  mixHex(hex, "#000000", CARD_HEADER_BLACK_MIX);

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
  const header = getCardHeaderHex(hex);
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

// Update --theme-hue plus readable accent tokens across all light and dark
// surfaces so text meets WCAG 1.4.3 (4.5:1) and icons/marks meet 1.4.11 (3:1).
export const applyAccentTokens = (hue, root = document.documentElement) => {
  root.style.setProperty("--theme-hue", hue);
  const rawLight = hslToHex(hue, 94, 60);
  const accDark = hslToHex(hue, 92, 65);

  const hNorm = ((Number(hue) % 360) + 360) % 360;

  // On blues/purples (195°–285°, including default 205°), reach 4.55:1 in light
  // mode so primary buttons get crisp white text instead of hard-to-read black on blue;
  // elsewhere gently nudge mid-tones (L >= 44%) when 3.05:1 is within reach so red (0°)
  // stays bright #f93939 and yellow stays sunny.
  let accLight = rawLight;
  if (hNorm >= 195 && hNorm <= 285) {
    for (let l = 60; l >= 32; l -= 0.5) {
      const candidate = hslToHex(hue, 94, l);
      if (
        contrastRatio(candidate, "#ffffff") >= 4.55 &&
        contrastRatio(candidate, "#f2f3f7") >= 4.55
      ) {
        accLight = candidate;
        break;
      }
    }
  } else {
    for (let l = 60; l >= 44; l -= 0.5) {
      const candidate = hslToHex(hue, 94, l);
      if (
        contrastRatio(candidate, "#ffffff") >= 3.05 &&
        contrastRatio(candidate, "#f2f3f7") >= 3.05
      ) {
        accLight = candidate;
        break;
      }
    }
  }

  // Darkening yellow (42°–86°) at fixed HSL hue turns it swamp olive; smoothly
  // warm that band toward golden amber so darkened light-mode tokens read as gold.
  const darkenableHue =
    hNorm > 42 && hNorm < 86
      ? hNorm -
        17 * 0.5 * (1 - Math.cos((2 * Math.PI * (hNorm - 42)) / (86 - 42)))
      : hNorm;

  const lightSurfaces = [
    "#ffffff",
    "#f2f3f7",
    "#e9ebee",
    mixHex("#e9ebee", rawLight, 0.1),
    mixHex("#ffffff", rawLight, 0.1),
    mixHex("#e9ebee", accLight, 0.1),
    mixHex("#ffffff", accLight, 0.1),
  ];
  let inkLight = "#000000";
  for (let l = 60; l >= 0; l -= 0.5) {
    const candidate = hslToHex(darkenableHue, 94, l);
    if (lightSurfaces.every((s) => contrastRatio(candidate, s) >= 4.6)) {
      inkLight = candidate;
      break;
    }
  }
  const darkSurfaces = [
    "#0d0e11",
    "#16171d",
    "#21232c",
    mixHex("#21232c", accDark, 0.15),
    mixHex("#16171d", accDark, 0.15),
  ];
  let inkDark = "#ffffff";
  for (let l = 65; l <= 100; l += 0.5) {
    const candidate = hslToHex(hue, 92, l);
    if (darkSurfaces.every((s) => contrastRatio(candidate, s) >= 4.6)) {
      inkDark = candidate;
      break;
    }
  }
  let graphicLight = "#000000";
  for (let l = 60; l >= 0; l -= 0.5) {
    const candidate = hslToHex(darkenableHue, 94, l);
    if (
      ["#ffffff", "#f2f3f7", "#e9ebee"].every(
        (s) => contrastRatio(candidate, s) >= 3.15,
      )
    ) {
      graphicLight = candidate;
      break;
    }
  }
  let graphicDark = "#ffffff";
  for (let l = 65; l <= 100; l += 0.5) {
    const candidate = hslToHex(hue, 92, l);
    if (
      ["#0d0e11", "#16171d", "#21232c"].every(
        (s) => contrastRatio(candidate, s) >= 3.15,
      )
    ) {
      graphicDark = candidate;
      break;
    }
  }

  const lightFillContrasts =
    contrastRatio(accLight, "#ffffff") >= 3 &&
    contrastRatio(accLight, "#f2f3f7") >= 3;
  const darkFillContrasts =
    contrastRatio(accDark, "#16171d") >= 3 &&
    contrastRatio(accDark, "#0d0e11") >= 3;

  let navTextLight = "#000000";
  for (let l = 60; l >= 0; l -= 0.5) {
    const candidate = hslToHex(darkenableHue, 94, l);
    if (contrastRatio(candidate, "#f2f3f7") >= 4.55) {
      navTextLight = candidate;
      break;
    }
  }
  let navTextDark = "#ffffff";
  for (let l = 65; l <= 100; l += 0.5) {
    const candidate = hslToHex(hue, 92, l);
    if (contrastRatio(candidate, "#0d0e11") >= 4.55) {
      navTextDark = candidate;
      break;
    }
  }

  root.style.setProperty("--accent-fill-light", accLight);
  root.style.setProperty("--accent-ink-light", inkLight);
  root.style.setProperty("--accent-ink-dark", inkDark);
  root.style.setProperty("--accent-graphic-light", graphicLight);
  root.style.setProperty("--accent-graphic-dark", graphicDark);
  root.style.setProperty(
    "--accent-large-text-light",
    contrastRatio(accLight, "#ffffff") >= 3 ? accLight : graphicLight,
  );
  root.style.setProperty(
    "--accent-large-text-dark",
    contrastRatio(accDark, "#16171d") >= 3 ? accDark : graphicDark,
  );
  root.style.setProperty(
    "--accent-nav-icon-light",
    contrastRatio(accLight, "#f2f3f7") >= 3 ? accLight : graphicLight,
  );
  root.style.setProperty(
    "--accent-nav-icon-dark",
    contrastRatio(accDark, "#0d0e11") >= 3 ? accDark : graphicDark,
  );
  root.style.setProperty("--accent-nav-text-light", navTextLight);
  root.style.setProperty("--accent-nav-text-dark", navTextDark);
  root.style.setProperty(
    "--accent-badge-rim-light",
    lightFillContrasts ? "none" : graphicLight,
  );
  root.style.setProperty(
    "--accent-badge-rim-dark",
    darkFillContrasts ? "none" : graphicDark,
  );
  root.style.setProperty(
    "--accent-badge-radius-light",
    lightFillContrasts ? "11.25px" : "10.75px",
  );
  root.style.setProperty(
    "--accent-badge-radius-dark",
    darkFillContrasts ? "11.25px" : "10.75px",
  );
  root.style.setProperty(
    "--accent-badge-mark-light",
    contrastRatio(accLight, "#ffffff") >= 3 ? "#ffffff" : "#000000",
  );
  root.style.setProperty(
    "--accent-fill-border-light",
    lightFillContrasts
      ? "transparent"
      : `color-mix(in srgb, ${graphicLight} 45%, transparent)`,
  );
  root.style.setProperty("--accent-on-fill-light", getReadableTextColor(accLight));
  root.style.setProperty("--accent-on-fill-dark", getReadableTextColor(accDark));
};

// Perceptual OKLab & Machado et al. (2009) full-severity CVD simulation
export const srgbToLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

export const linearToSrgb = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

export const CVD_MATRICES = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

// Simulate CVD on normalized [0..1] sRGB triple
export const simulateCvdRgb = (rgb01, matrix) => {
  const l = rgb01.map(srgbToLinear);
  return matrix.map((row) =>
    linearToSrgb(
      Math.min(1, Math.max(0, row[0] * l[0] + row[1] * l[1] + row[2] * l[2])),
    ),
  );
};

export const simulateCvdHex = (hex, visionMode) => {
  if (!visionMode || visionMode === "normal" || !CVD_MATRICES[visionMode]) {
    return hex;
  }
  const rgb01 = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const out = simulateCvdRgb(rgb01, CVD_MATRICES[visionMode]);
  return (
    "#" +
    out
      .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
      .join("")
  );
};

export const rgbToOklab = (rgb01) => {
  const [r, g, b] = rgb01.map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

export const hexToOklab = (hex) =>
  rgbToOklab([1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));

export const oklabDistanceRgb = (rgbA, rgbB) => {
  const a = rgbToOklab(rgbA);
  const b = rgbToOklab(rgbB);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b) * 100;
};

export const oklabDistance = (hexA, hexB) => {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b) * 100;
};
