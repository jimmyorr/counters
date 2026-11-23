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
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style as StatusBarStyle } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
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
      log.error("Failed to enable Firebase Analytics:", err);
    });
    const appStoreContainer = document.getElementById("about-app-store-container");
    if (appStoreContainer) {
      appStoreContainer.style.display = "none";
    }
  }

  // Whether the user asked the OS to minimize non-essential motion
  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Freeze the background shell (.ambient-backdrop, .app-main, .app-nav) at its
  // pre-dialog pixel dimensions while any modal sheet or software keyboard is
  // active. On native iOS/Android ("resize": "native"), opening the keyboard
  // shrinks the WebView height (and drops safe-area-inset-bottom to 0), which
  // would otherwise smoosh flex-stretched counter cards upward behind the
  // blurred dialog backdrop.
  let lockedViewportWidth = 0;
  let lockedWindowHeight = 0;
  let unlockViewportTimer = null;

  const snapshotBackgroundViewport = () => {
    const root = document.documentElement;
    const appMain = document.querySelector(".app-main");
    const appNav = document.querySelector(".app-nav");
    if (!appMain || !appNav) return;
    lockedViewportWidth = window.innerWidth;
    lockedWindowHeight = window.innerHeight;
    root.style.setProperty("--locked-app-height", `${window.innerHeight}px`);
    root.style.setProperty("--locked-main-height", `${appMain.offsetHeight}px`);
    root.style.setProperty("--locked-nav-top", `${appNav.offsetTop}px`);
    root.style.setProperty("--locked-nav-height", `${appNav.offsetHeight}px`);
  };

  const lockBackgroundViewport = () => {
    if (unlockViewportTimer) {
      clearTimeout(unlockViewportTimer);
      unlockViewportTimer = null;
    }
    const root = document.documentElement;
    if (!root.classList.contains("viewport-locked")) {
      snapshotBackgroundViewport();
      root.classList.add("viewport-locked");
    }
  };

  const unlockBackgroundViewportNow = () => {
    if (unlockViewportTimer) {
      clearTimeout(unlockViewportTimer);
      unlockViewportTimer = null;
    }
    const root = document.documentElement;
    root.classList.remove("viewport-locked");
    root.style.removeProperty("--locked-app-height");
    root.style.removeProperty("--locked-main-height");
    root.style.removeProperty("--locked-nav-top");
    root.style.removeProperty("--locked-nav-height");
  };

  const tryReleaseBackgroundViewport = () => {
    const root = document.documentElement;
    if (!root.classList.contains("viewport-locked")) return;
    // Stay locked while any dialog is open (including WebKit's .closing exit)
    if (document.querySelector("dialog[open]")) return;
    const typing = document.activeElement?.matches("input, textarea") ?? false;
    if (typing) return;

    const vv = window.visualViewport;
    const heightRestored =
      window.innerHeight >= lockedWindowHeight - 2 &&
      (!vv || Math.abs(vv.height - lockedWindowHeight) <= 2);

    if (heightRestored) {
      unlockBackgroundViewportNow();
      return;
    }

    // Native keyboard is still animating closed; wait for the WebView to finish
    // expanding back to lockedWindowHeight, with a fallback if the window was
    // genuinely resized smaller.
    if (!unlockViewportTimer) {
      unlockViewportTimer = setTimeout(() => {
        unlockViewportTimer = null;
        if (!document.querySelector("dialog[open]")) {
          unlockBackgroundViewportNow();
        }
      }, 500);
    }
  };

  // Track the software keyboard so bottom sheets sit cleanly above it and the
  // edit sheet fills the space above it (issue #37). Sets .keyboard-open on
  // <html> plus --vv-height (visible height) and --vv-bottom (how far the
  // visible area's bottom sits above the layout viewport's). Each platform
  // shows the keyboard differently:
  //  - Native apps: the Keyboard plugin shrinks the whole web view, so the
  //    window itself gets shorter and --vv-bottom stays 0.
  //  - Mobile web (iOS Safari & Android Chrome): only the visual viewport
  //    shrinks (and may scroll), so the sheet is lifted by --vv-bottom.
  // Best effort on the web; desktop never matches (no coarse pointer).
  let fullViewportHeight = 0;
  let viewportWidth = 0;
  const syncKeyboardState = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    if (
      document.querySelector("dialog[open]") &&
      (window.scrollY !== 0 || window.scrollX !== 0)
    ) {
      window.scrollTo(0, 0);
    }
    // Rotation or a window resize starts a new baseline
    if (window.innerWidth !== viewportWidth) {
      viewportWidth = window.innerWidth;
      fullViewportHeight = 0;
    }
    fullViewportHeight = Math.max(fullViewportHeight, window.innerHeight);
    const typing = document.activeElement?.matches("input, textarea") ?? false;
    const keyboardOpen =
      typing &&
      window.matchMedia("(pointer: coarse)").matches &&
      fullViewportHeight - vv.height > 150;
    const root = document.documentElement;
    root.classList.toggle("keyboard-open", keyboardOpen);
    if (keyboardOpen) {
      root.style.setProperty("--vv-height", `${vv.height}px`);
      root.style.setProperty(
        "--vv-bottom",
        `${Math.max(0, window.innerHeight - vv.offsetTop - vv.height)}px`,
      );
    } else {
      root.style.removeProperty("--vv-height");
      root.style.removeProperty("--vv-bottom");
    }

    if (
      root.classList.contains("viewport-locked") &&
      window.innerWidth !== lockedViewportWidth &&
      !keyboardOpen
    ) {
      root.classList.remove("viewport-locked");
      snapshotBackgroundViewport();
      if (document.querySelector("dialog[open]")) {
        root.classList.add("viewport-locked");
      } else {
        unlockBackgroundViewportNow();
      }
    } else if (root.classList.contains("viewport-locked")) {
      tryReleaseBackgroundViewport();
    }
  };

  window.visualViewport?.addEventListener("resize", syncKeyboardState);
  window.visualViewport?.addEventListener("scroll", syncKeyboardState);
  window.addEventListener("resize", syncKeyboardState);
  // The keyboard can close without a resize reaching us first (e.g. blur)
  document.addEventListener("focusin", (e) => {
    if (
      e.target instanceof Element &&
      e.target.matches("input, textarea") &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      lockBackgroundViewport();
    }
    syncKeyboardState();
  });
  document.addEventListener("focusout", () => setTimeout(syncKeyboardState, 0));
  if (Capacitor.getPlatform() === "ios") {
    // The prev/next/done bar costs 44pt above the keyboard; the sheet's Save
    // button and Enter cover what it offers
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch((err) => {
      log.warn("Failed to hide keyboard accessory bar:", err);
    });
  }

  // Central helper to track when dialogs are opened.
  // This is used to prevent synthetic 'click' events from instantly closing them.
  // openSeq orders stacked dialogs so Back closes the topmost one.
  let dialogOpenSeq = 0;
  const openDialog = (dialog) => {
    // Reopened while still playing its exit (below): finish closing first
    if (dialog.closeTimer) {
      clearTimeout(dialog.closeTimer);
      dialog.closeTimer = null;
      HTMLDialogElement.prototype.close.call(dialog);
      dialog.classList.remove("closing");
    }
    lockBackgroundViewport();
    dialog.style.transform = "";
    dialog.dataset.openedAt = Date.now().toString();
    dialog.dataset.openSeq = String(++dialogOpenSeq);
    dialog.showModal();
  };

  // Where the CSS overlay property isn't supported (WebKit, so Safari and the
  // iOS app), a dialog leaves the top layer the moment it closes, taking its
  // backdrop with it, so its exit transition never plays. There each dialog's
  // close() adds .closing, which plays the exit (index.css), and closes for
  // real once it's done. Escape goes the same way. Chrome plays it on its own.
  if (!CSS.supports("overlay", "auto")) {
    const nativeClose = HTMLDialogElement.prototype.close;
    document.querySelectorAll("dialog").forEach((dialog) => {
      dialog.close = (returnValue) => {
        if (!dialog.open || dialog.closeTimer) return;
        dialog.classList.add("closing");
        // The .closing transitions' length in index.css: quicker than the
        // usual exit, as the page behind ignores taps until the dialog closes
        const exitMs = prefersReducedMotion() ? 150 : 250;
        dialog.closeTimer = setTimeout(() => {
          dialog.closeTimer = null;
          nativeClose.call(dialog, returnValue);
          dialog.classList.remove("closing");
          tryReleaseBackgroundViewport();
        }, exitMs);
      };
      dialog.addEventListener("cancel", (e) => {
        e.preventDefault();
        dialog.close();
      });
    });
  }

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
    calcNumpadValue: "",
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

  // Slots keep a counter's color family across palettes (slot 0 is bluish in
  // every palette, and so on), so slot order isn't rainbow order. Pickers show
  // swatches sorted by hue instead, with near-greys last.
  const hueOf = (hex) => {
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

  const sortColorsByHue = (hexes) =>
    [...hexes].sort((a, b) => hueOf(a) - hueOf(b));

  const getSwatchesInDisplayOrder = () =>
    [...getSwatches()].sort((a, b) => hueOf(a.hex) - hueOf(b.hex));

  // Swatches ({ id, class, hex, name }) for the active palette
  const getSwatches = () => {
    const active = palettes[state.settings.palette] || palettes.bold;
    return active.colors.map((hex, id) => ({
      id,
      class: `card-color-${id}`,
      hex,
      name: active.names?.[id] || `Color ${id + 1}`,
    }));
  };

  // Helper: Convert HSL (0-360, 0-100, 0-100) to #rrggbb
  const hslToHex = (h, s, l) => {
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

  // Helper: Convert #rrggbb to { h, s, l } (0-360, 0-100, 0-100)
  const hexToHsl = (hex) => {
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

  const hexToRgba = (hex, alpha) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  let ambientInitialized = false;
  let currentAmbientLeaderHex = null;

  // Subtle ambient radial gradient influenced by the current leader (or calm
  // theme-hue fallback when empty or showing Total). Transitions slowly via
  // CSS @property once initialized.
  const updateAmbientBackdrop = (
    leaderHex = null,
    { immediate = false } = {},
  ) => {
    currentAmbientLeaderHex = leaderHex;
    const backdrop = document.getElementById("ambient-backdrop");
    if (!backdrop) return;

    const isDark = document.documentElement.classList.contains("dark-mode");
    let glow1, glow2, glow3;

    if (leaderHex && /^#[0-9a-f]{6}$/i.test(leaderHex)) {
      const { h, s, l } = hexToHsl(leaderHex);
      if (s < 10) {
        // Near-neutral custom colors (#ffffff, #000000, greys) stay neutral
        const base = hslToHex(
          220,
          Math.round(s),
          isDark ? (l > 50 ? 78 : 56) : l < 50 ? 38 : 56,
        );
        glow1 = hexToRgba(base, isDark ? 0.08 : 0.055);
        glow2 = hexToRgba(base, isDark ? 0.05 : 0.038);
        glow3 = hexToRgba(base, isDark ? 0.025 : 0.018);
      } else {
        const glowSat = Math.round(Math.min(92, Math.max(s * 0.85 + 15, 48)));
        const primary = hslToHex(h, glowSat, isDark ? 58 : 60);
        const secondary = hslToHex(
          (h + 28) % 360,
          Math.max(42, glowSat - 8),
          isDark ? 54 : 58,
        );
        const center = hslToHex(
          (h + 348) % 360,
          Math.max(40, glowSat - 12),
          isDark ? 56 : 60,
        );
        glow1 = hexToRgba(primary, isDark ? 0.125 : 0.075);
        glow2 = hexToRgba(secondary, isDark ? 0.08 : 0.05);
        glow3 = hexToRgba(center, isDark ? 0.038 : 0.024);
      }
    } else {
      const hue = Number(state.settings.themeHue ?? 205);
      const primary = hslToHex(hue, 82, isDark ? 58 : 60);
      const secondary = hslToHex((hue + 28) % 360, 72, isDark ? 54 : 58);
      const center = hslToHex((hue + 348) % 360, 68, isDark ? 56 : 60);
      glow1 = hexToRgba(primary, isDark ? 0.065 : 0.045);
      glow2 = hexToRgba(secondary, isDark ? 0.04 : 0.03);
      glow3 = hexToRgba(center, isDark ? 0.02 : 0.015);
    }

    const skipTransition = !ambientInitialized || immediate;
    if (skipTransition) {
      backdrop.classList.remove("ambient-ready");
    }

    backdrop.style.setProperty("--ambient-glow-1", glow1);
    backdrop.style.setProperty("--ambient-glow-2", glow2);
    backdrop.style.setProperty("--ambient-glow-3", glow3);
    backdrop.dataset.leaderColor = leaderHex || "";

    if (skipTransition) {
      void backdrop.offsetWidth;
      backdrop.classList.add("ambient-ready");
      ambientInitialized = true;
    }
  };

  // Update --theme-hue plus readable accent tokens across all light and dark
  // surfaces so text meets WCAG 1.4.3 (4.5:1) and icons/marks meet 1.4.11 (3:1).
  const applyAccentTokens = (hue) => {
    const root = document.documentElement;
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
        ? hNorm - 17 * 0.5 * (1 - Math.cos((2 * Math.PI * (hNorm - 42)) / (86 - 42)))
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
    if (ambientInitialized && currentAmbientLeaderHex === null) {
      updateAmbientBackdrop(null, { immediate: true });
    }
  };

  // Apply "light", "dark", or "system" theme classes and browser theme-color meta
  const applyTheme = (theme) => {
    const isDark =
      theme === "dark" ||
      (theme !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark-mode", isDark);
    document.documentElement.classList.toggle("light-mode", !isDark);
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute("content", isDark ? "#0d0e11" : "#f2f3f7");
    }
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({
        style: isDark ? StatusBarStyle.Dark : StatusBarStyle.Light,
      }).catch((err) => log.warn("StatusBar setStyle failed:", err));
      if (Capacitor.getPlatform() === "android") {
        StatusBar.setBackgroundColor({
          color: isDark ? "#0d0e11" : "#f2f3f7",
        }).catch(() => {
          /* ignored on Android 15+ edge-to-edge */
        });
      }
    }
    if (ambientInitialized) {
      updateAmbientBackdrop(currentAmbientLeaderHex, { immediate: true });
    }
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
      } else {
        const legacyLayout = localStorage.getItem("counters-layout");
        if (legacyLayout) state.settings.layout = legacyLayout;
      }
      // Theme used to live only in localStorage; adopt it once, then Preferences is the source of truth
      if (!state.settings.theme) {
        state.settings.theme =
          localStorage.getItem("counters-theme") || "system";
        saveSettings();
      }
      applyTheme(state.settings.theme);
      applyAccentTokens(state.settings.themeHue);
      localStorage.setItem("counters-layout", state.settings.layout);
      localStorage.setItem("counters-theme", state.settings.theme);
      localStorage.setItem("counters-theme-hue", String(state.settings.themeHue));

      if (state.settings.keepAwake) {
        KeepAwake.keepAwake().catch((err) =>
          log.warn("KeepAwake failed:", err),
        );
      }

      if (savedHistory) {
        state.history = JSON.parse(savedHistory).map((entry) => ({
          ...entry,
          counterLabel: entry.counterLabel || "",
        }));
      } else {
        state.history = [];
      }
    } catch (e) {
      log.error("Failed to load local storage state", e);
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
    localStorage.setItem("counters-theme-hue", String(state.settings.themeHue));
  };

  const saveHistory = () => {
    Preferences.set({
      key: "counters-history",
      value: JSON.stringify(state.history),
    });
  };

  // Helper: Unique identifier that never collides in synchronous loops or frozen clocks
  let idSeq = 0;
  const createId = () =>
    crypto.randomUUID?.() || `${Date.now()}-${++idSeq}`;

  // Helper: Strip IEEE-754 floating-point drift (e.g. 0.1 + 0.2 -> 0.3)
  const cleanFloat = (num) => Number(Number(num).toPrecision(12));

  // Helper: Format large numbers with commas and up to 6 decimal places
  const formatNumber = (num) => {
    return Number(num).toLocaleString("en-US", { maximumFractionDigits: 6 });
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
  const getThemeHex = () => hslToHex(state.settings.themeHue ?? 205, 94, 60);

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

  // Helper: Text color for the card label, which sits on the card header's 12%
  // black overlay. Keeps the card's text color unless that falls below 4.5:1
  // there, as black can on mid-tones (e.g. #777777); the value below is large
  // text that only needs 3:1, so it keeps the card color.
  const getHeaderTextColor = (hex, text) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return text;
    const header = mixHex(hex, "#000000", 0.12);
    if (contrastRatio(header, text) >= 4.5) return text;
    return contrastRatio(header, "#ffffff") >= contrastRatio(header, "#000000")
      ? "#ffffff"
      : "#000000";
  };

  // Helper: Mix a #rrggbb color toward `toward`, starting at `start`, only as
  // far as needed to reach 4.5:1 on `surface`
  const getReadableInk = (hex, surface, toward, start) => {
    for (let t = start; t < 1; t += 0.05) {
      const ink = mixHex(hex, toward, t);
      if (contrastRatio(ink, surface) >= 4.5) return ink;
    }
    return toward;
  };

  // Helper: The counter color as text on a light surface tinted 10% with it
  // (e.g. the calculator's title pill). Starts at the usual 85% shade and
  // darkens only as far as needed for 4.5:1, so pale colors stay readable.
  const getInkOnLightTint = (hex) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#000000";
    return getReadableInk(hex, mixHex("#ffffff", hex, 0.1), "#000000", 0.15);
  };

  // Helper: The dark mode counterpart, on the dark sheet surface tinted 15%.
  // Lightens from `start` (0 keeps the color as is) so dark colors stay readable.
  const getInkOnDarkTint = (hex, start = 0) => {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
    return getReadableInk(hex, mixHex("#16171d", hex, 0.15), "#ffffff", start);
  };

  // Helper: Theme a bottom sheet with a counter color and readable text on it
  const setSheetTheme = (dialog, hex) => {
    dialog.style.setProperty("--sheet-theme", hex);
    dialog.style.setProperty("--sheet-text", getReadableTextColor(hex));
    dialog.style.setProperty("--sheet-ink-light", getInkOnLightTint(hex));
    // Matches the old 60% color, 40% white mix unless that's too dark
    dialog.style.setProperty("--sheet-ink-dark", getInkOnDarkTint(hex, 0.4));
    // Readable counter ink on --bg-tertiary controls (e.g. calculator quick-adds)
    dialog.style.setProperty(
      "--sheet-control-ink-light",
      /^#[0-9a-f]{6}$/i.test(hex)
        ? getReadableInk(hex, "#e9ebee", "#000000", 0.15)
        : "#000000",
    );
    dialog.style.setProperty(
      "--sheet-control-ink-dark",
      /^#[0-9a-f]{6}$/i.test(hex)
        ? getReadableInk(hex, "#21232c", "#ffffff", 0.3)
        : "#ffffff",
    );
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
      log.warn("Audio Context failed to play", e);
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

  // Desktop Chrome/Edge expose navigator.vibrate but have no motor, so on the
  // web only offer haptics when the primary pointer is a finger
  const supportsWebVibrate = () =>
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const supportsHaptics = () => Capacitor.isNativePlatform() || supportsWebVibrate();

  const webVibrate = (pattern) => {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  };

  const playHaptic = async (style = ImpactStyle.Light) => {
    if (!state.settings.hapticsEnabled || !supportsHaptics()) return;
    if (!Capacitor.isNativePlatform()) {
      let pattern = 15;
      if (style === ImpactStyle.Heavy || style === NotificationType.Error) {
        pattern = [40, 30, 80];
      } else if (
        style === ImpactStyle.Medium ||
        style === NotificationType.Warning ||
        style === NotificationType.Success
      ) {
        pattern = 25;
      }
      webVibrate(pattern);
      return;
    }
    try {
      if (Object.values(NotificationType).includes(style)) {
        await Haptics.notification({ type: style });
      } else {
        await Haptics.impact({ style });
      }
    } catch (err) {
      log.warn("Haptics failed", err);
    }
  };

  const playSelectionHaptic = async () => {
    if (!state.settings.hapticsEnabled || !supportsHaptics()) return;
    if (!Capacitor.isNativePlatform()) {
      webVibrate(8);
      return;
    }
    try {
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
    } catch (err) {
      log.warn("Selection haptic failed", err);
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
      log.warn("Failed to generate noise source", e);
    }
  };

  // ------------------------------------------------------------------------
  // 5. Toast Notification System
  // ------------------------------------------------------------------------
  let toastTimeout = null;

  // Announce a message to screen readers via the polite live region.
  // Clear first so repeating the same text is still announced.
  const announce = (message) => {
    const announcer = $("#sr-announcer");
    if (!announcer) return;
    announcer.textContent = "";
    requestAnimationFrame(() => {
      announcer.textContent = message;
    });
  };

  const announceValue = (counter) => {
    announce(`${counter.label}: ${formatNumber(counter.value)}`);
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
      updateAmbientBackdrop(null);
      return;
    }

    leaderContainer.style.opacity = "1";
    leaderContainer.style.pointerEvents = "auto";

    const type = state.settings.topBarContent;
    const icon = leaderContainer.querySelector(".leader-icon svg");

    if (type === "total") {
      const totalValue = cleanFloat(
        state.counters.reduce((sum, item) => sum + item.value, 0),
      );
      leaderContainer.style.removeProperty("--leader-color");
      leaderContainer.style.removeProperty("--leader-bg");
      leaderContainer.style.removeProperty("--leader-border");
      leaderContainer.style.removeProperty("--leader-ink-light");
      leaderContainer.style.removeProperty("--leader-ink-border");
      leaderContainer.style.removeProperty("--leader-ink-dark");
      leaderContainer.style.removeProperty("--leader-ink-dark-border");
      icon.innerHTML = `<path d="M19 18v2H5v-2l6-6-6-6V4h14v2h-9.35L14 12l-4.35 6H19z"/>`;
      leaderText.textContent = `Total: ${formatNumber(totalValue)}`;
      updateAmbientBackdrop(null);
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
    const inkLight = getInkOnLightTint(themeHex);
    leaderContainer.style.setProperty("--leader-ink-light", inkLight);
    leaderContainer.style.setProperty("--leader-ink-border", `${inkLight}4d`);
    const inkDark = getInkOnDarkTint(themeHex);
    leaderContainer.style.setProperty("--leader-ink-dark", inkDark);
    leaderContainer.style.setProperty("--leader-ink-dark-border", `${inkDark}4d`);
    icon.innerHTML = isLowest
      ? `<path d="M11 16.172V4h2v12.172l5.364-5.364 1.414 1.414L12 20l-7.778-7.778 1.414-1.414L11 16.172z"/>`
      : `<path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>`;
    leaderText.textContent = leader.label;
    updateAmbientBackdrop(themeHex);
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
        const cardText = getReadableTextColor(cardThemeHex);
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
        }" style="--card-theme: ${cardThemeHex}; --card-text: ${cardText}; --card-label-text: ${getHeaderTextColor(cardThemeHex, cardText)}; view-transition-name: counter-${counter.id};">
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
      ghost.removeAttribute("data-counter-id");
      ghost.setAttribute("aria-hidden", "true");
      ghost.classList.add("drag-ghost");
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.viewTransitionName = "none";
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
      if (e.pointerType === "mouse" && e.button !== 0) return;
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
      if (before !== dragState.placeholder.nextElementSibling) {
        const prevPositions = cardPositions();
        movePlaceholder(dragState.placeholder, before);
        flipCardsFrom(prevPositions, { durationMs: 240 });
        playSelectionHaptic();
      }
    });

    const settleGhostIntoCard = (ghost, counterId) => {
      const droppedCard = listWrapper.querySelector(
        `.counter-card[data-counter-id="${counterId}"]`,
      );
      if (droppedCard && !prefersReducedMotion()) {
        const targetRect = droppedCard.getBoundingClientRect();
        const fromTransform = ghost.style.transform;
        droppedCard.style.opacity = "0";
        ghost
          .animate(
            [
              { transform: fromTransform },
              {
                transform: `translate3d(${targetRect.left}px, ${targetRect.top}px, 0) rotate(0deg) scale(1)`,
              },
            ],
            {
              duration: 170,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              fill: "forwards",
            },
          )
          .finished.catch(() => {
            /* ignore */
          })
          .finally(() => {
            droppedCard.style.opacity = "";
            ghost.remove();
          });
      } else {
        ghost.remove();
      }
    };

    const endDrag = (e) => {
      cancelHoldsFor(e.pointerId);
      if (!dragState) return;

      const { card, ghost, placeholder, moved, target } = dragState;
      dragState = null;

      // Restore tab slider scrolling
      const tabsSlider = $("#tabs-slider");
      if (tabsSlider) tabsSlider.style.overflowX = "";

      card.classList.remove("dragging");

      if (!moved) {
        // Treat no-movement as a cancelled drag — just remove ghost & placeholder
        ghost.remove();
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
      if (fromIdx === -1) {
        ghost.remove();
        return;
      }

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

      if (fromIdx !== toIdx) {
        const [movedItem] = state.counters.splice(fromIdx, 1);
        state.counters.splice(toIdx, 0, movedItem);
        saveCounters();
      }
      renderCountersList();
      settleGhostIntoCard(ghost, counterId);
      playHaptic(ImpactStyle.Light);
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
  const TABS = ["counters", "dice", "timer", "picker"];
  let isProgrammaticTabScroll = false;
  let programmaticTabTimeout = null;
  let resetPicker = () => {};

  const updateTabUI = (tabId) => {
    if (state.currentTab === tabId) return;
    const prevTab = state.currentTab;
    state.currentTab = tabId;
    if (prevTab === "picker") {
      resetPicker({ immediate: true });
    }
    playSelectionHaptic();

    // Update footer button active class and roving tabindex
    $$("[data-tab-btn]").forEach((btn) => {
      const isActive = btn.getAttribute("data-tab-btn") === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    // Keep off-screen panels out of the keyboard Tab order
    $$(".tab-content").forEach((panel) => {
      panel.inert = panel.id !== "tab-" + tabId;
    });

    // Update Topbar View Title
    const viewTitle = $("#app-view-title");
    if (viewTitle) {
      if (tabId === "counters") viewTitle.textContent = "Counters";
      else if (tabId === "dice") viewTitle.textContent = "Dice";
      else if (tabId === "timer") viewTitle.textContent = "Timer";
      else if (tabId === "picker") viewTitle.textContent = "Picker";
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
      slider.scrollTo({
        left: scrollTargetX,
        behavior: prefersReducedMotion() ? "instant" : "smooth",
      });
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
      playClickSound();
      playSelectionHaptic();
    });

    $("#layout-opt-grid").addEventListener("click", () => {
      state.settings.layout = "grid";
      document.documentElement.setAttribute("data-layout", "grid");
      $("#layout-opt-grid").classList.add("active");
      $("#layout-opt-list").classList.remove("active");
      saveSettings();
      renderCountersList();
      playClickSound();
      playSelectionHaptic();
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
        playClickSound();
        playSelectionHaptic();
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
      playClickSound();
      playSelectionHaptic();
    });
  };

  // ------------------------------------------------------------------------
  // 12. Calculator Dialog Sheet Logic (Accumulating math value)
  // ------------------------------------------------------------------------
  const updateNumpadDisplayDOM = () => {
    const displayEl = $("#calc-numpad-display");
    const subBtn = $("#calc-numpad-btn-subtract");
    const addBtn = $("#calc-numpad-btn-add");

    const valStr = state.calcNumpadValue;
    if (displayEl) {
      displayEl.textContent = valStr || "0";
      displayEl.classList.toggle("placeholder", !valStr);
    }

    const val = parseFloat(valStr || "0");
    if (subBtn) {
      subBtn.textContent =
        !val || isNaN(val) ? "Subtract" : `Subtract ${formatNumber(val)}`;
    }
    if (addBtn) {
      addBtn.textContent =
        !val || isNaN(val) ? "Add" : `Add ${formatNumber(val)}`;
    }
  };

  const openCalculator = (counterId, { byKeyboard = false } = {}) => {
    const counter = state.counters.find((c) => c.id === counterId);
    const dialog = $("#calculator-dialog");
    if (!counter || !dialog) return;

    state.activeCounterIdForCalc = counterId;
    state.calcPendingOperation = "plus";
    state.calcOpenedByKeyboard = byKeyboard;
    state.calcNumpadValue = "";

    const hexColor = getCounterHex(counter);
    const titleEl = $("#calc-dialog-title");
    titleEl.textContent = `${counter.label}: ${formatNumber(counter.value)}`;

    updateNumpadDisplayDOM();
    setSheetTheme(dialog, hexColor);
    openDialog(dialog);
    playClickSound(600, 700, 0.08, 0.05);
  };

  const setupCalculatorDialog = () => {
    const dialog = $("#calculator-dialog");
    if (!dialog) return;

    // Add or subtract an amount from the active counter, then close
    const applyToActiveCounter = (amount) => {
      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForCalc,
      );
      if (!counter) return;

      const oldValue = counter.value;
      const signedDelta =
        state.calcPendingOperation === "plus" ? amount : -amount;
      counter.value = cleanFloat(counter.value + signedDelta);
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
      if (amount !== 0) {
        state.calcPendingOperation = "plus";
        applyToActiveCounter(amount);
      }
    });

    // Number pad key clicks
    $("#calc-numpad-grid")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-key]");
      if (!btn) return;
      playHaptic(ImpactStyle.Light);
      playClickSound();

      const key = btn.getAttribute("data-key");
      if (key === "clear") {
        state.calcNumpadValue = "";
      } else if (key === ".") {
        if (!state.calcNumpadValue.includes(".")) {
          state.calcNumpadValue = state.calcNumpadValue
            ? `${state.calcNumpadValue}.`
            : "0.";
        }
      } else if (/^[0-9]$/.test(key)) {
        if (state.calcNumpadValue.length < 10) {
          if (state.calcNumpadValue === "0") {
            state.calcNumpadValue = key;
          } else {
            state.calcNumpadValue += key;
          }
        }
      }
      updateNumpadDisplayDOM();
    });

    // Number pad backspace
    $("#calc-numpad-backspace")?.addEventListener("click", () => {
      playHaptic(ImpactStyle.Light);
      playClickSound();
      if (state.calcNumpadValue) {
        state.calcNumpadValue = state.calcNumpadValue.slice(0, -1);
        updateNumpadDisplayDOM();
      }
    });

    // Number pad Add button
    $("#calc-numpad-btn-add")?.addEventListener("click", () => {
      playHaptic(ImpactStyle.Medium);
      const amount = parseFloat(state.calcNumpadValue || "0");
      if (isNaN(amount) || amount === 0) {
        dialog.close();
        return;
      }
      state.calcPendingOperation = "plus";
      applyToActiveCounter(amount);
    });

    // Number pad Subtract button
    $("#calc-numpad-btn-subtract")?.addEventListener("click", () => {
      playHaptic(ImpactStyle.Medium);
      const amount = parseFloat(state.calcNumpadValue || "0");
      if (isNaN(amount) || amount === 0) {
        dialog.close();
        return;
      }
      state.calcPendingOperation = "minus";
      applyToActiveCounter(amount);
    });

    // Physical keyboard support for calculator dialog
    window.addEventListener("keydown", (e) => {
      if (!dialog.open) return;
      if (e.isComposing) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        playHaptic(ImpactStyle.Light);
        playClickSound();
        if (state.calcNumpadValue.length < 10) {
          if (state.calcNumpadValue === "0") {
            state.calcNumpadValue = e.key;
          } else {
            state.calcNumpadValue += e.key;
          }
          updateNumpadDisplayDOM();
        }
      } else if (e.key === ".") {
        e.preventDefault();
        playHaptic(ImpactStyle.Light);
        playClickSound();
        if (!state.calcNumpadValue.includes(".")) {
          state.calcNumpadValue = state.calcNumpadValue
            ? `${state.calcNumpadValue}.`
            : "0.";
          updateNumpadDisplayDOM();
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        playHaptic(ImpactStyle.Light);
        playClickSound();
        if (state.calcNumpadValue) {
          state.calcNumpadValue = state.calcNumpadValue.slice(0, -1);
          updateNumpadDisplayDOM();
        }
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        playHaptic(ImpactStyle.Light);
        playClickSound();
        state.calcNumpadValue = "";
        updateNumpadDisplayDOM();
      } else if (e.key === "+") {
        e.preventDefault();
        $("#calc-numpad-btn-add")?.click();
      } else if (e.key === "-") {
        e.preventDefault();
        $("#calc-numpad-btn-subtract")?.click();
      } else if (e.key === "Enter") {
        e.preventDefault();
        $("#calc-numpad-btn-add")?.click();
      }
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

  // Each card's on-screen box, by counter id, before a change re-renders them
  const cardPositions = () => {
    const positions = {};
    $$("#counters-list-wrapper .counter-card:not(.dragging):not(.drag-ghost)").forEach(
      (card) => {
        const id = card.getAttribute("data-counter-id");
        if (id) positions[id] = card.getBoundingClientRect();
      },
    );
    return positions;
  };

  // Spring each re-rendered card from where it was (see cardPositions) into
  // its new place. Shared by shuffle, drag-reorder, and delete.
  const flipCardsFrom = (firstPositions, { durationMs = 450 } = {}) => {
    if (prefersReducedMotion()) return;
    $$("#counters-list-wrapper .counter-card:not(.dragging):not(.drag-ghost)").forEach(
      (card) => {
        const first = firstPositions[card.getAttribute("data-counter-id")];
        if (!first) return;
        const last = card.getBoundingClientRect();
        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top;
        if (!deltaX && !deltaY) return;

        // INVERT: move the card back to its old position instantly
        card.style.transition = "none";
        card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        card.style.zIndex = "10";

        // PLAY: animate to its new position
        requestAnimationFrame(() => {
          void card.offsetWidth; // Force reflow
          card.style.transition = `transform ${durationMs}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
          card.style.transform = "translate(0, 0)";

          setTimeout(() => {
            card.style.zIndex = "";
            card.style.transition = "";
            card.style.transform = "";
          }, durationMs);
        });
      },
    );
  };

  // Tumble a copy of a card off screen in front of everything, so the card
  // itself can leave the layout at once while the others slide into its place.
  // tilt, drop, and drift are the random ranges (deg, px, px) on top of the base motion.
  const tumbleCardOut = (
    cardEl,
    { delay = 0, tilt = 30, drop = 50, drift = 80 } = {},
  ) => {
    const rect = cardEl.getBoundingClientRect();
    const ghost = cardEl.cloneNode(true);
    ghost.removeAttribute("data-counter-id");
    ghost.classList.remove("animate-entry");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      zIndex: "150", // over the header and nav, under the toast
      pointerEvents: "none",
      viewTransitionName: "none",
    });
    document.body.append(ghost);

    const rotateDir = Math.random() > 0.5 ? 1 : -1;
    const rotateAngle = 25 + Math.random() * tilt;
    const dropY = 180 + Math.random() * drop;
    const dropX = (Math.random() - 0.5) * drift;
    ghost.style.transformOrigin = rotateDir > 0 ? "top left" : "top right";
    ghost
      .animate(
        [
          { transform: "none", opacity: 1 },
          { opacity: 1, offset: 0.2 },
          {
            transform: `translate(${dropX}px, ${dropY}px) rotate(${rotateDir * rotateAngle}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: 500,
          delay: delay * 1000,
          easing: "cubic-bezier(0.55, 0.085, 0.68, 0.53)",
          fill: "backwards",
        },
      )
      .finished.catch(() => {
        /* ignore */
      })
      .finally(() => ghost.remove());
  };

  // Count each card's value up or down from what it showed (fromValues: id ->
  // value) to its current value, slightly staggered, with a small pop as each
  // lands. A card stops counting if anything else changes it meanwhile.
  const countCardsFrom = (fromValues, { delay = 0 } = {}) => {
    if (prefersReducedMotion()) return;
    const DURATION = 600;
    const decimals = (n) => (String(n).split(".")[1] || "").length;
    const cards = [...$$(".counter-card")].filter((card) => {
      const id = card.getAttribute("data-counter-id");
      const counter = state.counters.find((c) => c.id === id);
      return counter && id in fromValues && fromValues[id] !== counter.value;
    });
    const stagger = Math.min(50, 250 / Math.max(cards.length, 1));

    cards.forEach((card, i) => {
      const id = card.getAttribute("data-counter-id");
      const from = fromValues[id];
      const to = state.counters.find((c) => c.id === id).value;
      const places = Math.max(decimals(from), decimals(to));
      const display = card.querySelector(".value-display");
      if (!display) return;
      let shown = formatNumber(from);
      display.textContent = shown;
      let start = null;

      const tick = (now) => {
        // Re-rendered (e.g. Undo) or changed by a tap: leave it be
        if (!display.isConnected || display.textContent !== shown) return;
        start ??= now + delay + i * stagger;
        const p = Math.min(1, Math.max(0, (now - start) / DURATION));
        const eased = 1 - (1 - p) ** 3;
        shown = formatNumber(
          p < 1 ? Number((from + (to - from) * eased).toFixed(places)) : to,
        );
        display.textContent = shown;
        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          display.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.15)", offset: 0.4 },
              { transform: "scale(1)" },
            ],
            { duration: 260, easing: "ease-out" },
          );
        }
      };
      requestAnimationFrame(tick);
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
          // Count down once the confirm sheet has mostly slid away
          countCardsFrom(
            Object.fromEntries(prevValues.map(({ id, value }) => [id, value])),
            { delay: 250 },
          );

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

      if (state.autoSortTimeout) {
        clearTimeout(state.autoSortTimeout);
        state.autoSortTimeout = null;
      }

      // FIRST: Capture current positions for FLIP animation
      const firstPositions = cardPositions();

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
      flipCardsFrom(firstPositions);

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
        if (state.autoSortTimeout) {
          clearTimeout(state.autoSortTimeout);
          state.autoSortTimeout = null;
        }
        // Cards tumble out in a cascade (capped so long lists don't drag on)
        // while the empty state rises in behind the last one
        const cards = [...$$(".counter-card")];
        let lastLeavesMs = 0;
        if (!prefersReducedMotion()) {
          const stagger = Math.min(0.06, 0.6 / cards.length);
          cards.forEach((cardEl, index) => {
            tumbleCardOut(cardEl, {
              delay: index * stagger,
              tilt: 45,
              drop: 80,
              drift: 120,
            });
          });
          lastLeavesMs = ((cards.length - 1) * stagger + 0.5) * 1000;
        }

        const deletedCounters = state.counters;
        const deletedHistory = state.history;
        state.counters = [];
        state.history = [];
        saveCounters();
        saveHistory();
        renderCountersList();
        renderHistory();

        if (lastLeavesMs) {
          $("#btn-empty-placeholder-icon")?.animate(
            [
              { opacity: 0, transform: "translateY(24px) scale(0.96)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 450,
              delay: Math.max(0, lastLeavesMs - 300),
              easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
              fill: "backwards",
            },
          );
        }

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
  const setActiveEditSwatch = (activeSwatch) => {
    $$(".palette-swatch").forEach((s) => {
      const isActive = s === activeSwatch;
      s.classList.toggle("active", isActive);
      if (s.tagName === "BUTTON") {
        s.setAttribute("aria-pressed", isActive ? "true" : "false");
      }
    });
  };

  // Render preset swatches as accessible buttons in the active palette's hue order
  const renderEditPaletteSwatches = () => {
    const paletteContainer = $("#edit-palette-container");
    if (!paletteContainer) return;
    paletteContainer.innerHTML =
      getSwatchesInDisplayOrder()
        .map(
          (swatch) => `
          <button type="button" class="palette-swatch ${swatch.class}" data-color-id="${swatch.id}" aria-label="${swatch.name}" aria-pressed="false" style="background-color: ${swatch.hex}"></button>
        `,
        )
        .join("") +
      `
          <div class="palette-swatch custom-color-picker" data-color-id="custom">
            <svg aria-hidden="true" class="custom-color-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z" />
            </svg>
            <input type="color" id="edit-custom-color" aria-label="Custom color picker">
          </div>
        `;
  };

  // Update Move up / Move down visibility and disabled states for non-drag reordering (#23)
  const syncEditReorderControls = () => {
    const row = $("#edit-reorder-row");
    const upBtn = $("#edit-btn-move-up");
    const downBtn = $("#edit-btn-move-down");
    if (!row || !upBtn || !downBtn) return;

    if (state.settings.autoSort || state.counters.length < 2) {
      row.hidden = true;
      return;
    }

    const idx = state.counters.findIndex(
      (c) => c.id === state.activeCounterIdForEdit,
    );
    if (idx === -1) {
      row.hidden = true;
      return;
    }

    row.hidden = false;
    upBtn.disabled = idx === 0;
    downBtn.disabled = idx === state.counters.length - 1;
  };

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
      renderEditPaletteSwatches();

      // Swatch Click bind
      paletteContainer.addEventListener("click", (e) => {
        const swatch = e.target.closest(".palette-swatch");
        if (!swatch) return;

        setActiveEditSwatch(swatch);

        // Dynamically update sheet theme color
        const colorId = swatch.getAttribute("data-color-id");
        if (colorId === "custom") {
          const customInput = $("#edit-custom-color");
          if (customInput) setSheetTheme(dialog, customInput.value);
        } else {
          const swatches = getSwatches();
          const swatchData = swatches[parseInt(colorId, 10)] || swatches[0];
          setSheetTheme(dialog, swatchData.hex);
        }

        playClickSound();
        playSelectionHaptic();
      });

      paletteContainer.addEventListener("input", (e) => {
        if (e.target.id !== "edit-custom-color") return;
        const swatch = e.target.closest(".palette-swatch");
        if (swatch) {
          swatch.style.backgroundColor = e.target.value;
          setActiveEditSwatch(swatch);
          setSheetTheme(dialog, e.target.value);
        }
      });
    }

    // Non-drag counter reordering (#23)
    const moveActiveCounter = (delta) => {
      if (state.settings.autoSort) return;
      const fromIdx = state.counters.findIndex(
        (c) => c.id === state.activeCounterIdForEdit,
      );
      const toIdx = fromIdx + delta;
      if (fromIdx === -1 || toIdx < 0 || toIdx >= state.counters.length) return;

      const wasFocusedOnUp = document.activeElement?.id === "edit-btn-move-up";
      const wasFocusedOnDown =
        document.activeElement?.id === "edit-btn-move-down";

      const firstPositions = cardPositions();
      const [movedCounter] = state.counters.splice(fromIdx, 1);
      state.counters.splice(toIdx, 0, movedCounter);
      saveCounters();
      renderCountersList();
      flipCardsFrom(firstPositions);
      syncEditReorderControls();

      // If keyboard focus was on a move button that just hit the end and became
      // disabled, keep focus in the pair by shifting to the opposite button.
      if (wasFocusedOnUp && $("#edit-btn-move-up")?.disabled) {
        $("#edit-btn-move-down")?.focus();
      } else if (wasFocusedOnDown && $("#edit-btn-move-down")?.disabled) {
        $("#edit-btn-move-up")?.focus();
      }

      announce(
        `${movedCounter.label} moved to position ${toIdx + 1} of ${state.counters.length}`,
      );
      playHaptic(ImpactStyle.Light);
      playClickSound(500, 650, 0.06, 0.04);
    };

    $("#edit-btn-move-up")?.addEventListener("click", () =>
      moveActiveCounter(-1),
    );
    $("#edit-btn-move-down")?.addEventListener("click", () =>
      moveActiveCounter(1),
    );

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
          colorId = parseInt(dataColorId, 10);
        }
      }

      const label = $("#edit-label").value.trim();
      const increment = cleanFloat(
        parseFloat($("#edit-increment").value || "1"),
      );
      const resetValue = cleanFloat(
        parseFloat($("#edit-reset-val").value || "0"),
      );
      // "Reset to N" saves the other edits too, with the value set to N
      const isReset = resetRequested;
      resetRequested = false;
      const value = isReset
        ? resetValue
        : cleanFloat(parseFloat($("#edit-value-input-details").value || "0"));

      // Edit existing counter
      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForEdit,
      );
      const valueBefore = counter?.value;
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
        // Count down once the edit sheet has mostly slid away
        if (counter) countCardsFrom({ [counter.id]: valueBefore }, { delay: 250 });
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

          const completeDeletion = () => {
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

          // The card tumbles out in front while the rest slide into place
          const firstPositions = cardPositions();
          if (cardEl && !prefersReducedMotion()) tumbleCardOut(cardEl);
          completeDeletion();
          flipCardsFrom(firstPositions);
        }
      });
    });
  };

  const setupEditValueDialog = () => {
    const dialog = $("#edit-value-dialog");
    const form = $("#edit-value-form");
    const input = $("#edit-value-input");

    if (!dialog || !form) return;

    if (input) {
      input.addEventListener("focus", () => {
        const valueAtFocus = input.value;
        setTimeout(() => {
          if (document.activeElement === input && input.value === valueAtFocus) {
            input.select();
          }
        }, 50);
      });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const newValueStr = $("#edit-value-input").value;
      if (newValueStr === "") return;
      const newValue = cleanFloat(parseFloat(newValueStr));

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
    const usedLabels = state.counters.map((c) => c.label);
    const unusedLabels = labelChoices.filter(
      (label) => !usedLabels.includes(label),
    );
    const label =
      unusedLabels.length > 0
        ? unusedLabels[Math.floor(Math.random() * unusedLabels.length)]
        : labelChoices[Math.floor(Math.random() * labelChoices.length)];

    const newCounter = {
      id: createId(),
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
    playHaptic(ImpactStyle.Light);
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
    syncEditReorderControls();

    // Set palette swatch selected
    const isCustom = isCustomColor(counter.color);
    const sheetThemeHex = getCounterHex(counter);
    const swatches = getSwatches();
    $$(".palette-swatch").forEach((swatch) => {
      const colorId = swatch.getAttribute("data-color-id");
      const isSelected = isCustom
        ? colorId === "custom"
        : parseInt(colorId, 10) === counter.color;
      swatch.classList.toggle("active", isSelected);
      if (swatch.tagName === "BUTTON") {
        swatch.setAttribute("aria-pressed", isSelected ? "true" : "false");
      }
      // Preset swatches follow the active palette
      if (swatches[colorId]) {
        swatch.style.backgroundColor = swatches[colorId].hex;
        swatch.setAttribute("aria-label", swatches[colorId].name);
      }
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
        nameInput.focus({ preventScroll: true });
        nameInput.select();
      }

      playClickSound();
    }
  };

  // ------------------------------------------------------------------------
  // 14. Settings Dialog Data Binder
  // ------------------------------------------------------------------------
  const syncThemeSetting = () => {
    const activeTheme = state.settings.theme || "system";
    $$("#setting-theme-group [data-theme-opt]").forEach((btn) => {
      const isActive = btn.getAttribute("data-theme-opt") === activeTheme;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-checked", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
  };

  // Render the 2-column palette picker cards with live rainbow-sorted swatch previews
  const renderPaletteSetting = () => {
    const group = $("#setting-palette-group");
    if (!group) return;
    const activeKey = palettes[state.settings.palette]
      ? state.settings.palette
      : "bold";
    group.innerHTML = Object.entries(palettes)
      .map(([key, { label, colors }]) => {
        const isActive = key === activeKey;
        const sorted = sortColorsByHue(colors);
        return `
          <button
            type="button"
            class="palette-option-card${isActive ? " active" : ""}"
            role="radio"
            aria-checked="${isActive ? "true" : "false"}"
            tabindex="${isActive ? "0" : "-1"}"
            data-palette-opt="${key}"
          >
            <span class="palette-option-name">${label}</span>
            <span class="palette-preview"${isActive ? ' id="setting-palette-preview"' : ""} aria-hidden="true">${sorted
              .map((hex) => `<span style="background-color: ${hex}"></span>`)
              .join("")}</span>
          </button>
        `;
      })
      .join("");
  };

  const loadSettingsIntoDOM = () => {
    $("#setting-sound").checked = state.settings.soundEnabled;
    const hapticSetting = $("#setting-haptic");
    const hapticRow = $("#setting-row-haptic");
    if (hapticSetting) {
      if (supportsHaptics()) {
        hapticSetting.checked = state.settings.hapticsEnabled;
        if (hapticRow) hapticRow.style.display = "";
      } else if (hapticRow) {
        hapticRow.style.display = "none";
      }
    }
    const keepAwakeEl = $("#setting-keep-awake");
    if (keepAwakeEl) keepAwakeEl.checked = state.settings.keepAwake;
    syncThemeSetting();
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
      playSelectionHaptic();
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
            log.warn("KeepAwake enable failed:", err),
          );
        } else {
          KeepAwake.allowSleep().catch((err) =>
            log.warn("KeepAwake disable failed:", err),
          );
        }
        playClickSound();
        playSelectionHaptic();
      });
    }

    // Theme Hue Slider with 15-degree haptic detents
    const hueSlider = $("#setting-theme-hue");
    if (hueSlider) {
      let lastDetent = Math.round((state.settings.themeHue ?? 205) / 15);
      hueSlider.addEventListener("input", (e) => {
        const hue = Number(e.target.value);
        applyAccentTokens(hue);
        const detent = Math.round(hue / 15);
        if (detent !== lastDetent) {
          lastDetent = detent;
          playSelectionHaptic();
        }
      });
      hueSlider.addEventListener("change", (e) => {
        state.settings.themeHue = parseInt(e.target.value, 10);
        applyAccentTokens(state.settings.themeHue);
        saveSettings();
        playClickSound();
      });
    }

    const selectPalette = (key, { focus = false } = {}) => {
      if (!palettes[key] || state.settings.palette === key) return;
      state.settings.palette = key;
      saveSettings();
      renderPaletteSetting();
      renderEditPaletteSwatches();
      renderCountersList();
      playClickSound();
      playSelectionHaptic();
      if (focus) {
        $(`#setting-palette-group [data-palette-opt="${key}"]`)?.focus();
      }
    };

    // Palette card grid (click + radiogroup arrow keys)
    const paletteGroup = $("#setting-palette-group");
    if (paletteGroup) {
      renderPaletteSetting();
      paletteGroup.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-palette-opt]");
        if (!btn) return;
        selectPalette(btn.getAttribute("data-palette-opt"));
      });
      paletteGroup.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key))
          return;
        e.preventDefault();
        const keys = Object.keys(palettes);
        const cur = palettes[state.settings.palette]
          ? state.settings.palette
          : "bold";
        const idx = keys.indexOf(cur);
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const nextKey = keys[(idx + step + keys.length) % keys.length];
        selectPalette(nextKey, { focus: true });
      });
    }

    const selectTheme = (theme, { focus = false } = {}) => {
      if (!["system", "dark", "light"].includes(theme)) return;
      if (state.settings.theme === theme) return;
      state.settings.theme = theme;
      saveSettings();
      applyTheme(theme);
      syncThemeSetting();
      playClickSound();
      playSelectionHaptic();
      if (focus) {
        $(`#setting-theme-group [data-theme-opt="${theme}"]`)?.focus();
      }
    };

    // Theme segmented control (click + radiogroup arrow keys)
    const themeGroup = $("#setting-theme-group");
    if (themeGroup) {
      syncThemeSetting();
      themeGroup.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-theme-opt]");
        if (!btn) return;
        selectTheme(btn.getAttribute("data-theme-opt"));
      });
      themeGroup.addEventListener("keydown", (e) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(e.key))
          return;
        e.preventDefault();
        const opts = ["system", "dark", "light"];
        const idx = opts.indexOf(state.settings.theme || "system");
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const nextOpt = opts[(idx + step + opts.length) % opts.length];
        selectTheme(nextOpt, { focus: true });
      });
    }

    // Quick Add Calculator custom items
    $("#setting-quick-add-values").addEventListener("input", (e) => {
      const input = e.target;
      const feedback = $("#quick-add-feedback");
      const tokens = input.value.split(",").map((t) => t.trim());
      const nonEmpty = tokens.filter((t) => t !== "");
      // Positive integers or decimals: reject partial strings like "7abc" or "2."
      const invalid = nonEmpty.filter(
        (t) => !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(t) || parseFloat(t) <= 0,
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

      const valid = nonEmpty.map((t) => parseFloat(t));
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
      dialog.addEventListener("close", tryReleaseBackgroundViewport);

      // Keep focus in the field when a button or swatch inside a sheet is
      // tapped while typing. Otherwise mousedown blurs the field, the keyboard
      // starts closing, the sheet moves mid-tap, and iOS drops the tap.
      if (dialog.classList.contains("bottom-sheet-dialog")) {
        dialog.addEventListener("mousedown", (e) => {
          const typing = document.activeElement?.matches("input, textarea");
          const control = e.target.closest(
            "button, .palette-swatch:not(.custom-color-picker)",
          );
          if (typing && control && dialog.contains(document.activeElement)) {
            e.preventDefault();
          }
        });
      }

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
      id: createId(),
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

    // Bottom Nav clicks and WAI-ARIA tablist keyboard navigation
    $$("[data-tab-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab-btn");
        if (tab === state.currentTab) return;
        switchTab(tab);
      });
    });

    $(".app-nav")?.addEventListener("keydown", (e) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      const idx = TABS.indexOf(state.currentTab);
      if (idx === -1) return;
      e.preventDefault();
      let nextIdx = idx;
      if (e.key === "ArrowRight") nextIdx = (idx + 1) % TABS.length;
      else if (e.key === "ArrowLeft")
        nextIdx = (idx - 1 + TABS.length) % TABS.length;
      else if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = TABS.length - 1;
      const nextTab = TABS[nextIdx];
      switchTab(nextTab);
      $(`[data-tab-btn="${nextTab}"]`)?.focus();
    });

    // Native scroll observer for Swipe detection & real-time header/nav synchronization
    const tabsSlider = $("#tabs-slider");
    if (tabsSlider) {
      let scrollRaf = null;

      const syncTabFromScroll = () => {
        const width = tabsSlider.clientWidth;
        if (!width) return;
        const index = Math.round(tabsSlider.scrollLeft / width);
        const currentVisibleTab = TABS[Math.min(Math.max(index, 0), TABS.length - 1)];

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
            if (TABS.includes(tabId) && state.currentTab !== tabId) {
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
    }

    const listWrapper = $("#counters-list-wrapper");
    if (listWrapper) {
      listWrapper.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
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
              const titleEl = $("#edit-value-title");
              if (titleEl) {
                titleEl.textContent = `Edit ${counter.label} value`;
              }
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
                  if (valueInput) {
                    valueInput.focus({ preventScroll: true });
                    valueInput.select();
                  }
                }, 50);
                playClickSound();
                playHaptic(ImpactStyle.Medium);
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
        counter.value = cleanFloat(counter.value + (isPlus ? step : -step));
        announceValue(counter);
        saveCounters();
        addHistoryLog(
          counter,
          `${isPlus ? "+" : "−"}${formatNumber(step)}`,
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
    // The dice behind the result on screen, e.g. "2d6" (null before a roll)
    let rolledDice = null;

    const syncDiceStepperButtons = () => {
      if (btnDiceMinus) btnDiceMinus.disabled = currentDiceCount <= 1;
      if (btnDicePlus) btnDicePlus.disabled = currentDiceCount >= 20;
    };
    syncDiceStepperButtons();

    const updateRollButtonLabel = () => {
      const dice = `${currentDiceCount}d${currentDiceType}`;
      if (btnRollAction) {
        btnRollAction.textContent = `Roll ${dice}`;
      }
      // Highlight the result only while it matches the selected dice
      diceResultCard?.classList.toggle("rolled", rolledDice === dice);
    };

    if (diceTypeSelector) {
      const typeButtons = diceTypeSelector.querySelectorAll(".dice-type-btn");
      typeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          playHaptic(ImpactStyle.Light);
          typeButtons.forEach((b) => {
            const isActive = b === btn;
            b.classList.toggle("active", isActive);
            b.setAttribute("aria-pressed", isActive ? "true" : "false");
          });
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
          syncDiceStepperButtons();
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
          syncDiceStepperButtons();
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
          rolledDice = `${currentDiceCount}d${currentDiceType}`;
          diceResultCard.classList.add("rolled");
          announce(`Rolled ${rolledDice}: ${total}`);

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
        // Blue border while it holds a time, like a fresh dice result
        swDisplay
          .closest(".placeholder-timer-visual")
          ?.classList.toggle("has-time", totalMs > 0);
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
  // 18b. Sheet Swipe/Drag to Dismiss Logic (velocity flick + rubber-banding)
  // ------------------------------------------------------------------------
  const setupBottomSheetDragging = () => {
    $$(".bottom-sheet-dialog").forEach((dialog) => {
      const header = dialog.querySelector(".bottom-sheet-header");
      const body = dialog.querySelector(".bottom-sheet-body");
      if (!header) return;

      let startX = 0;
      let startY = 0;
      let currentY = 0;
      let lastY = 0;
      let lastTime = 0;
      let velocityY = 0;
      let isDragging = false;
      let captureEl = null;
      let bodyPullCandidate = false;
      let activePointerId = null;

      const dismissSheet = () => {
        if (prefersReducedMotion()) {
          // Keep the released offset while fading out so it doesn't snap up first
          dialog.addEventListener(
            "close",
            () => {
              setTimeout(() => {
                if (!dialog.open) dialog.style.transform = "";
              }, 160);
            },
            { once: true },
          );
        } else {
          dialog.style.transform = "";
        }
        dialog.close();
        playClickSound(450, 350, 0.05, 0.03); // light close sound
      };

      const applySheetOffset = (deltaY, now) => {
        if (lastTime > 0) {
          const dt = Math.max(1, now - lastTime);
          const instVel = (deltaY - (lastY - startY)) / dt;
          velocityY = velocityY * 0.4 + instVel * 0.6;
        }
        lastY = startY + deltaY;
        lastTime = now;

        if (deltaY > 0) {
          currentY = deltaY;
          dialog.style.transform = `translate(-50%, ${deltaY}px)`;
        } else if (deltaY < 0 && !prefersReducedMotion()) {
          // Damped upward rubber-band resistance so sheets feel physically weighted
          const damped = -Math.min(18, Math.pow(-deltaY, 0.7) * 1.4);
          currentY = damped;
          dialog.style.transform = `translate(-50%, ${damped.toFixed(1)}px)`;
        } else {
          currentY = 0;
          dialog.style.transform = "";
        }
      };

      const endDragging = (e) => {
        bodyPullCandidate = false;
        if (!isDragging) return;
        isDragging = false;
        dialog.classList.remove("dragging");

        if (captureEl && e && e.pointerId !== undefined) {
          try {
            captureEl.releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        captureEl = null;
        activePointerId = null;

        // Dismiss if pulled past 100px OR flicked briskly downward
        if (currentY > 100 || (currentY > 28 && velocityY > 0.55)) {
          dismissSheet();
        } else {
          // Snap back smoothly
          dialog.style.transform = "";
        }
        currentY = 0;
        velocityY = 0;
      };

      header.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (e.target.closest("button, input, select, textarea, a")) return;

        startX = e.clientX;
        startY = e.clientY;
        lastY = e.clientY;
        lastTime = e.timeStamp || performance.now();
        velocityY = 0;
        isDragging = true;
        captureEl = header;
        activePointerId = e.pointerId;
        dialog.classList.add("dragging");
        try {
          header.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      });

      header.addEventListener("pointermove", (e) => {
        if (!isDragging || captureEl !== header) return;
        applySheetOffset(e.clientY - startY, e.timeStamp || performance.now());
      });

      header.addEventListener("pointerup", endDragging);
      header.addEventListener("pointercancel", endDragging);

      // Allow pulling down from the sheet body when scrolled to the very top
      if (body) {
        body.addEventListener("pointerdown", (e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          if (
            e.target.closest(
              "button, input, select, textarea, a, label, .palette-swatch, .hue-slider",
            )
          )
            return;
          if (body.scrollTop > 0) return;

          bodyPullCandidate = true;
          activePointerId = e.pointerId;
          startX = e.clientX;
          startY = e.clientY;
          lastY = e.clientY;
          lastTime = e.timeStamp || performance.now();
          velocityY = 0;
        });

        body.addEventListener("pointermove", (e) => {
          if (e.pointerId !== activePointerId) return;
          if (bodyPullCandidate && !isDragging) {
            if (body.scrollTop > 0) {
              bodyPullCandidate = false;
              return;
            }
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
              bodyPullCandidate = false;
              return;
            }
            if (dy > 10) {
              bodyPullCandidate = false;
              isDragging = true;
              captureEl = body;
              startY = e.clientY;
              lastY = e.clientY;
              lastTime = e.timeStamp || performance.now();
              dialog.classList.add("dragging");
              try {
                body.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }
            return;
          }
          if (!isDragging || captureEl !== body) return;
          if (e.cancelable) e.preventDefault();
          applySheetOffset(e.clientY - startY, e.timeStamp || performance.now());
        });

        body.addEventListener("pointerup", endDragging);
        body.addEventListener("pointercancel", endDragging);
      }
    });
  };

  // ------------------------------------------------------------------------
  // 18b. First-player Picker tab (Chwazi-style multi-touch selector)
  // ------------------------------------------------------------------------
  const PICKER_SHAPES = [
    {
      name: "triangle",
      markup:
        '<polygon class="picker-shape-path" points="50.00,6.00 88.11,72.00 11.89,72.00" />',
    },
    {
      name: "square",
      markup:
        '<rect class="picker-shape-path" x="19" y="19" width="62" height="62" rx="7" />',
    },
    {
      name: "diamond",
      markup:
        '<polygon class="picker-shape-path" points="50,7 77,50 50,93 23,50" />',
    },
    {
      name: "pentagon",
      markup:
        '<polygon class="picker-shape-path" points="50.00,7.50 90.42,36.87 74.98,84.38 25.02,84.38 9.58,36.87" />',
    },
    {
      name: "hexagon",
      markup:
        '<polygon class="picker-shape-path" points="50.00,7.50 86.81,28.75 86.81,71.25 50.00,92.50 13.19,71.25 13.19,28.75" />',
    },
    {
      name: "star",
      markup:
        '<polygon class="picker-shape-path" points="50.00,6.00 61.46,34.22 91.85,36.40 68.55,56.03 75.86,85.60 50.00,69.50 24.14,85.60 31.45,56.03 8.15,36.40 38.54,34.22" />',
    },
    {
      name: "octagon",
      markup:
        '<polygon class="picker-shape-path" points="50.00,7.00 61.86,21.36 80.41,19.59 78.64,38.14 93.00,50.00 78.64,61.86 80.41,80.41 61.86,78.64 50.00,93.00 38.14,78.64 19.59,80.41 21.36,61.86 7.00,50.00 21.36,38.14 19.59,19.59 38.14,21.36" />',
    },
    {
      name: "cross",
      markup:
        '<path class="picker-shape-path" d="M36,10 H64 V36 H90 V64 H64 V90 H36 V64 H10 V36 H36 Z" />',
    },
    {
      name: "heart",
      markup:
        '<path class="picker-shape-path" d="M50,90.94 C47.15,88.09 13.9,66.25 13.9,42.5 C13.9,29.2 24.35,20.65 35.75,20.65 C43.35,20.65 48.1,25.4 50,30.15 C51.9,25.4 56.65,20.65 64.25,20.65 C75.65,20.65 86.1,29.2 86.1,42.5 C86.1,66.25 52.85,88.09 50,90.94 Z" />',
    },
  ];

  const setupPicker = () => {
    const stage = $("#picker-stage");
    const circlesLayer = $("#picker-circles");
    const particlesLayer = $("#picker-particles");
    const winnerBgEl = $("#picker-winner-bg");
    const promptEl = $("#picker-prompt");
    const promptTitle = $("#picker-prompt-title");
    const promptSubtitle = $("#picker-prompt-subtitle");
    const statusEl = $("#picker-status");
    const tabsSlider = $("#tabs-slider");
    if (!stage || !circlesLayer) return;

    const PICKER_COUNTDOWN_MS = 3000;
    const PICKER_MIN_FINGERS = 2;
    const PICKER_EXPLOSION_STAGGER_MS = 140;
    const PICKER_PARTICLE_COUNT = 14;
    const ROTATION_MIN_DEG_PER_SEC = 36;
    // Stay below 60Hz/120Hz wagon-wheel stroboscopic harmonics (e.g. 5x14.4°=72° at 864°/s)
    const ROTATION_MAX_DEG_PER_SEC = 500;
    const ROTATION_SETTLED_DEG_PER_SEC = 24;
    const SWIPE_TRIGGER_PX = 64;
    const SWIPE_FLICK_PX = 36;
    const SWIPE_FLICK_VELOCITY = 0.3; // px/ms
    const SWIPE_AXIS_RATIO = 1.5;

    let phase = "idle"; // 'idle' | 'waiting' | 'counting' | 'eliminating' | 'selected'
    const touches = new Map(); // pointerId -> { x, y, color, slot, shape, shapeSlot, angle, direction, el }
    const heldPointers = new Set(); // pointerIds still down during 'eliminating' / 'selected'
    let swipeCandidate = null; // { pointerId, startX, startY, startTime }
    let roundColorOrder = [];
    let roundShapeOrder = [];
    let fallbackColorIndex = 0;
    let fallbackShapeIndex = 0;
    let nextDirection = 1;
    let countdownTimer = null;
    let countdownStartedAt = null;
    let eliminationTimers = [];
    let rotationRaf = null;
    let lastRotationTime = null;

    const shuffleIndices = (length) => {
      const slots = Array.from({ length }, (_, i) => i);
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }
      return slots;
    };

    const playPickerHaptic = (level) => {
      playHaptic(level === "major" ? ImpactStyle.Heavy : ImpactStyle.Light);
    };

    // Multi-touch needs a touchscreen; a mouse can only ever place one finger
    const hasTouchInput = () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(any-pointer: coarse)").matches;

    const setSliderLocked = (locked) => {
      if (!tabsSlider) return;
      if (locked) {
        const pickerPanel = document.getElementById("tab-picker");
        if (pickerPanel) {
          const targetX = pickerPanel.offsetLeft - tabsSlider.offsetLeft;
          if (Math.abs(tabsSlider.scrollLeft - targetX) > 1) {
            tabsSlider.scrollTo({ left: targetX, behavior: "instant" });
          }
        }
      }
      tabsSlider.style.overflowX = locked ? "hidden" : "";
    };

    const clearCountdown = () => {
      if (countdownTimer !== null) {
        clearTimeout(countdownTimer);
        countdownTimer = null;
      }
      countdownStartedAt = null;
    };

    const clearEliminationTimers = () => {
      eliminationTimers.forEach((id) => clearTimeout(id));
      eliminationTimers = [];
    };

    const stopRotationLoop = () => {
      if (rotationRaf !== null) {
        cancelAnimationFrame(rotationRaf);
        rotationRaf = null;
      }
      lastRotationTime = null;
      delete stage.dataset.rotationSpeed;
    };

    const getRotationSpeed = (now) => {
      if (phase === "counting" && countdownStartedAt !== null) {
        const progress = Math.min(1, Math.max(0, (now - countdownStartedAt) / PICKER_COUNTDOWN_MS));
        return (
          ROTATION_MIN_DEG_PER_SEC +
          (ROTATION_MAX_DEG_PER_SEC - ROTATION_MIN_DEG_PER_SEC) * Math.pow(progress, 1.25)
        );
      }
      if (phase === "eliminating") return ROTATION_MAX_DEG_PER_SEC;
      if (phase === "selected") return ROTATION_SETTLED_DEG_PER_SEC;
      return ROTATION_MIN_DEG_PER_SEC;
    };

    const stepRotation = () => {
      rotationRaf = null;
      if (touches.size === 0 || prefersReducedMotion()) {
        lastRotationTime = null;
        return;
      }
      const now = performance.now();
      const dt = lastRotationTime === null ? 0 : Math.min(0.1, Math.max(0, (now - lastRotationTime) / 1000));
      lastRotationTime = now;

      const speed = getRotationSpeed(now);
      stage.dataset.rotationSpeed = speed.toFixed(1);

      touches.forEach((entry) => {
        entry.angle = (entry.angle + entry.direction * speed * dt) % 360;
        entry.el.style.setProperty("--rot", `${entry.angle.toFixed(2)}deg`);
      });

      rotationRaf = requestAnimationFrame(stepRotation);
    };

    const startRotationLoop = () => {
      if (prefersReducedMotion()) return;
      const now = performance.now();
      stage.dataset.rotationSpeed = getRotationSpeed(now).toFixed(1);
      if (rotationRaf !== null) return;
      lastRotationTime = now;
      rotationRaf = requestAnimationFrame(stepRotation);
    };

    const updatePrompt = () => {
      if (!promptEl) return;
      if (phase === "idle") {
        promptEl.classList.remove("hidden");
        if (promptTitle) promptTitle.textContent = "Place fingers to choose";
        if (promptSubtitle) {
          promptSubtitle.textContent = hasTouchInput()
            ? "2 or more players"
            : "Needs a touchscreen";
        }
      } else if (phase === "waiting") {
        promptEl.classList.remove("hidden");
        if (promptTitle) promptTitle.textContent = "Waiting for another player";
        if (promptSubtitle) promptSubtitle.textContent = "Hold to choose";
      } else {
        promptEl.classList.add("hidden");
      }
    };

    const shuffleRoundPools = () => {
      const activePalette = palettes[state.settings.palette] || palettes.bold;
      roundColorOrder = shuffleIndices(activePalette.colors.length);
      roundShapeOrder = shuffleIndices(PICKER_SHAPES.length);
      fallbackColorIndex = 0;
      fallbackShapeIndex = 0;
      nextDirection = 1;
    };

    const allocateColor = () => {
      const activePalette = palettes[state.settings.palette] || palettes.bold;
      const usedSlots = new Set();
      touches.forEach((entry) => {
        if (entry.slot !== null) usedSlots.add(entry.slot);
      });
      for (const slot of roundColorOrder) {
        if (!usedSlots.has(slot) && activePalette.colors[slot]) {
          return { color: activePalette.colors[slot], slot };
        }
      }
      // Fallback for 9+ simultaneous fingers: golden-angle spaced HSL hues
      // (as hex so getReadableTextColor can pick the winner's ink)
      const hue = Math.round(((++fallbackColorIndex) * 137.508) % 360);
      return { color: hslToHex(hue, 78, 54), slot: null };
    };

    const allocateShape = () => {
      const usedShapeSlots = new Set();
      touches.forEach((entry) => {
        if (entry.shapeSlot !== null) usedShapeSlots.add(entry.shapeSlot);
      });
      for (const shapeSlot of roundShapeOrder) {
        if (!usedShapeSlots.has(shapeSlot) && PICKER_SHAPES[shapeSlot]) {
          return { shape: PICKER_SHAPES[shapeSlot], shapeSlot };
        }
      }
      const fallbackSlot = fallbackShapeIndex++ % PICKER_SHAPES.length;
      return { shape: PICKER_SHAPES[fallbackSlot], shapeSlot: null };
    };

    const positionCircle = (entry, clientX, clientY) => {
      const rect = stage.getBoundingClientRect();
      entry.x = clientX - rect.left;
      entry.y = clientY - rect.top;
      entry.el.style.setProperty("--x", `${entry.x}px`);
      entry.el.style.setProperty("--y", `${entry.y}px`);
    };

    const spawnGeometricExplosion = (entry) => {
      if (!particlesLayer || prefersReducedMotion()) return;
      const shapeDef = PICKER_SHAPES.find((s) => s.name === entry.shape) || PICKER_SHAPES[0];

      for (let i = 0; i < PICKER_PARTICLE_COUNT; i++) {
        const particle = document.createElement("div");
        particle.className = "picker-particle";
        particle.dataset.color = entry.color;
        particle.dataset.shape = shapeDef.name;
        const size = 12 + Math.round(Math.random() * 14);
        particle.style.setProperty("--particle-color", entry.color);
        particle.style.setProperty("--particle-size", `${size}px`);
        particle.innerHTML = `<svg aria-hidden="true" viewBox="0 0 100 100">${shapeDef.markup}</svg>`;
        particlesLayer.appendChild(particle);

        const baseAngle = (Math.PI * 2 * i) / PICKER_PARTICLE_COUNT;
        const angle = baseAngle + (Math.random() - 0.5) * 0.45;
        const distance = 70 + Math.random() * 85;
        const endX = entry.x + Math.cos(angle) * distance;
        const endY = entry.y + Math.sin(angle) * distance;
        const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 220);

        if (typeof particle.animate === "function") {
          const anim = particle.animate(
            [
              {
                transform: `translate3d(${entry.x - size / 2}px, ${entry.y - size / 2}px, 0) rotate(0deg) scale(1)`,
                opacity: 1,
              },
              {
                transform: `translate3d(${endX - size / 2}px, ${endY - size / 2}px, 0) rotate(${spin.toFixed(0)}deg) scale(0.15)`,
                opacity: 0,
              },
            ],
            {
              duration: 520,
              easing: "cubic-bezier(0.16, 1, 0.3, 1)",
              fill: "forwards",
            },
          );
          anim.onfinish = () => particle.remove();
          anim.oncancel = () => particle.remove();
        } else {
          particle.remove();
        }
      }
    };

    const finalizeWinner = (winnerId) => {
      const winner = touches.get(winnerId);
      if (!winner) {
        resetPicker();
        return;
      }

      phase = "selected";
      const ink = getReadableTextColor(winner.color);
      winner.el.style.setProperty("--winner-ink", ink);
      winner.el.classList.add("is-winner");

      if (winnerBgEl) {
        winnerBgEl.style.setProperty("--winner-bg", winner.color);
        winnerBgEl.style.setProperty("--winner-x", `${winner.x}px`);
        winnerBgEl.style.setProperty("--winner-y", `${winner.y}px`);
        winnerBgEl.classList.add("active");
      }

      playPickerHaptic("major");
      if (statusEl) {
        const activePalette = palettes[state.settings.palette] || palettes.bold;
        const colorName = winner.slot !== null ? activePalette.names?.[winner.slot] : null;
        statusEl.textContent = colorName
          ? `${colorName} ${winner.shape} selected`
          : `${winner.shape[0].toUpperCase()}${winner.shape.slice(1)} selected`;
      }
      updatePrompt();
    };

    const selectPickerWinner = () => {
      countdownTimer = null;
      countdownStartedAt = null;
      const ids = Array.from(touches.keys());
      if (ids.length < PICKER_MIN_FINGERS) {
        phase = ids.length === 1 ? "waiting" : "idle";
        updatePrompt();
        return;
      }

      const winnerId = ids[Math.floor(Math.random() * ids.length)];
      heldPointers.clear();
      ids.forEach((id) => heldPointers.add(id));

      const loserIds = ids.filter((id) => id !== winnerId);
      // Shuffle elimination order so defeated shapes pop in a fresh order
      for (let i = loserIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [loserIds[i], loserIds[j]] = [loserIds[j], loserIds[i]];
      }

      if (prefersReducedMotion()) {
        loserIds.forEach((id) => {
          const entry = touches.get(id);
          if (entry) {
            entry.el.remove();
            touches.delete(id);
          }
        });
        finalizeWinner(winnerId);
        return;
      }

      phase = "eliminating";
      clearEliminationTimers();

      loserIds.forEach((id, index) => {
        const timerId = setTimeout(() => {
          const entry = touches.get(id);
          if (!entry) return;
          entry.el.remove();
          touches.delete(id);
          spawnGeometricExplosion(entry);
        }, index * PICKER_EXPLOSION_STAGGER_MS);
        eliminationTimers.push(timerId);
      });

      const revealTimerId = setTimeout(() => {
        finalizeWinner(winnerId);
      }, loserIds.length * PICKER_EXPLOSION_STAGGER_MS);
      eliminationTimers.push(revealTimerId);
    };

    const schedulePickerSelection = () => {
      clearCountdown();
      countdownStartedAt = performance.now();
      countdownTimer = setTimeout(selectPickerWinner, PICKER_COUNTDOWN_MS);
      if (!prefersReducedMotion()) {
        stage.dataset.rotationSpeed = ROTATION_MIN_DEG_PER_SEC.toFixed(1);
      }
    };

    resetPicker = ({ immediate = false } = {}) => {
      clearCountdown();
      clearEliminationTimers();
      stopRotationLoop();
      touches.forEach((entry) => entry.el.remove());
      touches.clear();
      heldPointers.clear();
      swipeCandidate = null;
      phase = "idle";
      setSliderLocked(false);
      if (particlesLayer) particlesLayer.innerHTML = "";
      if (winnerBgEl) {
        winnerBgEl.classList.remove("active");
        if (immediate) {
          winnerBgEl.style.removeProperty("--winner-bg");
          winnerBgEl.style.removeProperty("--winner-x");
          winnerBgEl.style.removeProperty("--winner-y");
        }
      }
      if (statusEl) statusEl.textContent = "";
      updatePrompt();
    };

    const trySingleFingerSwipe = (e, isRelease = false) => {
      if (!swipeCandidate || swipeCandidate.pointerId !== e.pointerId) return false;
      if (phase !== "waiting" || touches.size !== 1) {
        swipeCandidate = null;
        return false;
      }
      const dx = e.clientX - swipeCandidate.startX;
      const dy = e.clientY - swipeCandidate.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX <= absY * SWIPE_AXIS_RATIO) return false;

      const pickerIdx = TABS.indexOf("picker");
      const targetTab = dx > 0 ? TABS[pickerIdx - 1] : TABS[pickerIdx + 1];
      if (!targetTab) return false;

      const elapsed = Math.max(1, performance.now() - swipeCandidate.startTime);
      const isDragSwipe = absX >= SWIPE_TRIGGER_PX;
      const isFlickSwipe =
        isRelease && absX >= SWIPE_FLICK_PX && absX / elapsed >= SWIPE_FLICK_VELOCITY;
      if (!isDragSwipe && !isFlickSwipe) return false;

      resetPicker();
      switchTab(targetTab);
      return true;
    };

    const addPickerTouch = (e) => {
      if (state.currentTab !== "picker") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (phase === "eliminating" || phase === "selected" || touches.has(e.pointerId)) return;
      e.stopPropagation();

      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const wasIdle = phase === "idle";
      if (wasIdle) {
        shuffleRoundPools();
        setSliderLocked(true);
      }

      const { color, slot } = allocateColor();
      const { shape, shapeSlot } = allocateShape();
      const el = document.createElement("div");
      el.className = "picker-circle";
      el.dataset.pointerId = String(e.pointerId);
      el.dataset.color = color;
      el.dataset.shape = shape.name;
      el.style.setProperty("--circle-color", color);
      el.style.setProperty("--rot", "0deg");
      el.innerHTML = `<svg class="picker-shape" aria-hidden="true" viewBox="0 0 100 100">${shape.markup}</svg>`;
      circlesLayer.appendChild(el);

      const direction = nextDirection;
      nextDirection = -nextDirection;
      const entry = {
        x: 0,
        y: 0,
        color,
        slot,
        shape: shape.name,
        shapeSlot,
        angle: 0,
        direction,
        el,
      };
      positionCircle(entry, e.clientX, e.clientY);
      touches.set(e.pointerId, entry);

      playPickerHaptic("minor");

      if (touches.size >= PICKER_MIN_FINGERS) {
        swipeCandidate = null;
        phase = "counting";
        schedulePickerSelection();
      } else {
        phase = "waiting";
        if (wasIdle) {
          swipeCandidate = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startTime: performance.now(),
          };
        }
      }
      startRotationLoop();
      updatePrompt();
    };

    const movePickerTouch = (e) => {
      if (trySingleFingerSwipe(e, false)) return;
      const entry = touches.get(e.pointerId);
      if (!entry) return;
      positionCircle(entry, e.clientX, e.clientY);
    };

    const removePickerTouch = (e) => {
      if (phase === "eliminating" || phase === "selected") {
        if (!heldPointers.has(e.pointerId)) return;
        heldPointers.delete(e.pointerId);
        if (heldPointers.size === 0) {
          resetPicker();
        }
        return;
      }

      if (e.type === "pointerup" && trySingleFingerSwipe(e, true)) return;

      const entry = touches.get(e.pointerId);
      if (!entry) return;
      entry.el.remove();
      touches.delete(e.pointerId);
      if (swipeCandidate?.pointerId === e.pointerId) {
        swipeCandidate = null;
      }

      if (touches.size >= PICKER_MIN_FINGERS) {
        phase = "counting";
        schedulePickerSelection();
        updatePrompt();
      } else if (touches.size === 1) {
        clearCountdown();
        phase = "waiting";
        if (!prefersReducedMotion()) {
          stage.dataset.rotationSpeed = ROTATION_MIN_DEG_PER_SEC.toFixed(1);
        }
        updatePrompt();
      } else {
        resetPicker();
      }
    };

    stage.addEventListener("pointerdown", addPickerTouch);
    stage.addEventListener("pointermove", movePickerTouch);
    stage.addEventListener("pointerup", removePickerTouch);
    stage.addEventListener("pointercancel", removePickerTouch);
    stage.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && phase !== "idle") {
        resetPicker();
      }
    });
    window.addEventListener("blur", () => {
      if (phase !== "idle") {
        resetPicker();
      }
    });
    updatePrompt();
  };

  // Android / native hardware Back navigation: close topmost open dialog first,
  // then return from Dice/Timer/Picker to Counters, before letting the OS exit
  const handleBackNavigation = ({ canGoBack = false } = {}) => {
    // Topmost is the one opened last, not the last in the markup: the confirm
    // sheet comes before History in index.html but opens on top of it
    const openDialogs = [...document.querySelectorAll("dialog[open]")]
      .filter((d) => !d.classList.contains("closing"))
      .sort((a, b) => Number(a.dataset.openSeq || 0) - Number(b.dataset.openSeq || 0));
    if (openDialogs.length > 0) {
      openDialogs[openDialogs.length - 1].close();
      return true;
    }
    if (state.currentTab !== "counters") {
      switchTab("counters");
      return true;
    }
    if (Capacitor.isNativePlatform()) {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    }
    return false;
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
    setupPicker();
    setupBottomSheetDragging();
    setupCardDragDrop();

    if (Capacitor.isNativePlatform()) {
      CapApp.addListener("backButton", handleBackNavigation).catch((err) =>
        log.warn("Back button listener failed:", err),
      );
    }
    document.addEventListener("counters:back", () => {
      handleBackNavigation();
    });

    // Re-apply keep awake when app comes to foreground
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && state.settings.keepAwake) {
        KeepAwake.keepAwake().catch((err) =>
          log.warn("KeepAwake failed on resume:", err),
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
      syncThemeSetting();
      renderPaletteSetting();
      renderEditPaletteSwatches();
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
      onRegistered(reg) {
        if (!reg) return;
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            reg.update().catch(() => {
              /* ignore when offline */
            });
          }
        });
      },
    });
  };

  // Bootstrap when DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
