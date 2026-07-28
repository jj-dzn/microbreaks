var step = 0;
var TOTAL = 5;
var selectedMin = 30;
var selectedMode = 'strict';
var selectedTheme = 'sage';
var workHoursEnabled = false;
var workStart = '09:00';
var workEnd = '17:00';
var weekendDays = [0, 6]; // paused days — 0=Sun, 6=Sat default

function el(id) { return document.getElementById(id); }

function send(msg) {
  return new Promise(function(resolve) {
    try {
      chrome.runtime.sendMessage(msg, function(r) {
        resolve(r || null);
      });
    } catch(e) {
      resolve(null);
    }
  });
}

// ===== INTERVAL =====
var ivBtns = document.querySelectorAll('.iv-opt');
ivBtns.forEach(function(btn) {
  btn.onclick = function() {
    ivBtns.forEach(function(b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
    selectedMin = parseInt(btn.getAttribute('data-min'));
  };
});

// ===== MODE =====
var modeBtns = document.querySelectorAll('.mode-opt');
modeBtns.forEach(function(btn) {
  btn.onclick = function() {
    modeBtns.forEach(function(b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
    selectedMode = btn.getAttribute('data-mode');
  };
});

// ===== THEME =====
var themeBtns = document.querySelectorAll('.theme-opt');
themeBtns.forEach(function(btn) {
  btn.onclick = function() {
    themeBtns.forEach(function(b) { b.classList.remove('sel'); });
    btn.classList.add('sel');
    selectedTheme = btn.getAttribute('data-theme');
  };
});

// ===== WORK HOURS =====
var whToggle = el('whToggle');
var whTimes = el('whTimes');
var whStartInput = el('whStart');
var whEndInput = el('whEnd');

whToggle.onclick = function() {
  workHoursEnabled = !workHoursEnabled;
  whToggle.setAttribute('aria-checked', String(workHoursEnabled));
  whToggle.classList.toggle('on', workHoursEnabled);
  whTimes.classList.toggle('show', workHoursEnabled);
};

whStartInput.onchange = function() { workStart = whStartInput.value || '09:00'; };
whEndInput.onchange = function() { workEnd = whEndInput.value || '17:00'; };

var dayBtns = document.querySelectorAll('.wh-day');
dayBtns.forEach(function(btn) {
  btn.onclick = function() {
    var day = parseInt(btn.getAttribute('data-day'));
    var idx = weekendDays.indexOf(day);
    if (idx > -1) {
      weekendDays.splice(idx, 1);
      btn.classList.remove('paused');
    } else {
      weekendDays.push(day);
      btn.classList.add('paused');
    }
  };
});

// ===== PRE-FILL FROM CURRENT SETTINGS =====
// This flow doubles as both first-run onboarding (where GET_STATE returns
// defaults) and a replay from Settings (where the user has real customized
// settings). Without this, replaying and clicking through without touching
// anything would silently reset the user's actual settings back to the
// hardcoded defaults above.
function applyStateToUI() {
  ivBtns.forEach(function(b) { b.classList.remove('sel'); });
  var ivMatch = null;
  ivBtns.forEach(function(b) {
    if (parseInt(b.getAttribute('data-min')) === selectedMin) ivMatch = b;
  });
  if (ivMatch) ivMatch.classList.add('sel');

  modeBtns.forEach(function(b) {
    b.classList.toggle('sel', b.getAttribute('data-mode') === selectedMode);
  });

  themeBtns.forEach(function(b) {
    b.classList.toggle('sel', b.getAttribute('data-theme') === selectedTheme);
  });

  whToggle.setAttribute('aria-checked', String(workHoursEnabled));
  whToggle.classList.toggle('on', workHoursEnabled);
  whTimes.classList.toggle('show', workHoursEnabled);
  whStartInput.value = workStart;
  whEndInput.value = workEnd;

  dayBtns.forEach(function(btn) {
    var day = parseInt(btn.getAttribute('data-day'));
    btn.classList.toggle('paused', weekendDays.indexOf(day) > -1);
  });
}

function initFromState() {
  send({ type: 'GET_STATE' }).then(function(state) {
    if (!state) return; // fall back to the hardcoded defaults already reflected in the HTML
    selectedMin = state.intervalMin || selectedMin;
    selectedMode = state.focusMode ? 'strict' : 'notification';
    selectedTheme = state.theme || selectedTheme;
    workHoursEnabled = !!state.workHoursEnabled;
    workStart = state.workStart || workStart;
    workEnd = state.workEnd || workEnd;
    weekendDays = Array.isArray(state.weekendDays) ? state.weekendDays.slice() : weekendDays;
    applyStateToUI();
  });
}
initFromState();

// ===== NAVIGATION =====
function updatePips() {
  for (var i = 0; i < TOTAL; i++) {
    var pip = el('pip' + i);
    if (i < step) pip.className = 'pip done';
    else if (i === step) pip.className = 'pip active';
    else pip.className = 'pip';
  }
  var isLast = step === TOTAL - 1;
  el('nextBtn').textContent = isLast ? 'Get started 🌿' : 'Next →';
  el('nextBtn').className = isLast ? 'btn-next done-btn' : 'btn-next';
  // Show back button on all steps except the first
  el('backBtn').style.display = step > 0 ? '' : 'none';
}

el('backBtn').onclick = function() {
  if (step <= 0) return;
  el('step' + step).classList.remove('active');
  step--;
  el('step' + step).classList.add('active');
  updatePips();
  // Reset finishing state so Next works again if user went back from last step
  finishing = false;
  el('nextBtn').disabled = false;
};

var finishing = false;

el('nextBtn').onclick = function() {
  if (step < TOTAL - 1) {
    el('step' + step).classList.remove('active');
    step++;
    el('step' + step).classList.add('active');
    updatePips();
  } else {
    if (finishing) return; // Bug 1 fix: prevent double-click
    finishing = true;
    el('nextBtn').disabled = true;
    finish();
  }
};

el('skipBtn').onclick = function() {
  send({ type: 'SET_PREF', key: 'onboardingDone', value: true }).then(function() {
    chrome.tabs.getCurrent(function(tab) {
      if (tab) chrome.tabs.remove(tab.id);
    });
  });
};

el('openShortcutsBtn').onclick = function() {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
};

function finish() {
  // Bug 2 fix: always read latest values from inputs at save time
  workStart = (el('whStart') && el('whStart').value) || workStart;
  workEnd = (el('whEnd') && el('whEnd').value) || workEnd;

  send({ type: 'SET_INTERVAL', intervalMin: selectedMin }).then(function() {
    return send({ type: 'SET_FOCUS', value: selectedMode === 'strict' });
  }).then(function() {
    return send({ type: 'SET_PREF', key: 'theme', value: selectedTheme });
  }).then(function() {
    // Always send this — not just when enabling — so turning work hours OFF
    // during a replay actually persists instead of silently being a no-op.
    return send({ type: 'SET_WORK_HOURS', enabled: workHoursEnabled, start: workStart, end: workEnd });
  }).then(function() {
    return send({ type: 'SET_WEEKEND_DAYS', days: weekendDays });
  }).then(function() {
    return send({ type: 'SET_PREF', key: 'onboardingDone', value: true });
  }).then(function() {
    chrome.tabs.getCurrent(function(tab) {
      if (tab) chrome.tabs.remove(tab.id);
    });
  }).catch(function() {
    // If anything failed, re-enable the button so user can try again
    finishing = false;
    el('nextBtn').disabled = false;
  });
}
