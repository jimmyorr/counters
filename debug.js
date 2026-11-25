/* ==========================================================================
   COUNTERS DEBUG CONTROLLER
   Drives the live ./?lab=1 Counters iframe via window.__countersLab and reuses
   Counters' shared palettes.js & index.css components directly.
   ========================================================================== */

import {
  PALETTES,
  COUNTER_PLACEHOLDER_LABELS,
  CVD_MATRICES,
  hueOf,
  sortColorsByHue,
  applyAccentTokens,
  simulateCvdHex,
} from "./palettes.js";
import {
  PALETTE_GROUPS,
  PALETTE_ORDER,
  SLOT_FAMILIES,
  auditPalette,
  resolveLabPalette,
  getAllLabPalettes,
  formatPaletteForCounters,
} from "./palettes-candidates.js";
import { log } from "./logger.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Pick 8 crisp bird names from Counters' shared COUNTER_PLACEHOLDER_LABELS
const DEMO_BIRDS = ["Wren", "Puffin", "Swift", "Gull", "Tern", "Lark", "Flicker", "Crane"].map(
  (name, i) =>
    COUNTER_PLACEHOLDER_LABELS.includes(name)
      ? name
      : COUNTER_PLACEHOLDER_LABELS[i],
);

const escapeHtml = (str) =>
  String(str ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );

// Populate SVG <feColorMatrix> filters dynamically from shared CVD_MATRICES
const initCvdFilterDefs = () => {
  const defs = $("#cvd-filter-defs");
  if (!defs) return;
  defs.innerHTML = Object.entries(CVD_MATRICES)
    .map(([mode, m]) => {
      const values = [
        `${m[0][0]} ${m[0][1]} ${m[0][2]} 0 0`,
        `${m[1][0]} ${m[1][1]} ${m[1][2]} 0 0`,
        `${m[2][0]} ${m[2][1]} ${m[2][2]} 0 0`,
        "0 0 0 1 0",
      ].join("  ");
      return `<filter id="cvd-${mode}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${values}" /></filter>`;
    })
    .join("");
};

const nowLocalMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

const state = {
  paletteId: "bold",
  category: "all",
  theme: "dark",
  visionMode: "normal",
  themeHue: 205,
  soundEnabled: true,

  // Dynamic parameters
  tonalMode: "analogous",
  shuffleSeed: "A7F39C",
  shuffleStyle: "vivid",
  shuffleHistory: ["A7F39C", "C0FFEE", "42B1RD"],
  skyMinutes: nowLocalMinutes(),
  skyPlaying: false,
  skyRafId: null,

  // Board controls
  boardOrder: "rainbow",
  labelMode: "birds",
  valuePreset: "demo",
  layoutMode: "grid",
  showCode: false,
  slotValues: [0, 0, 0, 0, 0, 0, 0, 1],
};

const readHashPalette = () => {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return;
  const cleaned = raw.startsWith("palette=") ? raw.slice(8) : raw;
  if (PALETTE_ORDER.includes(cleaned)) {
    state.paletteId = cleaned;
  }
};

const syncHash = () => {
  const target = `#${state.paletteId}`;
  if (window.location.hash !== target) {
    window.history.replaceState(null, "", target);
  }
};

let toastTimer = null;
const showToast = (msg) => {
  const el = $("#studio-toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2200);
};

const copyText = async (text, label) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    }
    showToast(label);
  } catch {
    showToast(label);
  }
};

const getDynamicParams = () => ({
  themeHue: state.themeHue,
  tonalMode: state.tonalMode,
  shuffleSeed: state.shuffleSeed,
  shuffleStyle: state.shuffleStyle,
  skyMinutes: state.skyMinutes,
});

const getActivePalette = () =>
  resolveLabPalette(state.paletteId, getDynamicParams());

