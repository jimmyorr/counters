/* ==========================================================================
   COUNTERS DEBUG — CANDIDATE PALETTES & DYNAMIC GENERATORS
   Reuses PALETTES, PALETTE_INSTRUMENTS, contrast math, OKLab, and Machado CVD
   simulation directly from ./palettes.js so nothing is duplicated.
   ========================================================================== */

import {
  PALETTES,
  PALETTE_INSTRUMENTS,
  hslToHex,
  hexToHsl,
  contrastRatio,
  getCardHeaderHex,
  getReadableTextColor,
  getHeaderTextColor,
  linearToSrgb,
  simulateCvdHex,
  hexToOklab,
  oklabDistance,
} from "./palettes.js";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const rgbToHex = (r, g, b) =>
  "#" +
  [r, g, b]
    .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
    .join("");

const oklabToLinearRgb = ({ L, a, b }) => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const isInGamut = ([r, g, b]) =>
  r >= -0.0005 &&
  r <= 1.0005 &&
  g >= -0.0005 &&
  g <= 1.0005 &&
  b >= -0.0005 &&
  b <= 1.0005;

export const oklchToHex = (L, C, hDeg) => {
  const hRad = (((hDeg % 360) + 360) % 360) * (Math.PI / 180);
  const clampedL = clamp(L, 0, 1);
  let lo = 0;
  let hi = Math.max(0, C);
  let best = [clampedL, clampedL, clampedL];
  const tryChroma = (c) =>
    oklabToLinearRgb({
      L: clampedL,
      a: c * Math.cos(hRad),
      b: c * Math.sin(hRad),
    });

  const full = tryChroma(hi);
  if (isInGamut(full)) {
    best = full;
  } else {
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      const rgb = tryChroma(mid);
      if (isInGamut(rgb)) {
        best = rgb;
        lo = mid;
      } else {
        hi = mid;
      }
    }
  }
  return rgbToHex(...best.map((v) => linearToSrgb(clamp(v, 0, 1)) * 255));
};

export const hexToOklch = (hex) => {
  const { L, a, b } = hexToOklab(hex);
  const C = Math.hypot(a, b);
  const h = C < 0.002 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, h };
};

