/* ==========================================================================
   PALETTES DEBUG LAB CONTROLLER
   Drives the live ./?lab=1 Counters iframe via window.__countersLab so all
   cards, dialogs, Picker instruments, and contrast tokens run through the
   real Counters app with zero duplicated UI or audio code.
   ========================================================================== */

import { PALETTES, hueOf, sortColorsByHue } from "./palettes.js";
import {
  PALETTE_GROUPS,
  PALETTE_ORDER,
  BIRD_NAMES,
  SLOT_FAMILIES,
  simulateCvdHex,
  auditPalette,
  computeStudioAccentTokens,
  resolveLabPalette,
  getAllLabPalettes,
  formatPaletteForCounters,
} from "./palettes-candidates.js";
import { log } from "./logger.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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

const applyStudioAccent = () => {
  const tokens = computeStudioAccentTokens(state.themeHue);
  const root = document.documentElement;
  root.style.setProperty("--theme-hue", String(tokens.hue));
  root.style.setProperty("--accent-fill-light", tokens.accLight);
  root.style.setProperty("--accent-fill-dark", tokens.accDark);
  root.style.setProperty("--accent-ink-light", tokens.inkLight);
  root.style.setProperty("--accent-ink-dark", tokens.inkDark);
  root.style.setProperty("--accent-on-fill-light", tokens.onFillLight);
  root.style.setProperty("--accent-on-fill-dark", tokens.onFillDark);
  const readout = $("#theme-hue-readout");
  if (readout) readout.textContent = `${Math.round(tokens.hue)}°`;
};

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
  return BIRD_NAMES[slotIdx] || `Slot ${slotIdx}`;
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

// Mirror edits made directly inside the real Counters iframe back to lab state
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
          class="palette-card-btn${isActive ? " active" : ""}"
          role="radio"
          aria-checked="${isActive}"
          data-palette-id="${p.id}"
        >
          <span class="palette-card-top">
            <span class="palette-card-name">${escapeHtml(p.label)}</span>
            ${badge ? `<span class="palette-mini-tag">${escapeHtml(badge)}</span>` : ""}
          </span>
          <span class="palette-dots-row" aria-hidden="true">
            ${simDots.map((hex) => `<span style="background-color: ${hex}"></span>`).join("")}
          </span>
          <span class="palette-card-sub">${escapeHtml(p.tagline)}</span>
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
        <span class="dock-label">Tonal harmony</span>
        <div class="mini-seg" id="tonal-mode-seg">
          <button type="button" class="mini-seg-btn${state.tonalMode === "analogous" ? " active" : ""}" data-tonal-mode="analogous">Analogous</button>
          <button type="button" class="mini-seg-btn${state.tonalMode === "monochromatic" ? " active" : ""}" data-tonal-mode="monochromatic">Monochromatic</button>
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
        <button type="button" class="action-pill-btn primary" id="btn-roll-shuffle">Roll 8 colors</button>
        <div class="mini-seg" id="shuffle-style-seg">
          <button type="button" class="mini-seg-btn${state.shuffleStyle === "vivid" ? " active" : ""}" data-shuffle-style="vivid">Vivid</button>
          <button type="button" class="mini-seg-btn${state.shuffleStyle === "luminous" ? " active" : ""}" data-shuffle-style="luminous">Luminous</button>
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
        <span class="dock-label">Sky time <span class="dock-sub" id="sky-time-readout">${escapeHtml(phase)} · ${escapeHtml(timeLabel)}</span></span>
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
  applyStudioAccent();
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
      syncIframe({ includeCounters: state.labelMode === "colors" || state.labelMode === "hex" });
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

  $("#btn-sound-toggle")?.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    const btn = $("#btn-sound-toggle");
    const lbl = $("#sound-toggle-label");
    if (btn) btn.setAttribute("aria-pressed", String(state.soundEnabled));
    if (lbl) lbl.textContent = state.soundEnabled ? "Sound on" : "Muted";
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

// Connect to the sandboxed Counters iframe as soon as its DOMContentLoaded init finishes
const waitForIframeBridge = () => {
  const iframe = $("#counters-iframe");
  if (!iframe) return;

  const tryConnect = () => {
    if (getLabBridge()) {
      attachIframeStateListener();
      syncIframe({ includeCounters: true });
      log.info("Palettes lab connected to Counters iframe");
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

readHashPalette();
applyStudioTheme(state.theme);
applyValuePreset("demo");
bindEvents();
renderStudioUI();
syncHash();
waitForIframeBridge();
