(function(){
  // REMOTE_LEADERBOARD_URL should be set as a global variable before this script runs.
  let REMOTE_LEADERBOARD_URL = window.REMOTE_LEADERBOARD_URL || '';

  // Cache para evitar requests innecesarios
  let cachedLeaderboard = null;
  let lastFetchTime = 0;
  const CACHE_DURATION = 30000; // 30 segundos
  
  // Controller para cancelar requests
  let currentController = null;

  async function fetchTopRemote(limit=5, forceRefresh=false){
    if(!REMOTE_LEADERBOARD_URL) throw new Error('REMOTE_LEADERBOARD_URL not configured');
    
    // Usar cache si es válido y no se fuerza refresh
    if (!forceRefresh && cachedLeaderboard && (Date.now() - lastFetchTime < CACHE_DURATION)) {
      return cachedLeaderboard;
    }
    
    // Usar JSONP para todos los environments (más confiable para Google Apps Script)
    console.log('Using JSONP for leaderboard');
    const url = REMOTE_LEADERBOARD_URL + (REMOTE_LEADERBOARD_URL.includes('?') ? '&' : '?') + 'action=getTop&limit=' + encodeURIComponent(limit) + '&callback=';
    const data = await fetchWithJsonp(url);
    
    // Actualizar cache
    cachedLeaderboard = data;
    lastFetchTime = Date.now();
    
    return data;
  }

  async function fetchVisitCount(){
    if(!REMOTE_LEADERBOARD_URL) throw new Error('REMOTE_LEADERBOARD_URL not configured');
    
    try {
      console.log('Fetching visit count via JSONP');
      const url = REMOTE_LEADERBOARD_URL + (REMOTE_LEADERBOARD_URL.includes('?') ? '&' : '?') + 'action=getVisitCount&callback=';
      const data = await fetchWithJsonp(url);
      return data.count || 0;
    } catch(e) {
      console.warn('JSONP fetch for visit count failed:', e);
      return null;
    }
  }

  // Helper function para JSONP fallback
  function fetchWithJsonp(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
      const script = document.createElement('script');
      
      window[callbackName] = function(data) {
        delete window[callbackName];
        document.body.removeChild(script);
        resolve(data);
      };
      
      script.src = url + callbackName;
      script.onerror = () => {
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('JSONP request failed'));
      };
      
      // Timeout
      setTimeout(() => {
        if (window[callbackName]) {
          delete window[callbackName];
          document.body.removeChild(script);
          reject(new Error('JSONP request timeout'));
        }
      }, timeout);
      
      document.body.appendChild(script);
    });
  }

  async function incrementVisitCount(){
    if(!REMOTE_LEADERBOARD_URL) return;
    
    try {
      // Usar JSONP con método GET (Apps Script puede manejar incremento via GET)
      const url = REMOTE_LEADERBOARD_URL + (REMOTE_LEADERBOARD_URL.includes('?') ? '&' : '?') + 'action=incrementVisit&callback=';
      const data = await fetchWithJsonp(url);
      console.log('Visit count incremented successfully via JSONP');
      return data;
    } catch(e) {
      // Como fallback, intentar POST normal (puede fallar por CORS)
      try {
        const body = new URLSearchParams();
        body.set('action', 'incrementVisit');
        
        await fetch(REMOTE_LEADERBOARD_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString(),
          mode: 'cors'
        });
        console.log('Visit count incremented via POST');
      } catch(postErr) {
        console.warn('Could not increment visit count:', postErr.message);
      }
    }
  }

  // Función para actualizar el display del contador
  function updateVisitCounter(count) {
    const counter = document.getElementById('visitCounter');
    if (!counter) return;
    
    if (count === null || count === undefined) {
      counter.textContent = 'Estadísticas no disponibles';
      counter.style.opacity = '0.6';
    } else {
      const formatted = new Intl.NumberFormat('es-ES').format(count);
      counter.textContent = `🎮 ${formatted} juegos jugados por la comunidad`;
      counter.style.opacity = '1';
    }
  }

  let CLIENT_API_KEY = '';
  let submitController = null;

  async function postEntryRemote(name, score){
    if(!REMOTE_LEADERBOARD_URL) throw new Error('REMOTE_LEADERBOARD_URL not configured');
    
    const cleanName = String(name || '---').slice(0, 24);
    const validScore = Number(score);
    
    // Permitir score 0 pero rechazar números negativos o inválidos
    if (isNaN(validScore) || validScore < 0) {
      throw new Error('Invalid score: score must be a non-negative number');
    }
    
    try {
      // Usar JSONP con GET request (más confiable que POST para Apps Script)
      const url = REMOTE_LEADERBOARD_URL + 
        (REMOTE_LEADERBOARD_URL.includes('?') ? '&' : '?') + 
        'action=addScore&name=' + encodeURIComponent(cleanName) + 
        '&score=' + encodeURIComponent(validScore) + 
        '&callback=';
        
      console.log('Submitting score via JSONP GET');
      const result = await fetchWithJsonp(url);
      
      // Invalidar cache después de enviar
      cachedLeaderboard = null;
      lastFetchTime = 0;
      
      return result;
    } catch(jsonpErr) {
      console.warn('JSONP submission failed, trying POST fallback:', jsonpErr);
      
      // Fallback a POST tradicional
      try {
        const body = new URLSearchParams();
        body.set('name', cleanName);
        body.set('score', String(validScore));
        
        const res = await fetch(REMOTE_LEADERBOARD_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString(),
          mode: 'cors'
        });
        
        if(!res.ok) throw new Error('POST submission failed: ' + res.status);
        
        const result = await res.json();
        
        // Invalidar cache después de enviar
        cachedLeaderboard = null;
        lastFetchTime = 0;
        
        return result;
      } catch(postErr) {
        throw new Error('Both JSONP and POST submission failed: ' + postErr.message);
      }
    }
  }

  // ---- Render optimizado ----
  function render(list){
    const container = document.getElementById('leaderboardList');
    if(!container) return;
    
    // Limpiar contenido anterior
    container.innerHTML = '';
    
    if(!list || list.length===0){ 
      container.innerHTML = '<div class="lb-empty">Sin registros</div>'; 
      return; 
    }
    
    // Usar DocumentFragment para mejor performance
    const fragment = document.createDocumentFragment();
    
    list.forEach((row, idx)=>{
      const el = document.createElement('div'); 
      el.className = 'lb-row';
      
      // Crear estructura más eficiente
      const pos = document.createElement('div');
      pos.className = 'lb-pos';
      pos.textContent = `${idx+1}.`;
      
      const name = document.createElement('div');
      name.className = 'lb-name';
      name.textContent = escapeHtml(row.name);
      
      const score = document.createElement('div');
      score.className = 'lb-score';
      score.textContent = row.score;
      
      el.appendChild(pos);
      el.appendChild(name);
      el.appendChild(score);
      
      fragment.appendChild(el);
    });
    
    container.appendChild(fragment);
  }

  // Spinner helpers
  function showSpinner(){
    const container = document.getElementById('leaderboardList');
    if(!container) return;
    container.innerHTML = '<div class="lb-spinner" aria-hidden="true"></div><div class="lb-spinner-text">Cargando mejores 5...</div>';
  }
  function hideSpinner(){ }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'})[c]); }

  function renderError(msg){
    const container = document.getElementById('leaderboardList');
    if(!container) return;
    container.innerHTML = `<div class="lb-error">${escapeHtml(msg||'No se puede conectar al leaderboard')}</div>`;
  }

  // Optimizar carga inicial y agregar contador de visitas
  window.addEventListener('DOMContentLoaded', async ()=>{
    if(!REMOTE_LEADERBOARD_URL){ 
      renderError('Leaderboard remoto no configurado'); 
      updateVisitCounter(null);
      return; 
    }
    
    // Incrementar contador de visita al cargar la página
    incrementVisitCount();
    
    try{
      showSpinner();
      
      // Obtener leaderboard y contador en paralelo para mejor performance
      const [remote, visitCount] = await Promise.allSettled([
        fetchTopRemote(5),
        fetchVisitCount()
      ]);
      
      // Mostrar leaderboard
      if (remote.status === 'fulfilled') {
        render(remote.value);
      } else {
        throw remote.reason;
      }
      
      // Mostrar contador
      if (visitCount.status === 'fulfilled') {
        updateVisitCounter(visitCount.value);
      } else {
        updateVisitCounter(null);
      }
      
    }catch(e){
      console.error('Error fetching remote leaderboard:', e);
      renderError('No se puede conectar al leaderboard');
      updateVisitCounter(null);
    }
  });

  // Optimizar game over con timeout y mejor UX
  window.addEventListener('tetris:gameover', async (e)=>{
    const d = e && e.detail ? e.detail : {};
    const name = d.name||''; const score = d.score||0;
    
    if(!REMOTE_LEADERBOARD_URL){ renderError('Leaderboard remoto no configurado'); return; }
    
    try{
      showSpinner();
      await postEntryRemote(name, score);
      const top = await fetchTopRemote(5, true);
      render(top);
      
      // Animación de éxito
      const aside = document.querySelector('.leaderboard');
      if(aside){ 
        aside.classList.add('flash'); 
        setTimeout(()=>aside.classList.remove('flash'), 1200); 
      }
    }catch(err){
      console.error('Error submitting to remote leaderboard:', err);
      renderError('Error al enviar el puntaje');
    }
  });

  window.__tetris_leaderboard = {
    fetchTop: (limit, forceRefresh) => fetchTopRemote(limit, forceRefresh),
    submit: postEntryRemote,
    fetchVisitCount: fetchVisitCount,
    incrementVisit: incrementVisitCount,
    updateVisitCounter: updateVisitCounter,
    setRemoteUrl(url){ REMOTE_LEADERBOARD_URL = String(url||''); cachedLeaderboard = null; lastFetchTime = 0; },
    setApiKey(k){ CLIENT_API_KEY = String(k||''); },
    clearCache(){ cachedLeaderboard = null; lastFetchTime = 0; },
    cancelRequests(){ 
      if(currentController) currentController.abort();
      if(submitController) submitController.abort();
    }
  };
})();