export const ensureContrastPolarity = (hex, targetText, minRatio = 4.65) => {
  const check = (candidate) => {
    const chosen = getReadableTextColor(candidate);
    if (chosen !== targetText) return false;
    const bodyRatio = contrastRatio(candidate, targetText);
    const hdrRatio = contrastRatio(getCardHeaderHex(candidate), targetText);
    return bodyRatio >= minRatio && hdrRatio >= minRatio;
  };
  if (check(hex)) return hex;

  const { L, C, h } = hexToOklch(hex);
  if (targetText === "#ffffff") {
    let lo = 0.14;
    let hi = L;
    let best = oklchToHex(0.42, C, h);
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      const cand = oklchToHex(mid, C, h);
      if (check(cand)) {
        best = cand;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return best;
  }
  let lo = L;
  let hi = 0.96;
  let best = oklchToHex(0.84, C, h);
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    const cand = oklchToHex(mid, C, h);
    if (check(cand)) {
      best = cand;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
};

export const auditPalette = (colors, visionMode = "normal") => {
  const effective = colors.map((c) => simulateCvdHex(c, visionMode));
  const polarities = new Set();
  let minBodyContrast = Infinity;
  let minHeaderContrast = Infinity;

  const swatches = colors.map((hex, slot) => {
    const displayHex = effective[slot];
    const text = getReadableTextColor(hex);
    const headerHex = getCardHeaderHex(hex);
    const headerText = getHeaderTextColor(hex, text);
    const bodyContrast = contrastRatio(hex, text);
    const headerContrast = contrastRatio(headerHex, headerText);
    polarities.add(text);
    polarities.add(headerText);
    minBodyContrast = Math.min(minBodyContrast, bodyContrast);
    minHeaderContrast = Math.min(minHeaderContrast, headerContrast);
    const hsl = hexToHsl(hex);
    return {
      slot,
      hex,
      displayHex,
      text,
      headerText,
      bodyContrast,
      headerContrast,
      minContrast: Math.min(bodyContrast, headerContrast),
      hsl: {
        h: Math.round(hsl.h),
        s: Math.round(hsl.s),
        l: Math.round(hsl.l),
      },
    };
  });

  let minPairwiseDeltaE = Infinity;
  for (let i = 0; i < effective.length; i++) {
    for (let j = i + 1; j < effective.length; j++) {
      minPairwiseDeltaE = Math.min(
        minPairwiseDeltaE,
        oklabDistance(effective[i], effective[j]),
      );
    }
  }

  const polarityList = [...polarities];
  const polarityMode =
    polarityList.length === 1
      ? polarityList[0] === "#ffffff"
        ? "uniform-white"
        : "uniform-black"
      : "adaptive";

  return {
    swatches,
    polarityMode,
    isUniformText: polarityList.length === 1,
    minContrast: Number(Math.min(minBodyContrast, minHeaderContrast).toFixed(2)),
    passesWcagAA: Math.min(minBodyContrast, minHeaderContrast) >= 4.5,
    minPairwiseDeltaE: Number(minPairwiseDeltaE.toFixed(1)),
  };
};

export const PALETTE_GROUPS = [
  { id: "current", label: "In Counters", shortLabel: "Current" },
  { id: "clean", label: "Clean & versatile", shortLabel: "Clean" },
  { id: "retro", label: "Retro & design-nerdy", shortLabel: "Retro" },
  { id: "wild", label: "Actually wild", shortLabel: "Wild" },
  { id: "dynamic", label: "Dynamic", shortLabel: "Dynamic" },
];

export const SLOT_FAMILIES = [
  "Blue / cool",
  "Red-orange / warm",
  "Pink / crimson",
  "Indigo / slate",
  "Green / moss",
  "Amber / gold",
  "Teal / cyan",
  "Purple / deep",
];

const SHIPPED_NOTES = {
  bold: "Default palette in Counters. Balanced saturation across eight distinct hue families.",
  pastel: "Ships in Counters. High lightness keeps black labels above 4.5:1 under the 12% header shade.",
  vintage: "Ships in Counters. Muted chroma makes long scorekeeping sessions gentle on the eyes.",
  nautical: "Ships in Counters. Low-glare maritime hues suited for dim rooms and late-night games.",
  vaporwave: "Ships in Counters. Electric synthwave chroma with uniform dark text.",
  colorblind: "Ships in Counters (key: colorblind). Maintains OKLab ΔE ≥ 9 across deuteranopia, protanopia, and tritanopia.",
};

export const CANDIDATE_PALETTES = {
  botanical: {
    id: "botanical",
    label: "Botanical",
    group: "clean",
    notes: "Earthy glazed stoneware, dried herbs, canyon clay, and bark tuned for uniform white ink.",
    colors: ["#266d69", "#b54624", "#a14653", "#85674e", "#25663b", "#945e0d", "#606b14", "#523b2f"],
    names: ["Eucalyptus", "Terracotta", "Clay", "Sandstone", "Moss", "Ochre", "Olive", "Bark"],
  },
  jewel: {
    id: "jewel",
    label: "Jewel",
    group: "clean",
    notes: "Deeper and more velvety than Bold, yet noticeably richer and less muted than Nautical.",
    colors: ["#0f43b8", "#9e231b", "#b8144d", "#652dc1", "#0d6e3f", "#9c5708", "#0b6e69", "#6b186e"],
    names: ["Sapphire", "Garnet", "Ruby", "Amethyst", "Emerald", "Topaz", "Jade", "Deep plum"],
  },
  mono: {
    id: "mono",
    label: "Mono",
    group: "clean",
    isRamp: true,
    notes: "Zero-distraction monochrome board: four mist-slate steps (dark ink) and four graphite steps (white ink).",
    colors: ["#e6e9f0", "#cbd1de", "#aeb7c9", "#8f99ae", "#565f73", "#3e4657", "#292f3c", "#171a22"],
    names: ["Mist", "Fog", "Silver slate", "Pewter", "Steel", "Graphite", "Charcoal", "Obsidian"],
  },
  transit: {
    id: "transit",
    label: "Transit",
    group: "clean",
    notes: "NYC, London, and Tokyo subway line colors engineered to be told apart in half a second.",
    colors: ["#004fb6", "#c44900", "#c41e24", "#556270", "#15733b", "#965b00", "#007282", "#7b2cbf"],
    names: ["Express blue", "Sixth ave orange", "Central red", "Jubilee slate", "Lexington green", "Circle amber", "Victoria teal", "Flushing violet"],
  },
  risograph: {
    id: "risograph",
    label: "Risograph",
    group: "retro",
    notes: "Soy-based indie printmaking spot inks with overprinted key-plate black type.",
    colors: ["#5ec2ff", "#ff7c6b", "#ff7eb9", "#9899ff", "#6fd96c", "#ffd447", "#48d6cc", "#e0b663"],
    names: ["Cornflower", "Riso red", "Fluorescent pink", "Federal blue", "Kelly green", "Sunflower", "Bright teal", "Metallic gold"],
  },
  eightBit: {
    id: "eightBit",
    label: "8-bit",
    group: "retro",
    notes: "Inspired by PICO-8 and classic cartridge sprites—quirky hues with uniform dark pixel ink.",
    colors: ["#59bfff", "#ff9642", "#ff7eb3", "#a89cf7", "#5ce06b", "#ffec3d", "#5ce6e6", "#ffc49b"],
    names: ["Sky byte", "Blaze orange", "Berry sprite", "Dusk indigo", "Slime green", "Coin yellow", "Ice cyan", "Peach pixel"],
  },
  phosphor: {
    id: "phosphor",
    label: "Phosphor",
    group: "retro",
    notes: "Eight ANSI and vector CRT phosphor emissions tuned to radiate in dark mode with crisp dark text.",
    colors: ["#4deeea", "#ffb638", "#ff77e9", "#7ea8ff", "#4aff6b", "#ffe45e", "#6effc8", "#c490ff"],
    names: ["Cyan beam", "P3 amber", "Magenta trace", "Cobalt ray", "P1 green", "Warm filament", "Vector aqua", "UV phosphor"],
  },
  handheld: {
    id: "handheld",
    label: "Handheld",
    group: "retro",
    isRamp: true,
    notes: "Dot-matrix olive LCD ramp: four lit pea-soup steps and four deep pixel-shadow steps.",
    colors: ["#d9e67e", "#c2d468", "#a8bd56", "#8ea646", "#465e2a", "#354a1f", "#253615", "#17240d"],
    names: ["Pea-soup", "Backlit lime", "LCD olive", "Moss matrix", "Dither shade", "Sprite olive", "Deep pixel", "Dot charcoal"],
  },
  hazard: {
    id: "hazard",
    label: "Hazard",
    group: "retro",
    notes: "Swiss industrial workshop and blueprint materials with razor-sharp stencil contrast.",
    colors: ["#0d4ba6", "#ff7b1c", "#c91c22", "#515c69", "#b8bec6", "#f5c400", "#eef0eb", "#1a1d21"],
    names: ["Blueprint blue", "Safety orange", "Signal red", "Raw steel", "Concrete", "Caution yellow", "Chalk", "Matte black"],
  },
  thermal: {
    id: "thermal",
    label: "Thermal",
    group: "wild",
    isRamp: true,
    notes: "Full FLIR infrared spectrum—try the Heat 1–8 score preset to watch counters heat up across the grid.",
    colors: ["#1b114a", "#53157d", "#991470", "#c42136", "#fc8428", "#ffd026", "#ffe875", "#fff9db"],
    names: ["Deep indigo", "Thermal violet", "IR magenta", "Crimson core", "Blazing orange", "Bright yellow", "Pale gold", "White-hot"],
  },
  bioluminescent: {
    id: "bioluminescent",
    label: "Bioluminescent",
    group: "wild",
    notes: "Abyssal neon built to shine against Counters’ #0d0e11 dark mode backdrop with uniform dark ink.",
    colors: ["#52c4ff", "#ff877a", "#ff70d9", "#d9f7ff", "#9eff47", "#6bffb8", "#3ef5e0", "#b68cff"],
    names: ["Jellyfish blue", "Coral glow", "Anemone magenta", "Ghostly ice", "Anglerfish chartreuse", "Seafoam", "Dinoflagellate cyan", "Abyssal violet"],
  },
  plumage: {
    id: "plumage",
    label: "Plumage",
    group: "wild",
    notes: "Wild bird feathers paired naturally with Counters’ bird placeholder names.",
    colors: ["#1956b8", "#c41926", "#e3bf8e", "#4f5d73", "#0e6b45", "#f7cf1d", "#0a7285", "#5e329e"],
    names: ["Jay blue", "Cardinal red", "Waxwing buff", "Slate", "Mallard emerald", "Goldfinch yellow", "Kingfisher cyan", "Iridescent violet"],
  },
  highlighter: {
    id: "highlighter",
    label: "Highlighter",
    group: "wild",
    notes: "Pure 1990s fluorescent textbook markers with crisp black ink across all eight slots.",
    colors: ["#33f0ff", "#ff912b", "#ff73cb", "#be9eff", "#50ff80", "#f8ff33", "#bdff33", "#ff8282"],
    names: ["Electric cyan", "Safety orange", "Hot pink", "Neon lavender", "Acid green", "Radioactive yellow", "Blinding lime", "Laser coral"],
  },
  meeple: {
    id: "meeple",
    label: "Meeple",
    group: "wild",
    notes: "Painted-wood tabletop player pieces plus natural birch so cards match tokens on the table.",
    colors: ["#1452bd", "#bd2424", "#f58529", "#343942", "#1e783c", "#f5ce24", "#e3caa1", "#6e2ca8"],
    names: ["Royal blue", "Wood-stain red", "Orange", "Charcoal", "Meadow green", "Sunny yellow", "Natural birch", "Purple"],
  },
  ember: {
    id: "ember",
    label: "Ember",
    group: "wild",
    isRamp: true,
    notes: "Single-temperature campfire story cooling from spark gold and flame down to midnight smoke.",
    colors: ["#ffd647", "#ff882e", "#b8251e", "#9c3b1c", "#7d3522", "#59384a", "#36333b", "#1c1a21"],
    names: ["Spark gold", "Flame orange", "Coal red", "Burnt sienna", "Rust", "Ash plum", "Charcoal", "Midnight smoke"],
  },
};

export const CANDIDATE_INSTRUMENTS = {
  botanical: {
    id: "kalimba",
    label: "Thumb kalimba",
    fundType: "sine",
    overType: "triangle",
    overMult: 3,
    detuneCents: 2,
    octaveShift: 0,
    attack: 0.007,
    decay: 0.34,
    peakVol: 0.082,
    sustainVol: 0.008,
    overPeak: 0.26,
    overSustain: 0.05,
    overDecay: 0.16,
    filterHz: 2900,
    swellFilterHz: 4600,
    filterQ: 0.9,
    pop: { startMult: 1.2, endMult: 0.36, dur: 0.09, vol: 0.14 },
  },
  jewel: {
    id: "crystal-harp",
    label: "Crystal harp",
    fundType: "sine",
    overType: "sine",
    overMult: 5,
    detuneCents: 4,
    octaveShift: 12,
    attack: 0.014,
    decay: 0.48,
    peakVol: 0.068,
    sustainVol: 0.008,
    overPeak: 0.2,
    overSustain: 0.09,
    overDecay: 0.42,
    filterHz: 5800,
    swellFilterHz: 8200,
    filterQ: 1.2,
    pop: { startMult: 1.4, endMult: 0.5, dur: 0.1, vol: 0.13 },
  },
  mono: {
    id: "felt-piano",
    label: "Felt piano",
    fundType: "sine",
    overType: "triangle",
    overMult: 2,
    detuneCents: 1,
    octaveShift: 0,
    attack: 0.016,
    decay: 0.32,
    peakVol: 0.082,
    sustainVol: 0.0075,
    overPeak: 0.12,
    overSustain: 0.04,
    overDecay: 0.2,
    filterHz: 1150,
    swellFilterHz: 2400,
    filterQ: 0.6,
    pop: { startMult: 0.9, endMult: 0.35, dur: 0.09, vol: 0.13 },
  },
  transit: {
    id: "station-chime",
    label: "Station chime",
    fundType: "triangle",
    overType: "sine",
    overMult: 3,
    detuneCents: 0,
    octaveShift: 0,
    attack: 0.008,
    decay: 0.4,
    peakVol: 0.078,
    sustainVol: 0.008,
    overPeak: 0.3,
    overSustain: 0.11,
    overDecay: 0.34,
    filterHz: 3800,
    swellFilterHz: 5600,
    filterQ: 0.85,
    pop: { startMult: 1.25, endMult: 0.42, dur: 0.1, vol: 0.15 },
  },
  risograph: {
    id: "combo-organ",
    label: "Combo organ",
    fundType: "triangle",
    overType: "sawtooth",
    overMult: 2,
    detuneCents: 5,
    octaveShift: 0,
    attack: 0.015,
    decay: 0.32,
    peakVol: 0.068,
    sustainVol: 0.007,
    overPeak: 0.36,
    overSustain: 0.25,
    overDecay: 0.3,
    filterHz: 2100,
    swellFilterHz: 4400,
    filterQ: 1.4,
    pop: { startMult: 1.3, endMult: 0.3, dur: 0.1, vol: 0.14 },
  },
  eightBit: {
    id: "chiptune",
    label: "8-bit pulse",
    fundType: "square",
    overType: "square",
    overMult: 2,
    detuneCents: 0,
    octaveShift: 0,
    attack: 0.004,
    decay: 0.24,
    peakVol: 0.048,
    sustainVol: 0.005,
    overPeak: 0.35,
    overSustain: 0.18,
    overDecay: 0.2,
    filterHz: 3600,
    swellFilterHz: 6400,
    filterQ: 0.9,
    pop: { startMult: 1.6, endMult: 0.25, dur: 0.08, vol: 0.13 },
  },
  phosphor: {
    id: "crt-vector",
    label: "Vector beam",
    fundType: "sawtooth",
    overType: "sine",
    overMult: 2,
    detuneCents: 6,
    octaveShift: 0,
    attack: 0.018,
    decay: 0.36,
    peakVol: 0.062,
    sustainVol: 0.0065,
    overPeak: 0.45,
    overSustain: 0.3,
    overDecay: 0.32,
    filterHz: 1650,
    swellFilterHz: 5200,
    filterQ: 2.6,
    pop: { startMult: 1.45, endMult: 0.2, dur: 0.11, vol: 0.14 },
  },
  handheld: {
    id: "dmg-wave",
    label: "Dot-matrix blip",
    fundType: "square",
    overType: "triangle",
    overMult: 4,
    detuneCents: 0,
    octaveShift: 12,
    attack: 0.004,
    decay: 0.2,
    peakVol: 0.045,
    sustainVol: 0.0045,
    overPeak: 0.3,
    overSustain: 0.1,
    overDecay: 0.15,
    filterHz: 4200,
    swellFilterHz: 6800,
    filterQ: 1.0,
    pop: { startMult: 1.8, endMult: 0.4, dur: 0.07, vol: 0.12 },
  },
  hazard: {
    id: "anvil-bell",
    label: "Steel chime",
    fundType: "triangle",
    overType: "square",
    overMult: 2.76,
    detuneCents: 0,
    octaveShift: 0,
    attack: 0.005,
    decay: 0.28,
    peakVol: 0.068,
    sustainVol: 0.0065,
    overPeak: 0.28,
    overSustain: 0.06,
    overDecay: 0.16,
    filterHz: 2600,
    swellFilterHz: 5000,
    filterQ: 1.5,
    pop: { startMult: 1.35, endMult: 0.22, dur: 0.1, vol: 0.16 },
  },
  thermal: {
    id: "ir-sweep",
    label: "Thermal synth",
    fundType: "sawtooth",
    overType: "triangle",
    overMult: 2,
    detuneCents: 7,
    octaveShift: 0,
    attack: 0.032,
    decay: 0.4,
    peakVol: 0.064,
    sustainVol: 0.0065,
    overPeak: 0.55,
    overSustain: 0.4,
    overDecay: 0.35,
    filterHz: 1100,
    swellFilterHz: 5800,
    filterQ: 2.4,
    pop: { startMult: 1.55, endMult: 0.26, dur: 0.12, vol: 0.15 },
  },
  bioluminescent: {
    id: "glass-armonica",
    label: "Abyssal glass",
    fundType: "sine",
    overType: "sine",
    overMult: 2.5,
    detuneCents: 5,
    octaveShift: 12,
    attack: 0.028,
    decay: 0.48,
    peakVol: 0.068,
    sustainVol: 0.0075,
    overPeak: 0.26,
    overSustain: 0.14,
    overDecay: 0.42,
    filterHz: 3900,
    swellFilterHz: 7200,
    filterQ: 1.9,
    pop: { startMult: 1.4, endMult: 0.48, dur: 0.12, vol: 0.13 },
  },
  plumage: {
    id: "ocarina",
    label: "Songbird flute",
    fundType: "triangle",
    overType: "sine",
    overMult: 2,
    detuneCents: 2,
    octaveShift: 12,
    attack: 0.025,
    decay: 0.36,
    peakVol: 0.072,
    sustainVol: 0.0075,
    overPeak: 0.24,
    overSustain: 0.12,
    overDecay: 0.3,
    filterHz: 3400,
    swellFilterHz: 5600,
    filterQ: 0.9,
    pop: { startMult: 1.3, endMult: 0.52, dur: 0.09, vol: 0.13 },
  },
  highlighter: {
    id: "rave-stab",
    label: "90s rave lead",
    fundType: "sawtooth",
    overType: "square",
    overMult: 1,
    detuneCents: 12,
    octaveShift: 0,
    attack: 0.008,
    decay: 0.28,
    peakVol: 0.054,
    sustainVol: 0.0055,
    overPeak: 0.65,
    overSustain: 0.5,
    overDecay: 0.26,
    filterHz: 2400,
    swellFilterHz: 6200,
    filterQ: 2.1,
    pop: { startMult: 1.7, endMult: 0.24, dur: 0.09, vol: 0.15 },
  },
  meeple: {
    id: "xylophone",
    label: "Wood xylophone",
    fundType: "sine",
    overType: "triangle",
    overMult: 3,
    detuneCents: 0,
    octaveShift: 0,
    attack: 0.005,
    decay: 0.2,
    peakVol: 0.088,
    sustainVol: 0.006,
    overPeak: 0.34,
    overSustain: 0.04,
    overDecay: 0.1,
    filterHz: 3600,
    swellFilterHz: 5200,
    filterQ: 0.75,
    pop: { startMult: 1.25, endMult: 0.38, dur: 0.08, vol: 0.16 },
  },
  ember: {
    id: "warm-reed",
    label: "Hearth reed",
    fundType: "sawtooth",
    overType: "sine",
    overMult: 1,
    detuneCents: -3,
    octaveShift: -12,
    attack: 0.038,
    decay: 0.42,
    peakVol: 0.078,
    sustainVol: 0.008,
    overPeak: 0.5,
    overSustain: 0.35,
    overDecay: 0.38,
    filterHz: 780,
    swellFilterHz: 2400,
    filterQ: 1.4,
    pop: { startMult: 0.85, endMult: 0.28, dur: 0.13, vol: 0.16 },
  },
};

// Dynamic 1: Tonal (live from Theme color slider)
export const generateTonalPalette = ({ hue = 205, mode = "analogous" } = {}) => {
  const baseHue = ((Number(hue) % 360) + 360) % 360;
  const warmth = 0.5 + 0.5 * Math.cos(((baseHue - 35) * Math.PI) / 180);
  const filterHz = Math.round(1800 + (1 - warmth) * 2200);
  const instrument = {
    id: mode === "monochromatic" ? "tonal-pure" : "tonal-bell",
    label: mode === "monochromatic" ? "Pure sine bell" : "Harmonic bell",
    fundType: "sine",
    overType: mode === "monochromatic" ? "sine" : "triangle",
    overMult: mode === "monochromatic" ? 2 : 3,
    detuneCents: mode === "monochromatic" ? 1 : 4,
    octaveShift: 0,
    attack: 0.011,
    decay: 0.36,
    peakVol: 0.078,
    sustainVol: 0.008,
    overPeak: 0.25,
    overSustain: 0.09,
    overDecay: 0.28,
    filterHz,
    swellFilterHz: filterHz + 2200,
    filterQ: 1.0,
    pop: { startMult: 1.2, endMult: 0.35, dur: 0.1, vol: 0.14 },
  };

  if (mode === "monochromatic") {
    const steps = [
      { L: 0.91, C: 0.055, name: "Tint 1 · mist", pol: "#000000" },
      { L: 0.85, C: 0.095, name: "Tint 2 · soft", pol: "#000000" },
      { L: 0.79, C: 0.135, name: "Tint 3 · bright", pol: "#000000" },
      { L: 0.73, C: 0.165, name: "Tint 4 · vivid", pol: "#000000" },
      { L: 0.51, C: 0.165, name: "Shade 5 · core", pol: "#ffffff" },
      { L: 0.44, C: 0.145, name: "Shade 6 · rich", pol: "#ffffff" },
      { L: 0.36, C: 0.115, name: "Shade 7 · deep", pol: "#ffffff" },
      { L: 0.28, C: 0.08, name: "Shade 8 · night", pol: "#ffffff" },
    ];
    const anchorOklch = hexToOklch(hslToHex(baseHue, 90, 55));
    const colors = steps.map((st, idx) =>
      ensureContrastPolarity(
        oklchToHex(st.L, st.C, anchorOklch.h + (idx - 3.5) * 2.2),
        st.pol,
        4.7,
      ),
    );
    return {
      id: "tonal",
      label: "Tonal",
      group: "dynamic",
      isDynamic: true,
      isRamp: true,
      dynamicParams: { hue: baseHue, mode },
      notes: `Monochromatic ${baseHue}° scale: four luminous tints and four deep shades sculpted in OKLCH.`,
      colors,
      names: steps.map((s) => s.name),
      instrument,
    };
  }

  const offsets = [
    { dh: 0, L: 0.48, C: 0.175, name: "Theme core" },
    { dh: -48, L: 0.47, C: 0.165, name: "Warm flank" },
    { dh: -32, L: 0.43, C: 0.175, name: "Near warm" },
    { dh: 32, L: 0.44, C: 0.175, name: "Near cool" },
    { dh: -16, L: 0.51, C: 0.155, name: "Sunlit crest" },
    { dh: -62, L: 0.49, C: 0.155, name: "Outer ember" },
    { dh: 16, L: 0.5, C: 0.155, name: "Tidal shift" },
    { dh: 52, L: 0.42, C: 0.165, name: "Outer dusk" },
  ];
  const anchorHue = hexToOklch(hslToHex(baseHue, 90, 52)).h;
  const colors = offsets.map((o) =>
    ensureContrastPolarity(oklchToHex(o.L, o.C, anchorHue + o.dh), "#ffffff", 4.75),
  );
  return {
    id: "tonal",
    label: "Tonal",
    group: "dynamic",
    isDynamic: true,
    isRamp: false,
    dynamicParams: { hue: baseHue, mode: "analogous" },
    notes: `Analogous ±55° neighborhood centered on ${baseHue}°—keeps uniform white text at every hue angle.`,
    colors,
    names: offsets.map((o) => o.name),
    instrument,
  };
};

// Dynamic 2: Shuffle (golden-angle OKLCH roller)
const hashSeed = (seedStr) => {
  const str = String(seedStr || "7F4A2C");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (seedInt) => {
  let a = seedInt >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hueNameForAngle = (oklchHue) => {
  const h = ((oklchHue % 360) + 360) % 360;
  if (h < 22) return "Crimson";
  if (h < 48) return "Coral";
  if (h < 75) return "Tangerine";
  if (h < 105) return "Gold";
  if (h < 135) return "Citron";
  if (h < 165) return "Clover";
  if (h < 195) return "Seafoam";
  if (h < 225) return "Lagoon";
  if (h < 258) return "Azure";
  if (h < 288) return "Cobalt";
  if (h < 320) return "Iris";
  if (h < 345) return "Orchid";
  return "Rose";
};

const GOLDEN_ANGLE = 137.50776405;
const SHUFFLE_PATCHES = [
  PALETTE_INSTRUMENTS.bold,
  PALETTE_INSTRUMENTS.pastel,
  PALETTE_INSTRUMENTS.vintage,
  PALETTE_INSTRUMENTS.vaporwave,
  CANDIDATE_INSTRUMENTS.risograph,
  CANDIDATE_INSTRUMENTS.eightBit,
  CANDIDATE_INSTRUMENTS.jewel,
  CANDIDATE_INSTRUMENTS.botanical,
];

export const generateShufflePalette = ({
  seed = "A7F39C",
  style = "vivid",
} = {}) => {
  const cleanSeed = String(seed).toUpperCase().slice(0, 8) || "A7F39C";
  const rand = mulberry32(hashSeed(`${cleanSeed}:${style}`));
  const startHue = rand() * 360;
  const isLight = style === "luminous";
  const targetText = isLight ? "#000000" : "#ffffff";

  const rawSwatches = Array.from({ length: 8 }, (_, i) => {
    const jitter = (rand() - 0.5) * 9;
    const h = (startHue + i * GOLDEN_ANGLE + jitter + 360) % 360;
    const L = isLight
      ? 0.8 + (i % 3) * 0.038 + (rand() - 0.5) * 0.025
      : 0.44 + (i % 3) * 0.038 + (rand() - 0.5) * 0.025;
    const C = isLight ? 0.125 + rand() * 0.055 : 0.155 + rand() * 0.055;
    const hex = ensureContrastPolarity(oklchToHex(L, C, h), targetText, 4.75);
    return { hex, h };
  });

  const slotTargetHues = [255, 38, 350, 285, 145, 85, 195, 315];
  const remaining = [...rawSwatches];
  const ordered = slotTargetHues.map((targetH) => {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((cand, idx) => {
      const diff = Math.abs(((cand.h - targetH + 540) % 360) - 180);
      if (diff < bestDist) {
        bestDist = diff;
        bestIdx = idx;
      }
    });
    return remaining.splice(bestIdx, 1)[0];
  });

  const usedNames = new Map();
  const names = ordered.map((item) => {
    const base = hueNameForAngle(item.h);
    const count = (usedNames.get(base) || 0) + 1;
    usedNames.set(base, count);
    return count === 1 ? `${base} roll` : `${base} ${count}`;
  });

  const patch =
    SHUFFLE_PATCHES[hashSeed(`inst:${cleanSeed}:${style}`) % SHUFFLE_PATCHES.length];

  return {
    id: "shuffle",
    label: "Shuffle",
    group: "dynamic",
    isDynamic: true,
    isRamp: false,
    dynamicParams: { seed: cleanSeed, style },
    notes: `Seed #${cleanSeed} (${isLight ? "luminous dark-ink" : "vivid white-ink"} mode) spaced by the 137.5° golden angle.`,
    colors: ordered.map((x) => x.hex),
    names,
    instrument: {
      ...patch,
      id: `shuffle-${patch.id}`,
      label: `${patch.label} (rolled)`,
    },
  };
};

// Dynamic 3: Sky (24-hour atmospheric interpolation)
const SKY_KEYFRAMES = [
  {
    minutes: 0,
    phase: "Midnight",
    polarity: "#ffffff",
    colors: ["#14295c", "#3a2352", "#4f1d46", "#1f2942", "#134e4a", "#4a3b22", "#134b5f", "#2b1e54"],
    names: ["Zenith navy", "Astral plum", "Nightflare", "Starlight slate", "Aurora pine", "Moonlit brass", "Abyssal fjord", "Cosmos indigo"],
  },
  {
    minutes: 360,
    phase: "Dawn",
    polarity: "#000000",
    colors: ["#9fd4f8", "#fcbd9b", "#f9b4cf", "#c2c9f7", "#c5e3c2", "#fbe09c", "#a5e4de", "#d7bdf8"],
    names: ["First light", "Peach horizon", "Rose cloud", "Morning mist", "Dew meadow", "Early sunbeam", "Sea glass", "Lilac haze"],
  },
  {
    minutes: 570,
    phase: "Morning",
    polarity: "#000000",
    colors: ["#72cdfc", "#fba979", "#fa9ec0", "#a6bff9", "#9fe3a9", "#f9db74", "#79e6d8", "#c5a8fb"],
    names: ["Crisp sky", "Warmstone", "Camellia", "High altitude", "Sunlit leaf", "Morning gold", "Coastal breeze", "Periwinkle air"],
  },
  {
    minutes: 780,
    phase: "Midday",
    polarity: "#000000",
    colors: ["#55c6ff", "#ff9b6a", "#ff94bc", "#95b8ff", "#8be896", "#ffe45e", "#5ce8db", "#ba9cff"],
    names: ["Zenith azure", "Sunbaked canyon", "Bougainvillea", "Cloud shadow", "Canopy bright", "High noon", "Tropical shoal", "Ultraviolet sky"],
  },
  {
    minutes: 1065,
    phase: "Golden hour",
    polarity: "#ffffff",
    colors: ["#255299", "#c74b16", "#b82555", "#5c478a", "#4b6b2c", "#9e5f08", "#1c6b75", "#7d2e7d"],
    names: ["Dusk cerulean", "Sundown ember", "Afterglow rose", "Violet shadow", "Olive hillside", "Burnished amber", "Harbor reflection", "Horizon plum"],
  },
  {
    minutes: 1230,
    phase: "Twilight",
    polarity: "#ffffff",
    colors: ["#16397a", "#99341f", "#8c1c52", "#3d396b", "#1f5748", "#7a4b14", "#145a6b", "#522575"],
    names: ["Nautical dusk", "Last ember", "Twilight magenta", "Indigo horizon", "Evening spruce", "Lantern glow", "Deep sound", "Civil dusk"],
  },
];

export const formatMinutesAsTime = (minutes) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hh24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, "0");
  const period = hh24 >= 12 ? "PM" : "AM";
  const hh12 = hh24 % 12 || 12;
  return `${hh12}:${mm} ${period}`;
};

export const generateSkyPalette = ({ minutes = 780 } = {}) => {
  const mins = ((Number(minutes) % 1440) + 1440) % 1440;
  let prev = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];
  let next = SKY_KEYFRAMES[0];
  let span = 1440 - prev.minutes + next.minutes;
  let elapsed =
    mins >= prev.minutes ? mins - prev.minutes : 1440 - prev.minutes + mins;

  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (mins >= SKY_KEYFRAMES[i].minutes && mins < SKY_KEYFRAMES[i + 1].minutes) {
      prev = SKY_KEYFRAMES[i];
      next = SKY_KEYFRAMES[i + 1];
      span = next.minutes - prev.minutes;
      elapsed = mins - prev.minutes;
      break;
    }
  }

  const rawT = span > 0 ? elapsed / span : 0;
  const t = 0.5 - 0.5 * Math.cos(Math.PI * rawT);
  const nearest = t < 0.5 ? prev : next;
  const targetPolarity = nearest.polarity;

  const colors = prev.colors.map((hexA, slot) => {
    const labA = hexToOklab(hexA);
    const labB = hexToOklab(next.colors[slot]);
    const mixedLinear = oklabToLinearRgb({
      L: labA.L + (labB.L - labA.L) * t,
      a: labA.a + (labB.a - labA.a) * t,
      b: labA.b + (labB.b - labA.b) * t,
    });
    const mixedHex = rgbToHex(
      ...mixedLinear.map((v) => linearToSrgb(clamp(v, 0, 1)) * 255),
    );
    return ensureContrastPolarity(mixedHex, targetPolarity, 4.7);
  });

  const dayFactor = Math.max(0, Math.sin(((mins - 360) / 720) * Math.PI));
  const isNight = mins < 330 || mins >= 1200;
  const instrument = {
    id: `sky-${nearest.phase.toLowerCase().replace(/\s+/g, "-")}`,
    label: isNight
      ? "Nocturne pad"
      : dayFactor > 0.65
        ? "Sunlit celesta"
        : "Horizon chime",
    fundType: isNight ? "triangle" : "sine",
    overType: "sine",
    overMult: dayFactor > 0.5 ? 3 : 2,
    detuneCents: isNight ? 5 : 2,
    octaveShift: dayFactor > 0.65 ? 12 : 0,
    attack: isNight ? 0.03 : 0.012,
    decay: 0.42,
    peakVol: 0.074,
    sustainVol: 0.0075,
    overPeak: 0.24,
    overSustain: 0.1,
    overDecay: 0.34,
    filterHz: Math.round(1300 + dayFactor * 3600),
    swellFilterHz: Math.round(2800 + dayFactor * 4400),
    filterQ: 0.95,
    pop: { startMult: 1.25, endMult: 0.4, dur: 0.1, vol: 0.14 },
  };

  return {
    id: "sky",
    label: "Sky",
    group: "dynamic",
    isDynamic: true,
    isRamp: false,
    dynamicParams: {
      minutes: Math.round(mins),
      phase: nearest.phase,
      timeLabel: formatMinutesAsTime(mins),
    },
    notes: `${nearest.phase} (${formatMinutesAsTime(mins)}) — OKLab atmospheric interpolation with guaranteed ${targetPolarity === "#ffffff" ? "white" : "dark"} card ink.`,
    colors,
    names: nearest.names,
    instrument,
  };
};

