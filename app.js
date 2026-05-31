/* ==========================================================================
   COUNTERS MODERN JAVASCRIPT CONTROLLER
   Vanilla ES6+ implementation with dynamic state management, local storage,
   Web Audio synthesizer, haptics, and custom mathematical overlays.
   ========================================================================== */

(function () {
  "use strict";

  // Central patch to track when dialogs are opened.
  // This is used to prevent synthetic 'click' events from instantly closing them.
  const originalShowModal = HTMLDialogElement.prototype.showModal;
  if (originalShowModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.dataset.openedAt = Date.now().toString();
      originalShowModal.apply(this, arguments);
    };
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
      hapticEnabled: true,
      quickAddValues: [5, 10, 15, 20, 50, 100],
    },
    history: [],
    currentTab: "counters",

    // Active actions/focus states
    activePlayerIdForCalc: null,
    activePlayerIdForEdit: null,
    calcPendingOperation: "plus", // 'plus' or 'minus'
    calcPendingValue: "",
    autoSortTimeout: null,
  };

  // Pre-configured player palette color swatches
  const colorSwatches = [
    { id: 0, class: "card-color-0", hex: "#162e8a" }, // Deep Blue
    { id: 1, class: "card-color-1", hex: "#e86a1a" }, // Bright Orange
    { id: 2, class: "card-color-2", hex: "#ca265a" }, // Crimson Pink
    { id: 3, class: "card-color-3", hex: "#5b6973" }, // Slate Grey
    { id: 4, class: "card-color-4", hex: "#167648" }, // Forest Green
    {
      id: 5,
      class: "card-color-5 { --card-theme: hsl(45, 95%, 45%); }",
      hex: "#e69f00",
    }, // Golden Yellow
    { id: 6, class: "card-color-6", hex: "#1096a6" }, // Teal
    { id: 7, class: "card-color-7", hex: "#622ea1" }, // Purple
  ];

  // ------------------------------------------------------------------------
  // 2. Local Storage Synchronizer
  // ------------------------------------------------------------------------
  const loadStateFromStorage = () => {
    try {
      const savedCounters = localStorage.getItem("counters-list");
      const savedSettings = localStorage.getItem("counters-settings");
      const savedHistory = localStorage.getItem("counters-history");

      if (savedCounters) {
        state.counters = JSON.parse(savedCounters);
      } else {
        state.counters = [];
        saveCounters();
      }

      if (savedSettings) {
        state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
      }

      if (savedHistory) {
        state.history = JSON.parse(savedHistory);
      } else {
        state.history = [];
      }
    } catch (e) {
      console.error("Failed to load local storage state", e);
    }
  };

  const saveCounters = () => {
    localStorage.setItem("counters-list", JSON.stringify(state.counters));
  };

  const saveSettings = () => {
    localStorage.setItem("counters-settings", JSON.stringify(state.settings));
  };

  const saveHistory = () => {
    localStorage.setItem("counters-history", JSON.stringify(state.history));
  };

  // Helper: Format large numbers with commas
  const formatNumber = (num) => {
    return Number(num).toLocaleString("en-US");
  };

  // Helper: DOM Element Selectors
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);

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
  // 4. Haptic Vibration Helper
  // ------------------------------------------------------------------------
  const triggerHaptic = (ms = 10) => {
    if (!state.settings.hapticEnabled) return;
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        console.warn("Tactile vibration not allowed", e);
      }
    }
  };

  // ------------------------------------------------------------------------
  // 5. Toast Notification System
  // ------------------------------------------------------------------------
  let toastTimeout = null;

  const showToast = (message) => {
    const toast = $("#toast-wrapper");
    const toastText = $("#toast-text");

    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.remove("hidden");

    if (toastTimeout) clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
      toast.classList.add("hidden");
    }, 2500);
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
    dialog.showModal();
    playClickSound();
    triggerHaptic();
  };

  const setupConfirmDialog = () => {
    const dialog = $("#confirm-dialog");
    if (!dialog) return;

    $("#confirm-btn-ok")?.addEventListener("click", () => {
      if (confirmCallback) confirmCallback();
      dialog.close();
      playClickSound();
    });

    $("#confirm-btn-cancel")?.addEventListener("click", () => {
      dialog.close();
      playClickSound();
    });
  };

  // ------------------------------------------------------------------------
  // 7. Dynamic View Renderers (Counters List, Leader Top Bar)
  // ------------------------------------------------------------------------

  // Re-calculate the leader bar metrics (Highest, Lowest, or Total score)
  const renderLeaderBar = () => {
    const leaderContainer = $("#header-leader-container");
    const leaderText = $("#header-leader-text");

    if (!leaderContainer || !leaderText) return;
    if (state.counters.length === 0) {
      leaderContainer.style.opacity = "0";
      leaderContainer.style.pointerEvents = "none";
      return;
    }

    leaderContainer.style.opacity = "1";
    leaderContainer.style.pointerEvents = "auto";

    const type = state.settings.topBarContent;

    if (type === "highest") {
      // Find highest scoring player
      const leader = [...state.counters].sort((a, b) => b.score - a.score)[0];
      const swatch = colorSwatches[leader.color] || colorSwatches[0];
      leaderContainer.style.setProperty("--leader-color", swatch.hex);
      leaderContainer.style.setProperty("--leader-bg", `${swatch.hex}15`);
      leaderContainer.style.setProperty("--leader-border", `${swatch.hex}40`);

      leaderContainer.querySelector(".leader-icon svg").innerHTML =
        `<path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>`;
      leaderText.textContent = leader.name;
    } else if (type === "lowest") {
      // Find lowest scoring player
      const lowLeader = [...state.counters].sort(
        (a, b) => a.score - b.score,
      )[0];
      const swatch = colorSwatches[lowLeader.color] || colorSwatches[0];
      leaderContainer.style.setProperty("--leader-color", swatch.hex);
      leaderContainer.style.setProperty("--leader-bg", `${swatch.hex}15`);
      leaderContainer.style.setProperty("--leader-border", `${swatch.hex}40`);

      leaderContainer.querySelector(".leader-icon svg").innerHTML =
        `<path d="M11 16.172V4h2v12.172l5.364-5.364 1.414 1.414L12 20l-7.778-7.778 1.414-1.414L11 16.172z"/>`;
      leaderText.textContent = lowLeader.name;
    } else if (type === "total") {
      // Find sum of all scores
      const totalScore = state.counters.reduce(
        (sum, item) => sum + item.score,
        0,
      );
      leaderContainer.style.removeProperty("--leader-color");
      leaderContainer.style.removeProperty("--leader-bg");
      leaderContainer.style.removeProperty("--leader-border");

      leaderContainer.querySelector(".leader-icon svg").innerHTML =
        `<path d="M19 18v2H5v-2l6-6-6-6V4h14v2h-9.35L14 12l-4.35 6H19z"/>`;
      leaderText.textContent = `Total: ${formatNumber(totalScore)}`;
    }
  };

  // Compile individual player card templates into the wrapper list
  const renderCountersList = () => {
    const listWrapper = $("#counters-list-wrapper");
    const emptyState = $("#empty-state-view");

    if (!listWrapper || !emptyState) return;

    if (state.counters.length === 0) {
      listWrapper.innerHTML = "";
      emptyState.classList.remove("hidden");
      renderLeaderBar();
      return;
    }

    emptyState.classList.add("hidden");

    // Reflect drag-enabled state on the wrapper for CSS cursor targeting
    listWrapper.setAttribute(
      "data-drag-enabled",
      state.settings.autoSort ? "false" : "true",
    );

    // Inject rendered HTML for each array item
    listWrapper.innerHTML = state.counters
      .map((player) => {
        const swatch = colorSwatches[player.color] || colorSwatches[0];
        return `
        <div class="player-card ${swatch.class}" data-player-id="${player.id}" style="--card-theme: ${swatch.hex}">
          <!-- Card Top Info Bar -->
          <div class="card-header">
            <button class="card-btn btn-player-reset" title="Reset score" aria-label="Reset score for ${player.name}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5.828 7l2.536 2.536L6.95 10.95 2 6l4.95-4.95 1.414 1.414L5.828 5H13a8 8 0 1 1 0 16H4v-2h9a6 6 0 1 0 0-12H5.828z"/>
              </svg>
            </button>
            <span class="player-name">${player.name}</span>
            <button class="card-btn btn-player-edit" title="Edit details" aria-label="Edit details for ${player.name}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5 18.084V22h3.916L21.416 9.497l-3.916-3.916L5 18.084zm3.084 1.916H7v-1.084l11.5-11.5 1.084 1.084L8.084 20zM19.416 3.584L21.416 5.584a2 2 0 0 1 0 2.828L20.416 9.412l-3.916-3.916L17.5 4.5a2 2 0 0 1 2.828 0z"/>
              </svg>
            </button>
          </div>
          
          <div class="card-body-wrapper">
            <!-- Card Direct Click decrement zone -->
            <div class="card-direct-zone card-direct-zone-minus" data-action="decrement" aria-label="Subtract direct increment">−</div>
            
            <!-- Middle Display -->
            <div class="card-score-body data-action-calc">
              <span class="score-display">${formatNumber(player.score)}</span>
            </div>
            
            <!-- Card Direct Click increment zone -->
            <div class="card-direct-zone card-direct-zone-plus" data-action="increment" aria-label="Add direct increment">+</div>
          </div>
        </div>
      `;
      })
      .join("");

    renderLeaderBar();
  };

  // ------------------------------------------------------------------------
  // 8. Auto Sorting With Debounce Delay
  // ------------------------------------------------------------------------
  const triggerAutoSortWithDebounce = () => {
    if (!state.settings.autoSort) return;

    if (state.autoSortTimeout) {
      clearTimeout(state.autoSortTimeout);
    }

    state.autoSortTimeout = setTimeout(() => {
      if (state.settings.topBarContent === "lowest") {
        state.counters.sort((a, b) => a.score - b.score);
      } else {
        state.counters.sort((a, b) => b.score - a.score);
      }
      saveCounters();
      renderCountersList();
    }, 3000); // 3 seconds delay so cards do not jump while being actively tapped!
  };

  // ------------------------------------------------------------------------
  // 8b. Card Drag-and-Drop Reorder (active only when auto-sort is disabled)
  // ------------------------------------------------------------------------
  const setupCardDragDrop = () => {
    const listWrapper = $("#counters-list-wrapper");
    if (!listWrapper) return;

    let dragState = null; // Tracks active drag session

    const getCardEls = () => [
      ...listWrapper.querySelectorAll(".player-card:not(.drag-placeholder):not(.dragging)"),
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
    const getDropTarget = (clientY) => {
      const cards = getCardEls();
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (clientY < midY) return card;
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
      if (state.settings.autoSort) return;
      const header = e.target.closest(".card-header");
      if (!header) return;
      // Skip if tapping a button or the player name inside the header
      if (e.target.closest("button") || e.target.closest(".player-name")) return;

      const card = header.closest(".player-card");
      if (!card) return;

      // Measure pointer offset relative to card top-left
      const rect = card.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;

      const { ghost } = createGhost(card, offsetX, offsetY);

      // Placeholder mimics the card's dimensions
      const placeholder = document.createElement("div");
      placeholder.className = "drag-placeholder";
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.minHeight = `${rect.height}px`;
      listWrapper.insertBefore(placeholder, card);

      // Capture pointer first BEFORE hiding the original card to prevent browser pointer cancel!
      try {
        listWrapper.setPointerCapture(e.pointerId);
      } catch (_) {}

      card.classList.add("dragging");

      dragState = {
        card,
        ghost,
        placeholder,
        offsetX,
        offsetY,
        moved: false,
      };

      e.preventDefault();
    });

    listWrapper.addEventListener("pointermove", (e) => {
      if (!dragState) return;
      dragState.moved = true;

      moveGhost(
        dragState.ghost,
        e.clientX,
        e.clientY,
        dragState.offsetX,
        dragState.offsetY,
      );

      const before = getDropTarget(e.clientY);
      movePlaceholder(dragState.placeholder, before);
    });

    const endDrag = (e) => {
      if (!dragState) return;

      const { card, ghost, placeholder, moved } = dragState;
      dragState = null;

      // Clean up ghost and dragging state
      ghost.remove();
      card.classList.remove("dragging");

      if (!moved) {
        // Treat no-movement as a cancelled drag — just remove placeholder
        placeholder.remove();
        return;
      }

      // Compute new order from DOM (placeholder position = drop slot)
      const allChildren = [...listWrapper.children];
      const placeholderIdx = allChildren.indexOf(placeholder);
      placeholder.remove();

      // Determine original index to remove from
      const playerId = card.getAttribute("data-player-id");
      const fromIdx = state.counters.findIndex((c) => c.id === playerId);
      if (fromIdx === -1) return;

      // Count how many real cards are before the placeholder position to get target index
      let toIdx = 0;
      let seen = 0;
      for (let i = 0; i < allChildren.length; i++) {
        if (i === placeholderIdx) break;
        const child = allChildren[i];
        if (
          child !== card &&
          child !== placeholder &&
          child.classList.contains("player-card")
        ) {
          seen++;
        }
      }
      toIdx = seen;
      // Clamp
      toIdx = Math.max(0, Math.min(toIdx, state.counters.length - 1));

      if (fromIdx === toIdx) {
        renderCountersList();
        return;
      }

      // Reorder state array
      const [moved_item] = state.counters.splice(fromIdx, 1);
      state.counters.splice(toIdx, 0, moved_item);
      saveCounters();
      renderCountersList();
      triggerHaptic(12);
      playClickSound(500, 650, 0.06, 0.04);
    };

    listWrapper.addEventListener("pointerup", endDrag);
    listWrapper.addEventListener("pointercancel", (e) => {
      if (!dragState) return;
      dragState.ghost.remove();
      dragState.card.classList.remove("dragging");
      dragState.placeholder.remove();
      dragState = null;
      renderCountersList();
    });
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
      .map((log) => {
        const swatch = colorSwatches[log.color] || colorSwatches[0];
        return `
        <div class="history-item" style="--history-theme: ${swatch.hex}">
          <div class="history-badge"></div>
          <div class="history-details">
            <div class="history-row-top">
              <span class="history-player">${log.playerName}</span>
              <span class="history-time">${log.timestamp}</span>
            </div>
            <div class="history-row-bottom">
              <span class="history-event">${log.actionLabel}</span>
              <span class="history-progression">${log.progression}</span>
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
  const switchTab = (tabId) => {
    state.currentTab = tabId;

    // Update footer button active class
    $$("[data-tab-btn]").forEach((btn) => {
      if (btn.getAttribute("data-tab-btn") === tabId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update screen tab visibility
    $$(".tab-content").forEach((section) => {
      if (section.getAttribute("data-view") === tabId) {
        section.classList.add("active");
      } else {
        section.classList.remove("active");
      }
    });

    // Update Topbar View Title
    const viewTitle = $("#app-view-title");
    if (viewTitle) {
      if (tabId === "counters") viewTitle.textContent = "Counters";
      else if (tabId === "dice") viewTitle.textContent = "Dice";
      else if (tabId === "timer") viewTitle.textContent = "Timer";
    }

    // Dynamic render adjustments
    if (tabId === "counters") {
      renderCountersList();
    }
  };

  // ------------------------------------------------------------------------
  // 11. Options Overlay Dialog logic
  // ------------------------------------------------------------------------
  const setupOptionsDialog = () => {
    const dialog = $("#options-dialog");
    if (!dialog) return;

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

      dialog.showModal();
      playClickSound();
      triggerHaptic();
    };

    // Open view options when clicking on the leader container (top left)
    $("#header-leader-container")?.addEventListener("click", openOptionsDialog);

    // Make openOptionsDialog available to other menus
    window.openOptionsDialog = openOptionsDialog;

    // Handle standard layout button switches
    $("#layout-opt-list").addEventListener("click", () => {
      state.settings.layout = "list";
      document.documentElement.setAttribute("data-layout", "list");
      $("#layout-opt-list").classList.add("active");
      $("#layout-opt-grid").classList.remove("active");
      saveSettings();
      renderCountersList();
      playClickSound();
      triggerHaptic();
    });

    $("#layout-opt-grid").addEventListener("click", () => {
      state.settings.layout = "grid";
      document.documentElement.setAttribute("data-layout", "grid");
      $("#layout-opt-grid").classList.add("active");
      $("#layout-opt-list").classList.remove("active");
      saveSettings();
      renderCountersList();
      playClickSound();
      triggerHaptic();
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
        playClickSound();
        triggerHaptic();
      });
    });

    // Auto sort toggles
    $("#options-auto-sort").addEventListener("change", (e) => {
      state.settings.autoSort = e.target.checked;
      saveSettings();
      renderCountersList();
      playClickSound();
      triggerHaptic();
    });
  };

  // ------------------------------------------------------------------------
  // 12. Calculator Dialog Sheet Logic (Accumulating math value)
  // ------------------------------------------------------------------------
  const setupCalculatorDialog = () => {
    const dialog = $("#calculator-dialog");
    if (!dialog) return;

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
    };

    // Toggle calculator operators (+ / -)
    $("#calc-op-minus").addEventListener("click", () => {
      state.calcPendingOperation = "minus";
      updateCalcDisplayDOM();
      playClickSound();
      triggerHaptic(5);
    });

    $("#calc-op-plus").addEventListener("click", () => {
      state.calcPendingOperation = "plus";
      updateCalcDisplayDOM();
      playClickSound();
      triggerHaptic(5);
    });

    // Quick Accumulating Buttons Taps (Instant apply & close)
    $("#calc-quick-add-container").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-quick-val]");
      if (!btn) return;

      if (state.activePlayerIdForCalc === null) return;

      const player = state.counters.find(
        (c) => c.id === state.activePlayerIdForCalc,
      );
      if (!player) return;

      const deltaValue = parseFloat(btn.getAttribute("data-quick-val") || "0");
      if (deltaValue === 0) return;

      const oldScore = player.score;
      const signedDelta =
          state.calcPendingOperation === "plus" ? deltaValue : -deltaValue;

      player.score += signedDelta;
      saveCounters();

      // History logging
      const label =
        signedDelta > 0
          ? `+${formatNumber(deltaValue)}`
          : `−${formatNumber(deltaValue)}`;
      addHistoryLog(player, label, oldScore, player.score);

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
      triggerHaptic(18);
    });

    // Calculate Checkmark confirm submit button
    $("#calc-btn-submit").addEventListener("click", () => {
      if (state.activePlayerIdForCalc === null) return;

      const player = state.counters.find(
        (c) => c.id === state.activePlayerIdForCalc,
      );
      if (!player) return;

      const deltaValue = parseFloat($("#calc-number-input").value || "0");
      if (deltaValue === 0) {
        dialog.close();
        return;
      }

      const oldScore = player.score;
      const signedDelta =
        state.calcPendingOperation === "plus" ? deltaValue : -deltaValue;

      player.score += signedDelta;
      saveCounters();

      // History logging
      const label =
        signedDelta > 0
          ? `+${formatNumber(deltaValue)}`
          : `−${formatNumber(deltaValue)}`;
      addHistoryLog(player, label, oldScore, player.score);

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
      triggerHaptic(18);
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
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    });


    $("#menu-btn-open-settings")?.addEventListener("click", () => {
      dialog.close();
      const settingsDialog = $("#settings-dialog");
      if (settingsDialog) {
        loadSettingsIntoDOM();
        settingsDialog.showModal();
        playClickSound();
        triggerHaptic();
      }
    });

    $("#menu-btn-reset-scores")?.addEventListener("click", () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog(
        "Reset scores for all counters to their base target values?",
        () => {
          state.counters.forEach((player) => {
            const oldScore = player.score;
            player.score = player.resetValue || 0;
            addHistoryLog(player, "Reset score", oldScore, player.score);
          });
          saveCounters();
          renderCountersList();
          showToast("All scores reset");
          playResetSound();
          triggerHaptic(40);
        },
      );
    });

    $("#menu-btn-delete-all")?.addEventListener("click", () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog("Are you sure you want to delete all counters?", () => {
        state.counters = [];
        state.history = [];
        saveCounters();
        saveHistory();
        renderCountersList();
        renderHistory();
        showToast("All counters deleted");
        playResetSound();
        triggerHaptic(60);
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
  // 13. Edit / Add player Panel Logic
  // ------------------------------------------------------------------------
  const setupEditPlayerDialog = () => {
    const dialog = $("#edit-player-dialog");
    const form = $("#edit-player-form");

    if (!dialog || !form) return;

    // Compile Palette Grid circular swatches
    const paletteContainer = $("#edit-palette-container");
    if (paletteContainer) {
      paletteContainer.innerHTML = colorSwatches
        .map((swatch) => {
          return `
          <div class="palette-swatch ${swatch.class}" data-color-id="${swatch.id}" style="background-color: ${swatch.hex}"></div>
        `;
        })
        .join("");

      // Swatch Click bind
      paletteContainer.addEventListener("click", (e) => {
        const swatch = e.target.closest(".palette-swatch");
        if (!swatch) return;

        $$(".palette-swatch").forEach((s) => s.classList.remove("active"));
        swatch.classList.add("active");

        // Dynamically update sheet theme color
        const colorId = parseInt(swatch.getAttribute("data-color-id"));
        const swatchData = colorSwatches[colorId] || colorSwatches[0];
        dialog.style.setProperty("--sheet-theme", swatchData.hex);

        playClickSound();
        triggerHaptic(5);
      });
    }

    // Form submission (Save player adjustments or Add player)
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const selectedSwatch = $(".palette-swatch.active");
      const colorId = selectedSwatch
        ? parseInt(selectedSwatch.getAttribute("data-color-id"))
        : 0;

      const name = $("#edit-label").value.trim();
      const score = parseInt($("#edit-score").value || "0");
      const increment = parseInt($("#edit-increment").value || "1");
      const resetValue = parseInt($("#edit-reset-val").value || "0");

      if (state.activePlayerIdForEdit === "new") {
        // Create new counter
        const newPlayer = {
          id: Date.now().toString(),
          name,
          score,
          color: colorId,
          increment,
          resetValue,
        };
        state.counters.push(newPlayer);
        saveCounters();
        addHistoryLog(newPlayer, "Added counter", 0, score);
        showToast(`Counter "${name}" added`);
      } else {
        // Edit existing counter
        const player = state.counters.find(
          (c) => c.id === state.activePlayerIdForEdit,
        );
        if (player) {
          const oldScore = player.score;
          player.name = name;
          player.score = score;
          player.color = colorId;
          player.increment = increment;
          player.resetValue = resetValue;
          saveCounters();

          if (oldScore !== score) {
            addHistoryLog(player, "Edited score", oldScore, score);
          } else {
            addHistoryLog(player, "Edited details", oldScore, score);
          }
          showToast(`Counter saved`);
        }
      }

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
      triggerHaptic(20);
    });

    // Delete player trash bin button
    $("#edit-btn-delete").addEventListener("click", () => {
      if (
        state.activePlayerIdForEdit === "new" ||
        state.activePlayerIdForEdit === null
      ) {
        dialog.close();
        return;
      }

      showConfirmDialog("Delete this player?", () => {
        const idx = state.counters.findIndex(
          (c) => c.id === state.activePlayerIdForEdit,
        );
        if (idx !== -1) {
          state.counters.splice(idx, 1);
          saveCounters();
          dialog.close();
          renderCountersList();
          showToast(`Counter deleted`);
          playResetSound();
          triggerHaptic(30);
        }
      });
    });
  };

  const setupEditNameDialog = () => {
    const dialog = $("#edit-name-dialog");
    const form = $("#edit-name-form");

    if (!dialog || !form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const newName = $("#edit-name-input").value.trim();
      if (!newName) return;

      const player = state.counters.find(
        (c) => c.id === state.activePlayerIdForEdit
      );
      if (player) {
        player.name = newName;
        saveCounters();
        addHistoryLog(player, "Edited name", player.score, player.score);
        showToast("Name updated");
      }

      dialog.close();
      renderCountersList();
      playSuccessSound();
      triggerHaptic(20);
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
      const newValue = parseInt(newValueStr);

      const player = state.counters.find(
        (c) => c.id === state.activePlayerIdForEdit
      );
      if (player) {
        const oldScore = player.score;
        player.score = newValue;
        saveCounters();
        addHistoryLog(player, "Edited score", oldScore, player.score);
        showToast("Value updated");
      }

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
      triggerHaptic(20);
    });
  };

  // Streamlined: Add new counter directly without dialog
  const addNewCounterStreamlined = () => {
    // Pick an unused color swatch
    const usedColors = state.counters.map((c) => c.color);
    const unusedSwatches = colorSwatches.filter((s) => !usedColors.includes(s.id));
    const selectedSwatch = unusedSwatches.length > 0
      ? unusedSwatches[Math.floor(Math.random() * unusedSwatches.length)]
      : colorSwatches[Math.floor(Math.random() * colorSwatches.length)];
    const colorId = selectedSwatch.id;

    // Pick an unused placeholder name if possible
    const nameChoices = [
      "Flicker",
      "Robin",
      "Finch",
      "Junco",
      "Wren",
      "Sparrow",
      "Heron",
      "Egret"
    ];
    const usedNames = state.counters.map((c) => c.name);
    const unusedNames = nameChoices.filter((name) => !usedNames.includes(name));
    const name = unusedNames.length > 0
      ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
      : nameChoices[Math.floor(Math.random() * nameChoices.length)];

    const newPlayer = {
      id: Date.now().toString(),
      name,
      score: 0,
      color: colorId,
      increment: 1,
      resetValue: 0,
    };

    state.counters.push(newPlayer);
    saveCounters();
    addHistoryLog(newPlayer, "Added counter", 0, 0);
    showToast(`Counter "${name}" added`);
    renderCountersList();
    triggerAutoSortWithDebounce();
    playSuccessSound();
    triggerHaptic(20);
  };

  // Open Edit Dialog wrapper for editing counter details
  const openEditPlayerDetails = (playerId) => {
    const player = state.counters.find((c) => c.id === playerId);
    if (!player) return;

    state.activePlayerIdForEdit = playerId;

    $("#edit-dialog-title").textContent = `Edit ${player.name}`;
    $("#edit-btn-delete").style.display = "flex"; // Show trash

    // Populate form values
    $("#edit-label").value = player.name;
    $("#edit-score").value = player.score;
    $("#edit-increment").value = player.increment;
    $("#edit-reset-val").value = player.resetValue;

    // Set palette swatch selected
    $$(".palette-swatch").forEach((swatch) => {
      const id = parseInt(swatch.getAttribute("data-color-id"));
      swatch.classList.toggle("active", id === player.color);
    });

    const dialog = $("#edit-player-dialog");
    if (dialog) {
      const swatch = colorSwatches[player.color] || colorSwatches[0];
      dialog.style.setProperty("--sheet-theme", swatch.hex);
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    }
  };

  // ------------------------------------------------------------------------
  // 14. Settings Dialog Data Binder
  // ------------------------------------------------------------------------
  const loadSettingsIntoDOM = () => {
    $("#setting-sound").checked = state.settings.soundEnabled;
    $("#setting-haptic").checked = state.settings.hapticEnabled;
    $("#setting-theme").value =
      localStorage.getItem("counters-theme") || "system";
    $("#setting-quick-add-values").value =
      state.settings.quickAddValues.join(", ");
  };

  const bindSettingsActions = () => {
    // Sound Toggle
    $("#setting-sound").addEventListener("change", (e) => {
      state.settings.soundEnabled = e.target.checked;
      saveSettings();
      playClickSound();
      triggerHaptic();
    });

    // Haptic Toggle
    $("#setting-haptic").addEventListener("change", (e) => {
      state.settings.hapticEnabled = e.target.checked;
      saveSettings();
      playClickSound();
      triggerHaptic();
    });

    // Theme selector
    $("#setting-theme").addEventListener("change", (e) => {
      const val = e.target.value;
      localStorage.setItem("counters-theme", val);

      const root = document.documentElement;
      if (val === "dark") {
        root.classList.add("dark-mode");
        root.classList.remove("light-mode");
      } else if (val === "light") {
        root.classList.add("light-mode");
        root.classList.remove("dark-mode");
      } else {
        // System preference
        const systemIsDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        root.classList.toggle("dark-mode", systemIsDark);
        root.classList.toggle("light-mode", !systemIsDark);
      }
      playClickSound();
      triggerHaptic();
    });

    // Quick Add Calculator custom items
    $("#setting-quick-add-values").addEventListener("input", (e) => {
      const val = e.target.value;
      const parsed = val
        .split(",")
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      if (parsed.length > 0) {
        state.settings.quickAddValues = parsed;
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
          playClickSound();
          triggerHaptic(5);
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
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    });

    // Clear history logs
    $("#history-btn-clear").addEventListener("click", () => {
      if (state.history.length === 0) return;
      showConfirmDialog("Clear transaction history?", () => {
        state.history = [];
        saveHistory();
        renderHistory();
        playResetSound();
        triggerHaptic(30);
      });
    });
  };

  // Helper: History Log Writer
  const addHistoryLog = (player, actionLabel, oldScore, newScore) => {
    const log = {
      id: Date.now().toString(),
      playerName: player.name,
      color: player.color,
      actionLabel: actionLabel,
      progression: `${formatNumber(oldScore)} → ${formatNumber(newScore)}`,
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
    let scorePressTimer = null;
    let scorePressActive = false;
    let scorePressMoved = false;
    let scorePressStartX = 0;
    let scorePressStartY = 0;
    let scorePressPlayerId = null;

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
        playClickSound(600, 350, 0.05, 0.03);
        triggerHaptic(5);
      });
    });

    // Header buttons
    $("#btn-add-player").addEventListener("click", () => {
      addNewCounterStreamlined();
    });

    $("#btn-empty-add-player").addEventListener("click", () => {
      addNewCounterStreamlined();
    });

    const listWrapper = $("#counters-list-wrapper");
    if (listWrapper) {
      listWrapper.addEventListener("pointerdown", (e) => {
        const scoreBody = e.target.closest(".card-score-body");
        if (!scoreBody) return;

        const card = scoreBody.closest(".player-card");
        if (!card) return;

        scorePressPlayerId = card.getAttribute("data-player-id");
        scorePressActive = true;
        scorePressMoved = false;
        scorePressStartX = e.clientX;
        scorePressStartY = e.clientY;

        scorePressTimer = setTimeout(() => {
          if (scorePressActive && !scorePressMoved) {
            scorePressActive = false;
            const player = state.counters.find((c) => c.id === scorePressPlayerId);
            if (player) {
              state.activePlayerIdForEdit = scorePressPlayerId;
              const valueInput = $("#edit-value-input");
              if (valueInput) {
                valueInput.value = player.score;
              }
              const dialog = $("#edit-value-dialog");
              if (dialog) {
                const swatch = colorSwatches[player.color] || colorSwatches[0];
                dialog.style.setProperty("--sheet-theme", swatch.hex);
                setTimeout(() => {
                  dialog.showModal();
                }, 50);
                playClickSound();
                triggerHaptic(15);
              }
            }
          }
        }, 500);
      });

      listWrapper.addEventListener("pointermove", (e) => {
        if (!scorePressActive) return;
        const dist = Math.hypot(e.clientX - scorePressStartX, e.clientY - scorePressStartY);
        if (dist > 10) {
          scorePressMoved = true;
          if (scorePressTimer) {
            clearTimeout(scorePressTimer);
            scorePressTimer = null;
          }
        }
      });

      listWrapper.addEventListener("pointerup", (e) => {
        // Only handle releases originating from an active score-body press to prevent
        // interfering with card reordering drags or other container gestures.
        if (!scorePressActive) return;

        scorePressActive = false;
        if (scorePressTimer) {
          clearTimeout(scorePressTimer);
          scorePressTimer = null;
        }

        const scoreBody = e.target.closest(".card-score-body");
        if (scoreBody) {
          e.preventDefault();
        }

        if (!scorePressMoved) {
          const player = state.counters.find((c) => c.id === scorePressPlayerId);
          if (player) {
            state.activePlayerIdForCalc = scorePressPlayerId;
            state.calcPendingValue = "";
            state.calcPendingOperation = "plus";

            $("#calc-dialog-title").textContent =
              `${player.name}: ${formatNumber(player.score)}`;
            $("#calc-number-input").value = "";
            $(".math-op-indicator").textContent = "+";
            $$(".op-btn").forEach((b) => b.classList.remove("active"));
            $("#calc-op-plus").classList.add("active");

            const dialog = $("#calculator-dialog");
            if (dialog) {
              const swatch = colorSwatches[player.color] || colorSwatches[0];
              dialog.style.setProperty("--sheet-theme", swatch.hex);
              setTimeout(() => {
                dialog.showModal();
              }, 50);
              playClickSound(600, 700, 0.08, 0.05);
              triggerHaptic(15);
            }
          }
        }
      });

      listWrapper.addEventListener("pointercancel", () => {
        scorePressActive = false;
        if (scorePressTimer) {
          clearTimeout(scorePressTimer);
          scorePressTimer = null;
        }
      });
    }

    // Counters List Delegated clicks (optimizing performance & garbage collection)
    $("#counters-list-wrapper").addEventListener("click", (e) => {
      const card = e.target.closest(".player-card");
      if (!card) return;

      const playerId = card.getAttribute("data-player-id");
      const player = state.counters.find((c) => c.id === playerId);
      if (!player) return;

      // 1. Direct Edge Subtract click target
      const zoneMinus = e.target.closest(".card-direct-zone-minus");
      if (zoneMinus) {
        zoneMinus.classList.add("zone-active-flash");
        setTimeout(() => zoneMinus.classList.remove("zone-active-flash"), 300);

        const oldScore = player.score;
        player.score -= player.increment || 1;
        saveCounters();
        addHistoryLog(
          player,
          `−${formatNumber(player.increment)}`,
          oldScore,
          player.score,
        );

        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(450, 200, 0.06, 0.05);
        triggerHaptic(10);
        return;
      }

      // 2. Direct Edge Add click target
      const zonePlus = e.target.closest(".card-direct-zone-plus");
      if (zonePlus) {
        zonePlus.classList.add("zone-active-flash");
        setTimeout(() => zonePlus.classList.remove("zone-active-flash"), 300);

        const oldScore = player.score;
        player.score += player.increment || 1;
        saveCounters();
        addHistoryLog(
          player,
          `+${formatNumber(player.increment)}`,
          oldScore,
          player.score,
        );

        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(650, 350, 0.06, 0.05);
        triggerHaptic(10);
        return;
      }


      // 3.5. Click on the player name (opens minimal edit name dialog)
      const playerName = e.target.closest(".player-name");
      if (playerName) {
        state.activePlayerIdForEdit = playerId;
        const nameInput = $("#edit-name-input");
        if (nameInput) {
          nameInput.value = player.name;
        }
        const dialog = $("#edit-name-dialog");
        if (dialog) {
          const swatch = colorSwatches[player.color] || colorSwatches[0];
          dialog.style.setProperty("--sheet-theme", swatch.hex);
          dialog.showModal();
          playClickSound();
          triggerHaptic(10);
        }
        return;
      }

      // 4. Edit details button click target
      if (e.target.closest(".btn-player-edit")) {
        openEditPlayerDetails(playerId);
        return;
      }

      // 5. Quick Reset score target
      if (e.target.closest(".btn-player-reset")) {
        showConfirmDialog(`Reset score for ${player.name} to 0?`, () => {
          const oldScore = player.score;
          player.score = 0;
          saveCounters();
          addHistoryLog(player, "Reset score", oldScore, player.score);

          renderCountersList();
          triggerAutoSortWithDebounce();
          playResetSound();
          triggerHaptic(25);
        });
        return;
      }
    });

    // Close Dialog triggers
    $$('dialog [command="close"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault(); // Prevent double-close warning in modern browsers
        const dialog = btn.closest("dialog");
        if (dialog && dialog.open) {
          dialog.close();
          playClickSound();
          triggerHaptic(5);
        }
      });
    });

    // Listen to OS Dark Theme adjustments live
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        const themeSelect = $("#setting-theme");
        if (themeSelect) {
          const savedTheme = localStorage.getItem("counters-theme") || "system";
          if (savedTheme === "system") {
            const root = document.documentElement;
            root.classList.toggle("dark-mode", e.matches);
            root.classList.toggle("light-mode", !e.matches);
          }
        }
      });
  };

  // ------------------------------------------------------------------------
  // 18. Placeholders Interactive Actions (Extra Premium Polish!)
  // ------------------------------------------------------------------------
  const setupPlaceholdersInteractions = () => {
    // 1. Dice Roller
    const diceBtn = $("#btn-roll-placeholder");
    const diceResult = $("#placeholder-dice-result");
    const diceIcon = $(".placeholder-icon.shake-animation");

    if (diceBtn && diceResult && diceIcon) {
      diceBtn.addEventListener("click", () => {
        // Trigger shaking animation
        diceIcon.classList.add("active");
        diceBtn.disabled = true;
        diceResult.textContent = "...";
        diceResult.classList.remove("rolled");

        playDiceSound();
        triggerHaptic(12);

        setTimeout(() => {
          diceIcon.classList.remove("active");
          const roll = Math.floor(Math.random() * 6) + 1;
          diceResult.textContent = roll;
          diceResult.classList.add("rolled");
          diceBtn.disabled = false;
          playClickSound(600, 800, 0.08, 0.05);
          triggerHaptic(20);
        }, 400);
      });
    }

    // 2. Stopwatch
    const swStart = $("#btn-timer-placeholder-start");
    const swReset = $("#btn-timer-placeholder-reset");
    const swDisplay = $("#placeholder-stopwatch-display");

    let timerInterval = null;
    let timerStartTime = 0;
    let timerElapsedTime = 0;
    let timerRunning = false;

    const updateTimerDisplay = () => {
      const totalMs =
        timerElapsedTime + (timerRunning ? Date.now() - timerStartTime : 0);
      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const ms = Math.floor((totalMs % 1000) / 100);

      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");

      if (swDisplay) {
        swDisplay.textContent = `${mm}:${ss}.${ms}`;
      }
    };

    if (swStart && swReset) {
      swStart.addEventListener("click", () => {
        if (!timerRunning) {
          // Play/Start
          timerRunning = true;
          timerStartTime = Date.now();
          swStart.textContent = "Pause";
          swStart.classList.add("danger-btn-outline");

          timerInterval = setInterval(updateTimerDisplay, 100);
          playClickSound(650, 450, 0.05, 0.03);
          triggerHaptic(6);
        } else {
          // Pause
          timerRunning = false;
          timerElapsedTime += Date.now() - timerStartTime;
          swStart.textContent = "Start";
          swStart.classList.remove("danger-btn-outline");

          clearInterval(timerInterval);
          playClickSound(450, 350, 0.05, 0.03);
          triggerHaptic(6);
        }
      });

      swReset.addEventListener("click", () => {
        timerRunning = false;
        timerElapsedTime = 0;
        swStart.textContent = "Start";
        swStart.classList.remove("danger-btn-outline");

        clearInterval(timerInterval);
        updateTimerDisplay();
        playResetSound();
        triggerHaptic(15);
      });
    }
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
        } catch (err) {}
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
          } catch (err) {}
        }

        // If dragged down past threshold (100px), close with a premium native slide transition
        if (currentY > 100) {
          dialog.style.transform = "translate(-50%, 100%)";
          setTimeout(() => {
            dialog.close();
            dialog.style.transform = "";
          }, 300);
          playClickSound(450, 350, 0.05, 0.03); // light close sound
          triggerHaptic(5);
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
  const init = () => {
    loadStateFromStorage();

    // Core Layout options loaded
    document.documentElement.setAttribute("data-layout", state.settings.layout);

    // Dialog sheets binds
    setupDialogBackdrops();
    setupOptionsDialog();
    setupMainMenuDialog();
    setupCalculatorDialog();
    setupEditPlayerDialog();
    setupEditNameDialog();
    setupEditValueDialog();
    setupHistoryDialog();
    setupConfirmDialog();

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

    // Set dynamic version from package.json via Vite define injection
    if (typeof __APP_VERSION__ !== "undefined") {
      const versionEl = document.getElementById("about-app-version");
      if (versionEl) {
        versionEl.textContent = `Counters v${__APP_VERSION__}`;
      }
    }
  };

  // Bootstrap when DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
