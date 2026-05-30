/* ==========================================================================
   COUNTERS MODERN JAVASCRIPT CONTROLLER
   Vanilla ES6+ implementation with dynamic state management, local storage,
   Web Audio synthesizer, haptics, and custom mathematical overlays.
   ========================================================================== */

(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // 1. Core Reactive State System
  // ------------------------------------------------------------------------
  const state = {
    counters: [],
    settings: {
      layout: 'list',
      topBarContent: 'highest',
      autoSort: false,
      soundEnabled: true,
      hapticEnabled: true,
      quickAddValues: [5, 10, 15, 20, 50, 100, 200]
    },
    history: [],
    currentTab: 'counters',
    
    // Active actions/focus states
    activePlayerIdForCalc: null,
    activePlayerIdForEdit: null,
    calcPendingOperation: 'plus', // 'plus' or 'minus'
    calcPendingValue: '',
    autoSortTimeout: null
  };

  // Pre-configured player palette color swatches
  const colorSwatches = [
    { id: 0, class: 'card-color-0', hex: '#162e8a' }, // Deep Blue
    { id: 1, class: 'card-color-1', hex: '#e86a1a' }, // Bright Orange
    { id: 2, class: 'card-color-2', hex: '#ca265a' }, // Crimson Pink
    { id: 3, class: 'card-color-3', hex: '#5b6973' }, // Slate Grey
    { id: 4, class: 'card-color-4', hex: '#167648' }, // Forest Green
    { id: 5, class: 'card-color-5 { --card-theme: hsl(45, 95%, 45%); }', hex: '#e69f00' }, // Golden Yellow
    { id: 6, class: 'card-color-6', hex: '#1096a6' }, // Teal
    { id: 7, class: 'card-color-7', hex: '#622ea1' }  // Purple
  ];

  // ------------------------------------------------------------------------
  // 2. Local Storage Synchronizer
  // ------------------------------------------------------------------------
  const loadStateFromStorage = () => {
    try {
      const savedCounters = localStorage.getItem('counters-list');
      const savedSettings = localStorage.getItem('counters-settings');
      const savedHistory = localStorage.getItem('counters-history');

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
    localStorage.setItem('counters-list', JSON.stringify(state.counters));
  };

  const saveSettings = () => {
    localStorage.setItem('counters-settings', JSON.stringify(state.settings));
  };

  const saveHistory = () => {
    localStorage.setItem('counters-history', JSON.stringify(state.history));
  };

  // Helper: Format large numbers with commas
  const formatNumber = (num) => {
    return Number(num).toLocaleString('en-US');
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
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  };

  // Subtle clicks/beeps to ensure highly satisfying user interface
  const playClickSound = (freqStart = 550, freqEnd = 200, duration = 0.06, vol = 0.05) => {
    if (!state.settings.soundEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
      
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
      filter.type = 'bandpass';
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
    if ('vibrate' in navigator) {
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
    const toast = $('#toast-wrapper');
    const toastText = $('#toast-text');
    
    if (!toast || !toastText) return;
    
    toastText.textContent = message;
    toast.classList.remove('hidden');
    
    if (toastTimeout) clearTimeout(toastTimeout);
    
    toastTimeout = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  };

  // ------------------------------------------------------------------------
  // 6. Confirm Dialog System
  // ------------------------------------------------------------------------
  let confirmCallback = null;

  const showConfirmDialog = (message, onConfirm) => {
    const dialog = $('#confirm-dialog');
    const msgEl = $('#confirm-dialog-message');
    if (!dialog || !msgEl) return;
    
    msgEl.textContent = message;
    confirmCallback = onConfirm;
    dialog.showModal();
    playClickSound();
    triggerHaptic();
  };

  const setupConfirmDialog = () => {
    const dialog = $('#confirm-dialog');
    if (!dialog) return;

    $('#confirm-btn-ok')?.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      dialog.close();
      playClickSound();
    });

    $('#confirm-btn-cancel')?.addEventListener('click', () => {
      dialog.close();
      playClickSound();
    });
  };

  // ------------------------------------------------------------------------
  // 7. Dynamic View Renderers (Counters List, Leader Top Bar)
  // ------------------------------------------------------------------------
  
  // Re-calculate the leader bar metrics (Highest, Lowest, or Total score)
  const renderLeaderBar = () => {
    const leaderContainer = $('#header-leader-container');
    const leaderText = $('#header-leader-text');
    
    if (!leaderContainer || !leaderText) return;
    if (state.counters.length === 0) {
      leaderContainer.style.opacity = '0';
      leaderContainer.style.pointerEvents = 'none';
      return;
    }
    
    leaderContainer.style.opacity = '1';
    leaderContainer.style.pointerEvents = 'auto';

    const type = state.settings.topBarContent;
    
    if (type === 'highest') {
      // Find highest scoring player
      const leader = [...state.counters].sort((a, b) => b.score - a.score)[0];
      leaderContainer.querySelector('.leader-icon svg').innerHTML = 
        `<path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>`;
      leaderText.textContent = leader.name;
    } else if (type === 'lowest') {
      // Find lowest scoring player
      const lowLeader = [...state.counters].sort((a, b) => a.score - b.score)[0];
      leaderContainer.querySelector('.leader-icon svg').innerHTML = 
        `<path d="M11 16.172V4h2v12.172l5.364-5.364 1.414 1.414L12 20l-7.778-7.778 1.414-1.414L11 16.172z"/>`;
      leaderText.textContent = lowLeader.name;
    } else if (type === 'total') {
      // Find sum of all scores
      const totalScore = state.counters.reduce((sum, item) => sum + item.score, 0);
      leaderContainer.querySelector('.leader-icon svg').innerHTML = 
        `<path d="M19 18v2H5v-2l6-6-6-6V4h14v2h-9.35L14 12l-4.35 6H19z"/>`;
      leaderText.textContent = `Total: ${formatNumber(totalScore)}`;
    }
  };

  // Compile individual player card templates into the wrapper list
  const renderCountersList = () => {
    const listWrapper = $('#counters-list-wrapper');
    const emptyState = $('#empty-state-view');
    
    if (!listWrapper || !emptyState) return;

    if (state.counters.length === 0) {
      listWrapper.innerHTML = '';
      emptyState.classList.remove('hidden');
      renderLeaderBar();
      return;
    }

    emptyState.classList.add('hidden');
    
    // Inject rendered HTML for each array item
    listWrapper.innerHTML = state.counters.map(player => {
      const swatch = colorSwatches[player.color] || colorSwatches[0];
      return `
        <div class="player-card ${swatch.class}" data-player-id="${player.id}" style="--card-theme: ${swatch.hex}">
          <!-- Card Top Info Bar -->
          <div class="card-header">
            <button class="card-btn btn-player-reset" title="Reset score" aria-label="Reset score for ${player.name}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5.466 13.456A6.976 6.976 0 0 1 5 12a7 7 0 1 1 7 7c-.63 0-1.238-.085-1.815-.242l-1.394 1.434A8.987 8.987 0 0 0 12 21a9 9 0 1 0-9-9c0 .646.071 1.272.2 1.874l2.266-.418zM11 7v5.414l3.293 3.293 1.414-1.414L13 11.586V7h-2z"/>
              </svg>
            </button>
            <span class="player-name">${player.name}</span>
            <button class="card-btn btn-player-edit" title="Edit details" aria-label="Edit details for ${player.name}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M5 18.084V22h3.916L21.416 9.497l-3.916-3.916L5 18.084zm3.084 1.916H7v-1.084l11.5-11.5 1.084 1.084L8.084 20zM19.416 3.584L21.416 5.584a2 2 0 0 1 0 2.828L20.416 9.412l-3.916-3.916L17.5 4.5a2 2 0 0 1 2.828 0z"/>
              </svg>
            </button>
          </div>
          
          <!-- Card Direct Click decrement zone -->
          <div class="card-direct-zone card-direct-zone-minus" data-action="decrement" aria-label="Subtract direct increment">−</div>
          
          <!-- Middle Display -->
          <div class="card-score-body data-action-calc">
            <span class="score-display">${formatNumber(player.score)}</span>
          </div>
          
          <!-- Card Direct Click increment zone -->
          <div class="card-direct-zone card-direct-zone-plus" data-action="increment" aria-label="Add direct increment">+</div>
        </div>
      `;
    }).join('');

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
      if (state.settings.topBarContent === 'lowest') {
        state.counters.sort((a, b) => a.score - b.score);
      } else {
        state.counters.sort((a, b) => b.score - a.score);
      }
      saveCounters();
      renderCountersList();
    }, 3000); // 3 seconds delay so cards do not jump while being actively tapped!
  };

  // ------------------------------------------------------------------------
  // 9. History Log Renderer
  // ------------------------------------------------------------------------
  const renderHistory = () => {
    const listWrapper = $('#history-items-wrapper');
    const emptyView = $('#history-empty-view');
    
    if (!listWrapper || !emptyView) return;

    if (state.history.length === 0) {
      listWrapper.innerHTML = '';
      emptyView.classList.remove('hidden');
      return;
    }

    emptyView.classList.add('hidden');
    listWrapper.innerHTML = state.history.map(log => {
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
    }).join('');
  };

  // ------------------------------------------------------------------------
  // 10. Navigation / Tab Switching
  // ------------------------------------------------------------------------
  const switchTab = (tabId) => {
    state.currentTab = tabId;
    
    // Update footer button active class
    $$('[data-tab-btn]').forEach(btn => {
      if (btn.getAttribute('data-tab-btn') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update screen tab visibility
    $$('.tab-content').forEach(section => {
      if (section.getAttribute('data-view') === tabId) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Update Topbar View Title
    const viewTitle = $('#app-view-title');
    if (viewTitle) {
      if (tabId === 'counters') viewTitle.textContent = 'Counters';
      else if (tabId === 'dice') viewTitle.textContent = 'Dice';
      else if (tabId === 'timer') viewTitle.textContent = 'Timer';
      else if (tabId === 'settings') viewTitle.textContent = 'Settings';
    }

    // Dynamic render adjustments
    if (tabId === 'counters') {
      renderCountersList();
    } else if (tabId === 'settings') {
      loadSettingsIntoDOM();
    }
  };

  // ------------------------------------------------------------------------
  // 11. Options Overlay Dialog logic
  // ------------------------------------------------------------------------
  const setupOptionsDialog = () => {
    const dialog = $('#options-dialog');
    if (!dialog) return;
    
    const openOptionsDialog = () => {
      // Sync dialog display to state configs before showing
      $('#options-auto-sort').checked = state.settings.autoSort;
      
      if (state.settings.layout === 'grid') {
        $('#layout-opt-grid').classList.add('active');
        $('#layout-opt-list').classList.remove('active');
      } else {
        $('#layout-opt-list').classList.add('active');
        $('#layout-opt-grid').classList.remove('active');
      }
      
      const type = state.settings.topBarContent;
      $(`#topbar-opt-highest`).classList.toggle('active', type === 'highest');
      $(`#topbar-opt-lowest`).classList.toggle('active', type === 'lowest');
      $(`#topbar-opt-total`).classList.toggle('active', type === 'total');
      
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    };

    // Open view options when clicking on the leader container (top left)
    $('#header-leader-container')?.addEventListener('click', openOptionsDialog);

    // Make openOptionsDialog available to other menus
    window.openOptionsDialog = openOptionsDialog;

    // Handle standard layout button switches
    $('#layout-opt-list').addEventListener('click', () => {
      state.settings.layout = 'list';
      document.documentElement.setAttribute('data-layout', 'list');
      $('#layout-opt-list').classList.add('active');
      $('#layout-opt-grid').classList.remove('active');
      saveSettings();
      renderCountersList();
      playClickSound();
      triggerHaptic();
    });

    $('#layout-opt-grid').addEventListener('click', () => {
      state.settings.layout = 'grid';
      document.documentElement.setAttribute('data-layout', 'grid');
      $('#layout-opt-grid').classList.add('active');
      $('#layout-opt-list').classList.remove('active');
      saveSettings();
      renderCountersList();
      playClickSound();
      triggerHaptic();
    });

    // Top Bar content settings options
    ['highest', 'lowest', 'total'].forEach(option => {
      $(`#topbar-opt-${option}`).addEventListener('click', () => {
        state.settings.topBarContent = option;
        $(`#topbar-opt-highest`).classList.toggle('active', option === 'highest');
        $(`#topbar-opt-lowest`).classList.toggle('active', option === 'lowest');
        $(`#topbar-opt-total`).classList.toggle('active', option === 'total');
        saveSettings();
        renderLeaderBar();
        playClickSound();
        triggerHaptic();
      });
    });

    // Auto sort toggles
    $('#options-auto-sort').addEventListener('change', (e) => {
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
    const dialog = $('#calculator-dialog');
    if (!dialog) return;

    // Reset current mathematical state
    const resetCalculatorState = () => {
      state.calcPendingValue = '';
      state.calcPendingOperation = 'plus';
      updateCalcDisplayDOM();
    };

    const updateCalcDisplayDOM = () => {
      const display = $('#calc-number-input');
      const opIndicator = $('.math-op-indicator');
      const opMinus = $('#calc-op-minus');
      const opPlus = $('#calc-op-plus');
      
      if (display) {
        display.value = state.calcPendingValue === '' ? '0' : formatNumber(state.calcPendingValue);
      }
      
      if (opIndicator) {
        opIndicator.textContent = state.calcPendingOperation === 'plus' ? '+' : '−';
      }

      if (opMinus && opPlus) {
        opMinus.classList.toggle('active', state.calcPendingOperation === 'minus');
        opPlus.classList.toggle('active', state.calcPendingOperation === 'plus');
      }
    };

    // Toggle calculator operators (+ / -)
    $('#calc-op-minus').addEventListener('click', () => {
      state.calcPendingOperation = 'minus';
      updateCalcDisplayDOM();
      playClickSound();
      triggerHaptic(5);
    });

    $('#calc-op-plus').addEventListener('click', () => {
      state.calcPendingOperation = 'plus';
      updateCalcDisplayDOM();
      playClickSound();
      triggerHaptic(5);
    });

    // Numerical keypad actions
    $$('.calc-numpad .num-btn[data-key]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        
        // Prevent multiple decimals
        if (key === '.' && state.calcPendingValue.includes('.')) return;
        
        // Capping total entry size
        if (state.calcPendingValue.length >= 8) return;
        
        state.calcPendingValue += key;
        updateCalcDisplayDOM();
        playClickSound(650, 400, 0.05, 0.03);
        triggerHaptic(5);
      });
    });

    // Clear Calculator button
    $('#calc-btn-clear').addEventListener('click', () => {
      state.calcPendingValue = '';
      updateCalcDisplayDOM();
      playClickSound(350, 200, 0.06, 0.04);
      triggerHaptic(5);
    });

    // Backspace button
    $('#calc-btn-backspace').addEventListener('click', () => {
      state.calcPendingValue = state.calcPendingValue.slice(0, -1);
      updateCalcDisplayDOM();
      playClickSound(400, 300, 0.05, 0.03);
      triggerHaptic(5);
    });

    // Quick Accumulating Buttons Taps (Adds to current screen value)
    $('#calc-quick-add-container').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-quick-val]');
      if (!btn) return;

      const val = parseFloat(btn.getAttribute('data-quick-val'));
      
      // Accumulate mathematical value
      const current = parseFloat(state.calcPendingValue || '0');
      state.calcPendingValue = (current + val).toString();
      
      updateCalcDisplayDOM();
      playClickSound(750, 500, 0.06, 0.05);
      triggerHaptic(8);
    });

    // Calculate Checkmark confirm submit button
    $('#calc-btn-submit').addEventListener('click', () => {
      if (state.activePlayerIdForCalc === null) return;
      
      const player = state.counters.find(c => c.id === state.activePlayerIdForCalc);
      if (!player) return;
      
      const deltaValue = parseFloat(state.calcPendingValue || '0');
      if (deltaValue === 0) {
        dialog.close();
        return;
      }
      
      const oldScore = player.score;
      const signedDelta = state.calcPendingOperation === 'plus' ? deltaValue : -deltaValue;
      
      player.score += signedDelta;
      saveCounters();
      
      // History logging
      const label = signedDelta > 0 ? `+${formatNumber(deltaValue)}` : `−${formatNumber(deltaValue)}`;
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
    const dialog = $('#main-menu-dialog');
    const openBtn = $('#btn-open-options');
    if (!dialog || !openBtn) return;

    openBtn.addEventListener('click', () => {
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    });

    $('#menu-btn-view-options')?.addEventListener('click', () => {
      dialog.close();
      if (window.openOptionsDialog) window.openOptionsDialog();
    });

    $('#menu-btn-reset-scores')?.addEventListener('click', () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog("Reset scores for all players to their base target values?", () => {
        state.counters.forEach(player => {
          const oldScore = player.score;
          player.score = player.resetValue || 0;
          addHistoryLog(player, "Reset score", oldScore, player.score);
        });
        saveCounters();
        renderCountersList();
        showToast("All scores reset");
        playResetSound();
        triggerHaptic(40);
      });
    });

    $('#menu-btn-delete-all')?.addEventListener('click', () => {
      dialog.close();
      if (state.counters.length === 0) return;
      showConfirmDialog("Are you sure you want to delete all players?", () => {
        state.counters = [];
        state.history = [];
        saveCounters();
        saveHistory();
        renderCountersList();
        renderHistory();
        showToast("All players deleted");
        playResetSound();
        triggerHaptic(60);
      });
    });
  };

  // Populate dynamic quick-add grids inside calculator overlay
  const populateCalculatorQuickAdds = () => {
    const container = $('#calc-quick-add-container');
    if (!container) return;

    container.innerHTML = state.settings.quickAddValues.map(val => {
      return `<button data-quick-val="${val}">+${formatNumber(val)}</button>`;
    }).join('');
  };

  // ------------------------------------------------------------------------
  // 13. Edit / Add player Panel Logic
  // ------------------------------------------------------------------------
  const setupEditPlayerDialog = () => {
    const dialog = $('#edit-player-dialog');
    const form = $('#edit-player-form');
    
    if (!dialog || !form) return;

    // Compile Palette Grid circular swatches
    const paletteContainer = $('#edit-palette-container');
    if (paletteContainer) {
      paletteContainer.innerHTML = colorSwatches.map(swatch => {
        return `
          <div class="palette-swatch ${swatch.class}" data-color-id="${swatch.id}" style="background-color: ${swatch.hex}"></div>
        `;
      }).join('');
      
      // Swatch Click bind
      paletteContainer.addEventListener('click', (e) => {
        const swatch = e.target.closest('.palette-swatch');
        if (!swatch) return;

        $$('.palette-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        playClickSound();
        triggerHaptic(5);
      });
    }

    // Form submission (Save player adjustments or Add player)
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const selectedSwatch = $('.palette-swatch.active');
      const colorId = selectedSwatch ? parseInt(selectedSwatch.getAttribute('data-color-id')) : 0;
      
      const name = $('#edit-name').value.trim();
      const score = parseInt($('#edit-score').value || '0');
      const increment = parseInt($('#edit-increment').value || '1');
      const resetValue = parseInt($('#edit-reset-val').value || '0');

      if (state.activePlayerIdForEdit === 'new') {
        // Create new player
        const newPlayer = {
          id: Date.now().toString(),
          name,
          score,
          color: colorId,
          increment,
          resetValue
        };
        state.counters.push(newPlayer);
        saveCounters();
        addHistoryLog(newPlayer, "Added player", 0, score);
        showToast(`Player "${name}" added`);
      } else {
        // Edit existing player
        const player = state.counters.find(c => c.id === state.activePlayerIdForEdit);
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
          showToast(`Player saved`);
        }
      }

      dialog.close();
      renderCountersList();
      triggerAutoSortWithDebounce();
      playSuccessSound();
      triggerHaptic(20);
    });

    // Delete player trash bin button
    $('#edit-btn-delete').addEventListener('click', () => {
      if (state.activePlayerIdForEdit === 'new' || state.activePlayerIdForEdit === null) {
        dialog.close();
        return;
      }
      
      showConfirmDialog("Delete this player?", () => {
        const idx = state.counters.findIndex(c => c.id === state.activePlayerIdForEdit);
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

  // Open Edit Dialog wrapper for adding new player
  const openAddPlayerDialog = () => {
    state.activePlayerIdForEdit = 'new';
    
    // Set edit header text
    $('#edit-dialog-title').textContent = 'Add player';
    $('#edit-btn-delete').style.display = 'none'; // Hide trash
    
    // Reset values to blank/defaults
    $('#edit-name').value = '';
    $('#edit-score').value = '0';
    $('#edit-increment').value = '1';
    $('#edit-reset-val').value = '0';
    
    // Random default color swatch selection
    const randColor = Math.floor(Math.random() * colorSwatches.length);
    $$('.palette-swatch').forEach(swatch => {
      const id = parseInt(swatch.getAttribute('data-color-id'));
      swatch.classList.toggle('active', id === randColor);
    });

    const dialog = $('#edit-player-dialog');
    if (dialog) {
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    }
  };

  // Open Edit Dialog wrapper for editing player details
  const openEditPlayerDetails = (playerId) => {
    const player = state.counters.find(c => c.id === playerId);
    if (!player) return;

    state.activePlayerIdForEdit = playerId;
    
    $('#edit-dialog-title').textContent = `Edit ${player.name}`;
    $('#edit-btn-delete').style.display = 'flex'; // Show trash
    
    // Populate form values
    $('#edit-name').value = player.name;
    $('#edit-score').value = player.score;
    $('#edit-increment').value = player.increment;
    $('#edit-reset-val').value = player.resetValue;
    
    // Set palette swatch selected
    $$('.palette-swatch').forEach(swatch => {
      const id = parseInt(swatch.getAttribute('data-color-id'));
      swatch.classList.toggle('active', id === player.color);
    });

    const dialog = $('#edit-player-dialog');
    if (dialog) {
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    }
  };

  // ------------------------------------------------------------------------
  // 14. Settings Tab Data Binder
  // ------------------------------------------------------------------------
  const loadSettingsIntoDOM = () => {
    $('#setting-sound').checked = state.settings.soundEnabled;
    $('#setting-haptic').checked = state.settings.hapticEnabled;
    $('#setting-theme').value = localStorage.getItem('counters-theme') || 'system';
    $('#setting-quick-add-values').value = state.settings.quickAddValues.join(', ');
  };

  const bindSettingsActions = () => {
    // Sound Toggle
    $('#setting-sound').addEventListener('change', (e) => {
      state.settings.soundEnabled = e.target.checked;
      saveSettings();
      playClickSound();
      triggerHaptic();
    });

    // Haptic Toggle
    $('#setting-haptic').addEventListener('change', (e) => {
      state.settings.hapticEnabled = e.target.checked;
      saveSettings();
      playClickSound();
      triggerHaptic();
    });

    // Theme selector
    $('#setting-theme').addEventListener('change', (e) => {
      const val = e.target.value;
      localStorage.setItem('counters-theme', val);
      
      const root = document.documentElement;
      if (val === 'dark') {
        root.classList.add('dark-mode');
        root.classList.remove('light-mode');
      } else if (val === 'light') {
        root.classList.add('light-mode');
        root.classList.remove('dark-mode');
      } else {
        // System preference
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark-mode', systemIsDark);
        root.classList.toggle('light-mode', !systemIsDark);
      }
      playClickSound();
      triggerHaptic();
    });

    // Quick Add Calculator custom items
    $('#setting-quick-add-values').addEventListener('input', (e) => {
      const val = e.target.value;
      const parsed = val.split(',')
                        .map(n => parseInt(n.trim()))
                        .filter(n => !isNaN(n) && n > 0);
      
      if (parsed.length > 0) {
        state.settings.quickAddValues = parsed;
        saveSettings();
        populateCalculatorQuickAdds();
      }
    });

    // Reset scores dangerous triggers
    $('#btn-danger-reset-all').addEventListener('click', () => {
      if (state.counters.length === 0) return;
      showConfirmDialog("Reset scores for all players to 0?", () => {
        state.counters.forEach(player => {
          const oldScore = player.score;
          player.score = 0;
          addHistoryLog(player, "Reset score", oldScore, player.score);
        });
        saveCounters();
        renderCountersList();
        showToast("All scores reset");
        playResetSound();
        triggerHaptic(40);
      });
    });

    // Delete all players dangerous triggers
    $('#btn-danger-delete-all').addEventListener('click', () => {
      if (state.counters.length === 0) return;
      showConfirmDialog("Are you sure you want to delete all players? This deletes all counters and configurations permanently.", () => {
        state.counters = [];
        state.history = [];
        saveCounters();
        saveHistory();
        renderCountersList();
        renderHistory();
        showToast("All players deleted");
        playResetSound();
        triggerHaptic(60);
      });
    });
  };

  // ------------------------------------------------------------------------
  // 15. Dialog Dismiss backdrop check bindings
  // ------------------------------------------------------------------------
  const setupDialogBackdrops = () => {
    $$('dialog').forEach(dialog => {
      // Direct click outside boundary fallback (Safari etc.)
      if (!('closedBy' in HTMLDialogElement.prototype)) {
        dialog.addEventListener('click', (event) => {
          if (event.target !== dialog) return;
          const rect = dialog.getBoundingClientRect();
          const isDialogContent = (
            rect.top <= event.clientY &&
            event.clientY <= rect.top + rect.height &&
            rect.left <= event.clientX &&
            event.clientX <= rect.left + rect.width
          );
          if (!isDialogContent) {
            dialog.close();
            playClickSound();
            triggerHaptic(5);
          }
        });
      }
    });
  };

  // ------------------------------------------------------------------------
  // 16. History Dialog log overlays
  // ------------------------------------------------------------------------
  const setupHistoryDialog = () => {
    const dialog = $('#history-dialog');
    const openBtn = $('#btn-open-history');
    
    if (!dialog || !openBtn) return;

    openBtn.addEventListener('click', () => {
      renderHistory();
      dialog.showModal();
      playClickSound();
      triggerHaptic();
    });

    // Clear history logs
    $('#history-btn-clear').addEventListener('click', () => {
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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
    // Prevent long press context menu globally except on text inputs to feel like a native app
    window.addEventListener('contextmenu', (e) => {
      const tagName = e.target.tagName;
      if (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
        e.preventDefault();
      }
    });
    
    // Bottom Nav clicks
    $$('[data-tab-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab-btn');
        if (tab === state.currentTab) return;
        switchTab(tab);
        playClickSound(600, 350, 0.05, 0.03);
        triggerHaptic(5);
      });
    });

    // Header buttons
    $('#btn-add-player').addEventListener('click', () => {
      openAddPlayerDialog();
    });

    $('#btn-empty-add-player').addEventListener('click', () => {
      openAddPlayerDialog();
    });

    // Pointer handlers for long press vs short press on card body
    let pressTimer = null;
    let isLongPress = false;
    let longPressedPlayerId = null;

    $('#counters-list-wrapper').addEventListener('pointerdown', (e) => {
      const cardBody = e.target.closest('.card-score-body');
      if (!cardBody) return;
      
      isLongPress = false;
      const card = cardBody.closest('.player-card');
      if (!card) return;
      longPressedPlayerId = card.getAttribute('data-player-id');

      pressTimer = setTimeout(() => {
        isLongPress = true;
        const player = state.counters.find(c => c.id === longPressedPlayerId);
        if (!player) return;

        // Long press logic: open calculator
        state.activePlayerIdForCalc = longPressedPlayerId;
        state.calcPendingValue = '';
        state.calcPendingOperation = 'plus';
        
        $('#calc-dialog-title').textContent = `${player.name}: ${formatNumber(player.score)}`;
        $('#calc-number-input').value = '0';
        $('.math-op-indicator').textContent = '+';
        $$('.op-btn').forEach(b => b.classList.remove('active'));
        $('#calc-op-plus').classList.add('active');
        
        const dialog = $('#calculator-dialog');
        if (dialog) {
          dialog.showModal();
          playClickSound(600, 700, 0.08, 0.05); // variant for long press
          triggerHaptic(15);
        }
      }, 500); // 500ms for long press
    });

    const cancelLongPress = () => {
      if (pressTimer) clearTimeout(pressTimer);
    };

    $('#counters-list-wrapper').addEventListener('pointercancel', cancelLongPress);
    
    // Prevent long press trigger if user scrolls/moves pointer significantly
    $('#counters-list-wrapper').addEventListener('pointermove', () => {
      // Real robust implementations check distance, but cancel works as a baseline
    });

    $('#counters-list-wrapper').addEventListener('pointerup', (e) => {
      cancelLongPress();
      
      const cardBody = e.target.closest('.card-score-body');
      if (!cardBody) return;

      // Prevent triggering short press if it was a long press
      if (!isLongPress && longPressedPlayerId) {
        // Short press logic: increment score by 1
        const player = state.counters.find(c => c.id === longPressedPlayerId);
        if (!player) return;

        const oldScore = player.score;
        player.score += 1;
        saveCounters();
        addHistoryLog(player, "+1", oldScore, player.score);
        
        // Brief visual flash
        cardBody.classList.add('zone-active-flash');
        setTimeout(() => cardBody.classList.remove('zone-active-flash'), 300);

        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(650, 350, 0.06, 0.05);
        triggerHaptic(10);
      }
      longPressedPlayerId = null;
    });

    // Counters List Delegated clicks (optimizing performance & garbage collection)
    $('#counters-list-wrapper').addEventListener('click', (e) => {
      const card = e.target.closest('.player-card');
      if (!card) return;

      const playerId = card.getAttribute('data-player-id');
      const player = state.counters.find(c => c.id === playerId);
      if (!player) return;

      // 1. Direct Edge Subtract click target
      const zoneMinus = e.target.closest('.card-direct-zone-minus');
      if (zoneMinus) {
        zoneMinus.classList.add('zone-active-flash');
        setTimeout(() => zoneMinus.classList.remove('zone-active-flash'), 300);
        
        const oldScore = player.score;
        player.score -= player.increment || 1;
        saveCounters();
        addHistoryLog(player, `−${formatNumber(player.increment)}`, oldScore, player.score);
        
        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(450, 200, 0.06, 0.05);
        triggerHaptic(10);
        return;
      }

      // 2. Direct Edge Add click target
      const zonePlus = e.target.closest('.card-direct-zone-plus');
      if (zonePlus) {
        zonePlus.classList.add('zone-active-flash');
        setTimeout(() => zonePlus.classList.remove('zone-active-flash'), 300);
        
        const oldScore = player.score;
        player.score += player.increment || 1;
        saveCounters();
        addHistoryLog(player, `+${formatNumber(player.increment)}`, oldScore, player.score);
        
        renderCountersList();
        triggerAutoSortWithDebounce();
        playClickSound(650, 350, 0.06, 0.05);
        triggerHaptic(10);
        return;
      }

      // 3. Edit details button click target
      if (e.target.closest('.btn-player-edit')) {
        openEditPlayerDetails(playerId);
        return;
      }

      // 4. Quick Reset score target
      if (e.target.closest('.btn-player-reset')) {
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
    $$('dialog [command="close"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent double-close warning in modern browsers
        const dialog = btn.closest('dialog');
        if (dialog && dialog.open) {
          dialog.close();
          playClickSound();
          triggerHaptic(5);
        }
      });
    });

    // Listen to OS Dark Theme adjustments live
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      const themeSelect = $('#setting-theme');
      if (themeSelect) {
        const savedTheme = localStorage.getItem('counters-theme') || 'system';
        if (savedTheme === 'system') {
          const root = document.documentElement;
          root.classList.toggle('dark-mode', e.matches);
          root.classList.toggle('light-mode', !e.matches);
        }
      }
    });
  };

  // ------------------------------------------------------------------------
  // 18. Placeholders Interactive Actions (Extra Premium Polish!)
  // ------------------------------------------------------------------------
  const setupPlaceholdersInteractions = () => {
    // 1. Dice Roller
    const diceBtn = $('#btn-roll-placeholder');
    const diceResult = $('#placeholder-dice-result');
    const diceIcon = $('.placeholder-icon.shake-animation');
    
    if (diceBtn && diceResult && diceIcon) {
      diceBtn.addEventListener('click', () => {
        // Trigger shaking animation
        diceIcon.classList.add('active');
        diceBtn.disabled = true;
        diceResult.textContent = '...';
        diceResult.classList.remove('rolled');
        
        playDiceSound();
        triggerHaptic(12);

        setTimeout(() => {
          diceIcon.classList.remove('active');
          const roll = Math.floor(Math.random() * 6) + 1;
          diceResult.textContent = roll;
          diceResult.classList.add('rolled');
          diceBtn.disabled = false;
          playClickSound(600, 800, 0.08, 0.05);
          triggerHaptic(20);
        }, 400);
      });
    }

    // 2. Stopwatch
    const swStart = $('#btn-timer-placeholder-start');
    const swReset = $('#btn-timer-placeholder-reset');
    const swDisplay = $('#placeholder-stopwatch-display');
    
    let timerInterval = null;
    let timerStartTime = 0;
    let timerElapsedTime = 0;
    let timerRunning = false;

    const updateTimerDisplay = () => {
      const totalMs = timerElapsedTime + (timerRunning ? (Date.now() - timerStartTime) : 0);
      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const ms = Math.floor((totalMs % 1000) / 100);
      
      const mm = String(minutes).padStart(2, '0');
      const ss = String(seconds).padStart(2, '0');
      
      if (swDisplay) {
        swDisplay.textContent = `${mm}:${ss}.${ms}`;
      }
    };

    if (swStart && swReset) {
      swStart.addEventListener('click', () => {
        if (!timerRunning) {
          // Play/Start
          timerRunning = true;
          timerStartTime = Date.now();
          swStart.textContent = 'Pause';
          swStart.classList.add('danger-btn-outline');
          
          timerInterval = setInterval(updateTimerDisplay, 100);
          playClickSound(650, 450, 0.05, 0.03);
          triggerHaptic(6);
        } else {
          // Pause
          timerRunning = false;
          timerElapsedTime += Date.now() - timerStartTime;
          swStart.textContent = 'Start';
          swStart.classList.remove('danger-btn-outline');
          
          clearInterval(timerInterval);
          playClickSound(450, 350, 0.05, 0.03);
          triggerHaptic(6);
        }
      });

      swReset.addEventListener('click', () => {
        timerRunning = false;
        timerElapsedTime = 0;
        swStart.textContent = 'Start';
        swStart.classList.remove('danger-btn-outline');
        
        clearInterval(timerInterval);
        updateTimerDisplay();
        playResetSound();
        triggerHaptic(15);
      });
    }
  };

  // ------------------------------------------------------------------------
  // 19. Initialization Bootstrap routine
  // ------------------------------------------------------------------------
  const init = () => {
    loadStateFromStorage();
    
    // Core Layout options loaded
    document.documentElement.setAttribute('data-layout', state.settings.layout);

    // Dialog sheets binds
    setupDialogBackdrops();
    setupOptionsDialog();
    setupMainMenuDialog();
    setupCalculatorDialog();
    setupEditPlayerDialog();
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
  };

  // Bootstrap when DOM ready
  document.addEventListener('DOMContentLoaded', init);

})();