// Derived directly from PALETTES + CANDIDATE_PALETTES so new shipped palettes appear automatically
export const PALETTE_ORDER = [
  ...Object.keys(PALETTES),
  ...Object.keys(CANDIDATE_PALETTES),
  "tonal",
  "shuffle",
  "sky",
];

export const resolveLabPalette = (id, dynamicState = {}) => {
  if (PALETTES[id]) {
    const shipped = PALETTES[id];
    return {
      id,
      label: shipped.label,
      group: "current",
      shipped: true,
      notes: SHIPPED_NOTES[id] || `Ships in Counters (${shipped.label}).`,
      colors: shipped.colors,
      names: shipped.names,
      instrument: PALETTE_INSTRUMENTS[id] || PALETTE_INSTRUMENTS.bold,
    };
  }
  if (id === "tonal") {
    return generateTonalPalette({
      hue: dynamicState.themeHue ?? 205,
      mode: dynamicState.tonalMode ?? "analogous",
    });
  }
  if (id === "shuffle") {
    return generateShufflePalette({
      seed: dynamicState.shuffleSeed ?? "A7F39C",
      style: dynamicState.shuffleStyle ?? "vivid",
    });
  }
  if (id === "sky") {
    return generateSkyPalette({
      minutes: dynamicState.skyMinutes ?? 780,
    });
  }
  const cand = CANDIDATE_PALETTES[id] || CANDIDATE_PALETTES.botanical;
  return {
    ...cand,
    instrument: CANDIDATE_INSTRUMENTS[cand.id] || PALETTE_INSTRUMENTS.bold,
  };
};

