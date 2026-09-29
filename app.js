/* ==========================================================================
   COUNTERS MODERN JAVASCRIPT CONTROLLER
   Vanilla ES6+ implementation with dynamic state management, local storage,
   Web Audio synthesizer, and custom mathematical overlays.
   ========================================================================== */

import { Preferences } from "@capacitor/preferences";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { registerSW } from "virtual:pwa-register";
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import confetti from "canvas-confetti";
import { FirebaseAnalytics } from "@capacitor-firebase/analytics";
import { log } from "./logger.js";

(function () {
  "use strict";

  // Google Analytics Sidecar (Web only)
  if (!Capacitor.isNativePlatform()) {
    const gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=G-K0MFHHQ1RM";
    document.head.appendChild(gtagScript);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", "G-K0MFHHQ1RM");
  } else {
    // Native App via Capacitor
    FirebaseAnalytics.setEnabled({ enabled: true }).catch((err) => {
      console.error("Failed to enable Firebase Analytics:", err);
    });
  }

  // Whether the user asked the OS to minimize non-essential motion
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Central helper to track when dialogs are opened.
  // This is used to prevent synthetic 'click' events from instantly closing them.
  const openDialog = (dialog) => {
    dialog.dataset.openedAt = Date.now().toString();
    dialog.showModal();
  };

  // ------------------------------------------------------------------------
  // 1. Core Reactive State System
  // ------------------------------------------------------------------------
  const state = {
    counters: [],
    settings: {
      layout: "list",
      topBarContent: "highest",
      autoSort: false,
      soundEnabled: true,
      hapticsEnabled: true,
      quickAddValues: [5, 10, 15, 20, 50, 100],
      themeHue: 205,
      keepAwake: false,
      palette: "bold",
    },
    history: [],
    currentTab: "counters",

    // Active actions/focus states
    activeCounterIdForCalc: null,
    activeCounterIdForEdit: null,
    calcPendingOperation: "plus", // 'plus' or 'minus'
    calcOpenedByKeyboard: false,
    autoSortTimeout: null,
  };

  // Pre-configured counter palette color swatches
  // Preset counter palettes. Counters store a slot index (0-7), so switching
  // palettes recolors existing counters. Every color in a palette must take the
  // same text color at 4.5:1 so cards never mix black and white text (enforced
  // in tests/e2e/accessibility.spec.js).
  const palettes = {
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
    },
  };

  // Slots keep a counter's color family across palettes (slot 0 is bluish in
  // every palette, and so on), so slot order isn't rainbow order. Pickers show
  // swatches sorted by hue instead, with near-greys last.
  const getSwatchesInDisplayOrder = () => {
    const hueOf = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 0.08) return 999; // near-grey: sort last
      const d = max - min;
      const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    return [...getSwatches()].sort((a, b) => hueOf(a.hex) - hueOf(b.hex));
  };

  // Swatches ({ id, class, hex }) for the active palette
  const getSwatches = () =>
    (palettes[state.settings.palette] || palettes.bold).colors.map(
      (hex, id) => ({ id, class: `card-color-${id}`, hex }),
    );

  // Apply "light", "dark", or "system" theme classes to the root element
  const applyTheme = (theme) => {
    const isDark =
      theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.documentElement.classList.toggle("light-mode", !isDark);
  };

  // ------------------------------------------------------------------------
  // 2. Local Storage Synchronizer
  // ------------------------------------------------------------------------
  const loadStateFromStorage = async () => {
    try {
      const savedCounters = (await Preferences.get({ key: "counters-list" }))
        .value;
      const savedSettings = (
        await Preferences.get({ key: "counters-settings" })
      ).value;
      const savedHistory = (await Preferences.get({ key: "counters-history" }))
        .value;

      if (savedCounters) {
        state.counters = JSON.parse(savedCounters).map((counter) => ({
          ...counter,
          label: counter.label || "",
        }));
      } else {
        state.counters = [];
        saveCounters();
      }

      if (savedSettings) {
        state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
      }
      // Theme used to live only in localStorage; adopt it once, then Preferences is the source of truth
      if (!state.settings.theme) {
        state.settings.theme =
          localStorage.getItem("counters-theme") || "system";
        saveSettings();
      }
      applyTheme(state.settings.theme);
      localStorage.setItem("counters-theme", state.settings.theme);
      document.documentElement.style.setProperty(
        "--theme-hue",
        state.settings.themeHue,
      );

      if (state.settings.keepAwake) {
        KeepAwake.keepAwake().catch((err) =>
          console.warn("KeepAwake failed:", err),
        );
      }

      if (savedHistory) {
        state.history = JSON.parse(savedHistory).map((log) => ({
          ...log,
          counterLabel: log.counterLabel || "",
        }));
      } else {
        state.history = [];
      }
    } catch (e) {
      console.error("Failed to load local storage state", e);
    }
  };

  const saveCounters = () => {
    Preferences.set({
      key: "counters-list",
      // isNew is a transient render flag; persisting it replays the entry animation on next launch
      value: JSON.stringify(state.counters, (key, val) =>
        key === "isNew" ? undefined : val,
      ),
    });
  };

  const saveSettings = () => {
    Preferences.set({
      key: "counters-settings",
      value: JSON.stringify(state.settings),
    });
    // Mirrors read synchronously by the pre-load script in index.html to avoid a flash
    localStorage.setItem("counters-layout", state.settings.layout);
    localStorage.setItem("counters-theme", state.settings.theme);
  };

  const saveHistory = () => {
    Preferences.set({
      key: "counters-history",
      value: JSON.stringify(state.history),
    });
  };

  // Helper: Format large numbers with commas
  const formatNumber = (num) => {
    return Number(num).toLocaleString("en-US");
  };

  // Helper: Escape HTML special chars before interpolating user text into HTML
  const escapeHtml = (str) =>
    String(str ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // Helper: DOM Element Selectors
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

  // Helper: Get App Theme Hex Color
  const getThemeHex = () => {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.fillStyle = `hsl(${state.settings.themeHue || 205}, 94%, 60%)`;
    return ctx.fillStyle;
  };

  // Helper: Get Counter Hex Color
  // Colors are either a preset swatch index or a custom "#rrggbb" string
  const isCustomColor = (color) =>
    typeof color === "string" && color.startsWith("#");

  const getCounterHex = (counter) => {
    if (isCustomColor(counter.color)) {
      return counter.color;
    }
    const swatches = getSwatches();
    const presetSwatch = swatches[counter.color] || swatches[0];
    return presetSwatch.hex;
  };

  // Helpers: WCAG relative luminance and contrast ratio for #rrggbb colors
  const relativeLuminance = (hex) => {
    const channel = (i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const contrastRatio = (a, b) => {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  // Helper: Mix a #rrggbb color toward another by t (0-1)
  const mixHex = (hex, toward, t) =>
    "#" +
    [1, 3, 5]
      .map((i) => {
        const from = parseInt(hex.slice(i, i + 2), 16);
        const to = parseInt(toward.slice(i, i + 2), 16);
        return Math.round(from + (to - from) * t).toString(16).padStart(2, "0");
      })
      .join("");

  // Helper: Black or white text, whichever contrasts more with a #rrggbb background
  const getReadableTextColor = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
    const whiteContrast = contrastRatio(hex, "#ffffff");
    // Prefer white whenever it passes WCAG AA (4.5:1). White only gains contrast
    // under the card header's dark overlay, while black loses it, so a color
    // where black barely wins on the body could still fail in the header.
    if (whiteContrast >= 4.5) return "#ffffff";
    // Otherwise (light custom colors) use pure black, which beats near-black.
    return whiteContrast >= contrastRatio(hex, "#000000") ? "#ffffff" : "#000000";
  };

  // Helper: The counter color as text on a light surface tinted 10% with it
  // (e.g. the calculator's title pill). Starts at the usual 85% shade and
  // darkens only as far as needed for 4.5:1, so pale colors stay readable.
  const getInkOnLightTint = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#000000";
    const surface = mixHex("#ffffff", hex, 0.1);
    for (let t = 0.15; t < 1; t += 0.05) {
      const ink = mixHex(hex, "#000000", t);
      if (contrastRatio(ink, surface) >= 4.5) return ink;
    }
    return "#000000";
  };

  // Helper: Theme a bottom sheet with a counter color and readable text on it
  const setSheetTheme = (dialog, hex) => {
    dialog.style.setProperty("--sheet-theme", hex);
    dialog.style.setProperty("--sheet-text", getReadableTextColor(hex));
    dialog.style.setProperty("--sheet-ink-light", getInkOnLightTint(hex));
  };

  // ------------------------------------------------------------------------
  // 3. Web Audio Tonal Synthesizer
  // ------------------------------------------------------------------------
  let audioCtx = null;

  const getAudioContext = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (common browser security constraint)
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  };

  // Subtle clicks/beeps to ensure highly satisfying user interface
  const playClickSound = (
    freqStart = 550,
    freqEnd = 200,
    duration = 0.06,
    vol = 0.05,
  ) => {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        freqEnd,
        ctx.currentTime + duration,
      );

      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context failed to play", e);
    }
  };

  // Play a soft high-pitched success double chime
  const playSuccessSound = () => {
    if (!state.settings.soundEnabled) return;
    playClickSound(580, 580, 0.04, 0.04);
    setTimeout(() => {
      playClickSound(880, 880, 0.07, 0.04);
    }, 50);
  };

  // Play a descending slide for deletion or reset
  const playResetSound = () => {
    if (!state.settings.soundEnabled) return;
    playClickSound(300, 100, 0.18, 0.06);
  };

  // Play a low-frequency double thud for denied/blocked actions
  const playDeniedSound = () => {
    if (!state.settings.soundEnabled) return;
    playClickSound(240, 140, 0.06, 0.06);
    setTimeout(() => {
      playClickSound(190, 110, 0.07, 0.06);
    }, 80);
  };
  // Timer countdown beep (3, 2, 1)
  const playTimerBeep = () => {
    if (!state.settings.soundEnabled) return;
    playClickSound(800, 800, 0.06, 0.06);
  };

  // Timer finish: a deep "boop-boop" to follow the "beeps"
  const playTimerFinish = () => {
    if (!state.settings.soundEnabled) return;
    playClickSound(400, 400, 0.15, 0.06);
    setTimeout(() => {
      if (!state.settings.soundEnabled) return;
      playClickSound(400, 400, 0.15, 0.06);
    }, 200);
  };

  const playHaptic = async (style = ImpactStyle.Light) => {
    if (!state.settings.hapticsEnabled || !Capacitor.isNativePlatform()) return;
    try {
      if (Object.values(NotificationType).includes(style)) {
        await Haptics.notification({ type: style });
      } else {
        await Haptics.impact({ style });
      }
    } catch (err) {
      console.warn("Haptics failed", err);
    }
  };

  // Play a randomized rumbling white noise block for rolling dice
  const playDiceSound = () => {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      const bufferSize = ctx.sampleRate * 0.15; // 150ms buffer
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Populate buffer with randomized white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = buffer;

      // Filter the white noise to sound like heavy rolling dice clicking together
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(450, ctx.currentTime);
      filter.Q.setValueAtTime(3.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseSource.start();
    } catch (e) {
      console.warn("Failed to generate noise source", e);
    }
  };

  // ------------------------------------------------------------------------
  // 5. Toast Notification System
  // ------------------------------------------------------------------------
  let toastTimeout = null;

  // Announce a counter's new value to screen readers via the polite live region.
  // Clear first so repeating the same text is still announced.
  const announceValue = (counter) => {
    const announcer = $("#sr-announcer");
    if (!announcer) return;
    announcer.textContent = "";
    requestAnimationFrame(() => {
      announcer.textContent = `${counter.label}: ${formatNumber(counter.value)}`;
    });
  };

  let toastDuration = 2500;

  const hideToast = () => {
    $("#toast-wrapper")?.classList.add("hidden");
    const toastAction = $("#toast-action");
    if (toastAction) toastAction.hidden = true;
  };

  const scheduleToastHide = () => {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(hideToast, toastDuration);
  };

  const showToast = (message, options = {}) => {
    const toast = $("#toast-wrapper");
    const toastText = $("#toast-text");
    const toastAction = $("#toast-action");

    if (!toast || !toastText) return;

    toastText.textContent = message;

    const { actionLabel, onAction, duration = 2500 } = options;
    if (toastAction) {
      if (actionLabel && typeof onAction === "function") {
        toastAction.textContent = actionLabel;
        toastAction.hidden = false;
        toastAction.onclick = () => {
          if (toastTimeout) clearTimeout(toastTimeout);
          hideToast();
          onAction();
        };
      } else {
        toastAction.hidden = true;
        toastAction.onclick = null;
      }
    }

    toast.classList.remove("hidden");
    toastDuration = duration;
    scheduleToastHide();
  };

  // Keep an actionable toast (e.g. Undo) up while it's hovered or focused, so
  // keyboard and screen reader users have time to reach it
  const setupToast = () => {
    const toastAction = $("#toast-action");
    if (!toastAction) return;
    const pause = () => {
      if (toastTimeout) clearTimeout(toastTimeout);
    };
    toastAction.addEventListener("pointerenter", pause);
    toastAction.addEventListener("focusin", pause);
    toastAction.addEventListener("pointerleave", scheduleToastHide);
    toastAction.addEventListener("focusout", scheduleToastHide);
  };

  // ------------------------------------------------------------------------
  // 6. Confirm Dialog System
  // ------------------------------------------------------------------------
  let confirmCallback = null;

  const showConfirmDialog = (message, onConfirm) => {
    const dialog = $("#confirm-dialog");
    const msgEl = $("#confirm-dialog-message");
    if (!dialog || !msgEl) return;

    msgEl.textContent = message;
    confirmCallback = onConfirm;
    openDialog(dialog);
  };

  const setupConfirmDialog = () => {
    const dialog = $("#confirm-dialog");
    if (!dialog) return;

    $("#confirm-btn-ok")?.addEventListener("click", () => {
      if (confirmCallback) confirmCallback();
      dialog.close();
    });

    $("#confirm-btn-cancel")?.addEventListener("click", () => {
      dialog.close();
    });
  };

  // ------------------------------------------------------------------------
  // 7. Dynamic View Renderers (Counters List, Leader Top Bar)
  // ------------------------------------------------------------------------

  // Re-calculate the leader bar metrics (Highest, Lowest, or Total value)
  const renderLeaderBar = () => {
    const leaderContainer = $("#header-leader-container");
    const leaderText = $("#header-leader-text");

    if (!leaderContainer || !leaderText) return;
    if (state.counters.length === 0) {
      leaderContainer.style.opacity = "0";
      leaderContainer.style.pointerEvents = "none";
      leaderText.textContent = "";
      return;
    }

    leaderContainer.style.opacity = "1";
    leaderContainer.style.pointerEvents = "auto";

    const type = state.settings.topBarContent;
    const icon = leaderContainer.querySelector(".leader-icon svg");

    if (type === "total") {
      const totalValue = state.counters.reduce(
        (sum, item) => sum + item.value,
        0,
      );
      leaderContainer.style.removeProperty("--leader-color");
      leaderContainer.style.removeProperty("--leader-bg");
      leaderContainer.style.removeProperty("--leader-border");
      icon.innerHTML = `<path d="M19 18v2H5v-2l6-6-6-6V4h14v2h-9.35L14 12l-4.35 6H19z"/>`;
      leaderText.textContent = `Total: ${formatNumber(totalValue)}`;
      return;
    }

    // Highest or lowest value. Sort is stable, so ties go to the counter shown first.
    const isLowest = type === "lowest";
    const leader = [...state.counters].sort((a, b) =>
      isLowest ? a.value - b.value : b.value - a.value,
    )[0];
    const themeHex = getCounterHex(leader);
    leaderContainer.style.setProperty("--leader-color", themeHex);
    leaderContainer.style.setProperty("--leader-bg", `${themeHex}15`);
    leaderContainer.style.setProperty("--leader-border", `${themeHex}40`);
    icon.innerHTML = isLowest
      ? `<path d="M11 16.172V4h2v12.172l5.364-5.364 1.414 1.414L12 20l-7.778-7.778 1.414-1.414L11 16.172z"/>`
      : `<path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>`;
    leaderText.textContent = leader.label;
  };

  // Compile individual counter card templates into the wrapper list
  const renderCountersList = () => {
    const listWrapper = $("#counters-list-wrapper");
    const emptyState = $("#empty-state-view");

    if (!listWrapper || !emptyState) return;

    if (state.counters.length === 0) {
      listWrapper.innerHTML = "";
      listWrapper.style.display = "none";
      emptyState.classList.remove("hidden");
      renderLeaderBar();
      const tabCounters = $("#tab-counters");
      if (tabCounters) tabCounters.scrollTop = 0;
      return;
    }

    listWrapper.style.display = "";
    emptyState.classList.add("hidden");

    // Reflect drag-enabled state on the wrapper for CSS cursor targeting
    listWrapper.setAttribute(
      "data-drag-enabled",
      state.settings.autoSort ? "false" : "true",
    );

    // 1. Capture current focus before rendering
    let focusedCounterId = null;
    let focusedSelector = null;
    if (document.activeElement) {
      const card = document.activeElement.closest(".counter-card");
      if (card) {
        focusedCounterId = card.getAttribute("data-counter-id");
        if (document.activeElement.classList.contains("card-direct-zone-minus"))
          focusedSelector = ".card-direct-zone-minus";
        else if (document.activeElement.classList.contains("card-value-body"))
          focusedSelector = ".card-value-body";
        else if (
          document.activeElement.classList.contains("card-direct-zone-plus")
        )
          focusedSelector = ".card-direct-zone-plus";
        else if (document.activeElement.classList.contains("card-header"))
          focusedSelector = ".card-header";
      }
    }

    // Inject rendered HTML for each array item
    listWrapper.innerHTML = state.counters
      .map((counter) => {
        const cardThemeHex = getCounterHex(counter);
        const swatchClass = isCustomColor(counter.color)
          ? ""
          : `card-color-${getSwatches()[counter.color] ? counter.color : 0}`;
        const isNewClass = counter.isNew ? " animate-entry" : "";
        delete counter.isNew;
        // Name the counter in every control so screen readers can tell cards apart
        const name = escapeHtml(counter.label);
        const step = formatNumber(counter.increment || 1);
        return `
        <div class="counter-card ${swatchClass}${isNewClass}" data-counter-id="${
          counter.id
        }" style="--card-theme: ${cardThemeHex}; --card-text: ${getReadableTextColor(cardThemeHex)}; view-transition-name: counter-${counter.id};">
          <!-- Card Top Info Bar -->
          <div class="card-header" role="button" tabindex="0" aria-label="Edit ${name}">
            <span class="counter-label">${name}</span>
          </div>
          
          <div class="card-body-wrapper">
            <!-- Card Direct Click decrement zone -->
            <div class="card-direct-zone card-direct-zone-minus" aria-label="Subtract ${step} from ${name}" tabindex="0" role="button">−</div>
            
            <!-- Middle Display -->
            <div class="card-value-body" tabindex="0" role="button" aria-label="${name}: ${formatNumber(counter.value)}. Open calculator">
              <span class="value-display">${formatNumber(counter.value)}</span>
            </div>
            
            <!-- Card Direct Click increment zone -->
            <div class="card-direct-zone card-direct-zone-plus" aria-label="Add ${step} to ${name}" tabindex="0" role="button">+</div>
          </div>
        </div>
      `;
      })
      .join("");

    renderLeaderBar();

    // 2. Restore focus
    if (focusedCounterId && focusedSelector) {
      const newCard = document.querySelector(
        `.counter-card[data-counter-id="${focusedCounterId}"]`,
      );
      if (newCard) {
        const elToFocus = newCard.querySelector(focusedSelector);
        if (elToFocus) elToFocus.focus();
      }
    }
  };

  // ------------------------------------------------------------------------
  // 8. Auto Sorting With Debounce Delay
  // ------------------------------------------------------------------------
  const performAutoSortNow = () => {
    if (!state.settings.autoSort) return;
    if (state.settings.topBarContent === "lowest") {
      state.counters.sort((a, b) => a.value - b.value);
    } else {
      state.counters.sort((a, b) => b.value - a.value);
    }
    saveCounters();
    
    // View Transitions struggle with <dialog> backdrops and Top Layer z-indexes. 
    // If a menu is open, just do an instant re-render to avoid visual glitches.
    if (document.startViewTransition && !document.querySelector("dialog[open]")) {
      document.startViewTransition(() => renderCountersList());
    } else {
      renderCountersList();
    }
  };

  const triggerAutoSortWithDebounce = () => {
    if (!state.settings.autoSort) return;

    if (state.autoSortTimeout) {
      clearTimeout(state.autoSortTimeout);
    }

    state.autoSortTimeout = setTimeout(() => {
      performAutoSortNow();
    }, 3000); // 3 seconds delay so cards do not jump while being actively tapped!
  };

  // ------------------------------------------------------------------------
  // 8b. Card Drag-and-Drop Reorder (active only when auto-sort is disabled)
  // ------------------------------------------------------------------------
  let headerHoldSuppressedClick = false;

  const setupCardDragDrop = () => {
    const listWrapper = $("#counters-list-wrapper");
    if (!listWrapper) return;

    let dragState = null; // Tracks active drag session
    let pendingDrag = null; // Tracks pending hold before drag activates
    let pendingDragTimer = null;
    let headerHoldTimer = null;
    let headerHoldActive = false;
    let headerHoldPointerId = null;
    let headerHoldStartX = 0;
    let headerHoldStartY = 0;
    let suppressUntilRelease = false;

    // Cancel holds that haven't turned into an auto-sort warning or a drag yet
    const cancelHeaderHold = () => {
      headerHoldActive = false;
      if (headerHoldTimer) {
        clearTimeout(headerHoldTimer);
        headerHoldTimer = null;
      }
    };
    const cancelPendingDrag = () => {
      if (pendingDragTimer) {
        clearTimeout(pendingDragTimer);
        pendingDragTimer = null;
      }
      pendingDrag = null;
    };
    const cancelHoldsFor = (pointerId) => {
      if (headerHoldActive && pointerId === headerHoldPointerId) {
        cancelHeaderHold();
      }
      if (pendingDrag && pointerId === pendingDrag.pointerId) {
        cancelPendingDrag();
      }
    };

    const getCardEls = () => [
      ...listWrapper.querySelectorAll(
        ".counter-card:not(.drag-placeholder):not(.dragging)",
      ),
    ];

    // Creates a pixel-perfect clone of the dragged card to float under pointer
    const createGhost = (sourceCard, offsetX, offsetY) => {
      const rect = sourceCard.getBoundingClientRect();
      const ghost = sourceCard.cloneNode(true);
      ghost.classList.add("drag-ghost");
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) rotate(1.5deg) scale(1.03)`;
      document.body.appendChild(ghost);
      return { ghost, offsetX, offsetY };
    };
    // Moves the ghost to follow the pointer
    const moveGhost = (ghost, clientX, clientY, offsetX, offsetY) => {
      const x = clientX - offsetX;
      const y = clientY - offsetY;
      ghost.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(1.5deg) scale(1.03)`;
    };

    // Infers which slot (before which card) the pointer is hovering over
    const getDropTarget = (clientX, clientY) => {
      const cards = getCardEls();
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        
        if (state.settings.layout === "grid") {
          // If pointer is above this card's row, insert before it
          if (clientY < rect.top) return card;
          
          // If pointer is within this card's row vertically, check horizontal midpoint
          if (clientY <= rect.bottom) {
            const midX = rect.left + rect.width / 2;
            if (clientX < midX) return card;
          }
        } else {
          // List mode: 1D vertical check
          const midY = rect.top + rect.height / 2;
          if (clientY < midY) return card;
        }
      }
      return null; // Insert at end
    };

    // Inserts or moves the placeholder to show the drop position
    const movePlaceholder = (placeholder, beforeCard) => {
      if (beforeCard) {
        listWrapper.insertBefore(placeholder, beforeCard);
      } else {
        listWrapper.appendChild(placeholder);
      }
    };

    listWrapper.addEventListener("pointerdown", (e) => {
      const header = e.target.closest(".card-header");
      if (!header) return;
      // Skip if tapping a button inside the header
      if (e.target.closest("button")) return;

      if (state.settings.autoSort) {
        headerHoldActive = true;
        headerHoldPointerId = e.pointerId;
        headerHoldStartX = e.clientX;
        headerHoldStartY = e.clientY;
        if (headerHoldTimer) clearTimeout(headerHoldTimer);
        headerHoldTimer = setTimeout(() => {
          if (!headerHoldActive) return;
          headerHoldActive = false;
          // Swallow the click that the eventual release generates, however long
          // the press lasts (cleared shortly after release below)
          headerHoldSuppressedClick = true;
          suppressUntilRelease = true;

          const card = header.closest(".counter-card");
          if (card) {
            card.classList.remove("shake-denied");
            void card.offsetWidth;
            card.classList.add("shake-denied");
            setTimeout(() => card.classList.remove("shake-denied"), 350);
          }

          showToast("🚫 Auto-sorting enabled");
          playDeniedSound();
          playHaptic(NotificationType.Error);
        }, 500);
        return;
      }

      const card = header.closest(".counter-card");
      if (!card) return;

      // Hold threshold (350ms) to distinguish intentional drag from swiping
      if (pendingDragTimer) clearTimeout(pendingDragTimer);
      pendingDrag = {
        card,
        header,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        target: e.target,
      };

      pendingDragTimer = setTimeout(() => {
        if (!pendingDrag) return;
        const p = pendingDrag;
        pendingDrag = null;
        pendingDragTimer = null;

        // If the entry animation is still running, strip it immediately
        // so that getBoundingClientRect captures the true un-transformed bounds.
        if (p.card.classList.contains("animate-entry")) {
          p.card.classList.remove("animate-entry");
        }

        // Measure pointer offset relative to card top-left
        const rect = p.card.getBoundingClientRect();
        const offsetX = p.currentX - rect.left;
        const offsetY = p.currentY - rect.top;

        const { ghost } = createGhost(p.card, offsetX, offsetY);

        // Placeholder mimics the card's dimensions
        const placeholder = document.createElement("div");
        placeholder.className = "drag-placeholder";
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.minHeight = `${rect.height}px`;
        listWrapper.insertBefore(placeholder, p.card);

        // Capture pointer first BEFORE hiding the original card to prevent browser pointer cancel!
        try {
          listWrapper.setPointerCapture(p.pointerId);
        } catch {
          /* ignore */
        }

        p.card.classList.add("dragging");
        playHaptic(ImpactStyle.Medium);

        headerHoldSuppressedClick = true;
        setTimeout(() => {
          headerHoldSuppressedClick = false;
        }, 400);

        dragState = {
          card: p.card,
          ghost,
          placeholder,
          offsetX,
          offsetY,
          moved: false,
          target: p.target,
        };

        // Disable tab slider scrolling while dragging
        const tabsSlider = $("#tabs-slider");
        if (tabsSlider) tabsSlider.style.overflowX = "hidden";
      }, 350);
    });

    listWrapper.addEventListener("pointermove", (e) => {
      if (headerHoldActive && e.pointerId === headerHoldPointerId) {
        const dist = Math.hypot(
          e.clientX - headerHoldStartX,
          e.clientY - headerHoldStartY,
        );
        if (dist > 15) cancelHeaderHold();
      }

      if (pendingDrag && e.pointerId === pendingDrag.pointerId) {
        const dist = Math.hypot(
          e.clientX - pendingDrag.startX,
          e.clientY - pendingDrag.startY,
        );
        // If movement exceeds tolerance before timer fires, cancel drag so horizontal swipe can happen
        if (dist > 15) {
          cancelPendingDrag();
        } else {
          pendingDrag.currentX = e.clientX;
          pendingDrag.currentY = e.clientY;
        }
      }

      if (!dragState) return;
      dragState.moved = true;

      moveGhost(
        dragState.ghost,
        e.clientX,
        e.clientY,
        dragState.offsetX,
        dragState.offsetY,
      );

      const before = getDropTarget(e.clientX, e.clientY);
      movePlaceholder(dragState.placeholder, before);
    });

    const endDrag = (e) => {
      cancelHoldsFor(e.pointerId);
      if (!dragState) return;

      const { card, ghost, placeholder, moved, target } = dragState;
      dragState = null;

      // Restore tab slider scrolling
      const tabsSlider = $("#tabs-slider");
      if (tabsSlider) tabsSlider.style.overflowX = "";

      // Clean up ghost and dragging state
      ghost.remove();
      card.classList.remove("dragging");

      if (!moved) {
        // Treat no-movement as a cancelled drag — just remove placeholder
        placeholder.remove();
        const counterId = card.getAttribute("data-counter-id");
        
        // A hold that never moved is a tap. With pointer capture the native
        // click lands on the list rather than the card, so open the editor
        // here and swallow that click.
        if (target && target.closest(".card-header")) {
          openEditCounterDetails(counterId);
        }
        
        return;
      }

      // A real drag just ended: swallow the click the release generates so it
      // doesn't fall through to the header-tap handler and open the editor.
      // Same suppression flags as the long-press path (cleared after release).
      headerHoldSuppressedClick = true;
      suppressUntilRelease = true;

      // Compute new order from DOM (placeholder position = drop slot)
      const allChildren = [...listWrapper.children];
      const placeholderIdx = allChildren.indexOf(placeholder);
      placeholder.remove();

      // Determine original index to remove from
      const counterId = card.getAttribute("data-counter-id");
      const fromIdx = state.counters.findIndex((c) => c.id === counterId);
      if (fromIdx === -1) return;

      // Count how many real cards are before the placeholder position to get target index
      let seen = 0;
      for (let i = 0; i < allChildren.length; i++) {
        if (i === placeholderIdx) break;
        const child = allChildren[i];
        if (
          child !== card &&
          child !== placeholder &&
          child.classList.contains("counter-card")
        ) {
          seen++;
        }
      }
      const toIdx = Math.max(0, Math.min(seen, state.counters.length - 1));

      if (fromIdx === toIdx) {
        renderCountersList();
        return;
      }

      // Reorder state array
      const [moved_item] = state.counters.splice(fromIdx, 1);
      state.counters.splice(toIdx, 0, moved_item);
      saveCounters();
      renderCountersList();
      playClickSound(500, 650, 0.06, 0.04);
    };

    listWrapper.addEventListener("pointerup", endDrag);
    listWrapper.addEventListener("pointercancel", (e) => {
      cancelHoldsFor(e.pointerId);
      if (!dragState) return;
      dragState.ghost.remove();
      dragState.card.classList.remove("dragging");
      dragState.placeholder.remove();
      dragState = null;
      
      const tabsSlider = $("#tabs-slider");
      if (tabsSlider) tabsSlider.style.overflowX = "";
      renderCountersList();
    });

    // After a denied long press, stop suppressing once the release's own click
    // has had its chance to fire, so the next real tap works. Listen on window
    // so a release outside the list still counts.
    const endSuppressionAfterRelease = () => {
      if (!suppressUntilRelease) return;
      suppressUntilRelease = false;
      setTimeout(() => {
        headerHoldSuppressedClick = false;
      }, 100);
    };
    window.addEventListener("pointerup", endSuppressionAfterRelease, true);
    window.addEventListener("pointercancel", endSuppressionAfterRelease, true);

    // Capture-phase click listener to suppress accidental click/edit-dialog after long press
    listWrapper.addEventListener(
      "click",
      (e) => {
        if (headerHoldSuppressedClick) {
          headerHoldSuppressedClick = false;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
  };

  // ------------------------------------------------------------------------
  // 9. History Log Renderer
  // ------------------------------------------------------------------------
  const renderHistory = () => {
    const listWrapper = $("#history-items-wrapper");
    const emptyView = $("#history-empty-view");

    if (!listWrapper || !emptyView) return;

    if (state.history.length === 0) {
      listWrapper.innerHTML = "";
      emptyView.classList.remove("hidden");
      return;
    }

    emptyView.classList.add("hidden");
    listWrapper.innerHTML = state.history
      .map((logItem) => {
        const themeHex =
          logItem.color === "system"
            ? "var(--accent-color)"
            : getCounterHex(logItem);

        return `
        <div class="history-item" style="--history-theme: ${themeHex}">
          <div class="history-badge"></div>
          <div class="history-details">
            <div class="history-row-top">
              <span class="history-counter">${escapeHtml(logItem.counterLabel)}</span>
              <span class="history-time">${logItem.timestamp}</span>
            </div>
            <div class="history-row-bottom">
              <span class="history-event">${logItem.actionLabel}</span>
              <span class="history-progression">${logItem.progression}</span>
            </div>
          </div>
        </div>
      `;
      })
      .join("");
  };

  // ------------------------------------------------------------------------
  // 10. Navigation / Tab Switching
  // ------------------------------------------------------------------------
  let isProgrammaticTabScroll = false;
  let programmaticTabTimeout = null;

  const updateTabUI = (tabId) => {
    if (state.currentTab === tabId) return;
    state.currentTab = tabId;

    // Update footer button active class
    $$("[data-tab-btn]").forEach((btn) => {
      const isActive = btn.getAttribute("data-tab-btn") === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    // Update Topbar View Title
    const viewTitle = $("#app-view-title");
    if (viewTitle) {
      if (tabId === "counters") viewTitle.textContent = "Counters";
      else if (tabId === "dice") viewTitle.textContent = "Dice";
      else if (tabId === "timer") viewTitle.textContent = "Timer";
    }
  };

  const switchTab = (tabId) => {
    isProgrammaticTabScroll = true;
    if (programmaticTabTimeout) clearTimeout(programmaticTabTimeout);
    programmaticTabTimeout = setTimeout(() => {
      isProgrammaticTabScroll = false;
      programmaticTabTimeout = null;
    }, 450);

    updateTabUI(tabId);
    
    // Smoothly scroll the native snap container to the target tab
    const slider = $("#tabs-slider");
    const target = document.getElementById("tab-" + tabId);
    if (slider && target) {
      const scrollTargetX = target.offsetLeft - slider.offsetLeft;
      slider.scrollTo({ left: scrollTargetX, behavior: "smooth" });
    }
  };

  // ------------------------------------------------------------------------
  // 11. Options Overlay Dialog logic
  // ------------------------------------------------------------------------
  const openOptionsDialog = () => {
    // Sync dialog display to state configs before showing
    $("#options-auto-sort").checked = state.settings.autoSort;

    if (state.settings.layout === "grid") {
      $("#layout-opt-grid").classList.add("active");
      $("#layout-opt-list").classList.remove("active");
    } else {
      $("#layout-opt-list").classList.add("active");
      $("#layout-opt-grid").classList.remove("active");
    }

    const type = state.settings.topBarContent;
    $(`#topbar-opt-highest`).classList.toggle("active", type === "highest");
    $(`#topbar-opt-lowest`).classList.toggle("active", type === "lowest");
    $(`#topbar-opt-total`).classList.toggle("active", type === "total");

    openDialog($("#options-dialog"));
  };

  const setupOptionsDialog = () => {
    const dialog = $("#options-dialog");
    if (!dialog) return;

    // Open view options when clicking on the leader container (top left)
    $("#header-leader-container")?.addEventListener("click", openOptionsDialog);

    // Handle standard layout button switches
    $("#layout-opt-list").addEventListener("click", () => {
      state.settings.layout = "list";
      document.documentElement.setAttribute("data-layout", "list");
      $("#layout-opt-list").classList.add("active");
      $("#layout-opt-grid").classList.remove("active");
      saveSettings();
      renderCountersList();
    });

    $("#layout-opt-grid").addEventListener("click", () => {
      state.settings.layout = "grid";
      document.documentElement.setAttribute("data-layout", "grid");
      $("#layout-opt-grid").classList.add("active");
      $("#layout-opt-list").classList.remove("active");
      saveSettings();
      renderCountersList();
    });

    // Top Bar content settings options
    ["highest", "lowest", "total"].forEach((option) => {
      $(`#topbar-opt-${option}`).addEventListener("click", () => {
        state.settings.topBarContent = option;
        $(`#topbar-opt-highest`).classList.toggle(
          "active",
          option === "highest",
        );
        $(`#topbar-opt-lowest`).classList.toggle("active", option === "lowest");
        $(`#topbar-opt-total`).classList.toggle("active", option === "total");
        saveSettings();
        renderLeaderBar();
        if (state.settings.autoSort) {
          performAutoSortNow();
        }
      });
    });

    // Auto sort toggles
    $("#options-auto-sort").addEventListener("change", (e) => {
      state.settings.autoSort = e.target.checked;
      saveSettings();
      if (state.settings.autoSort) {
        performAutoSortNow();
      } else {
        renderCountersList();
      }
    });
  };

  // ------------------------------------------------------------------------
  // 12. Calculator Dialog Sheet Logic (Accumulating math value)
  // ------------------------------------------------------------------------
  const updateSubmitButtonText = () => {
    const submitBtn = $("#calc-btn-submit");
    if (!submitBtn) return;

    const inputEl = $("#calc-number-input");
    let valStr = inputEl?.value || "";

    if (valStr.length > 14) {
      valStr = valStr.slice(0, 14);
      if (inputEl) inputEl.value = valStr;
    }

    const val = parseFloat(valStr);
    const isMinus = state.calcPendingOperation === "minus";

    if (!val || isNaN(val)) {
      submitBtn.textContent = isMinus ? "Subtract" : "Add";
    } else {
      submitBtn.textContent = `${isMinus ? "Subtract" : "Add"} ${formatNumber(
        val,
      )}`;
    }
  };

  const updateCalcDisplayDOM = () => {
    const opIndicator = $(".math-op-indicator");
    const opMinus = $("#calc-op-minus");
    const opPlus = $("#calc-op-plus");

    const sign = state.calcPendingOperation === "plus" ? "+" : "−";

    if (opIndicator) {
      opIndicator.textContent = sign;
    }

    // Dynamically update quick add button signs (+ / -) to match toggled operator
    $$("#calc-quick-add-container button").forEach((btn) => {
      const val = btn.getAttribute("data-quick-val");
      btn.textContent = `${sign}${formatNumber(parseFloat(val))}`;
    });

    if (opMinus && opPlus) {
      opMinus.classList.toggle(
        "active",
        state.calcPendingOperation === "minus",
      );
      opPlus.classList.toggle(
        "active",
        state.calcPendingOperation === "plus",
      );
    }

    updateSubmitButtonText();
  };

  const openCalculator = (counterId, { byKeyboard = false } = {}) => {
    const counter = state.counters.find((c) => c.id === counterId);
    const dialog = $("#calculator-dialog");
    if (!counter || !dialog) return;

    state.activeCounterIdForCalc = counterId;
    state.calcPendingOperation = "plus";
    state.calcOpenedByKeyboard = byKeyboard;

    const hexColor = getCounterHex(counter);
    const titleEl = $("#calc-dialog-title");
    titleEl.textContent = `${counter.label}: ${formatNumber(counter.value)}`;
    titleEl.style.setProperty("--pill-bg", `${hexColor}15`);
    titleEl.style.setProperty("--pill-border", `${hexColor}40`);
    const input = $("#calc-number-input");
    input.value = "";
    updateCalcDisplayDOM();
    setSheetTheme(dialog, hexColor);

    openDialog(dialog);
    input.focus();
    playClickSound(600, 700, 0.08, 0.05);
  };

  const setupCalculatorDialog = () => {
    const dialog = $("#calculator-dialog");
    if (!dialog) return;

    $("#calc-number-input")?.addEventListener("input", updateSubmitButtonText);

    // The calculator isn't a <form>, so wire Enter (and the mobile "Go" key) to submit
    $("#calc-number-input")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        $("#calc-btn-submit")?.click();
      }
    });

    // Prevent focus from shifting away from the text input when tapping the toggle
    $(".operation-toggles").addEventListener("pointerdown", (e) => {
      e.preventDefault();
    });

    $(".operation-toggles").addEventListener("click", (e) => {
      const btn = e.target.closest(".op-btn");
      if (!btn) return;
      playHaptic(ImpactStyle.Light);

      if (btn && !btn.classList.contains("active")) {
        state.calcPendingOperation = btn.id === "calc-op-minus" ? "minus" : "plus";
      } else {
        state.calcPendingOperation = state.calcPendingOperation === "plus" ? "minus" : "plus";
      }
      updateCalcDisplayDOM();
      playClickSound();
    });

    // Add or subtract an amount from the active counter, then close
    const applyToActiveCounter = (amount) => {
      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForCalc,
      );
      if (!counter) return;

      const oldValue = counter.value;
      const signedDelta =
        state.calcPendingOperation === "plus" ? amount : -amount;
      counter.value += signedDelta;
      saveCounters();

      const label =
        signedDelta > 0 ? `+${formatNumber(amount)}` : `−${formatNumber(amount)}`;
      addHistoryLog(counter, label, oldValue, counter.value);
      announceValue(counter);

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
    };

    // Quick-add buttons apply instantly
    $("#calc-quick-add-container").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-quick-val]");
      if (!btn) return;
      playHaptic(ImpactStyle.Light);
      const amount = parseFloat(btn.getAttribute("data-quick-val") || "0");
      if (amount !== 0) applyToActiveCounter(amount);
    });

    $("#calc-btn-submit").addEventListener("click", () => {
      playHaptic(ImpactStyle.Medium);
      const amount = parseFloat($("#calc-number-input").value || "0");
      if (amount === 0) {
        dialog.close();
        return;
      }
      applyToActiveCounter(amount);
    });

    dialog.addEventListener("close", () => {
      if (!state.calcOpenedByKeyboard) {
        const blurActive = () => {
          const active = document.activeElement;
          if (active && active.classList.contains("card-value-body")) {
            active.blur();
          }
        };
        blurActive();
        queueMicrotask(blurActive);
        requestAnimationFrame(blurActive);
      }
    });
  };

  // Animate a card tumbling off screen, then collapse the space it left.
  // tilt, drop, and drift are the random ranges (deg, px, px) on top of the base motion.
  const animateCardFallOut = (
    cardEl,
    { delay = 0, tilt = 30, drop = 50, drift = 80 } = {},
  ) => {
    const h = cardEl.offsetHeight;
    cardEl.classList.remove("animate-entry", "animate-reset");
    cardEl.style.overflow = "hidden";
    cardEl.style.pointerEvents = "none";
    cardEl.style.height = `${h}px`; // Lock height synchronously

    const rotateDir = Math.random() > 0.5 ? 1 : -1;
    const rotateAngle = 25 + Math.random() * tilt;
    const dropY = 180 + Math.random() * drop;
    const dropX = (Math.random() - 0.5) * drift;
    const collapsing = ["height", "margin-top", "margin-bottom", "padding-top", "padding-bottom", "border-width"];
    const bounce = "0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";

    // Wait 1 frame for the browser to paint the height lock
    requestAnimationFrame(() => {
      cardEl.style.transformOrigin = rotateDir > 0 ? "top left" : "top right";
      // Delay the layout collapse so the card falls out first
      cardEl.style.transition = [
        `transform 0.5s cubic-bezier(0.55, 0.085, 0.68, 0.53) ${delay}s`,
        `opacity 0.4s ease-in ${delay + 0.1}s`,
        ...collapsing.map((prop) => `${prop} ${bounce} ${delay + 0.3}s`),
      ].join(", ");

      // Wait 1 more frame so the transition is active before changing styles
      requestAnimationFrame(() => {
        cardEl.style.transform = `translate(${dropX}px, ${dropY}px) rotate(${rotateDir * rotateAngle}deg)`;
        cardEl.style.opacity = "0";
        for (const prop of collapsing) cardEl.style.setProperty(prop, "0px");
      });
    });
  };

  // ------------------------------------------------------------------------
  // 13. Main Menu & Points to Win Logic
  // ------------------------------------------------------------------------
  const setupMainMenuDialog = () => {
    const dialog = $("#main-menu-dialog");
    const openBtn = $("#btn-open-options");
    if (!dialog || !openBtn) return;

    openBtn.addEventListener("click", () => {
      openDialog(dialog);
    });

    $("#menu-btn-open-settings")?.addEventListener("click", () => {
      dialog.close();
      const settingsDialog = $("#settings-dialog");
      if (settingsDialog) {
        loadSettingsIntoDOM();
        openDialog(settingsDialog);
      }
    });

    $("#menu-btn-open-display-options")?.addEventListener("click", () => {
      dialog.close();
      openOptionsDialog();
    });

    $("#menu-btn-reset-counters")?.addEventListener("click", () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog(
        "Reset all counters to their base target values?",
        () => {
          const prevValues = state.counters.map((c) => ({
            id: c.id,
            value: c.value,
          }));
          const addedLogIds = [];
          state.counters.forEach((counter) => {
            const oldValue = counter.value;
            counter.value = counter.resetValue || 0;
            addHistoryLog(counter, "Reset counter", oldValue, counter.value);
            if (state.history[0]) addedLogIds.push(state.history[0].id);
          });
          saveCounters();

          renderCountersList();

          const listWrapper = $("#counters-list-wrapper");
          if (listWrapper) {
            listWrapper.classList.remove("animate-reset");
            void listWrapper.offsetWidth; // Trigger reflow
            listWrapper.classList.add("animate-reset");

            const cards = Array.from($$(".counter-card"));
            const animDuration = 0.85; // 850ms flip duration
            const maxStagger = 0.16; // Tight 160ms window so all cards spin together without lockstep

            // Generate well-distributed delays across the tight stagger window
            const delays = cards.map((_, i) => {
              const base = (i / Math.max(cards.length - 1, 1)) * maxStagger;
              const jitter =
                (Math.random() - 0.5) *
                (maxStagger / Math.max(cards.length, 1)) *
                0.5;
              return Math.max(0, base + jitter);
            });

            // Fisher-Yates shuffle to assign delays in completely random order
            for (let i = delays.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [delays[i], delays[j]] = [delays[j], delays[i]];
            }

            cards.forEach((card, index) => {
              card.style.animationDelay = `${delays[index].toFixed(3)}s`;
              card.style.animationFillMode = "backwards";
            });

            const maxDelay = Math.max(...delays, 0);
            const totalDurationMs =
              Math.round((animDuration + maxDelay) * 1000) + 100;

            setTimeout(() => {
              listWrapper.classList.remove("animate-reset");
              cards.forEach((c) => {
                c.style.animationDelay = "";
                c.style.animationFillMode = "";
              });
            }, totalDurationMs);
          }

          showToast("All counters reset", {
            actionLabel: "Undo",
            duration: 5000,
            onAction: () => {
              prevValues.forEach(({ id, value }) => {
                const c = state.counters.find((x) => x.id === id);
                if (c) c.value = value;
              });
              // Remove the "Reset counter" history entries — the reset never happened
              if (addedLogIds.length > 0) {
                state.history = state.history.filter(
                  (h) => !addedLogIds.includes(h.id),
                );
              }
              saveCounters();
              saveHistory();
              renderCountersList();
              renderHistory();
              showToast("Counters restored");
            },
          });
          playResetSound();
          playHaptic(ImpactStyle.Medium);
        },
      );
    });

    $("#menu-btn-shuffle-counters")?.addEventListener("click", () => {
      dialog.close();
      if (state.counters.length === 0) return;

      // FIRST: Capture current positions for FLIP animation
      const firstPositions = {};
      $$(".counter-card").forEach((card) => {
        const id = card.getAttribute("data-counter-id");
        if (id) firstPositions[id] = card.getBoundingClientRect();
      });

      // Capture original order
      const originalOrder = state.counters.map((c) => c.id).join(",");

      // Fisher-Yates shuffle
      for (let i = state.counters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.counters[i], state.counters[j]] = [
          state.counters[j],
          state.counters[i],
        ];
      }

      // Turn off auto-sort if it's on, otherwise it will just sort itself back
      if (state.settings.autoSort) {
        state.settings.autoSort = false;
        $("#options-auto-sort").checked = false;
        saveSettings();
      }

      saveCounters();
      renderCountersList(); // Renders new DOM elements

      // LAST, INVERT, PLAY
      const animateShuffle = !prefersReducedMotion();
      $$(".counter-card").forEach((card) => {
        const id = card.getAttribute("data-counter-id");
        const first = firstPositions[id];
        if (first && animateShuffle) {
          const last = card.getBoundingClientRect();
          const deltaX = first.left - last.left;
          const deltaY = first.top - last.top;

          // INVERT: move new card to old position instantly
          card.style.transition = "none";
          card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          card.style.zIndex = "10";

          // PLAY: animate back to new position
          requestAnimationFrame(() => {
            void card.offsetWidth; // Force reflow
            card.style.transition =
              "transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
            card.style.transform = "translate(0, 0)";

            setTimeout(() => {
              card.style.zIndex = "";
              card.style.transition = "";
              card.style.transform = "";
            }, 450);
          });
        }
      });

      const newOrder = state.counters.map((c) => c.id).join(",");

      if (state.counters.length >= 2 && originalOrder === newOrder) {
        showToast("Perfect shuffle!\nExact same order!");
        confetti({
          particleCount: 150,
          disableForReducedMotion: true,
          spread: 80,
          origin: { y: 0.6 },
        });
      } else {
        showToast("Counters shuffled");
      }

      playClickSound();
    });

    $("#menu-btn-share-counters")?.addEventListener("click", async () => {
      dialog.close();
      if (state.counters.length === 0) {
        showToast("No counters to share");
        return;
      }

      const lines = ["Counters"];
      state.counters.forEach((counter) => {
        lines.push(`${counter.label}: ${formatNumber(counter.value)}`);
      });
      const text = lines.join("\n");

      // Prefer the native share sheet (includes Copy on iOS/Android)
      if (typeof navigator.share === "function") {
        try {
          // Note: no title param — it renders as a duplicate header above
          // the text in the share sheet, which already starts with one.
          await navigator.share({ text });
        } catch (e) {
          // User dismissed the share sheet — not an error
          if (e && e.name !== "AbortError") {
            log.warn("Share failed:", e);
          }
        }
        return;
      }

      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard");
      } catch (e) {
        log.warn("Clipboard write failed, trying legacy copy:", e);
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
          showToast("Copied to clipboard");
        } catch {
          showToast("Could not share counters");
        }
        ta.remove();
      }
    });

    $("#menu-btn-delete-all")?.addEventListener("click", () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog("Are you sure you want to delete all counters?", () => {
        const tabCounters = $("#tab-counters");
        if (tabCounters) tabCounters.style.overflow = "hidden";

        const completeDeletion = () => {
          if (tabCounters) {
            tabCounters.style.overflow = "";
            tabCounters.scrollTop = 0;
          }
          const deletedCounters = state.counters;
          const deletedHistory = state.history;
          state.counters = [];
          state.history = [];
          saveCounters();
          saveHistory();
          renderCountersList();
          renderHistory();
          showToast("All counters deleted", {
            actionLabel: "Undo",
            duration: 5000,
            onAction: () => {
              state.counters = deletedCounters;
              state.history = deletedHistory;
              saveCounters();
              saveHistory();
              renderCountersList();
              renderHistory();
              showToast("Counters restored");
            },
          });
          playResetSound();
          playHaptic(ImpactStyle.Medium);
        };

        const cards = $$(".counter-card");
        if (cards.length > 0 && !prefersReducedMotion()) {
          cards.forEach((cardEl, index) => {
            // 60ms cascade stagger
            animateCardFallOut(cardEl, {
              delay: index * 0.06,
              tilt: 45,
              drop: 80,
              drift: 120,
            });
          });
          setTimeout(completeDeletion, 700 + cards.length * 60);
        } else {
          completeDeletion();
        }
      });
    });
  };

  // Populate dynamic quick-add grids inside calculator overlay
  const populateCalculatorQuickAdds = () => {
    const container = $("#calc-quick-add-container");
    if (!container) return;

    container.innerHTML = state.settings.quickAddValues
      .map((val) => {
        return `<button data-quick-val="${val}">+${formatNumber(val)}</button>`;
      })
      .join("");
  };

  // ------------------------------------------------------------------------
  // 13. Edit / Add counter Panel Logic
  // ------------------------------------------------------------------------
  const setupEditCounterDialog = () => {
    const dialog = $("#edit-counter-dialog");
    const form = $("#edit-counter-form");

    if (!dialog || !form) return;

    // Auto-select text on focus/tap for input fields. Deferred so it lands
    // after a tap places the cursor, which would otherwise undo the selection.
    form.querySelectorAll("input").forEach((input) => {
      input.addEventListener("focus", () => {
        const valueAtFocus = input.value;
        setTimeout(() => {
          // select() also focuses, so skip it if focus moved to another field.
          // Also skip it if typing already started, or it would select (and the
          // next key would replace) what was just typed.
          if (document.activeElement === input && input.value === valueAtFocus) {
            input.select();
          }
        }, 50);
      });
    });

    // Compile Palette Grid circular swatches
    const paletteContainer = $("#edit-palette-container");
    if (paletteContainer) {
      paletteContainer.innerHTML =
        getSwatchesInDisplayOrder()
          .map((swatch) => {
            return `
          <div class="palette-swatch ${swatch.class}" data-color-id="${swatch.id}" style="background-color: ${swatch.hex}"></div>
        `;
          })
          .join("") +
        `
          <div class="palette-swatch custom-color-picker" data-color-id="custom">
            <svg class="custom-color-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" />
            </svg>
            <input type="color" id="edit-custom-color" aria-label="Custom color picker">
          </div>
        `;

      // Swatch Click bind
      paletteContainer.addEventListener("click", (e) => {
        const swatch = e.target.closest(".palette-swatch");
        if (!swatch) return;

        $$(".palette-swatch").forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");

        // Dynamically update sheet theme color
        const colorId = swatch.getAttribute("data-color-id");
        if (colorId === "custom") {
          const customInput = $("#edit-custom-color");
          if (customInput)
            setSheetTheme(dialog, customInput.value);
        } else {
          const swatches = getSwatches();
          const swatchData = swatches[parseInt(colorId)] || swatches[0];
          setSheetTheme(dialog, swatchData.hex);
        }

        playClickSound();
      });

      const customColorInput = $("#edit-custom-color");
      if (customColorInput) {
        customColorInput.addEventListener("input", (e) => {
          const swatch = e.target.closest(".palette-swatch");
          if (swatch) {
            swatch.style.backgroundColor = e.target.value;
            $$(".palette-swatch").forEach((s) => s.classList.remove("active"));
            swatch.classList.add("active");
            setSheetTheme(dialog, e.target.value);
          }
        });
      }
    }

    // Set by the "Reset to N" button just before it submits the form
    let resetRequested = false;

    // Form submission (Save counter adjustments or Add counter)
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      playHaptic(ImpactStyle.Medium);

      const selectedSwatch = $(".palette-swatch.active");
      let colorId = 0;
      if (selectedSwatch) {
        const dataColorId = selectedSwatch.getAttribute("data-color-id");
        if (dataColorId === "custom") {
          colorId = $("#edit-custom-color").value;
        } else {
          colorId = parseInt(dataColorId);
        }
      }

      const label = $("#edit-label").value.trim();
      const increment = parseFloat($("#edit-increment").value || "1");
      const resetValue = parseFloat($("#edit-reset-val").value || "0");
      // "Reset to N" saves the other edits too, with the value set to N
      const isReset = resetRequested;
      resetRequested = false;
      const value = isReset
        ? resetValue
        : parseFloat($("#edit-value-input-details").value || "0");

      // Edit existing counter
      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForEdit,
      );
      if (counter) {
        const oldValue = counter.value;
        if (label !== counter.label) delete counter.autoNamed;
        counter.label = label;
        counter.value = value;
        counter.color = colorId;
        counter.increment = increment;
        counter.resetValue = resetValue;
        saveCounters();

        if (isReset) {
          addHistoryLog(counter, "Reset value", oldValue, value);
          const resetLogId = state.history[0]?.id;
          announceValue(counter);
          showToast(`${counter.label} reset to ${formatNumber(value)}`, {
            actionLabel: "Undo",
            duration: 5000,
            onAction: () => {
              counter.value = oldValue;
              // The reset never happened, so drop its history entry
              state.history = state.history.filter((h) => h.id !== resetLogId);
              saveCounters();
              saveHistory();
              renderCountersList();
              triggerAutoSortWithDebounce();
              announceValue(counter);
              showToast(`${counter.label} restored`);
            },
          });
        } else if (oldValue !== value) {
          addHistoryLog(counter, "Edited value", oldValue, value);
          showToast(`Counter saved`);
        } else {
          addHistoryLog(counter, "Edited details", oldValue, value);
          showToast(`Counter saved`);
        }
      }

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      if (isReset) {
        playResetSound();
        const card = $(`.counter-card[data-counter-id="${counter?.id}"]`);
        if (card && !prefersReducedMotion()) {
          card.classList.add("animate-reset");
          setTimeout(() => card.classList.remove("animate-reset"), 950);
        }
      } else {
        playSuccessSound();
      }
    });

    $("#edit-reset-val").addEventListener("input", updateResetButtonLabel);

    // Reset isn't a submit button (Enter must mean Save), so submit in reset
    // mode explicitly. requestSubmit() still runs the form's validation.
    $("#edit-btn-reset").addEventListener("click", () => {
      resetRequested = true;
      form.requestSubmit();
      // If validation blocked the submit, don't leave reset mode armed
      resetRequested = false;
    });

    // Delete counter trash bin button
    $("#edit-btn-delete").addEventListener("click", () => {
      playHaptic(ImpactStyle.Medium);
      if (state.activeCounterIdForEdit === null) {
        dialog.close();
        return;
      }

      showConfirmDialog("Delete this counter?", () => {
        const idx = state.counters.findIndex(
          (c) => c.id === state.activeCounterIdForEdit,
        );
        if (idx !== -1) {
          const counter = state.counters[idx];
          const counterId = state.activeCounterIdForEdit;
          const cardEl = $(`.counter-card[data-counter-id="${counterId}"]`);

          const tabCounters = $("#tab-counters");
          if (tabCounters) tabCounters.style.overflow = "hidden";

          const completeDeletion = () => {
            if (tabCounters) tabCounters.style.overflow = "";
            // Re-resolve the index: auto-sort may have reordered the array
            // during the exit animation, making the captured idx stale
            const deletedIndex = state.counters.findIndex(
              (c) => c.id === counterId,
            );
            if (deletedIndex === -1) return;
            let deletedLogId = null;
            if (counter) {
              addHistoryLog(
                counter,
                "Deleted counter",
                counter.value,
                counter.value,
              );
              deletedLogId = state.history[0]?.id || null;
            }
            const deletedCounter = state.counters[deletedIndex];
            state.counters.splice(deletedIndex, 1);
            saveCounters();
            renderCountersList();
            showToast(`Counter deleted`, {
              actionLabel: "Undo",
              duration: 5000,
              onAction: () => {
                // Restore at the original position
                const at = Math.min(deletedIndex, state.counters.length);
                state.counters.splice(at, 0, deletedCounter);
                // Remove the "Deleted counter" history entry — the delete never happened
                if (deletedLogId) {
                  const hIdx = state.history.findIndex(
                    (h) => h.id === deletedLogId,
                  );
                  if (hIdx !== -1) state.history.splice(hIdx, 1);
                }
                saveCounters();
                saveHistory();
                renderCountersList();
                renderHistory();
                showToast(`Counter restored`);
              },
            });
            playResetSound();
            playHaptic(ImpactStyle.Medium);
          };

          dialog.close();

          if (cardEl && !prefersReducedMotion()) {
            animateCardFallOut(cardEl);
            setTimeout(completeDeletion, 700);
          } else {
            completeDeletion();
          }
        }
      });
    });
  };

  const setupEditValueDialog = () => {
    const dialog = $("#edit-value-dialog");
    const form = $("#edit-value-form");

    if (!dialog || !form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const newValueStr = $("#edit-value-input").value;
      if (newValueStr === "") return;
      const newValue = parseFloat(newValueStr);

      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForEdit,
      );
      if (counter) {
        const oldValue = counter.value;
        counter.value = newValue;
        saveCounters();
        addHistoryLog(counter, "Edited value", oldValue, counter.value);
        announceValue(counter);
        showToast("Value updated");
      }

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
    });
  };

  // Streamlined: Add new counter directly without dialog
  const addNewCounterStreamlined = () => {
    // Pick an unused color swatch
    const usedColors = state.counters.map((c) => c.color);
    const swatches = getSwatches();
    const unusedSwatches = swatches.filter(
      (s) => !usedColors.includes(s.id),
    );
    const selectedSwatch =
      unusedSwatches.length > 0
        ? unusedSwatches[Math.floor(Math.random() * unusedSwatches.length)]
        : swatches[Math.floor(Math.random() * swatches.length)];
    const colorId = selectedSwatch.id;

    // Pick an unused placeholder label if possible
    const labelChoices = [
      "Flicker",
      "Robin",
      "Finch",
      "Junco",
      "Wren",
      "Sparrow",
      "Heron",
      "Egret",
      "Piper",
      "Merlin",
      "Kite",
      "Lark",
      "Swift",
      "Jay",
      "Phoebe",
      "Starling",
      "Dunlin",
      "Thrush",
      "Vesper",
      "Magpie",
      "Tern",
      "Puffin",
      "Gull",
      "Crane",
      "Plover",
      "Stilt",
    ];
    const usedLabels = state.counters.map((c) => c.label);
    const unusedLabels = labelChoices.filter(
      (label) => !usedLabels.includes(label),
    );
    const label =
      unusedLabels.length > 0
        ? unusedLabels[Math.floor(Math.random() * unusedLabels.length)]
        : labelChoices[Math.floor(Math.random() * labelChoices.length)];

    const newCounter = {
      id: Date.now().toString(),
      label,
      autoNamed: true, // still on its automatic name; the edit dialog selects it for renaming
      value: 0,
      color: colorId,
      increment: 1,
      resetValue: 0,
      isNew: true,
    };

    state.counters.push(newCounter);
    saveCounters();
    addHistoryLog(newCounter, "Added counter", 0, 0);
    showToast(`Counter "${label}" added`);
    renderCountersList();
    triggerAutoSortWithDebounce();
    playSuccessSound();
  };

  // Open Edit Dialog wrapper for editing counter details
  // The edit dialog's reset button names the value it resets to
  const updateResetButtonLabel = () => {
    const resetBtn = $("#edit-btn-reset");
    if (!resetBtn) return;
    const resetValue = parseFloat($("#edit-reset-val").value || "0");
    resetBtn.textContent = `Reset to ${formatNumber(Number.isFinite(resetValue) ? resetValue : 0)}`;
  };

  const openEditCounterDetails = (counterId) => {
    const counter = state.counters.find((c) => c.id === counterId);
    if (!counter) return;

    state.activeCounterIdForEdit = counterId;

    $("#edit-dialog-title").textContent = `Edit ${counter.label}`;
    $("#edit-btn-delete").style.display = "flex"; // Show trash

    // Populate form values
    $("#edit-label").value = counter.label;
    $("#edit-value-input-details").value = counter.value;
    $("#edit-increment").value = counter.increment;
    $("#edit-reset-val").value = counter.resetValue;
    updateResetButtonLabel();

    // Set palette swatch selected
    const isCustom = isCustomColor(counter.color);
    const sheetThemeHex = getCounterHex(counter);
    const swatches = getSwatches();
    $$(".palette-swatch").forEach((swatch) => {
      const colorId = swatch.getAttribute("data-color-id");
      swatch.classList.toggle(
        "active",
        isCustom ? colorId === "custom" : parseInt(colorId) === counter.color,
      );
      // Preset swatches follow the active palette
      if (swatches[colorId]) swatch.style.backgroundColor = swatches[colorId].hex;
      if (colorId === "custom") {
        // Show the counter's custom color, or start the picker at the app theme color
        const customHex = isCustom ? counter.color : getThemeHex();
        swatch.style.backgroundColor = customHex;
        const input = swatch.querySelector("input");
        if (input) input.value = customHex;
      }
    });

    const dialog = $("#edit-counter-dialog");
    if (dialog) {
      setSheetTheme(dialog, sheetThemeHex);
      openDialog(dialog);

      // Usually don't focus a field: on phones that opens the keyboard and
      // squeezes the sheet. Exception: a counter still on its automatic name is
      // almost always being renamed, so select the name and let typing replace it.
      // Select right away (not just via the deferred focus handler) so typing
      // replaces the name even if it starts immediately.
      if (counter.autoNamed) {
        const nameInput = $("#edit-label");
        nameInput.focus();
        nameInput.select();
      }

      playClickSound();
    }
  };

  // ------------------------------------------------------------------------
  // 14. Settings Dialog Data Binder
  // ------------------------------------------------------------------------
  // Fill the palette select from the palettes map and preview the chosen palette
  const renderPaletteSetting = () => {
    const select = $("#setting-palette");
    const preview = $("#setting-palette-preview");
    if (!select || !preview) return;
    if (!select.options.length) {
      select.innerHTML = Object.entries(palettes)
        .map(([key, { label }]) => `<option value="${key}">${label}</option>`)
        .join("");
    }
    select.value = palettes[state.settings.palette] ? state.settings.palette : "bold";
    preview.innerHTML = getSwatchesInDisplayOrder()
      .map(({ hex }) => `<span style="background-color: ${hex}"></span>`)
      .join("");
  };

  const loadSettingsIntoDOM = () => {
    $("#setting-sound").checked = state.settings.soundEnabled;
    const hapticSetting = $("#setting-haptic");
    if (hapticSetting) {
      if (Capacitor.isNativePlatform()) {
        hapticSetting.checked = state.settings.hapticsEnabled;
      } else {
        $("#setting-row-haptic").style.display = "none";
      }
    }
    const keepAwakeEl = $("#setting-keep-awake");
    if (keepAwakeEl) keepAwakeEl.checked = state.settings.keepAwake;
    $("#setting-theme").value = state.settings.theme || "system";
    renderPaletteSetting();
    const quickAddInput = $("#setting-quick-add-values");
    if (quickAddInput) {
      quickAddInput.value = state.settings.quickAddValues.join(", ");
      // Clear any stale validation state from the previous visit
      quickAddInput.classList.remove("input-error");
      quickAddInput.removeAttribute("aria-invalid");
      const feedback = $("#quick-add-feedback");
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("settings-feedback-error");
        feedback.hidden = true;
      }
    }
    $("#setting-theme-hue").value = state.settings.themeHue;
  };

  const bindSettingsActions = () => {
    // Sound Toggle
    $("#setting-sound").addEventListener("change", (e) => {
      state.settings.soundEnabled = e.target.checked;
      saveSettings();
      playClickSound();
    });

    // Haptic Toggle
    const hapticToggle = $("#setting-haptic");
    if (hapticToggle) {
      hapticToggle.addEventListener("change", (e) => {
        state.settings.hapticsEnabled = e.target.checked;
        saveSettings();
        playClickSound();
        playHaptic(ImpactStyle.Light);
      });
    }

    // Keep Awake Toggle
    const keepAwakeToggle = $("#setting-keep-awake");
    if (keepAwakeToggle) {
      keepAwakeToggle.addEventListener("change", (e) => {
        state.settings.keepAwake = e.target.checked;
        saveSettings();
        if (state.settings.keepAwake) {
          KeepAwake.keepAwake().catch((err) =>
            console.warn("KeepAwake enable failed:", err),
          );
        } else {
          KeepAwake.allowSleep().catch((err) =>
            console.warn("KeepAwake disable failed:", err),
          );
        }
        playClickSound();
      });
    }

    // Theme Hue Slider
    const hueSlider = $("#setting-theme-hue");
    if (hueSlider) {
      hueSlider.addEventListener("input", (e) => {
        const val = e.target.value;
        document.documentElement.style.setProperty("--theme-hue", val);
      });
      hueSlider.addEventListener("change", (e) => {
        state.settings.themeHue = parseInt(e.target.value, 10);
        saveSettings();
        playClickSound();
      });
    }

    // Palette selector
    $("#setting-palette").addEventListener("change", (e) => {
      state.settings.palette = e.target.value;
      saveSettings();
      renderPaletteSetting();
      renderCountersList();
      playClickSound();
    });

    // Theme selector
    $("#setting-theme").addEventListener("change", (e) => {
      state.settings.theme = e.target.value;
      saveSettings();
      applyTheme(state.settings.theme);
      playClickSound();
    });

    // Quick Add Calculator custom items
    $("#setting-quick-add-values").addEventListener("input", (e) => {
      const input = e.target;
      const feedback = $("#quick-add-feedback");
      const tokens = input.value.split(",").map((t) => t.trim());
      const nonEmpty = tokens.filter((t) => t !== "");
      // Strict positive integers: parseInt would silently mangle "2.5" -> 2
      // or accept "7abc" -> 7, so require digits only.
      const invalid = nonEmpty.filter(
        (t) => !/^\d+$/.test(t) || parseInt(t, 10) <= 0,
      );

      if (invalid.length > 0) {
        // Don't apply partially-invalid input; say what's wrong instead.
        input.classList.add("input-error");
        input.setAttribute("aria-invalid", "true");
        if (feedback) {
          feedback.textContent = `Invalid values: ${invalid.join(", ")}`;
          feedback.classList.add("settings-feedback-error");
          feedback.hidden = false;
        }
        return;
      }

      input.classList.remove("input-error");
      input.removeAttribute("aria-invalid");
      if (feedback) {
        feedback.textContent = "";
        feedback.classList.remove("settings-feedback-error");
        feedback.hidden = true;
      }

      const valid = nonEmpty.map((t) => parseInt(t, 10));
      if (valid.length > 0) {
        state.settings.quickAddValues = valid;
        saveSettings();
        populateCalculatorQuickAdds();
      }
    });
  };

  // ------------------------------------------------------------------------
  // 15. Dialog Dismiss backdrop check bindings
  // ------------------------------------------------------------------------
  const setupDialogBackdrops = () => {
    $$("dialog").forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const openedAt = parseInt(dialog.dataset.openedAt || "0");
        if (Date.now() - openedAt < 300) {
          return;
        }
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) {
          event.preventDefault();
          event.stopPropagation();
          dialog.close();
        }
      });
    });
  };

  // ------------------------------------------------------------------------
  // 16. History Dialog log overlays
  // ------------------------------------------------------------------------
  const setupHistoryDialog = () => {
    const dialog = $("#history-dialog");
    const openBtn = $("#btn-open-history");

    if (!dialog || !openBtn) return;

    openBtn.addEventListener("click", () => {
      renderHistory();
      openDialog(dialog);
    });

    // Clear history logs
    $("#history-btn-clear").addEventListener("click", () => {
      if (state.history.length === 0) return;
      showConfirmDialog("Clear history?", () => {
        state.history = [];
        saveHistory();
        renderHistory();
        playResetSound();
        playHaptic(ImpactStyle.Medium);
      });
    });
  };

  // Helper: History Log Writer
  const addHistoryLog = (counter, actionLabel, oldValue, newValue) => {
    let progressionVal;
    if (typeof oldValue === "string" && newValue === undefined) {
      progressionVal = oldValue;
    } else if (
      actionLabel === "Added counter" ||
      actionLabel === "Deleted counter" ||
      actionLabel === "Reset counter"
    ) {
      // For added/deleted/reset, showing the exact previous values isn't always useful, but let's at least hide 0 -> 0
      if (oldValue === newValue) {
        progressionVal = "";
      } else {
        progressionVal = `${formatNumber(oldValue)} → ${formatNumber(
          newValue,
        )}`;
      }
    } else {
      progressionVal = `${formatNumber(oldValue)} → ${formatNumber(newValue)}`;
    }

    const log = {
      id: Date.now().toString(),
      counterLabel: counter.label || counter.name || "Unknown",
      color: counter.color,
      actionLabel: actionLabel,
      progression: progressionVal,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
    state.history.unshift(log);

    // Capacity ceiling (50 entries)
    if (state.history.length > 50) {
      state.history.pop();
    }

    saveHistory();
  };

  // ------------------------------------------------------------------------
  // 17. Event Delegation & Interactions
  // ------------------------------------------------------------------------
  const bindDOMEvents = () => {
    // Drop focus globally for pointer clicks to make the UI feel like a native app.
    // This prevents dialogs from restoring focus to tapped buttons and removes false-positive focus rings.
    // Keyboard a11y remains untouched because Enter/Space clicks have e.detail === 0.
    document.addEventListener(
      "click",
      (e) => {
        if (e.detail > 0 && document.activeElement instanceof HTMLElement) {
          if (
            !["INPUT", "TEXTAREA", "SELECT"].includes(
              document.activeElement.tagName,
            )
          ) {
            document.activeElement.blur();
          }
        }
      },
      true,
    );
    let valuePressTimer = null;
    let valuePressActive = false;
    let valuePressMoved = false;
    let valuePressStartX = 0;
    let valuePressStartY = 0;
    let valuePressCounterId = null;

    // Prevent long press context menu globally except on text inputs to feel like a native app
    window.addEventListener("contextmenu", (e) => {
      const tagName = e.target.tagName;
      if (
        tagName !== "INPUT" &&
        tagName !== "TEXTAREA" &&
        !e.target.isContentEditable
      ) {
        e.preventDefault();
      }
    });

    // Bottom Nav clicks
    $$("[data-tab-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab-btn");
        if (tab === state.currentTab) return;
        switchTab(tab);
      });
    });

    // Native scroll observer for Swipe detection & real-time header/nav synchronization
    const tabsSlider = $("#tabs-slider");
    if (tabsSlider) {
      const tabs = ["counters", "dice", "timer"];
      let scrollRaf = null;

      const syncTabFromScroll = () => {
        const width = tabsSlider.clientWidth;
        if (!width) return;
        const index = Math.round(tabsSlider.scrollLeft / width);
        const currentVisibleTab = tabs[Math.min(Math.max(index, 0), tabs.length - 1)];

        if (isProgrammaticTabScroll) {
          if (currentVisibleTab === state.currentTab) {
            isProgrammaticTabScroll = false;
            if (programmaticTabTimeout) {
              clearTimeout(programmaticTabTimeout);
              programmaticTabTimeout = null;
            }
          }
          return;
        }

        if (currentVisibleTab && state.currentTab !== currentVisibleTab) {
          updateTabUI(currentVisibleTab);
        }
      };

      // Reset programmatic flag if user starts interacting directly
      tabsSlider.addEventListener("pointerdown", () => {
        isProgrammaticTabScroll = false;
        if (programmaticTabTimeout) {
          clearTimeout(programmaticTabTimeout);
          programmaticTabTimeout = null;
        }
      }, { passive: true });

      // Support native scroll snap events if available (Chrome 129+)
      if ("onscrollsnapchange" in HTMLElement.prototype) {
        tabsSlider.addEventListener("scrollsnapchange", (e) => {
          if (isProgrammaticTabScroll) return;
          const target = e.snapTargetInline;
          if (target && target.id) {
            const tabId = target.id.replace("tab-", "");
            if (tabs.includes(tabId) && state.currentTab !== tabId) {
              updateTabUI(tabId);
            }
          }
        });
      }

      // Real-time synchronization during scroll / swipe
      tabsSlider.addEventListener("scroll", () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = null;
          syncTabFromScroll();
        });
      }, { passive: true });

      // Final synchronization on scrollend
      tabsSlider.addEventListener("scrollend", () => {
        isProgrammaticTabScroll = false;
        if (programmaticTabTimeout) {
          clearTimeout(programmaticTabTimeout);
          programmaticTabTimeout = null;
        }
        syncTabFromScroll();
      });
    }

    // Header buttons
    $("#btn-add-counter").addEventListener("click", () => {
      addNewCounterStreamlined();
    });

    const emptyPlaceholder = $("#btn-empty-placeholder-icon");
    if (emptyPlaceholder) {
      emptyPlaceholder.addEventListener("click", () => {
        addNewCounterStreamlined();
      });
      emptyPlaceholder.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          addNewCounterStreamlined();
        }
      });
    }

    const listWrapper = $("#counters-list-wrapper");
    if (listWrapper) {
      listWrapper.addEventListener("pointerdown", (e) => {
        const valueBody = e.target.closest(".card-value-body");
        if (!valueBody) return;

        const card = valueBody.closest(".counter-card");
        if (!card) return;

        valuePressCounterId = card.getAttribute("data-counter-id");
        valuePressActive = true;
        valuePressMoved = false;
        valuePressStartX = e.clientX;
        valuePressStartY = e.clientY;

        valuePressTimer = setTimeout(() => {
          if (valuePressActive && !valuePressMoved) {
            valuePressActive = false;
            const counter = state.counters.find(
              (c) => c.id === valuePressCounterId,
            );
            if (counter) {
              state.activeCounterIdForEdit = valuePressCounterId;
              const valueInput = $("#edit-value-input");
              if (valueInput) {
                valueInput.value = counter.value;
              }
              const dialog = $("#edit-value-dialog");
              if (dialog) {
                const hexColor = getCounterHex(counter);
                setSheetTheme(dialog, hexColor);
                setTimeout(() => {
                  openDialog(dialog);
                }, 50);
                playClickSound();
              }
            }
          }
        }, 500);
      });

      listWrapper.addEventListener("pointermove", (e) => {
        if (!valuePressActive) return;
        const dist = Math.hypot(
          e.clientX - valuePressStartX,
          e.clientY - valuePressStartY,
        );
        if (dist > 10) {
          valuePressMoved = true;
          if (valuePressTimer) {
            clearTimeout(valuePressTimer);
            valuePressTimer = null;
          }
        }
      });

      listWrapper.addEventListener("pointerup", (e) => {
        // Only handle releases originating from an active value-body press to prevent
        // interfering with card reordering drags or other container gestures.
        if (!valuePressActive) return;

        valuePressActive = false;
        if (valuePressTimer) {
          clearTimeout(valuePressTimer);
          valuePressTimer = null;
        }

        const valueBody = e.target.closest(".card-value-body");
        if (valueBody) {
          e.preventDefault();
        }

        if (!valuePressMoved) {
          openCalculator(valuePressCounterId);
        }
      });

      listWrapper.addEventListener("pointercancel", () => {
        valuePressActive = false;
        if (valuePressTimer) {
          clearTimeout(valuePressTimer);
          valuePressTimer = null;
        }
      });
    }

    // Counters List Delegated clicks (optimizing performance & garbage collection)
    $("#counters-list-wrapper").addEventListener("click", (e) => {
      const card = e.target.closest(".counter-card");
      if (!card) return;

      const counterId = card.getAttribute("data-counter-id");
      const counter = state.counters.find((c) => c.id === counterId);
      if (!counter) return;

      // 1. Direct edge +/- zones step by the counter's increment
      const zone = e.target.closest(".card-direct-zone");
      if (zone) {
        const isPlus = zone.classList.contains("card-direct-zone-plus");
        zone.classList.add("zone-active-flash");
        setTimeout(() => zone.classList.remove("zone-active-flash"), 300);

        const oldValue = counter.value;
        const step = counter.increment || 1;
        counter.value += isPlus ? step : -step;
        announceValue(counter);
        saveCounters();
        addHistoryLog(
          counter,
          `${isPlus ? "+" : "−"}${formatNumber(counter.increment)}`,
          oldValue,
          counter.value,
        );

        renderCountersList();
        triggerAutoSortWithDebounce();
        playHaptic(ImpactStyle.Light);
        if (isPlus) playClickSound(650, 350, 0.06, 0.05);
        else playClickSound(450, 200, 0.06, 0.05);
        return;
      }

      // 3. Tapping the header opens the edit dialog (rename, reset, color, ...).
      // Clicks right after a long press are swallowed by the capture-phase
      // listener in setupCardDragDrop before they get here.
      if (e.target.closest(".card-header")) {
        openEditCounterDetails(counterId);
      }
    });

    // Handle Keyboard A11y on cards
    $("#counters-list-wrapper").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const card = e.target.closest(".counter-card");
        if (!card) return;

        const valueBody = e.target.closest(".card-value-body");
        if (valueBody) {
          e.preventDefault();
          openCalculator(card.getAttribute("data-counter-id"), {
            byKeyboard: true,
          });
          return;
        }

        if (e.target.closest(".card-header")) {
          e.preventDefault();
          openEditCounterDetails(card.getAttribute("data-counter-id"));
          return;
        }

        const directZone = e.target.closest(".card-direct-zone");
        if (directZone) {
          e.preventDefault();
          directZone.click(); // Handled by click listener
          return;
        }
      }
    });

    // Close Dialog triggers
    $$('dialog [command="close"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); // Prevent double-close warning in modern browsers
        const dialog = btn.closest("dialog");
        if (dialog && dialog.open) {
          dialog.close();
        }
      });
    });

    // Listen to OS Dark Theme adjustments live
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        if (state.settings.theme === "system") applyTheme("system");
      });
  };

  // ------------------------------------------------------------------------
  // 18. Placeholders Interactive Actions (Extra Premium Polish!)
  // ------------------------------------------------------------------------
  const setupPlaceholdersInteractions = () => {
    // 1. Redesigned Dice Roller
    const diceShakeIcon = $("#dice-shake-icon");
    const diceTypeSelector = $("#dice-type-selector");
    const diceCountDisplay = $("#dice-count-display");
    const btnDiceMinus = $("#btn-dice-minus");
    const btnDicePlus = $("#btn-dice-plus");
    const btnRollAction = $("#btn-roll-action");
    const diceResultCard = $("#dice-result-card");
    const diceResultBreakdown = $("#dice-result-breakdown");
    const diceResultTotal = $("#dice-result-total");

    // Tracks dice configuration
    let currentDiceType = 6;
    let currentDiceCount = 1;

    const updateRollButtonLabel = () => {
      if (btnRollAction) {
        btnRollAction.textContent = `Roll ${currentDiceCount}d${currentDiceType}`;
      }
    };

    if (diceTypeSelector) {
      const typeButtons = diceTypeSelector.querySelectorAll(".dice-type-btn");
      typeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          playHaptic(ImpactStyle.Light);
          typeButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          currentDiceType = parseInt(btn.getAttribute("data-type")) || 6;
          updateRollButtonLabel();
          playClickSound(650, 500, 0.05, 0.04);
        });
      });
    }

    if (btnDiceMinus) {
      btnDiceMinus.addEventListener("click", () => {
        if (currentDiceCount > 1) {
          playHaptic(ImpactStyle.Light);
          currentDiceCount--;
          if (diceCountDisplay) {
            diceCountDisplay.textContent = currentDiceCount;
          }
          updateRollButtonLabel();
          playClickSound(550, 450, 0.05, 0.04);
        }
      });
    }

    if (btnDicePlus) {
      btnDicePlus.addEventListener("click", () => {
        if (currentDiceCount < 20) {
          playHaptic(ImpactStyle.Light);
          currentDiceCount++;
          if (diceCountDisplay) {
            diceCountDisplay.textContent = currentDiceCount;
          }
          updateRollButtonLabel();
          playClickSound(650, 750, 0.05, 0.04);
        }
      });
    }

    if (
      btnRollAction &&
      diceResultTotal &&
      diceResultBreakdown &&
      diceShakeIcon &&
      diceResultCard
    ) {
      btnRollAction.addEventListener("click", () => {
        playHaptic(ImpactStyle.Light);
        // Trigger shaking animation
        diceShakeIcon.classList.add("active");
        btnRollAction.disabled = true;
        diceResultTotal.textContent = "...";
        diceResultTotal.classList.remove("animate-pop");
        diceResultBreakdown.textContent = "";
        diceResultCard.classList.remove("rolled");

        playDiceSound();

        setTimeout(() => {
          diceShakeIcon.classList.remove("active");

          let total = 0;
          const rolls = [];
          for (let i = 0; i < currentDiceCount; i++) {
            const roll = Math.floor(Math.random() * currentDiceType) + 1;
            rolls.push(roll);
            total += roll;
          }

          // State 2: Roll Result
          diceResultTotal.textContent = total;
          diceResultTotal.classList.add("animate-pop");
          diceResultCard.classList.add("rolled");

          if (currentDiceCount > 1) {
            diceResultBreakdown.textContent = `(${rolls.join(" + ")})`;
          } else {
            diceResultBreakdown.textContent = "";
          }

          // Log dice roll to history
          let progressionText = `Result: ${total}`;
          if (currentDiceCount > 1 && currentDiceCount <= 5) {
            progressionText += ` (${rolls.join(" + ")})`;
          }
          addHistoryLog(
            { name: "Dice roll", color: "system" },
            `Rolled ${currentDiceCount}d${currentDiceType}`,
            progressionText,
          );

          btnRollAction.disabled = false;
          playClickSound(600, 800, 0.08, 0.05);
          playHaptic(ImpactStyle.Medium);
        }, 400);
      });
    }

    // 2. Stopwatch & Countdown Timer
    const swStart = $("#btn-timer-placeholder-start");
    const swReset = $("#btn-timer-placeholder-reset");
    const swDisplay = $("#placeholder-stopwatch-display");
    const incButtons = $$(".timer-inc-btn");
    const timerShakeIcon = $("#timer-shake-icon");

    let timerInterval = null;
    let timerStartTime = 0;
    let stopwatchElapsedMs = 0;
    let countdownRemainingMs = 0;
    let timerRunning = false;
    let timerMode = "stopwatch"; // "stopwatch" or "countdown"
    let timerLastBeepSecond = 0;

    const updateTimerDisplay = () => {
      let totalMs;
      if (timerMode === "stopwatch") {
        totalMs =
          stopwatchElapsedMs + (timerRunning ? Date.now() - timerStartTime : 0);
      } else {
        totalMs =
          countdownRemainingMs -
          (timerRunning ? Date.now() - timerStartTime : 0);
        if (totalMs <= 0) {
          totalMs = 0;
          if (timerRunning) {
            timerRunning = false;
            clearInterval(timerInterval);
            swStart.textContent = "Start";
            swStart.classList.remove("danger-btn-outline");
            timerMode = "stopwatch";
            stopwatchElapsedMs = 0;
            countdownRemainingMs = 0;
            timerLastBeepSecond = 0;
            if (timerShakeIcon) {
              timerShakeIcon.classList.remove("active");
              void timerShakeIcon.offsetWidth; // trigger reflow
              timerShakeIcon.classList.add("active");
              setTimeout(() => {
                timerShakeIcon.classList.remove("active");
              }, 400);
            }
            playTimerFinish();
            playHaptic(ImpactStyle.Medium);
            setTimeout(() => {
              playHaptic(ImpactStyle.Medium);
            }, 200);
          }
        } else if (timerRunning) {
          const currentSecond = Math.ceil(totalMs / 1000);
          if (currentSecond <= 3 && currentSecond > 0 && currentSecond !== timerLastBeepSecond) {
            timerLastBeepSecond = currentSecond;
            playTimerBeep();
            playHaptic(ImpactStyle.Light);
          }
        }
      }

      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const ms = Math.floor((totalMs % 1000) / 100);

      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");

      if (swDisplay) {
        swDisplay.textContent = `${mm}:${ss}.${ms}`;
      }

      // Disabled / visually dimmed if timer is at 0
      if (swReset) {
        swReset.disabled = totalMs === 0;
      }
    };

    // Initialize reset button state
    if (swReset) {
      swReset.disabled = true;
    }

    if (swStart && swReset) {
      swStart.addEventListener("click", () => {
        let currentDisplayMs;
        if (timerMode === "stopwatch") {
          currentDisplayMs =
            stopwatchElapsedMs +
            (timerRunning ? Date.now() - timerStartTime : 0);
        } else {
          currentDisplayMs =
            countdownRemainingMs -
            (timerRunning ? Date.now() - timerStartTime : 0);
        }

        if (currentDisplayMs <= 0 && timerMode === "countdown") {
          // If we completed a countdown and start again at 0, reset to stopwatch mode
          timerMode = "stopwatch";
          stopwatchElapsedMs = 0;
          countdownRemainingMs = 0;
        }

        if (!timerRunning) {
          // Play/Start
          playHaptic(ImpactStyle.Medium);
          timerRunning = true;
          timerStartTime = Date.now();
          swStart.textContent = "Pause";
          swStart.classList.add("danger-btn-outline");

          timerInterval = setInterval(updateTimerDisplay, 30);
          playClickSound(650, 450, 0.05, 0.03);
        } else {
          // Pause
          playHaptic(ImpactStyle.Medium);
          timerRunning = false;
          const delta = Date.now() - timerStartTime;
          if (timerMode === "stopwatch") {
            stopwatchElapsedMs += delta;
          } else {
            countdownRemainingMs -= delta;
            if (countdownRemainingMs < 0) countdownRemainingMs = 0;
          }
          swStart.textContent = "Start";
          swStart.classList.remove("danger-btn-outline");

          clearInterval(timerInterval);
          playClickSound(450, 350, 0.05, 0.03);
        }
        updateTimerDisplay();
      });

      swReset.addEventListener("click", () => {
        playHaptic(ImpactStyle.Medium);
        timerRunning = false;
        stopwatchElapsedMs = 0;
        countdownRemainingMs = 0;
        timerLastBeepSecond = 0;
        timerMode = "stopwatch";
        swStart.textContent = "Start";
        swStart.classList.remove("danger-btn-outline");

        clearInterval(timerInterval);
        updateTimerDisplay();
        playResetSound();
        playHaptic(ImpactStyle.Medium);
      });
    }

    // Bind increment buttons click
    incButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        playHaptic(ImpactStyle.Light);
        const secs = parseInt(btn.getAttribute("data-secs")) || 10;
        const addMs = secs * 1000;

        if (timerMode === "stopwatch") {
          const currentDisplayMs =
            stopwatchElapsedMs +
            (timerRunning ? Date.now() - timerStartTime : 0);
          timerMode = "countdown";
          countdownRemainingMs = currentDisplayMs + addMs;
          stopwatchElapsedMs = 0;
          // Elapsed time is now folded into countdownRemainingMs; restart the
          // clock so it isn't subtracted a second time while running
          if (timerRunning) timerStartTime = Date.now();
        } else {
          countdownRemainingMs += addMs;
        }

        playClickSound(600, 500, 0.05, 0.03);
        if (timerShakeIcon) {
          timerShakeIcon.classList.remove("pop");
          void timerShakeIcon.offsetWidth;
          timerShakeIcon.classList.add("pop");
          setTimeout(() => {
            timerShakeIcon.classList.remove("pop");
          }, 250);
        }
        updateTimerDisplay();
      });
    });
  };

  // ------------------------------------------------------------------------
  // 18b. Sheet Swipe/Drag to Dismiss Logic
  // ------------------------------------------------------------------------
  const setupBottomSheetDragging = () => {
    $$(".bottom-sheet-dialog").forEach((dialog) => {
      const header = dialog.querySelector(".bottom-sheet-header");
      if (!header) return;

      let startY = 0;
      let currentY = 0;
      let isDragging = false;

      header.addEventListener("pointerdown", (e) => {
        // Skip trigger on buttons or interactive inputs
        if (
          e.target.closest("button") ||
          e.target.closest("input") ||
          e.target.closest("select")
        )
          return;

        startY = e.clientY;
        isDragging = true;
        dialog.classList.add("dragging");
        try {
          header.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      });

      header.addEventListener("pointermove", (e) => {
        if (!isDragging) return;

        const deltaY = e.clientY - startY;
        // Only allow downward dragging
        if (deltaY > 0) {
          currentY = deltaY;
          dialog.style.transform = `translate(-50%, ${deltaY}px)`;
        } else {
          currentY = 0;
          dialog.style.transform = "";
        }
      });

      const endDragging = (e) => {
        if (!isDragging) return;
        isDragging = false;
        dialog.classList.remove("dragging");

        if (e && e.pointerId) {
          try {
            header.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }

        // If dragged down past threshold (100px), close with a premium native slide transition
        if (currentY > 100) {
          dialog.style.transform = "translate(-50%, 100%)";
          setTimeout(() => {
            dialog.close();
            dialog.style.transform = "";
          }, 300);
          playClickSound(450, 350, 0.05, 0.03); // light close sound
        } else {
          // Snap back smoothly
          dialog.style.transform = "";
        }
        currentY = 0;
      };

      header.addEventListener("pointerup", endDragging);
      header.addEventListener("pointercancel", endDragging);
    });
  };

  // ------------------------------------------------------------------------
  // 19. Initialization Bootstrap routine
  // ------------------------------------------------------------------------
  const init = async () => {
    await loadStateFromStorage();

    // Core Layout options loaded
    document.documentElement.setAttribute("data-layout", state.settings.layout);

    // Dialog sheets binds
    setupDialogBackdrops();
    setupOptionsDialog();
    setupMainMenuDialog();
    setupCalculatorDialog();
    setupEditCounterDialog();
    setupEditValueDialog();
    setupHistoryDialog();
    setupConfirmDialog();
    setupToast();

    // Dynamic lists compile
    populateCalculatorQuickAdds();
    renderCountersList();

    // Events bind
    bindDOMEvents();
    bindSettingsActions();

    // Extras
    setupPlaceholdersInteractions();
    setupBottomSheetDragging();
    setupCardDragDrop();

    // Re-apply keep awake when app comes to foreground
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.settings.keepAwake) {
        KeepAwake.keepAwake().catch((err) =>
          console.warn("KeepAwake failed on resume:", err),
        );
      }
    });

    // Web: another tab changed saved state. Reload it, otherwise our stale copy
    // overwrites theirs on the next save. (Never fires on native.)
    window.addEventListener("storage", async (e) => {
      if (e.key !== null && !/counters-(list|settings|history)$/.test(e.key)) {
        return;
      }
      await loadStateFromStorage();
      document.documentElement.setAttribute("data-layout", state.settings.layout);
      populateCalculatorQuickAdds();
      renderCountersList();
      renderHistory();
    });

    // Set dynamic version from package.json via Vite define injection
    const appVersion =
      window.__APP_VERSION__ ||
      (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0");
    const commitHash = window.__COMMIT_HASH__ || "unknown";
    const isDirty = window.__IS_DIRTY__ ? "+" : "";

    // Startup banner
    console.log(`🔢 Counters v${appVersion} (${commitHash}${isDirty})`);

    const versionEl = document.getElementById("about-app-version");
    if (versionEl) {
      versionEl.textContent = `Counters v${appVersion}`;
    }

    // Register right away instead of waiting for window load, which a stalled
    // third-party request (e.g. analytics) can delay indefinitely
    registerSW({
      immediate: true,
      onOfflineReady() {
        log.info("App ready to work offline");
      },
    });
  };

  // Bootstrap when DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