const applyStudioTheme = (mode) => {
  state.theme = mode === "light" ? "light" : "dark";
  const isDark = state.theme === "dark";
  document.documentElement.classList.toggle("dark-mode", isDark);
  document.documentElement.classList.toggle("light-mode", !isDark);
  $$("#theme-mode-group [data-theme-mode]").forEach((btn) => {
    const active = btn.dataset.themeMode === state.theme;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
};

const syncSoundButtons = () => {
  $$("#sound-mode-group [data-sound-mode]").forEach((btn) => {
    const active = (btn.dataset.soundMode === "on") === state.soundEnabled;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
};

const getOrderedSlots = (palette) => {
  const indices = [0, 1, 2, 3, 4, 5, 6, 7];
  if (state.boardOrder === "slots" || palette.isRamp) {
    return indices;
  }
  return [...indices].sort(
    (a, b) => hueOf(palette.colors[a]) - hueOf(palette.colors[b]),
  );
};

const getCardLabel = (palette, slotIdx) => {
  if (state.labelMode === "colors") {
    return palette.names[slotIdx] || `Slot ${slotIdx}`;
  }
  if (state.labelMode === "hex") {
    return palette.colors[slotIdx].toUpperCase();
  }
  return DEMO_BIRDS[slotIdx] || `Slot ${slotIdx}`;
};

const applyValuePreset = (preset) => {
  state.valuePreset = preset;
  const palette = getActivePalette();
  const order = getOrderedSlots(palette);
  const next = [0, 0, 0, 0, 0, 0, 0, 0];
  if (preset === "demo") {
    const targetSlot = palette.isRamp ? order[order.length - 1] : 7;
    next[targetSlot] = 1;
  } else if (preset === "heat") {
    order.forEach((slot, rank) => {
      next[slot] = (rank + 1) * 5;
    });
  } else if (preset === "scores") {
    const sample = [42, 38, 31, 27, 24, 19, 15, 11];
    order.forEach((slot, rank) => {
      next[slot] = sample[rank];
    });
  }
  state.slotValues = next;
};

const buildLabCounters = (palette) =>
  getOrderedSlots(palette).map((slot) => ({
    id: `slot-${slot}`,
    label: getCardLabel(palette, slot),
    value: state.slotValues[slot],
    color: slot,
    increment: 1,
    resetValue: 0,
  }));

const getLabBridge = () => {
  const iframe = $("#counters-iframe");
  return iframe?.contentWindow?.__countersLab || null;
};

let syncingToIframe = false;

const syncIframe = ({ includeCounters = true, previewChime = false } = {}) => {
  const bridge = getLabBridge();
  if (!bridge) return;
  const palette = getActivePalette();
  syncingToIframe = true;
  try {
    bridge.sync({
      paletteKey: palette.id,
      paletteDef: {
        label: palette.label,
        colors: palette.colors,
        names: palette.names,
      },
      instrumentDef: palette.instrument,
      counters: includeCounters ? buildLabCounters(palette) : undefined,
      layout: state.layoutMode,
      theme: state.theme,
      themeHue: state.themeHue,
      soundEnabled: state.soundEnabled,
      previewChime,
    });
  } finally {
    syncingToIframe = false;
  }
};

const attachIframeStateListener = () => {
  const iframe = $("#counters-iframe");
  const win = iframe?.contentWindow;
  if (!win) return;
  win.__countersLabOnStateChange = () => {
    if (syncingToIframe) return;
    const innerState = win.__countersLab?.getState?.();
    if (!innerState) return;
    for (const c of innerState.counters || []) {
      if (typeof c.color === "number" && c.color >= 0 && c.color < 8) {
        state.slotValues[c.color] = c.value;
      }
    }
    if (innerState.settings?.theme && innerState.settings.theme !== state.theme) {
      if (innerState.settings.theme === "dark" || innerState.settings.theme === "light") {
        applyStudioTheme(innerState.settings.theme);
      }
    }
    if (
      typeof innerState.settings?.soundEnabled === "boolean" &&
      innerState.settings.soundEnabled !== state.soundEnabled
    ) {
      state.soundEnabled = innerState.settings.soundEnabled;
      syncSoundButtons();
    }
    if (
      typeof innerState.settings?.themeHue === "number" &&
      innerState.settings.themeHue !== state.themeHue
    ) {
      state.themeHue = innerState.settings.themeHue;
      const hueSlider = $("#studio-theme-hue");
      if (hueSlider) hueSlider.value = String(state.themeHue);
      renderStudioUI();
      if (state.paletteId === "tonal") {
        syncIframe({ includeCounters: false });
      }
    }
    if (
      innerState.settings?.palette &&
      PALETTE_ORDER.includes(innerState.settings.palette) &&
      innerState.settings.palette !== state.paletteId
    ) {
      state.paletteId = innerState.settings.palette;
      renderStudioUI();
      syncHash();
    }
  };
};

const renderCategoryTabs = () => {
  const wrap = $("#category-tabs");
  if (!wrap) return;
  const allPalettes = getAllLabPalettes(getDynamicParams());
  const tabs = [
    { id: "all", label: `All (${allPalettes.length})` },
    ...PALETTE_GROUPS.map((g) => ({
      id: g.id,
      label: `${g.shortLabel} (${allPalettes.filter((p) => p.group === g.id).length})`,
    })),
  ];
  wrap.innerHTML = tabs
    .map((t) => {
      const isActive = t.id === state.category;
      return `<button type="button" class="cat-tab${isActive ? " active" : ""}" role="tab" aria-selected="${isActive}" data-cat="${t.id}">${escapeHtml(t.label)}</button>`;
    })
    .join("");
};

// Reuses Counters' .palette-option-card, .palette-option-name & .palette-preview from index.css
const renderPaletteCatalog = () => {
  const grid = $("#palette-catalog-grid");
  if (!grid) return;
  const all = getAllLabPalettes(getDynamicParams());
  const visible =
    state.category === "all" ? all : all.filter((p) => p.group === state.category);

  grid.innerHTML = visible
    .map((p) => {
      const isActive = p.id === state.paletteId;
      const sorted = p.isRamp ? p.colors : sortColorsByHue(p.colors);
      const simDots = sorted.map((hex) => simulateCvdHex(hex, state.visionMode));
      const badge = p.shipped
        ? "In app"
        : p.isDynamic
          ? "Live"
          : p.isRamp
            ? "Ramp"
            : "";
      return `
        <button
          type="button"
          class="palette-option-card${isActive ? " active" : ""}"
          role="radio"
          aria-checked="${isActive}"
          data-palette-id="${p.id}"
        >
          <span class="palette-card-top">
            <span class="palette-option-name">${escapeHtml(p.label)}</span>
            ${badge ? `<span class="palette-mini-tag">${escapeHtml(badge)}</span>` : ""}
          </span>
          <span class="palette-preview" aria-hidden="true">
            ${simDots.map((hex) => `<span style="background-color: ${hex}"></span>`).join("")}
          </span>
        </button>
      `;
    })
    .join("");
};

const renderDynamicControls = (palette) => {
  const extra = $("#dynamic-extra");
  const hint = $("#theme-hue-hint");
  if (!extra) return;

  if (state.paletteId === "tonal") {
    if (hint) hint.textContent = "Actively driving all 8 Tonal slots";
    extra.hidden = false;
    extra.innerHTML = `
      <div class="dyn-row">
        <span class="setting-title">Tonal harmony</span>
        <div class="segmented-control lab-mini-seg" id="tonal-mode-seg">
          <button type="button" class="segment-btn${state.tonalMode === "analogous" ? " active" : ""}" data-tonal-mode="analogous">Analogous</button>
          <button type="button" class="segment-btn${state.tonalMode === "monochromatic" ? " active" : ""}" data-tonal-mode="monochromatic">Monochromatic</button>
        </div>
      </div>
    `;
    return;
  }

  if (hint) hint.textContent = "Drives accents & Tonal";

  if (state.paletteId === "shuffle") {
    extra.hidden = false;
    extra.innerHTML = `
      <div class="dyn-row">
        <button type="button" class="primary-btn lab-compact-btn" id="btn-roll-shuffle">Roll 8 colors</button>
        <div class="segmented-control lab-mini-seg" id="shuffle-style-seg">
          <button type="button" class="segment-btn${state.shuffleStyle === "vivid" ? " active" : ""}" data-shuffle-style="vivid">Vivid</button>
          <button type="button" class="segment-btn${state.shuffleStyle === "luminous" ? " active" : ""}" data-shuffle-style="luminous">Luminous</button>
        </div>
      </div>
      <div class="dyn-chip-row" aria-label="Recent shuffle seeds">
        ${state.shuffleHistory
          .map(
            (seed) =>
              `<button type="button" class="dyn-chip${seed === state.shuffleSeed ? " active" : ""}" data-seed="${escapeHtml(seed)}">#${escapeHtml(seed)}</button>`,
          )
          .join("")}
      </div>
    `;
    return;
  }

  if (state.paletteId === "sky") {
    const { phase, timeLabel } = palette.dynamicParams;
    extra.hidden = false;
    extra.innerHTML = `
      <div class="dyn-row">
        <span class="setting-title">Sky time <span class="dock-sub" id="sky-time-readout">${escapeHtml(phase)} · ${escapeHtml(timeLabel)}</span></span>
        <button type="button" class="dyn-chip${state.skyPlaying ? " active" : ""}" id="btn-sky-play">${state.skyPlaying ? "Pause 24h" : "Timelapse"}</button>
      </div>
      <input type="range" id="sky-time-slider" class="sky-slider" min="0" max="1439" value="${Math.round(state.skyMinutes)}" aria-label="Time of day in minutes" />
      <div class="dyn-chip-row">
        <button type="button" class="dyn-chip" data-sky-preset="360">Dawn</button>
        <button type="button" class="dyn-chip" data-sky-preset="780">Midday</button>
        <button type="button" class="dyn-chip" data-sky-preset="1065">Golden hour</button>
        <button type="button" class="dyn-chip" data-sky-preset="1230">Twilight</button>
        <button type="button" class="dyn-chip" data-sky-preset="0">Midnight</button>
        <button type="button" class="dyn-chip" data-sky-preset="now">Now</button>
      </div>
    `;
    return;
  }

  extra.hidden = true;
  extra.innerHTML = "";
};

const renderInspector = (palette, audit) => {
  $("#inspector-palette-name").textContent = palette.label;
  const groupMeta = PALETTE_GROUPS.find((g) => g.id === palette.group);
  $("#inspector-group-badge").textContent = groupMeta ? groupMeta.label : palette.group;
  $("#inspector-palette-notes").textContent = palette.notes;

  const polarityText =
    audit.polarityMode === "uniform-white"
      ? "Uniform white ✓"
      : audit.polarityMode === "uniform-black"
        ? "Uniform dark ✓"
        : "Adaptive B/W";
  $("#metric-polarity").textContent = polarityText;
  $("#metric-contrast").textContent = `${audit.minContrast.toFixed(2)}:1 AA ✓`;
  $("#metric-delta-label").textContent =
    state.visionMode === "normal"
      ? "Min OKLab ΔE"
      : `ΔE (${state.visionMode.slice(0, 6)})`;
  $("#metric-delta").textContent = String(audit.minPairwiseDeltaE);

  const inst = palette.instrument;
  if (inst) {
    const oct =
      inst.octaveShift > 0
        ? " · +1 oct"
        : inst.octaveShift < 0
          ? " · −1 oct"
          : "";
    $("#instrument-name").textContent = inst.label;
    $("#instrument-recipe").textContent = `${inst.fundType} + ${inst.overMult}× ${inst.overType} · ${inst.filterHz} Hz LP${oct}`;
  }

  const swatchGrid = $("#swatch-values-grid");
  if (swatchGrid) {
    swatchGrid.innerHTML = audit.swatches
      .map((sw) => {
        const inkTag = sw.text === "#ffffff" ? "W" : "B";
        return `
          <button
            type="button"
            class="swatch-chip-btn"
            data-swatch-slot="${sw.slot}"
            data-copy-hex="${sw.hex}"
            title="Slot ${sw.slot} (${SLOT_FAMILIES[sw.slot]}): click to copy ${sw.hex}"
          >
            <span class="swatch-color-preview" style="--sw-body: ${sw.displayHex}; --sw-text: ${sw.text};">
              <span class="swatch-preview-hdr"></span>
              <span class="swatch-preview-row">
                <span>S${sw.slot}</span>
                <span>${sw.hex.toUpperCase()}</span>
              </span>
            </span>
            <span class="swatch-meta">
              <span class="swatch-name">${escapeHtml(palette.names[sw.slot])}</span>
              <span class="swatch-contrast">${sw.minContrast.toFixed(1)}:1 ${inkTag}</span>
            </span>
          </button>
        `;
      })
      .join("");
  }

  const migStrip = $("#slot-migration-strip");
  if (migStrip) {
    const boldColors = PALETTES.bold.colors;
    migStrip.innerHTML = audit.swatches
      .map((sw, idx) => {
        const fromHex = simulateCvdHex(boldColors[idx], state.visionMode);
        return `
          <div class="migration-col" title="Slot ${idx}: Bold ${PALETTES.bold.names[idx]} → ${palette.label} ${palette.names[idx]}">
            <span class="mig-slot-id">S${idx}</span>
            <span class="mig-dot" style="background-color: ${fromHex}"></span>
            <span class="mig-arrow">↓</span>
            <span class="mig-dot" style="background-color: ${sw.displayHex}"></span>
          </div>
        `;
      })
      .join("");
  }

  const codeSnippet = $("#code-snippet");
  const codeDrawer = $("#code-drawer");
  const toggleBtn = $("#btn-toggle-code");
  if (codeSnippet && codeDrawer && toggleBtn) {
    codeSnippet.textContent = formatPaletteForCounters(palette);
    codeDrawer.hidden = !state.showCode;
    toggleBtn.textContent = state.showCode ? "Hide code" : "Show code";
  }
};

const renderStudioUI = () => {
  const palette = getActivePalette();
  const audit = auditPalette(palette.colors, state.visionMode);
  applyAccentTokens(state.themeHue);
  const readout = $("#theme-hue-readout");
  if (readout) readout.textContent = `${Math.round(state.themeHue)}°`;
  $("#counters-device")?.setAttribute("data-vision", state.visionMode);
  renderCategoryTabs();
  renderPaletteCatalog();
  renderDynamicControls(palette);
  renderInspector(palette, audit);
};

const renderAll = ({ includeCounters = true, previewChime = false } = {}) => {
  renderStudioUI();
  syncIframe({ includeCounters, previewChime });
  syncHash();
};

const stopSkyTimelapse = () => {
  state.skyPlaying = false;
  if (state.skyRafId !== null) {
    cancelAnimationFrame(state.skyRafId);
    state.skyRafId = null;
  }
};

const startSkyTimelapse = () => {
  stopSkyTimelapse();
  state.skyPlaying = true;
  let lastTs = null;
  const step = (ts) => {
    if (!state.skyPlaying || state.paletteId !== "sky") {
      stopSkyTimelapse();
      return;
    }
    if (lastTs !== null) {
      const dt = ts - lastTs;
      state.skyMinutes = (state.skyMinutes + dt * 0.12) % 1440;
      const slider = $("#sky-time-slider");
      if (slider) slider.value = String(Math.round(state.skyMinutes));
      const palette = getActivePalette();
      const audit = auditPalette(palette.colors, state.visionMode);
      const readout = $("#sky-time-readout");
      if (readout) {
        readout.textContent = `${palette.dynamicParams.phase} · ${palette.dynamicParams.timeLabel}`;
      }
      renderPaletteCatalog();
      renderInspector(palette, audit);
      syncIframe({ includeCounters: state.labelMode !== "birds" });
    }
    lastTs = ts;
    state.skyRafId = requestAnimationFrame(step);
  };
  state.skyRafId = requestAnimationFrame(step);
};

const rollNewShuffleSeed = () => {
  const alphabet = "0123456789ABCDEF";
  let seed = "";
  for (let i = 0; i < 6; i++) {
    seed += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  state.shuffleSeed = seed;
  state.shuffleHistory = [
    seed,
    ...state.shuffleHistory.filter((s) => s !== seed),
  ].slice(0, 5);
};

const selectPalette = (id, { previewChime = true } = {}) => {
  if (!PALETTE_ORDER.includes(id)) return;
  const reClickingShuffle = id === "shuffle" && state.paletteId === "shuffle";
  if (id !== "sky") stopSkyTimelapse();
  state.paletteId = id;
  if (reClickingShuffle) rollNewShuffleSeed();
  renderAll({ includeCounters: true, previewChime });
};

const stepPalette = (delta) => {
  const idx = PALETTE_ORDER.indexOf(state.paletteId);
  const nextIdx = (idx + delta + PALETTE_ORDER.length) % PALETTE_ORDER.length;
  selectPalette(PALETTE_ORDER[nextIdx]);
};

const bindEvents = () => {
  $("#category-tabs")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    state.category = btn.dataset.cat;
    renderStudioUI();
  });

  const catalog = $("#palette-catalog-grid");
  catalog?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-palette-id]");
    if (!btn) return;
    selectPalette(btn.dataset.paletteId);
  });

  catalog?.addEventListener("keydown", (e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    e.preventDefault();
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    stepPalette(delta);
    catalog.querySelector(`[data-palette-id="${state.paletteId}"]`)?.focus();
  });

  $("#btn-prev-palette")?.addEventListener("click", () => stepPalette(-1));
  $("#btn-next-palette")?.addEventListener("click", () => stepPalette(1));

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.key === "[") {
      e.preventDefault();
      stepPalette(-1);
    } else if (e.key === "]") {
      e.preventDefault();
      stepPalette(1);
    } else if ((e.key === "r" || e.key === "R") && state.paletteId === "shuffle") {
      e.preventDefault();
      rollNewShuffleSeed();
      renderAll({ includeCounters: true, previewChime: true });
    }
  });

  $("#vision-mode-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vision]");
    if (!btn) return;
    state.visionMode = btn.dataset.vision;
    $$("#vision-mode-group [data-vision]").forEach((b) => {
      const active = b.dataset.vision === state.visionMode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderStudioUI();
  });

  $("#theme-mode-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-mode]");
    if (!btn) return;
    applyStudioTheme(btn.dataset.themeMode);
    renderAll({ includeCounters: false });
  });

  $("#sound-mode-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sound-mode]");
    if (!btn) return;
    const nextEnabled = btn.dataset.soundMode === "on";
    if (nextEnabled === state.soundEnabled) return;
    state.soundEnabled = nextEnabled;
    syncSoundButtons();
    syncIframe({ includeCounters: false, previewChime: state.soundEnabled });
  });

  $("#btn-audition-chime")?.addEventListener("click", () => {
    getLabBridge()?.audition("chime");
  });

  $("#btn-audition-chord")?.addEventListener("click", () => {
    getLabBridge()?.audition("chord");
  });

  $("#btn-audition-pop")?.addEventListener("click", () => {
    getLabBridge()?.audition("pop");
  });

  $("#btn-demo-picker")?.addEventListener("click", () => {
    getLabBridge()?.simulatePicker(5);
  });

  $("#btn-copy-code")?.addEventListener("click", () => {
    const palette = getActivePalette();
    copyText(
      formatPaletteForCounters(palette),
      `Copied ${palette.label} snippet for palettes.js`,
    );
  });

  $("#btn-toggle-code")?.addEventListener("click", () => {
    state.showCode = !state.showCode;
    renderStudioUI();
  });

  $("#studio-theme-hue")?.addEventListener("input", (e) => {
    state.themeHue = Number(e.target.value);
    renderAll({ includeCounters: state.paletteId === "tonal" && state.labelMode !== "birds" });
  });

  const dynExtra = $("#dynamic-extra");
  dynExtra?.addEventListener("click", (e) => {
    const tonalBtn = e.target.closest("[data-tonal-mode]");
    if (tonalBtn) {
      state.tonalMode = tonalBtn.dataset.tonalMode;
      renderAll({ includeCounters: true, previewChime: true });
      return;
    }
    const styleBtn = e.target.closest("[data-shuffle-style]");
    if (styleBtn) {
      state.shuffleStyle = styleBtn.dataset.shuffleStyle;
      renderAll({ includeCounters: true, previewChime: true });
      return;
    }
    if (e.target.closest("#btn-roll-shuffle")) {
      rollNewShuffleSeed();
      renderAll({ includeCounters: true, previewChime: true });
      return;
    }
    const seedChip = e.target.closest("[data-seed]");
    if (seedChip) {
      state.shuffleSeed = seedChip.dataset.seed;
      renderAll({ includeCounters: true, previewChime: true });
      return;
    }
    if (e.target.closest("#btn-sky-play")) {
      if (state.skyPlaying) {
        stopSkyTimelapse();
        renderDynamicControls(getActivePalette());
      } else {
        startSkyTimelapse();
        renderDynamicControls(getActivePalette());
      }
      return;
    }
    const skyPreset = e.target.closest("[data-sky-preset]");
    if (skyPreset) {
      stopSkyTimelapse();
      const raw = skyPreset.dataset.skyPreset;
      state.skyMinutes = raw === "now" ? nowLocalMinutes() : Number(raw);
      renderAll({ includeCounters: true, previewChime: true });
    }
  });

  dynExtra?.addEventListener("input", (e) => {
    if (e.target.id === "sky-time-slider") {
      stopSkyTimelapse();
      state.skyMinutes = Number(e.target.value);
      const palette = getActivePalette();
      const audit = auditPalette(palette.colors, state.visionMode);
      const readout = $("#sky-time-readout");
      if (readout) {
        readout.textContent = `${palette.dynamicParams.phase} · ${palette.dynamicParams.timeLabel}`;
      }
      renderPaletteCatalog();
      renderInspector(palette, audit);
      syncIframe({ includeCounters: state.labelMode !== "birds" });
    }
  });

  $("#board-order-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-order]");
    if (!btn) return;
    state.boardOrder = btn.dataset.order;
    $$("#board-order-group [data-order]").forEach((b) => {
      const active = b.dataset.order === state.boardOrder;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderAll({ includeCounters: true });
  });

  $("#board-label-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-label-mode]");
    if (!btn) return;
    state.labelMode = btn.dataset.labelMode;
    $$("#board-label-group [data-label-mode]").forEach((b) => {
      const active = b.dataset.labelMode === state.labelMode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderAll({ includeCounters: true });
  });

  $("#board-preset-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preset]");
    if (!btn) return;
    applyValuePreset(btn.dataset.preset);
    $$("#board-preset-group [data-preset]").forEach((b) => {
      const active = b.dataset.preset === state.valuePreset;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderAll({ includeCounters: true });
  });

  $("#board-layout-group")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-layout-mode]");
    if (!btn) return;
    state.layoutMode = btn.dataset.layoutMode;
    $$("#board-layout-group [data-layout-mode]").forEach((b) => {
      const active = b.dataset.layoutMode === state.layoutMode;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderAll({ includeCounters: false });
  });

  $("#swatch-values-grid")?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-swatch-slot]");
    if (!chip) return;
    const slot = Number(chip.dataset.swatchSlot);
    const hex = chip.dataset.copyHex;
    const palette = getActivePalette();
    copyText(hex, `Copied ${palette.names[slot]} (${hex.toUpperCase()})`);
  });

  window.addEventListener("hashchange", () => {
    readHashPalette();
    renderAll({ includeCounters: true });
  });
};

const waitForIframeBridge = () => {
  const iframe = $("#counters-iframe");
  if (!iframe) return;

  const tryConnect = () => {
    if (getLabBridge()) {
      attachIframeStateListener();
      syncIframe({ includeCounters: true });
      log.info("Debug connected to Counters iframe");
      return true;
    }
    return false;
  };

  if (tryConnect()) return;
  const poll = setInterval(() => {
    if (tryConnect()) clearInterval(poll);
  }, 25);
  iframe.addEventListener("load", () => {
    if (tryConnect()) clearInterval(poll);
  });
};

initCvdFilterDefs();
readHashPalette();
applyStudioTheme(state.theme);
applyValuePreset("demo");
bindEvents();
renderStudioUI();
syncHash();
waitForIframeBridge();
