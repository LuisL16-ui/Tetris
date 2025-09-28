window.addEventListener('DOMContentLoaded', ()=>{
  // Throttle utility para optimizar eventos frecuentes
  const throttle = (func, limit) => {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  };

  function keyLabel(code){
    if(!code) return '';
    if(code.startsWith('Key')) return code.slice(3);
    if(code.startsWith('Digit')) return code.slice(5);
    if(code.startsWith('Arrow')) return code.slice(5);
    if(code === 'Space') return 'Space';
    if(code.startsWith('Numpad')) return code.slice(6);
    return code;
  }

  const board = document.getElementById('board');
  const next = document.getElementById('next');
  [board,next].forEach(c=>{ c.style.width = c.width + 'px'; c.style.height = c.height + 'px'; });

  // Destruir instancia anterior del juego si existe
  if(window.game && typeof window.game.destroy === 'function') {
    window.game.destroy();
  }

  // Create game but don't auto-start; user must press INICIAR
  window.game = new Game(board,next, { autoStart: false });

  // Start overlay/button
  const startOverlay = document.getElementById('startOverlay');
  const btnStart = document.getElementById('btnStart');
  function hideStartOverlay(){ if(startOverlay) startOverlay.classList.add('hidden'); }
  function showStartOverlay(){ if(startOverlay) startOverlay.classList.remove('hidden'); }
  if(btnStart){ btnStart.addEventListener('click', ()=>{ try{ AudioManager.play('start'); window.game.startGame(); AudioManager.startMusicIfEnabled(); }catch(e){} hideStartOverlay(); }); }

  // --- Audio manager (simple) ---
  // header sound toggle removed; use toggle inside audio modal
  const audioEnabledToggle = document.getElementById('audioEnabledToggle');
  const AudioManager = (function(){
    let enabled = true;
    const STORAGE_KEY = 'tetris_audio';
    // base coefficients to tune relative loudness
    const BASE_MUSIC_COEF = 0.36; // music sits softer by default
    const BASE_SFX_COEF = 0.9;

    const assets = {
      click: new Audio('assets/click.mp3'),
      lineclear: new Audio('assets/linearclear.mp3'),
      music: new Audio('assets/bg-loop.wav'),
      start: new Audio('assets/startGame.ogg')
    };
    // music loops
    assets.music.loop = true;
    assets.lineclear.loop = false;

    // load prefs (master/music/sfx) from localStorage
    function loadPrefs(){
      try{
        const raw = localStorage.getItem(STORAGE_KEY);
        if(!raw) return { master:36, music:36, sfx:90 };
        const parsed = JSON.parse(raw);
        return {
          master: Math.max(0, Math.min(100, Number(parsed.master)||36)),
          music: Math.max(0, Math.min(100, Number(parsed.music)||36)),
          sfx: Math.max(0, Math.min(100, Number(parsed.sfx)||90))
        };
      }catch(e){ return { master:36, music:36, sfx:90 }; }
    }

    function savePrefs(p){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }catch(e){} }

    let prefs = loadPrefs();

    function applyVolumes(fromPrefs){
      const p = fromPrefs || prefs;
      const mMaster = (p.master || 0) / 100;
      const mMusic = (p.music || 0) / 100;
      const mSfx = (p.sfx || 0) / 100;
      // effective volumes
      assets.music.volume = Math.max(0, Math.min(1, BASE_MUSIC_COEF * mMaster * mMusic));
      assets.lineclear.volume = Math.max(0, Math.min(1, BASE_SFX_COEF * mMaster * mSfx));
      // keep click silent unless intentionally used
      assets.click.volume = 0.0;
    }

    // apply initial volumes
    applyVolumes();

  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) {
      try {
        assets.music.pause();
      } catch (e) {}
    } else {
      try {
        assets.music.play().catch(() => {});
      } catch (e) {}
    }
    if (audioEnabledToggle)
      audioEnabledToggle.setAttribute('aria-pressed', String(enabled));
  }
    function toggle(){ setEnabled(!enabled); }
    function play(name){ if(!enabled) return; const a = assets[name]; if(!a) return; try{ a.currentTime = 0; a.play().catch(()=>{}); }catch(e){} }
    function startMusicIfEnabled(){ if(enabled){ try{ assets.music.play().catch(()=>{}); }catch(e){} } }

    // API to adjust volumes (live preview). Save separately when desired.
    function setMaster(v){ prefs.master = Math.max(0, Math.min(100, Number(v)||0)); applyVolumes(); }
    function setMusic(v){ prefs.music = Math.max(0, Math.min(100, Number(v)||0)); applyVolumes(); }
    function setSfx(v){ prefs.sfx = Math.max(0, Math.min(100, Number(v)||0)); applyVolumes(); }
    function getPrefs(){ return Object.assign({}, prefs); }
    function save(){ savePrefs(prefs); }

    // Backwards-compatibility single-setter
    function setVolume(percent){ setMaster(percent); save(); }
    function isEnabled(){ return !!enabled; }
    function getVolume(){ return prefs.master; }

    return { setEnabled, toggle, play, startMusicIfEnabled, setMaster, setMusic, setSfx, getPrefs, save, setVolume, getVolume, isEnabled };
  })();

  // wire volume slider (modal)
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeValue = document.getElementById('volumeValue');
  if(volumeSlider && volumeValue){
    // init slider from persisted value
    try{ const v = Number(localStorage.getItem('tetris_volume') || 36); volumeSlider.value = String(v); volumeValue.textContent = v + '%'; AudioManager.setVolume && AudioManager.setVolume(v); }catch(e){}
    volumeSlider.addEventListener('input', (e)=>{ const v = Number(e.target.value||0); volumeValue.textContent = v + '%'; AudioManager.setVolume && AudioManager.setVolume(v); });
    volumeSlider.addEventListener('change', (e)=>{ const v = Number(e.target.value||0); volumeValue.textContent = v + '%'; AudioManager.setVolume && AudioManager.setVolume(v); });
  }

  // initialize audio toggle inside modal
  if(audioEnabledToggle){
    // set initial state from AudioManager
    try{
      const en = AudioManager.isEnabled();
      audioEnabledToggle.setAttribute('aria-pressed', String(en));
      audioEnabledToggle.classList.toggle('active', !!en);
    }catch(e){}
    audioEnabledToggle.addEventListener('click', ()=>{
      AudioManager.toggle();
      const en = AudioManager.isEnabled();
      audioEnabledToggle.classList.toggle('active', !!en);
      try{ audioEnabledToggle.setAttribute('aria-pressed', String(en)); }catch(e){}
    });
  }

  // --- Audio configuration modal wiring (master/music/sfx) ---
  const btnAudioConfig = document.getElementById('btnAudioConfig');
  const modalAudioConfig = document.getElementById('modalAudioConfig');
  const audioMaster = document.getElementById('audioMaster');
  const audioMusic = document.getElementById('audioMusic');
  const audioSfx = document.getElementById('audioSfx');
  const btnAudioSave = document.getElementById('btnAudioSave');
  const btnAudioCancel = document.getElementById('btnAudioCancel');

  if(btnAudioConfig){
    btnAudioConfig.addEventListener('click', ()=>{
      // open audio modal (hide main pause modal)
      if(!modal.classList.contains('hidden')) modal.classList.add('hidden');
      if(modalAudioConfig) modalAudioConfig.classList.remove('hidden');
      // load current prefs into sliders
      try{
        const p = AudioManager.getPrefs();
        // snapshot original prefs so Cancel can restore
        _origAudioPrefs = Object.assign({}, p);
        if(audioMaster) audioMaster.value = String(p.master||36);
        if(audioMusic) audioMusic.value = String(p.music||36);
        if(audioSfx) audioSfx.value = String(p.sfx||90);
      }catch(e){}
    });
  }

  // Track original prefs so cancel can revert
  let _origAudioPrefs = null;
  function openAudioModal(){ if(modalAudioConfig){ modalAudioConfig.classList.remove('hidden'); } }
  function closeAudioModal(){ if(modalAudioConfig){ modalAudioConfig.classList.add('hidden'); } }

  // When sliders change, apply live (but do not persist until Save)
  if(audioMaster){ audioMaster.addEventListener('input', (e)=>{ AudioManager.setMaster(Number(e.target.value||0)); }); }
  if(audioMusic){ audioMusic.addEventListener('input', (e)=>{ AudioManager.setMusic(Number(e.target.value||0)); }); }
  if(audioSfx){ audioSfx.addEventListener('input', (e)=>{ AudioManager.setSfx(Number(e.target.value||0)); }); }

  if(btnAudioCancel){ btnAudioCancel.addEventListener('click', ()=>{
    // restore original prefs
    try{ if(_origAudioPrefs){ AudioManager.setMaster(_origAudioPrefs.master); AudioManager.setMusic(_origAudioPrefs.music); AudioManager.setSfx(_origAudioPrefs.sfx); }
    }catch(e){}
    closeAudioModal(); if(modal) modal.classList.remove('hidden');
  }); }

  if(btnAudioSave){ btnAudioSave.addEventListener('click', ()=>{
    // persist current prefs
    try{ AudioManager.save(); }catch(e){}
    closeAudioModal(); if(modal) modal.classList.remove('hidden');
  }); }

  // When opening audio modal, snapshot original prefs for cancel
  if(modalAudioConfig){
    modalAudioConfig.addEventListener('transitionstart', ()=>{
      try{ _origAudioPrefs = AudioManager.getPrefs(); }catch(e){ _origAudioPrefs = null; }
    });
  }

  // Click sound removed per request (clicks were out of sync). No delegated click playback.

  // Play line clear sound when game emits event
  window.addEventListener('tetris:lineclear', (ev)=>{ AudioManager.play('lineclear'); });

  // Background music will be started explicitly when the user presses START

  // Modal elements
  const modal = document.getElementById('modal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalMain = document.getElementById('modalMain');
  const keyConfigModal = document.getElementById('modalKeyConfig');
  const keyConfigOverlay = document.getElementById('modalOverlayKey');
  const keyConfigPanel = document.getElementById('keyConfig');
  const keyRowsContainer = keyConfigPanel.querySelector('.key-rows');

  const btnRestart = document.getElementById('btnRestart');
  const btnKeyConfig = document.getElementById('btnKeyConfig');
  const btnKeyBack = document.getElementById('btnKeyBack');
  const btnKeySave = document.getElementById('btnKeySave');
  const btnKeyReset = document.getElementById('btnKeyReset');
  const saveBadge = document.getElementById('saveBadge');

  const unsavedToast = document.getElementById('unsavedToast');
  const toastDiscard = document.getElementById('toastDiscard');
  const toastCancel = document.getElementById('toastCancel');
  const successToast = document.getElementById('successToast');
  const successToastContent = document.getElementById('successToastContent');

  const speedButtons = Array.from(document.querySelectorAll('.speed-btn'));

  // Normaliza nombres y asegura claves canónicas
  function normalizeBindings(raw){
    const normalized = {};
    const canonical = ['moveLeft','moveRight','softDrop','hardDrop','rotateLeft','rotateRight'];
    if(!raw || typeof raw !== 'object'){
      canonical.forEach(k=>normalized[k]=undefined);
      return normalized;
    }
    // copy exact values if present
    canonical.forEach(k=>{ if(raw[k]) normalized[k]=raw[k]; else normalized[k]=undefined; });
    // compat: older shape could have `rotate` or `rotate` alias; map it to rotateRight if rotateRight missing
    if(raw.rotate && !normalized.rotateRight) normalized.rotateRight = raw.rotate;
    // also accept rotate (single) used previously
    return normalized;
  }

  let pendingBindings = normalizeBindings(window.game.bindings);

  function hasUnsavedChanges(){
    const saved = normalizeBindings(window.game.bindings);
    const pending = normalizeBindings(pendingBindings);
    const canonical = ['moveLeft','moveRight','softDrop','hardDrop','rotateLeft','rotateRight'];
    for(const k of canonical){
      const s = saved[k] || '';
      const p = pending[k] || '';
      if(s !== p) return true;
    }
    return false;
  }

  // Construye un mapa { keyCode: [actions...] } para detectar duplicados
  function computeDuplicateMap(bindings){
    if(!bindings) return {};
    const norm = normalizeBindings(bindings);
    const map = {};
    Object.keys(norm).forEach(k=>{
      const code = norm[k] || '';
      if(!code) return;
      if(!map[code]) map[code]=[];
      map[code].push(k);
    });
    return map;
  }

  function hasDuplicateAssignments(){
    const source = pendingBindings || window.game.bindings;
    const map = computeDuplicateMap(source);
    return Object.keys(map).some(c=>map[c].length>1);
  }

  function updateSaveButtonState(){
    if(!btnKeySave) return;
    const unsaved = hasUnsavedChanges();
    const hasDup = hasDuplicateAssignments();
    btnKeySave.disabled = !unsaved || hasDup;
    if(saveBadge){
      if(hasDup){ saveBadge.textContent = 'Conflicto'; saveBadge.classList.add('changes'); saveBadge.classList.add('conflict'); }
      else { saveBadge.textContent = unsaved ? 'Cambios' : 'Sin cambios'; saveBadge.classList.toggle('changes', !!unsaved); saveBadge.classList.remove('conflict'); }
    }
  }

  function showUnsavedToast(){
    const visibleModal = (!keyConfigModal.classList.contains('hidden')) ? keyConfigModal : modal;
    const modalContent = visibleModal.querySelector('.modal-content'); if(!modalContent) return;
    unsavedToast.classList.remove('hidden');
    const toastBox = unsavedToast.querySelector('.toast-content');
    const rect = modalContent.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2; const top = rect.bottom + 20;
    toastBox.style.left = centerX + 'px'; toastBox.style.transform = 'translateX(-50%)';
    toastBox.style.top = Math.min(window.innerHeight - toastBox.offsetHeight - 8, top) + 'px';
    try{ prevFocusedElement = document.activeElement; toastDiscard.focus(); window.addEventListener('keydown', onToastKeydown); }catch(e){}
  }
  function hideUnsavedToast(){ unsavedToast.classList.add('hidden'); try{ window.removeEventListener('keydown', onToastKeydown); if(prevFocusedElement && typeof prevFocusedElement.focus === 'function') prevFocusedElement.focus(); }catch(e){} }
  let prevFocusedElement = null;
  function onToastKeydown(e){ if(unsavedToast.classList.contains('hidden')) return; if(e.key === 'Enter'){ e.preventDefault(); toastDiscard.click(); }else if(e.key === 'Escape'){ e.preventDefault(); toastCancel.click(); } }

  // Render lateral controls panel (always from saved bindings)
  function renderControlsPanel(){
    const panel = document.querySelector('.panel.controls'); if(!panel) return;
    const raw = (window.game && window.game.bindings) ? window.game.bindings : {};
    const source = normalizeBindings(raw);
    const rows = [
      {text: 'Menu', key: 'Escape'},
      {text: 'Mover izquierda', key: source.moveLeft},
      {text: 'Mover derecha', key: source.moveRight},
      {text: 'Bajar (mantener)', key: source.softDrop},
      {text: 'Rotar izquierda', key: source.rotateLeft},
      {text: 'Rotar derecha', key: source.rotateRight},
      {text: 'Bajar instantáneo', key: source.hardDrop}
    ];
    const html = rows.map(r=>`<div>${r.text}: <strong>${keyLabel(r.key)||'-'}</strong></div>`).join('\n');
    panel.innerHTML = `<h2>Controles</h2>${html}`;
  }

  function renderKeyRows(){
    keyRowsContainer.innerHTML = '';
    const actions = [
      {id:'moveLeft', label:'Mover izquierda'},
      {id:'moveRight', label:'Mover derecha'},
      {id:'softDrop', label:'Bajar (soft)'},
      {id:'rotateLeft', label:'Rotar izquierda'},
      {id:'rotateRight', label:'Rotar derecha'},
      {id:'hardDrop', label:'Bajar instantáneo'}
    ];
    const source = pendingBindings || window.game.bindings;
    const norm = normalizeBindings(source);
    const duplicates = computeDuplicateMap(norm);
    actions.forEach(a=>{
      const row = document.createElement('div'); row.className='key-row';
      const label = document.createElement('div'); label.className='key-label'; label.textContent = a.label;
      const btn = document.createElement('button'); btn.className='key-btn'; btn.textContent = keyLabel(norm[a.id]) || '-';
      btn.dataset.action = a.id; btn.addEventListener('click', ()=>startListening(btn));
      // Marcar conflicto si la tecla está asignada a más de una acción
      if(duplicates && duplicates[norm[a.id]] && duplicates[norm[a.id]].length > 1){
        btn.classList.add('conflict');
        const note = document.createElement('div'); note.className = 'conflict-note'; note.textContent = 'Duplicada';
        row.appendChild(label); row.appendChild(btn); row.appendChild(note);
      } else {
        row.appendChild(label); row.appendChild(btn);
      }
      keyRowsContainer.appendChild(row);
    });
    updateSaveButtonState();
  }

  let listeningBtn = null;
  function startListening(button){
    if(listeningBtn) return;
    button.classList.add('listening');
    const previousLabel = button.textContent;
    button.textContent = '...';
    listeningBtn = button;

    function onKey(e){
      e.preventDefault();
      const code = e.code;
      const action = listeningBtn.dataset.action;
  if(!pendingBindings) pendingBindings = normalizeBindings(window.game.bindings);

  // Construir el mapa actual efectivo (pending override sobre game.bindings) y normalizar
  const effectiveRaw = Object.assign({}, window.game.bindings, pendingBindings);
  const effective = normalizeBindings(effectiveRaw);

  // Buscar si la tecla ya está asignada a otra acción
  const alreadyFor = Object.keys(effective).find(k => (effective[k] === code));
      if(alreadyFor && alreadyFor !== action){
        // Mostrar mensaje breve en el botón y no asignar
        listeningBtn.classList.remove('listening');
        listeningBtn.classList.add('invalid');
        listeningBtn.textContent = 'Tecla ya usada → ' + alreadyFor;
        window.removeEventListener('keydown', onKey);
        // revertir el texto tras 1.6s
        setTimeout(()=>{
          if(listeningBtn){
            listeningBtn.classList.remove('invalid');
            const normPending = normalizeBindings(pendingBindings || {});
            const normSaved = normalizeBindings(window.game.bindings || {});
            listeningBtn.textContent = keyLabel(normPending[action] || normSaved[action]) || '-';
          }
          listeningBtn = null;
        }, 1600);
        updateSaveButtonState();
        return;
      }

  // Asignación permitida (o reasignando la misma acción)
  // Actualizar pending y normalizar inmediatamente
  pendingBindings = Object.assign({}, pendingBindings || {}, { [action]: code });
  pendingBindings = normalizeBindings(pendingBindings);
      listeningBtn.classList.remove('listening');
      listeningBtn.textContent = keyLabel(code);
      listeningBtn = null;
      window.removeEventListener('keydown', onKey);
      updateSaveButtonState();
    }

    window.addEventListener('keydown', onKey);
  }

  // Handlers
  btnKeyConfig && btnKeyConfig.addEventListener('click', ()=>{
    pendingBindings = normalizeBindings(window.game.bindings);
    if(!modal.classList.contains('hidden')) modal.classList.add('hidden');
    keyConfigModal.classList.remove('hidden');
    renderKeyRows(); updateSaveButtonState();
  });

  btnKeyBack && btnKeyBack.addEventListener('click', ()=>{
    if(hasUnsavedChanges()) { showUnsavedToast(); return; }
    pendingBindings = null; keyConfigModal.classList.add('hidden'); if(modal) modal.classList.remove('hidden');
  });

  btnKeySave && btnKeySave.addEventListener('click', ()=>{
    if(pendingBindings){
      const norm = normalizeBindings(pendingBindings);
      window.game.bindings = Object.assign({}, norm);
      try{ localStorage.setItem('tetris_bindings', JSON.stringify(window.game.bindings)); }catch(e){}
      pendingBindings = null;
    }
    keyConfigModal.classList.add('hidden'); if(modal) modal.classList.remove('hidden'); updateSaveButtonState(); renderControlsPanel();
  });

  btnKeyReset && btnKeyReset.addEventListener('click', ()=>{
    const defaultBindingsRaw = { moveLeft:'ArrowLeft', moveRight:'ArrowRight', softDrop:'ArrowDown', rotateLeft:'KeyZ', rotateRight:'KeyX', hardDrop:'Space' };
    pendingBindings = normalizeBindings(defaultBindingsRaw);
    renderKeyRows(); updateSaveButtonState();
    if(successToast){ clearTimeout(window._successToastTimer); successToast.classList.remove('hidden'); successToast.classList.add('show'); window._successToastTimer = setTimeout(()=>{ successToast.classList.remove('show'); successToast.classList.add('hidden'); }, 1600); }
  });

  toastDiscard && toastDiscard.addEventListener('click', ()=>{ pendingBindings = null; hideUnsavedToast(); keyConfigModal.classList.add('hidden'); if(modal) modal.classList.remove('hidden'); updateSaveButtonState(); });
  toastCancel && toastCancel.addEventListener('click', ()=>{ hideUnsavedToast(); });

  // Modal control and pause
  function openModal(){ if(modal) modal.classList.remove('hidden'); }
  function closeModal(){ if(modal) modal.classList.add('hidden'); }
  function closeModalClean(){ pendingBindings = null; keyConfigPanel.classList.add('hidden'); if(modalMain) modalMain.classList.remove('hidden'); const content = modal.querySelector('.modal-content'); if(content) content.style.minWidth = ''; closeModal(); }
  function toggleModal(){ 
    const shouldToggle = window.game && (window.game.isRunning || window.game.startTime);
    if(modal.classList.contains('hidden')){ 
      openModal(); 
      if(shouldToggle){ try{ window.game.togglePause(); }catch(e){} }
    } else { 
      closeModalClean(); 
      if(shouldToggle){ try{ window.game.togglePause(); }catch(e){} }
    } 
  }

  window.addEventListener('keydown', function(e){
    if(e.code !== 'Escape') return;
    try{ /* debug */ }catch(_){ }
    e.preventDefault();
    // If Game Over modal is open, close it first
    try{
      const mg = document.getElementById('modalGameOver');
      if(mg && !mg.classList.contains('hidden')){ mg.classList.add('hidden'); e.stopImmediatePropagation(); return; }
    }catch(_){ }
    if(!keyConfigModal.classList.contains('hidden')){
      if(hasUnsavedChanges()){ showUnsavedToast(); e.stopImmediatePropagation(); return; }
      pendingBindings = null; keyConfigModal.classList.add('hidden'); if(modal) modal.classList.remove('hidden'); e.stopImmediatePropagation(); return;
    }
    // If audio config modal is open, treat ESC as Cancel (restore original prefs) and close it
    try{
      if(modalAudioConfig && !modalAudioConfig.classList.contains('hidden')){
        try{ if(_origAudioPrefs){ AudioManager.setMaster(_origAudioPrefs.master); AudioManager.setMusic(_origAudioPrefs.music); AudioManager.setSfx(_origAudioPrefs.sfx); } }catch(_e){}
        if(modalAudioConfig) modalAudioConfig.classList.add('hidden'); if(modal) modal.classList.remove('hidden'); e.stopImmediatePropagation(); return;
      }
    }catch(_){ }
    try{ 
      // Only toggle modal / pause if the game has started
      if(window.game && (window.game.isRunning || window.game.startTime)){
        toggleModal();
      }
    }catch(err){ console.error('[TETRIS] Error in ESC handler:', err); }
    e.stopImmediatePropagation();
  }, true);

  modalOverlay && modalOverlay.addEventListener('click', ()=>{ closeModalClean(); try{ if(window.game && window.game.startTime) window.game.togglePause(); }catch(e){} });
  // audio modal overlay should cancel and restore audio prefs (like btnAudioCancel)
  const modalAudioOverlay = document.getElementById('modalAudioOverlay');
  modalAudioOverlay && modalAudioOverlay.addEventListener('click', ()=>{
    try{ if(_origAudioPrefs){ AudioManager.setMaster(_origAudioPrefs.master); AudioManager.setMusic(_origAudioPrefs.music); AudioManager.setSfx(_origAudioPrefs.sfx); } }catch(e){}
    if(modalAudioConfig) modalAudioConfig.classList.add('hidden'); if(modal) modal.classList.remove('hidden');
  });
  keyConfigOverlay && keyConfigOverlay.addEventListener('click', ()=>{ if(hasUnsavedChanges()){ showUnsavedToast(); return; } pendingBindings = null; keyConfigModal.classList.add('hidden'); if(modal) modal.classList.remove('hidden'); });

  btnRestart && btnRestart.addEventListener('click', ()=>{ closeModalClean(); window.game.restartGame(); });

  // Mobile-only modal close button
  const btnModalClose = document.getElementById('btnModalClose');
  if(btnModalClose){ btnModalClose.addEventListener('click', ()=>{ try{ closeModalClean(); // do not toggle pause if game not started
    if(window.game && (window.game.isRunning || window.game.startTime)){
      try{ window.game.togglePause(); }catch(e){}
    }
  }catch(e){} }); }

  speedButtons.forEach(b=>{ b.addEventListener('click', ()=>{ speedButtons.forEach(x=>x.classList.remove('active')); b.classList.add('active'); const mult = Number(b.getAttribute('data-mult')) || 1; window.game.setSpeed(mult); }); });

  // Listen to custom events for stats/time
  window.addEventListener('tetris:stats', ev=>{ const d = ev.detail || {}; document.getElementById('score').textContent = d.score || window.game.score || 0; document.getElementById('lines').textContent = d.lines || window.game.lines || 0; document.getElementById('level').textContent = d.level || window.game.level || 1; });
  window.addEventListener('tetris:time', ev=>{ const s = ev.detail || 0; document.getElementById('time').textContent = s; });

  // Initial render
  renderControlsPanel(); renderKeyRows(); updateSaveButtonState();

  // Responsive rearrange for mobile - optimizado con throttling
  const mobileTopbar = document.getElementById('mobileTopbar');
  const leaderboardPanel = document.querySelector('.leaderboard');
  const panels = Array.from(document.querySelectorAll('aside.sidebar .panel'));
  const markerPanel = panels.find(p => p.querySelector('#score'));
  const timePanel = panels.find(p => p.querySelector('#time'));
  let currentIsMobile = null; // Cache para evitar cambios innecesarios

  function applyMobileLayout(){
    const isMobile = window.innerWidth <= 780;
    
    // Evitar trabajo innecesario si no cambió el estado
    if (currentIsMobile === isMobile) return;
    currentIsMobile = isMobile;
    
    if(isMobile){
      if(mobileTopbar){
        mobileTopbar.classList.remove('hidden');
        // ensure marker (score) is left and time is right
        if(markerPanel) mobileTopbar.appendChild(markerPanel);
        if(timePanel) mobileTopbar.appendChild(timePanel);
        mobileTopbar.setAttribute('aria-hidden','false');
        mobileTopbar.style.order = '1';
      }
      // move leaderboard to bottom of content (after aside) so it appears at the end
      if(leaderboardPanel){
        const container = document.querySelector('.content');
        if(container) container.appendChild(leaderboardPanel);
        leaderboardPanel.setAttribute('aria-hidden','false');
        // force it to render after other items
        try{ leaderboardPanel.style.order = '9999'; }catch(e){}
      }
      // ensure touch controls are visible (CSS handles display)
    } else {
      // restore original sidebar order: leaderboard at start, then panels
      const sidebar = document.querySelector('aside.sidebar');
      // place leaderboard to the left of the board (before .board-wrap) on desktop
      const content = document.querySelector('.content');
      const boardWrap = document.querySelector('.board-wrap');
      if(content && boardWrap && leaderboardPanel){ content.insertBefore(leaderboardPanel, boardWrap); }
      else if(sidebar && leaderboardPanel){ sidebar.insertBefore(leaderboardPanel, sidebar.firstChild); }
      // prefer placing marker/time inside .panel-stats-grid if it exists
      const statsGrid = document.querySelector('.panel-stats-grid');
      if(statsGrid){ if(markerPanel) statsGrid.appendChild(markerPanel); if(timePanel) statsGrid.appendChild(timePanel); }
      else { if(markerPanel && sidebar) sidebar.appendChild(markerPanel); if(timePanel && sidebar) sidebar.appendChild(timePanel); }
      if(mobileTopbar){ mobileTopbar.classList.add('hidden'); mobileTopbar.setAttribute('aria-hidden','true'); mobileTopbar.style.order = ''; }
      if(leaderboardPanel){ leaderboardPanel.setAttribute('aria-hidden','false'); leaderboardPanel.style.order = ''; }
    }
    
    // Invalidar cache del overlay width cuando cambia el layout
    if(window.game && window.game._cachedOverlayWidth) {
      window.game._cachedOverlayWidth = null;
    }
  }

  const throttledApplyMobileLayout = throttle(applyMobileLayout, 150);
  window.addEventListener('resize', throttledApplyMobileLayout, { passive: true });
  // run once on load
  applyMobileLayout();

  // --- Game Over modal handling ---
  const modalGameOver = document.getElementById('modalGameOver');
  const modalGameOverOverlay = document.getElementById('modalGameOverOverlay');
  const gameOverScore = document.getElementById('gameOverScore');
  const gameOverName = document.getElementById('gameOverName');
  const btnGameOverSubmit = document.getElementById('btnGameOverSubmit');
  const btnGameOverRestart = document.getElementById('btnGameOverRestart');

  function openGameOver(score){
    if(!modalGameOver) return;
    
    gameOverScore.textContent = String(score || 0);
    gameOverName.value = '';
    if(!modal.classList.contains('hidden')) modal.classList.add('hidden');
    modalGameOver.classList.remove('hidden');
    
    // Enfocar el input del nombre automáticamente después de un pequeño delay
    // para asegurar que el modal esté completamente visible
    setTimeout(() => {
      if(gameOverName && typeof gameOverName.focus === 'function') {
        gameOverName.focus();
      }
    }, 100);
  }

  function closeGameOver(){ if(!modalGameOver) return; modalGameOver.classList.add('hidden'); }

  window.addEventListener('tetris:ended', (ev)=>{ const score = ev && ev.detail ? ev.detail.score : 0; openGameOver(score); });

  btnGameOverSubmit && btnGameOverSubmit.addEventListener('click', ()=>{
    const name = (gameOverName && gameOverName.value) ? gameOverName.value.trim().slice(0,24) : '';
    const scoreText = gameOverScore ? gameOverScore.textContent : '0';
    const score = Number(scoreText) || 0;
    
    try{ window.dispatchEvent(new CustomEvent('tetris:gameover', { detail: { name, score } })); }catch(e){ console.error('Error dispatching event:', e); }
    closeGameOver();
    try{ window.game && window.game.restartGame(); }catch(e){}
  });

  btnGameOverRestart && btnGameOverRestart.addEventListener('click', ()=>{
    closeGameOver();
    try{ window.game && window.game.restartGame(); }catch(e){}
  });

  modalGameOverOverlay && modalGameOverOverlay.addEventListener('click', ()=>{ closeGameOver(); });

  // --- Touch / on-screen controls - optimizado ---
  const touchLeft = document.getElementById('btnTouchLeft');
  const touchRight = document.getElementById('btnTouchRight');
  const touchSoft = document.getElementById('btnTouchSoft');
  const touchHard = document.getElementById('btnTouchHard');
  const touchRotateL = document.getElementById('btnTouchRotateL');
  const touchRotateR = document.getElementById('btnTouchRotateR');
  const touchPause = document.getElementById('btnTouchPause');

  // Helper: simulate keydown/keyup behavior on the game (optimizado)
  function dispatchKeyDown(code){ 
    const e = new KeyboardEvent('keydown',{code, bubbles: false}); 
    window.dispatchEvent(e); 
  }
  function dispatchKeyUp(code){ 
    const e = new KeyboardEvent('keyup',{code, bubbles: false}); 
    window.dispatchEvent(e); 
  }

  // Continuous press helpers - optimizado con mejor timing
  let leftTouchInterval=null, rightTouchInterval=null;
  const TOUCH_REPEAT_DELAY = 120; // ms para inicio
  const TOUCH_REPEAT_RATE = 90;   // ms entre repeticiones
  
  function startLeft(){ 
    if(leftTouchInterval) return; 
    dispatchKeyDown(window.game.bindings.moveLeft); 
    setTimeout(() => {
      if(leftTouchInterval === null) return;
      leftTouchInterval = setInterval(()=>dispatchKeyDown(window.game.bindings.moveLeft), TOUCH_REPEAT_RATE);
    }, TOUCH_REPEAT_DELAY);
    leftTouchInterval = true;
  }
  
  function stopLeft(){ 
    if(leftTouchInterval && typeof leftTouchInterval !== 'boolean'){
      clearInterval(leftTouchInterval); 
    }
    leftTouchInterval=null; 
    dispatchKeyUp(window.game.bindings.moveLeft); 
  }
  
  function startRight(){ 
    if(rightTouchInterval) return; 
    dispatchKeyDown(window.game.bindings.moveRight); 
    setTimeout(() => {
      if(rightTouchInterval === null) return;
      rightTouchInterval = setInterval(()=>dispatchKeyDown(window.game.bindings.moveRight), TOUCH_REPEAT_RATE);
    }, TOUCH_REPEAT_DELAY);
    rightTouchInterval = true;
  }
  
  function stopRight(){ 
    if(rightTouchInterval && typeof rightTouchInterval !== 'boolean'){
      clearInterval(rightTouchInterval); 
    }
    rightTouchInterval=null; 
    dispatchKeyUp(window.game.bindings.moveRight); 
  }

  // Event listeners optimizados con passive donde sea posible
  if(touchLeft){ 
    touchLeft.addEventListener('touchstart', e=>{ e.preventDefault(); startLeft(); }, { passive: false }); 
    touchLeft.addEventListener('touchend', e=>{ e.preventDefault(); stopLeft(); }, { passive: false }); 
    touchLeft.addEventListener('touchcancel', e=>{ stopLeft(); }, { passive: true });
    touchLeft.addEventListener('mousedown', e=>{ e.preventDefault(); startLeft(); }); 
    touchLeft.addEventListener('mouseup', e=>{ stopLeft(); }); 
    touchLeft.addEventListener('mouseleave', e=>{ stopLeft(); }, { passive: true });
  }
  
  if(touchRight){ 
    touchRight.addEventListener('touchstart', e=>{ e.preventDefault(); startRight(); }, { passive: false }); 
    touchRight.addEventListener('touchend', e=>{ e.preventDefault(); stopRight(); }, { passive: false }); 
    touchRight.addEventListener('touchcancel', e=>{ stopRight(); }, { passive: true });
    touchRight.addEventListener('mousedown', e=>{ e.preventDefault(); startRight(); }); 
    touchRight.addEventListener('mouseup', e=>{ stopRight(); }); 
    touchRight.addEventListener('mouseleave', e=>{ stopRight(); }, { passive: true });
  }

  // Botones de acción única con debouncing
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  const debouncedAction = debounce((code) => {
    dispatchKeyDown(code); 
    setTimeout(()=>dispatchKeyUp(code), 50);
  }, 100);

  if(touchSoft){ touchSoft.addEventListener('click', e=>{ e.preventDefault(); debouncedAction(window.game.bindings.softDrop); }); }
  if(touchHard){ touchHard.addEventListener('click', e=>{ e.preventDefault(); debouncedAction(window.game.bindings.hardDrop); }); }
  if(touchRotateL){ touchRotateL.addEventListener('click', e=>{ e.preventDefault(); debouncedAction(window.game.bindings.rotateLeft); }); }
  if(touchRotateR){ touchRotateR.addEventListener('click', e=>{ e.preventDefault(); debouncedAction(window.game.bindings.rotateRight); }); }
  if(touchPause){ touchPause.addEventListener('click', e=>{ e.preventDefault(); try{ toggleModal(); }catch(e){} }); }
});