export const getAllLabPalettes = (dynamicState = {}) =>
  PALETTE_ORDER.map((id) => resolveLabPalette(id, dynamicState));

export const formatPaletteForCounters = (palette) => {
  const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(palette.id)
    ? palette.id
    : JSON.stringify(palette.id);
  const colorLines = palette.colors
    .map((hex, idx) => `    "${hex}", // ${palette.names[idx] || `Slot ${idx}`}`)
    .join("\n");
  const nameLines = palette.names
    .map((name) => `    ${JSON.stringify(name)},`)
    .join("\n");
  const inst = palette.instrument || PALETTE_INSTRUMENTS.bold;
  const instLines = [
    `// PALETTE_INSTRUMENTS entry in palettes.js:`,
    `${key}: {`,
    `  id: ${JSON.stringify(inst.id)},`,
    `  label: ${JSON.stringify(inst.label)},`,
    `  fundType: ${JSON.stringify(inst.fundType)},`,
    `  overType: ${JSON.stringify(inst.overType)},`,
    `  overMult: ${inst.overMult},`,
    `  detuneCents: ${inst.detuneCents},`,
    `  octaveShift: ${inst.octaveShift},`,
    `  attack: ${inst.attack},`,
    `  decay: ${inst.decay},`,
    `  peakVol: ${inst.peakVol},`,
    `  sustainVol: ${inst.sustainVol},`,
    `  overPeak: ${inst.overPeak},`,
    `  overSustain: ${inst.overSustain},`,
    `  overDecay: ${inst.overDecay},`,
    `  filterHz: ${inst.filterHz},`,
    `  swellFilterHz: ${inst.swellFilterHz},`,
    `  filterQ: ${inst.filterQ},`,
    `  pop: { startMult: ${inst.pop.startMult}, endMult: ${inst.pop.endMult}, dur: ${inst.pop.dur}, vol: ${inst.pop.vol} },`,
    `},`,
  ].join("\n");
  return `// PALETTES entry in palettes.js:\n${key}: {\n  label: ${JSON.stringify(palette.label)},\n  colors: [\n${colorLines}\n  ],\n  names: [\n${nameLines}\n  ],\n},\n\n${instLines}`;
};
