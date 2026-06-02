/* ==========================================================================
   COUNTERS MODERN JAVASCRIPT CONTROLLER
   Vanilla ES6+ implementation with dynamic state management, local storage,
   Web Audio synthesizer, and custom mathematical overlays.
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
      quickAddValues: [5, 10, 15, 20, 50, 100],
    },
    history: [],
    currentTab: "counters",

    // Active actions/focus states
    activeCounterIdForCalc: null,
    activeCounterIdForEdit: null,
    calcPendingOperation: "plus", // 'plus' or 'minus'
    calcPendingValue: "",
    autoSortTimeout: null,
  };

  // Pre-configured counter palette color swatches
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

  // Re-calculate the leader bar metrics (Highest, Lowest, or Total value)
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
      // Find highest value counter
      const leader = [...state.counters].sort((a, b) => b.value - a.value)[0];
      const swatch = colorSwatches[leader.color] || colorSwatches[0];
      leaderContainer.style.setProperty("--leader-color", swatch.hex);
      leaderContainer.style.setProperty("--leader-bg", `${swatch.hex}15`);
      leaderContainer.style.setProperty("--leader-border", `${swatch.hex}40`);

      leaderContainer.querySelector(".leader-icon svg").innerHTML =
        `<path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>`;
      leaderText.textContent = leader.name;
    } else if (type === "lowest") {
      // Find lowest value counter
      const lowLeader = [...state.counters].sort(
        (a, b) => a.value - b.value,
      )[0];
      const swatch = colorSwatches[lowLeader.color] || colorSwatches[0];
      leaderContainer.style.setProperty("--leader-color", swatch.hex);
      leaderContainer.style.setProperty("--leader-bg", `${swatch.hex}15`);
      leaderContainer.style.setProperty("--leader-border", `${swatch.hex}40`);

      leaderContainer.querySelector(".leader-icon svg").innerHTML =
        `<path d="M11 16.172V4h2v12.172l5.364-5.364 1.414 1.414L12 20l-7.778-7.778 1.414-1.414L11 16.172z"/>`;
      leaderText.textContent = lowLeader.name;
    } else if (type === "total") {
      // Find sum of all values
      const totalValue = state.counters.reduce(
        (sum, item) => sum + item.value,
        0,
      );
      leaderContainer.style.removeProperty("--leader-color");
      leaderContainer.style.removeProperty("--leader-bg");
      leaderContainer.style.removeProperty("--leader-border");

      leaderContainer.querySelector(".leader-icon svg").innerHTML =
        `<path d="M19 18v2H5v-2l6-6-6-6V4h14v2h-9.35L14 12l-4.35 6H19z"/>`;
      leaderText.textContent = `Total: ${formatNumber(totalValue)}`;
    }
  };

  // Compile individual counter card templates into the wrapper list
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
      .map((counter) => {
        const swatch = colorSwatches[counter.color] || colorSwatches[0];
        const isNewClass = counter.isNew ? " animate-entry" : "";
        delete counter.isNew;
        return `
        <div class="counter-card ${swatch.class}${isNewClass}" data-counter-id="${counter.id}" style="--card-theme: ${swatch.hex}">
          <!-- Card Top Info Bar -->
          <div class="card-header">
            <button class="card-btn btn-counter-reset" title="Reset value" aria-label="Reset value for ${counter.name}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5.828 7l2.536 2.536L6.95 10.95 2 6l4.95-4.95 1.414 1.414L5.828 5H13a8 8 0 1 1 0 16H4v-2h9a6 6 0 1 0 0-12H5.828z"/>
              </svg>
            </button>
            <span class="counter-name">${counter.name}</span>
            <button class="card-btn btn-counter-edit" title="Edit details" aria-label="Edit details for ${counter.name}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5 18.084V22h3.916L21.416 9.497l-3.916-3.916L5 18.084zm3.084 1.916H7v-1.084l11.5-11.5 1.084 1.084L8.084 20zM19.416 3.584L21.416 5.584a2 2 0 0 1 0 2.828L20.416 9.412l-3.916-3.916L17.5 4.5a2 2 0 0 1 2.828 0z"/>
              </svg>
            </button>
          </div>
          
          <div class="card-body-wrapper">
            <!-- Card Direct Click decrement zone -->
            <div class="card-direct-zone card-direct-zone-minus" data-action="decrement" aria-label="Subtract direct increment">−</div>
            
            <!-- Middle Display -->
            <div class="card-value-body data-action-calc">
              <span class="value-display">${formatNumber(counter.value)}</span>
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
        state.counters.sort((a, b) => a.value - b.value);
      } else {
        state.counters.sort((a, b) => b.value - a.value);
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
      // Skip if tapping a button or the counter name inside the header
      if (e.target.closest("button") || e.target.closest(".counter-name"))
        return;

      const card = header.closest(".counter-card");
      if (!card) return;

      // If the entry animation is still running, strip it immediately
      // so that getBoundingClientRect captures the true un-transformed bounds.
      if (card.classList.contains("animate-entry")) {
        card.classList.remove("animate-entry");
      }

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
      const counterId = card.getAttribute("data-counter-id");
      const fromIdx = state.counters.findIndex((c) => c.id === counterId);
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
          child.classList.contains("counter-card")
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
              <span class="history-counter">${log.counterName}</span>
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
    });

    $("#layout-opt-grid").addEventListener("click", () => {
      state.settings.layout = "grid";
      document.documentElement.setAttribute("data-layout", "grid");
      $("#layout-opt-grid").classList.add("active");
      $("#layout-opt-list").classList.remove("active");
      saveSettings();
      renderCountersList();
      playClickSound();
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
      });
    });

    // Auto sort toggles
    $("#options-auto-sort").addEventListener("change", (e) => {
      state.settings.autoSort = e.target.checked;
      saveSettings();
      renderCountersList();
      playClickSound();
    });
  };

  // ------------------------------------------------------------------------
  // 12. Calculator Dialog Sheet Logic (Accumulating math value)
  // ------------------------------------------------------------------------
  const setupCalculatorDialog = () => {
    const dialog = $("#calculator-dialog");
    if (!dialog) return;

    const updateSubmitButtonText = () => {
      const submitBtn = $("#calc-btn-submit");
      if (!submitBtn) return;

      const valStr = $("#calc-number-input")?.value || "";
      const val = parseFloat(valStr);
      const isMinus = state.calcPendingOperation === "minus";

      if (!val || isNaN(val)) {
        submitBtn.textContent = isMinus ? "Subtract" : "Add";
      } else {
        submitBtn.textContent = `${isMinus ? "Subtract" : "Add"} ${formatNumber(val)}`;
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

    window.updateCalcDisplayDOM = updateCalcDisplayDOM;

    $("#calc-number-input")?.addEventListener("input", updateSubmitButtonText);

    // Toggle calculator operators (+ / -)
    $("#calc-op-minus").addEventListener("click", () => {
      state.calcPendingOperation = "minus";
      updateCalcDisplayDOM();
      playClickSound();
    });

    $("#calc-op-plus").addEventListener("click", () => {
      state.calcPendingOperation = "plus";
      updateCalcDisplayDOM();
      playClickSound();
    });

    // Quick Accumulating Buttons Taps (Instant apply & close)
    $("#calc-quick-add-container").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-quick-val]");
      if (!btn) return;

      if (state.activeCounterIdForCalc === null) return;

      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForCalc,
      );
      if (!counter) return;

      const deltaValue = parseFloat(btn.getAttribute("data-quick-val") || "0");
      if (deltaValue === 0) return;

      const oldValue = counter.value;
      const signedDelta =
        state.calcPendingOperation === "plus" ? deltaValue : -deltaValue;

      counter.value += signedDelta;
      saveCounters();

      // History logging
      const label =
        signedDelta > 0
          ? `+${formatNumber(deltaValue)}`
          : `−${formatNumber(deltaValue)}`;
      addHistoryLog(counter, label, oldValue, counter.value);

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
    });

    // Calculate Checkmark confirm submit button
    $("#calc-btn-submit").addEventListener("click", () => {
      if (state.activeCounterIdForCalc === null) return;

      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForCalc,
      );
      if (!counter) return;

      const deltaValue = parseFloat($("#calc-number-input").value || "0");
      if (deltaValue === 0) {
        dialog.close();
        return;
      }

      const oldValue = counter.value;
      const signedDelta =
        state.calcPendingOperation === "plus" ? deltaValue : -deltaValue;

      counter.value += signedDelta;
      saveCounters();

      // History logging
      const label =
        signedDelta > 0
          ? `+${formatNumber(deltaValue)}`
          : `−${formatNumber(deltaValue)}`;
      addHistoryLog(counter, label, oldValue, counter.value);

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
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
    });

    $("#menu-btn-open-settings")?.addEventListener("click", () => {
      dialog.close();
      const settingsDialog = $("#settings-dialog");
      if (settingsDialog) {
        loadSettingsIntoDOM();
        settingsDialog.showModal();
        playClickSound();
      }
    });

    $("#menu-btn-reset-counters")?.addEventListener("click", () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog(
        "Reset all counters to their base target values?",
        () => {
          state.counters.forEach((counter) => {
            const oldValue = counter.value;
            counter.value = counter.resetValue || 0;
            addHistoryLog(counter, "Reset counter", oldValue, counter.value);
          });
          saveCounters();
          renderCountersList();
          showToast("All counters reset");
          playResetSound();
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
      });
    }

    // Form submission (Save counter adjustments or Add counter)
    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const selectedSwatch = $(".palette-swatch.active");
      const colorId = selectedSwatch
        ? parseInt(selectedSwatch.getAttribute("data-color-id"))
        : 0;

      const name = $("#edit-label").value.trim();
      const value = parseInt($("#edit-value-input-details").value || "0");
      const increment = parseInt($("#edit-increment").value || "1");
      const resetValue = parseInt($("#edit-reset-val").value || "0");

      if (state.activeCounterIdForEdit === "new") {
        // Create new counter
        const newCounter = {
          id: Date.now().toString(),
          name,
          value,
          color: colorId,
          increment,
          resetValue,
          isNew: true,
        };
        state.counters.push(newCounter);
        saveCounters();
        addHistoryLog(newCounter, "Added counter", 0, value);
        showToast(`Counter "${name}" added`);
      } else {
        // Edit existing counter
        const counter = state.counters.find(
          (c) => c.id === state.activeCounterIdForEdit,
        );
        if (counter) {
          const oldValue = counter.value;
          counter.name = name;
          counter.value = value;
          counter.color = colorId;
          counter.increment = increment;
          counter.resetValue = resetValue;
          saveCounters();

          if (oldValue !== value) {
            addHistoryLog(counter, "Edited value", oldValue, value);
          } else {
            addHistoryLog(counter, "Edited details", oldValue, value);
          }
          showToast(`Counter saved`);
        }
      }

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
    });

    // Delete counter trash bin button
    $("#edit-btn-delete").addEventListener("click", () => {
      if (
        state.activeCounterIdForEdit === "new" ||
        state.activeCounterIdForEdit === null
      ) {
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
            if (counter) {
              addHistoryLog(
                counter,
                "Deleted counter",
                counter.value,
                counter.value,
              );
            }
            state.counters.splice(idx, 1);
            saveCounters();
            renderCountersList();
            showToast(`Counter deleted`);
            playResetSound();
          };

          dialog.close();

          if (cardEl) {
            // Lock height to current actual pixel height to allow smooth CSS transition to 0
            cardEl.style.height = `${cardEl.offsetHeight}px`;

            // Force a reflow to make the height lock take effect
            void cardEl.offsetHeight;

            cardEl.classList.add("animate-exit");
            const animations = cardEl.getAnimations();
            if (animations.length > 0) {
              Promise.allSettled(animations.map((a) => a.finished)).then(
                completeDeletion,
              );
            } else {
              setTimeout(completeDeletion, 300);
            }
          } else {
            completeDeletion();
          }
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

      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForEdit,
      );
      if (counter) {
        counter.name = newName;
        saveCounters();
        addHistoryLog(counter, "Edited name", counter.value, counter.value);
        showToast("Name updated");
      }

      dialog.close();
      renderCountersList();
      playSuccessSound();
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

      const counter = state.counters.find(
        (c) => c.id === state.activeCounterIdForEdit,
      );
      if (counter) {
        const oldValue = counter.value;
        counter.value = newValue;
        saveCounters();
        addHistoryLog(counter, "Edited value", oldValue, counter.value);
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
    const unusedSwatches = colorSwatches.filter(
      (s) => !usedColors.includes(s.id),
    );
    const selectedSwatch =
      unusedSwatches.length > 0
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
    const usedNames = state.counters.map((c) => c.name);
    const unusedNames = nameChoices.filter((name) => !usedNames.includes(name));
    const name =
      unusedNames.length > 0
        ? unusedNames[Math.floor(Math.random() * unusedNames.length)]
        : nameChoices[Math.floor(Math.random() * nameChoices.length)];

    const newCounter = {
      id: Date.now().toString(),
      name,
      value: 0,
      color: colorId,
      increment: 1,
      resetValue: 0,
      isNew: true,
    };

    state.counters.push(newCounter);
    saveCounters();
    addHistoryLog(newCounter, "Added counter", 0, 0);
    showToast(`Counter "${name}" added`);
    renderCountersList();
    triggerAutoSortWithDebounce();
    playSuccessSound();
  };

  // Open Edit Dialog wrapper for editing counter details
  const openEditCounterDetails = (counterId) => {
    const counter = state.counters.find((c) => c.id === counterId);
    if (!counter) return;

    state.activeCounterIdForEdit = counterId;

    $("#edit-dialog-title").textContent = `Edit ${counter.name}`;
    $("#edit-btn-delete").style.display = "flex"; // Show trash

    // Populate form values
    $("#edit-label").value = counter.name;
    $("#edit-value-input-details").value = counter.value;
    $("#edit-increment").value = counter.increment;
    $("#edit-reset-val").value = counter.resetValue;

    // Set palette swatch selected
    $$(".palette-swatch").forEach((swatch) => {
      const id = parseInt(swatch.getAttribute("data-color-id"));
      swatch.classList.toggle("active", id === counter.color);
    });

    const dialog = $("#edit-counter-dialog");
    if (dialog) {
      const swatch = colorSwatches[counter.color] || colorSwatches[0];
      dialog.style.setProperty("--sheet-theme", swatch.hex);
      dialog.showModal();
      playClickSound();
    }
  };

  // ------------------------------------------------------------------------
  // 14. Settings Dialog Data Binder
  // ------------------------------------------------------------------------
  const loadSettingsIntoDOM = () => {
    $("#setting-sound").checked = state.settings.soundEnabled;
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
    });

    // Clear history logs
    $("#history-btn-clear").addEventListener("click", () => {
      if (state.history.length === 0) return;
      showConfirmDialog("Clear transaction history?", () => {
        state.history = [];
        saveHistory();
        renderHistory();
        playResetSound();
      });
    });
  };

  // Helper: History Log Writer
  const addHistoryLog = (counter, actionLabel, oldValue, newValue) => {
    let progressionVal = "";
    if (typeof oldValue === "string" && newValue === undefined) {
      progressionVal = oldValue;
    } else {
      progressionVal = `${formatNumber(oldValue)} → ${formatNumber(newValue)}`;
    }

    const log = {
      id: Date.now().toString(),
      counterName: counter.name,
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
        playClickSound(600, 350, 0.05, 0.03);
      });
    });

    // Header buttons
    $("#btn-add-counter").addEventListener("click", () => {
      addNewCounterStreamlined();
    });

    $("#btn-empty-add-counter").addEventListener("click", () => {
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
                const swatch = colorSwatches[counter.color] || colorSwatches[0];
                dialog.style.setProperty("--sheet-theme", swatch.hex);
                setTimeout(() => {
                  dialog.showModal();
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
          const counter = state.counters.find(
            (c) => c.id === valuePressCounterId,
          );
          if (counter) {
            state.activeCounterIdForCalc = valuePressCounterId;
            state.calcPendingValue = "";
            state.calcPendingOperation = "plus";

            $("#calc-dialog-title").textContent =
              `${counter.name}: ${formatNumber(counter.value)}`;
            $("#calc-number-input").value = "";
            if (window.updateCalcDisplayDOM) {
              window.updateCalcDisplayDOM();
            }

            const dialog = $("#calculator-dialog");
            if (dialog) {
              const swatch = colorSwatches[counter.color] || colorSwatches[0];
              dialog.style.setProperty("--sheet-theme", swatch.hex);

              const titleEl = $("#calc-dialog-title");
              if (titleEl) {
                titleEl.style.setProperty("--pill-bg", `${swatch.hex}15`);
                titleEl.style.setProperty("--pill-border", `${swatch.hex}40`);
              }

              setTimeout(() => {
                dialog.showModal();
              }, 50);
              playClickSound(600, 700, 0.08, 0.05);
            }
          }
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

      // 1. Direct Edge Subtract click target
      const zoneMinus = e.target.closest(".card-direct-zone-minus");
      if (zoneMinus) {
        zoneMinus.classList.add("zone-active-flash");
        setTimeout(() => zoneMinus.classList.remove("zone-active-flash"), 300);

        const oldValue = counter.value;
        counter.value -= counter.increment || 1;
        saveCounters();
        addHistoryLog(
          counter,
          `−${formatNumber(counter.increment)}`,
          oldValue,
          counter.value,
        );

        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(450, 200, 0.06, 0.05);
        return;
      }

      // 2. Direct Edge Add click target
      const zonePlus = e.target.closest(".card-direct-zone-plus");
      if (zonePlus) {
        zonePlus.classList.add("zone-active-flash");
        setTimeout(() => zonePlus.classList.remove("zone-active-flash"), 300);

        const oldValue = counter.value;
        counter.value += counter.increment || 1;
        saveCounters();
        addHistoryLog(
          counter,
          `+${formatNumber(counter.increment)}`,
          oldValue,
          counter.value,
        );

        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(650, 350, 0.06, 0.05);
        return;
      }

      // 3.5. Click on the counter name (opens minimal edit name dialog)
      const counterName = e.target.closest(".counter-name");
      if (counterName) {
        state.activeCounterIdForEdit = counterId;
        const nameInput = $("#edit-name-input");
        if (nameInput) {
          nameInput.value = counter.name;
        }
        const dialog = $("#edit-name-dialog");
        if (dialog) {
          const swatch = colorSwatches[counter.color] || colorSwatches[0];
          dialog.style.setProperty("--sheet-theme", swatch.hex);
          dialog.showModal();
          playClickSound();
        }
        return;
      }

      // 4. Edit details button click target
      if (e.target.closest(".btn-counter-edit")) {
        openEditCounterDetails(counterId);
        return;
      }

      // 5. Quick Reset value target
      if (e.target.closest(".btn-counter-reset")) {
        showConfirmDialog(`Reset value for ${counter.name} to 0?`, () => {
          const oldValue = counter.value;
          counter.value = 0;
          saveCounters();
          addHistoryLog(counter, "Reset value", oldValue, counter.value);

          renderCountersList();
          triggerAutoSortWithDebounce();
          playResetSound();
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
            { name: "Dice roll", color: 3 },
            `Rolled ${currentDiceCount}d${currentDiceType}`,
            progressionText
          );

          btnRollAction.disabled = false;
          playClickSound(600, 800, 0.08, 0.05);
        }, 400);
      });
    }

    // 2. Stopwatch & Countdown Timer
    const swStart = $("#btn-timer-placeholder-start");
    const swReset = $("#btn-timer-placeholder-reset");
    const swDisplay = $("#placeholder-stopwatch-display");
    const incButtons = $$(".timer-inc-btn");

    let timerInterval = null;
    let timerStartTime = 0;
    let stopwatchElapsedMs = 0;
    let countdownRemainingMs = 0;
    let timerRunning = false;
    let timerMode = "stopwatch"; // "stopwatch" or "countdown"

    const updateTimerDisplay = () => {
      let totalMs = 0;
      if (timerMode === "stopwatch") {
        totalMs = stopwatchElapsedMs + (timerRunning ? Date.now() - timerStartTime : 0);
      } else {
        totalMs = countdownRemainingMs - (timerRunning ? Date.now() - timerStartTime : 0);
        if (totalMs <= 0) {
          totalMs = 0;
          if (timerRunning) {
            timerRunning = false;
            clearInterval(timerInterval);
            swStart.textContent = "Start";
            swStart.classList.remove("danger-btn-outline");
            playSuccessSound();
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
        swReset.disabled = (totalMs === 0);
      }
    };

    // Initialize reset button state
    if (swReset) {
      swReset.disabled = true;
    }

    if (swStart && swReset) {
      swStart.addEventListener("click", () => {
        let currentDisplayMs = 0;
        if (timerMode === "stopwatch") {
          currentDisplayMs = stopwatchElapsedMs + (timerRunning ? Date.now() - timerStartTime : 0);
        } else {
          currentDisplayMs = countdownRemainingMs - (timerRunning ? Date.now() - timerStartTime : 0);
        }

        if (currentDisplayMs <= 0 && timerMode === "countdown") {
          // If we completed a countdown and start again at 0, reset to stopwatch mode
          timerMode = "stopwatch";
          stopwatchElapsedMs = 0;
          countdownRemainingMs = 0;
        }

        if (!timerRunning) {
          // Play/Start
          timerRunning = true;
          timerStartTime = Date.now();
          swStart.textContent = "Pause";
          swStart.classList.add("danger-btn-outline");

          timerInterval = setInterval(updateTimerDisplay, 100);
          playClickSound(650, 450, 0.05, 0.03);
        } else {
          // Pause
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
        timerRunning = false;
        stopwatchElapsedMs = 0;
        countdownRemainingMs = 0;
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
        const secs = parseInt(btn.getAttribute("data-secs")) || 10;
        const addMs = secs * 1000;

        let currentDisplayMs = 0;
        if (timerMode === "stopwatch") {
          currentDisplayMs = stopwatchElapsedMs + (timerRunning ? Date.now() - timerStartTime : 0);
          timerMode = "countdown";
          countdownRemainingMs = currentDisplayMs + addMs;
          stopwatchElapsedMs = 0;
        } else {
          countdownRemainingMs += addMs;
        }

        playClickSound(600, 500, 0.05, 0.03);
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
    setupEditCounterDialog();
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
