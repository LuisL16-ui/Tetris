class Game {
  constructor(canvas, nextCanvas, options){
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.nextCanvas = nextCanvas; this.nextCtx = nextCanvas.getContext('2d', { alpha: false });
    this.blockSize = 24;
    this.resizeThrottle = null;
    this.resizeCanvas = this.resizeCanvas.bind(this);
    this.throttledResize = this.throttledResize.bind(this);
    this.resizeCanvas();
    window.addEventListener('resize', this.throttledResize, { passive: true });
    this.board = new Board(10,20);
    this.resizeCanvas();
    this.bag = new Bag();
    this.score = 0; this.lines = 0; this.level = 1;
    this.interval = 800;
    this.baseInterval = this.interval;
    this.speedMult = 1;
    this.dropCounter = 0;
    this.lastTime = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.hardDrop = false;
    this.animationId = null;
    this.current = this.spawn();
    this.next = this.createRandomTetromino();
    this.keys = {};
    this.bindings = {
      moveLeft: 'ArrowLeft',
      moveRight: 'ArrowRight',
      softDrop: 'ArrowDown',
      rotateLeft: 'KeyZ',
      rotateRight: 'KeyX',
      hardDrop: 'Space'
    };
    try{
      const saved = localStorage.getItem('tetris_bindings');
      if(saved){
        const parsed = JSON.parse(saved);
        if(parsed && typeof parsed === 'object') this.bindings = Object.assign({}, this.bindings, parsed);
        if(parsed && parsed.rotate && !this.bindings.rotateRight){
          this.bindings.rotateRight = parsed.rotate;
        }
        this.bindings.rotate = this.bindings.rotateRight || this.bindings.rotate;
      }
      const savedSpeed = localStorage.getItem('tetris_speed');
      if(savedSpeed) this.speedMult = Number(savedSpeed) || this.speedMult;
    }catch(e){}
    
    // Limpiar listeners anteriores antes de crear nuevos
    this.unbindKeys();
    this.bindKeys();
    this.updateTime();
    this.drawNext();
    this.options = options || {};
    if(this.options.autoStart !== false){
      this.start();
    }
  }

  // Public method to start the game loop when ready
  startGame(){
    if(this.isRunning) return;
    this.start();
  }

  // Limpia los event listeners de teclado
  unbindKeys(){
    if(this.keydownHandler){
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if(this.keyupHandler){
      window.removeEventListener('keyup', this.keyupHandler);
      this.keyupHandler = null;
    }
  }

  // Cleanup completo del juego
  destroy(){
    // Parar animación
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Limpiar timers
    clearInterval(this.timeInterval);
    
    // Remover event listeners
    this.unbindKeys();
    if(this.throttledResize){
      window.removeEventListener('resize', this.throttledResize);
    }
    
    // Resetear estados
    this.isRunning = false;
    this.isPaused = false;
    this.isGameOver = true;
  }

  // Throttled resize para evitar demasiadas llamadas
  throttledResize(){
    if (this.resizeThrottle) return;
    this.resizeThrottle = requestAnimationFrame(() => {
      this.resizeCanvas();
      this.resizeThrottle = null;
    });
  }

  // Ajusta el tamaño del canvas
  resizeCanvas(){
    const cssWidth = this.canvas.getBoundingClientRect().width || this.canvas.width;
    this.blockSize = Math.max(12, Math.floor(cssWidth / 10));
    const rows = (this.board && this.board.rows) ? this.board.rows : 20;
    const displayWidthExact = this.blockSize * 10;
    const displayHeight = this.blockSize * rows;
    
    // Solo actualizar si hay cambio significativo
    const currentWidth = parseFloat(this.canvas.style.width) || 0;
    if (Math.abs(currentWidth - displayWidthExact) > 1) {
      this.canvas.style.width = displayWidthExact + 'px';
      this.canvas.style.height = displayHeight + 'px';
      
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Limitar DPR para performance
      this.canvas.width = Math.round(displayWidthExact * dpr);
      this.canvas.height = Math.round(displayHeight * dpr);
      this.ctx.setTransform(dpr,0,0,dpr,0,0);
      // Optimizar contexto para juegos
      this.ctx.imageSmoothingEnabled = false;
    }
    
    const nsize = this.nextCanvas.getBoundingClientRect().width || this.nextCanvas.width;
    const targetNSize = Math.floor(nsize);
    const currentNWidth = parseFloat(this.nextCanvas.style.width) || 0;
    if (Math.abs(currentNWidth - targetNSize) > 1) {
      this.nextCanvas.style.width = targetNSize + 'px';
      const ndpr = Math.min(window.devicePixelRatio || 1, 2);
      this.nextCanvas.width = Math.round(nsize * ndpr);
      this.nextCanvas.height = Math.round(nsize * ndpr);
      this.nextCtx.setTransform(ndpr,0,0,ndpr,0,0);
      this.nextCtx.imageSmoothingEnabled = false;
    }
    
    const overlay = document.getElementById('nextOverlay');
    if(overlay){
      const ow = overlay.getBoundingClientRect().width || overlay.width;
      const targetOSize = Math.floor(ow);
      const currentOWidth = parseFloat(overlay.style.width) || 0;
      if (Math.abs(currentOWidth - targetOSize) > 1) {
        overlay.style.width = targetOSize + 'px';
        const odpr = Math.min(window.devicePixelRatio || 1, 2);
        overlay.width = Math.round(ow * odpr);
        overlay.height = Math.round(ow * odpr);
        const octx = overlay.getContext('2d', { alpha: false });
        octx.setTransform(odpr,0,0,odpr,0,0);
        octx.imageSmoothingEnabled = false;
      }
    }
  }

  createRandomTetromino(){
    const key = this.bag.next();
    const shape = deepCopy(Shapes[key]);
    const tet = new Tetromino(shape, Colors[key]);
    return tet;
  }

  spawn(){
    const key = this.bag.next();
    const shape = deepCopy(Shapes[key]);
    const tet = new Tetromino(shape, Colors[key]);
    tet.x = Math.floor((this.board.cols - tet.width)/2);
    tet.y = -Math.max(0, tet.shape.findIndex(row => row.some(v=>v)));
    return tet;
  }

  // Configura las teclas del juego
  bindKeys(){
    // Crear referencias a los handlers para poder removerlos después
    this.keydownHandler = (e) => {
      if(e.repeat) return;
      if(this.isGameOver || this.isPaused) return; // Prevenir input durante pausa/game over
      
      // Verificar si el usuario está escribiendo en un input o elemento editable
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return; // No interferir con la escritura
      }
      
      const handled = Object.values(this.bindings);
      if(handled.includes(e.code)) e.preventDefault();
      
      if(e.code === this.bindings.moveLeft){ 
        this.move(-1); 
        return; 
      }
      if(e.code === this.bindings.moveRight){ 
        this.move(1); 
        return; 
      }
      if(e.code === this.bindings.softDrop){ 
        this.keys['softDrop']=true; 
        return; 
      }
      if(e.code === this.bindings.hardDrop){ 
        this.hardDrop = true; 
        return; 
      }
      if(e.code === this.bindings.rotateLeft){ 
        this.rotatePiece('left'); 
        return; 
      }
      if(e.code === this.bindings.rotateRight || e.code === this.bindings.rotate){ 
        this.rotatePiece('right'); 
        return; 
      }
    };
    
    this.keyupHandler = (e) => {
      // Verificar si el usuario está escribiendo en un input o elemento editable
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        return; // No interferir con la escritura
      }
      
      if(e.code === this.bindings.softDrop) {
        this.keys['softDrop'] = false;
      }
    };
    
    // Añadir los listeners
    window.addEventListener('keydown', this.keydownHandler, { passive: false });
    window.addEventListener('keyup', this.keyupHandler, { passive: true });
  }

  start(){
    this.isRunning = true;
    this.startTime = Date.now();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  // Pausa o reanuda el juego
  togglePause(){
    this.isRunning = !this.isRunning;
    if(this.isRunning){
      this.startTime += (Date.now() - (this._pauseAt || Date.now()));
      this.lastTime = performance.now();
      this.timeInterval = setInterval(()=>{
        const s = Math.floor((Date.now() - this.startTime)/1000);
        this.emitTime && this.emitTime(s);
      },500);
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
      this.animationId = requestAnimationFrame(this.loop.bind(this));
    } else {
      this._pauseAt = Date.now();
      clearInterval(this.timeInterval);
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
    }
  }

  updateTime(){
    const el = document.getElementById('time');
    this.timeInterval = setInterval(()=>{
      const s = Math.floor((Date.now() - this.startTime)/1000);
      if(el) el.textContent = pad(Math.floor(s/60)) + ':' + pad(s%60);
    },500);
  }

  emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name, {detail})); }catch(e){} }

  loop(t){
    const delta = t - this.lastTime; this.lastTime = t;
    const dropSpeed = this.keys['softDrop'] ? 50 : this.interval;
    this.dropCounter += delta;
    if(this.hardDrop){ while(this.moveDown()){}; this.hardDrop = false; }
    else if(this.dropCounter > dropSpeed){ this.moveDown(); this.dropCounter = 0; }
    this.draw();
    if(this.isRunning) {
      this.animationId = requestAnimationFrame(this.loop.bind(this));
    } else {
      this.animationId = null;
    }
  }

  move(dir){ 
    if(this.isGameOver || this.isPaused || !this.current) return;
    this.current.x += dir; 
    if(this.collide()) this.current.x -= dir; 
  }

  moveDown(){
    this.current.y += 1;
    if(this.collide()){ this.current.y -= 1; this.lockPiece(); return false; }
    return true;
  }

  collide(){
    if (!this.current || !this.current.shape) return false;
    
    const s = this.current.shape;
    for(let r = 0; r < s.length; r++){
      for(let c = 0; c < s[r].length; c++){
        if(!s[r][c]) continue;
        const x = this.current.x + c;
        const y = this.current.y + r;
        
        // Verificar límites del tablero
        if(x < 0 || x >= this.board.cols || y >= this.board.rows) return true;
        
        // Verificar colisión con piezas existentes (permitir y negativo para spawn)
        if(y >= 0 && this.board.cell(x, y)) return true;
      }
    }
    return false;
  }

  collideAt(tet, atX, atY){
    if (!tet || !tet.shape) return false;
    
    const s = tet.shape;
    for(let r = 0; r < s.length; r++){
      for(let c = 0; c < s[r].length; c++){
        if(!s[r][c]) continue;
        const x = atX + c;
        const y = atY + r;
        
        // Verificar límites del tablero
        if(x < 0 || x >= this.board.cols || y >= this.board.rows) return true;
        
        // Verificar colisión con piezas existentes (permitir y negativo)
        if(y >= 0 && this.board.cell(x, y)) return true;
      }
    }
    return false;
  }

  rotatePiece(direction = 'right'){
    if (!this.current) {
      return;
    }
    
    // Guardar estado original
    const originalShape = deepCopy(this.current.shape);
    const originalX = this.current.x;
    const originalY = this.current.y;
    
    // Realizar rotación
    this.current.rotate(direction);
    
    // Wall kicks - intentar diferentes posiciones si hay colisión
    const wallKicks = [
      [0, 0],   // Sin movimiento
      [-1, 0],  // Mover izquierda
      [1, 0],   // Mover derecha
      [0, -1],  // Mover arriba
      [-1, -1], // Diagonal izquierda-arriba
      [1, -1],  // Diagonal derecha-arriba
      [0, 1],   // Mover abajo (raro, pero puede ser útil)
      [-2, 0],  // Mover 2 izquierda (para piezas largas)
      [2, 0]    // Mover 2 derecha (para piezas largas)
    ];
    
    let rotationSuccessful = false;
    
    for (const [dx, dy] of wallKicks) {
      this.current.x = originalX + dx;
      this.current.y = originalY + dy;
      
      if (!this.collide()) {
        rotationSuccessful = true;
        break;
      }
    }
    
    // Si ninguna posición funciona, revertir
    if (!rotationSuccessful) {
      this.current.shape = originalShape;
      this.current.x = originalX;
      this.current.y = originalY;
    }
  }

  lockPiece(){
    this.board.place(this.current);
    const cleared = this.board.clearLines();

    if(cleared){
      this.lines += cleared;
      this.score += [0,40,100,300,1200][cleared]*this.level;
      this.level = 1 + Math.floor(this.lines/10);
      this.baseInterval = Math.max(100, 800 - (this.level-1)*70);
      this.interval = Math.max(50, Math.round(this.baseInterval / (this.speedMult || 1)));
      this.emit('tetris:stats', { score: this.score, lines: this.lines, level: this.level });
      try{ window.dispatchEvent(new CustomEvent('tetris:lineclear', { detail: { cleared } })); }catch(e){}
    }

    if(this.next){
      this.current = this.next;
    } else {
      this.current = this.createRandomTetromino();
    }
    this.current.x = Math.floor((this.board.cols - this.current.width)/2);
    this.current.y = -1;
    this.next = this.createRandomTetromino();
    if(this.collide()){
      this.isRunning = false;
      clearInterval(this.timeInterval);
      this.draw();
      setTimeout(()=>{
        try{
          const ev = new CustomEvent('tetris:ended', { detail: { score: this.score } });
          window.dispatchEvent(ev);
        }catch(e){}
      },100);
    }
  }

  // Reinicia el juego
  restartGame(){
    // Cleanup anterior
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    clearInterval(this.timeInterval);
    
    // Limpiar listeners de teclado antes de reiniciar
    this.unbindKeys();
    
    // Resetear estados del juego
    this.isGameOver = false;
    this.isPaused = false;
    this.isRunning = false;
    this.hardDrop = false;
    this.keys = {};
    
    this.board = new Board(this.board.cols, this.board.rows);
    this.bag = new Bag();
    this.score = 0; this.lines = 0; this.level = 1;
    this.emit('tetris:stats', { score: this.score, lines: this.lines, level: this.level });
    this.current = this.spawn();
    this.next = this.createRandomTetromino();
    this.startTime = Date.now();
    this.updateTime();
    
    // Reconfigurar listeners de teclado
    this.bindKeys();
    this.isRunning = true;
    this.lastTime = performance.now();
    this.draw();
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  // Cambia la velocidad del juego
  setSpeed(mult){
    this.speedMult = mult || 1;
    this.baseInterval = this.baseInterval || this.interval;
    this.interval = Math.max(50, Math.round(this.baseInterval / this.speedMult));
    try{ localStorage.setItem('tetris_speed', String(this.speedMult)); }catch(e){}
  }

  // Métodos de dibujo
  drawCell(x,y,color){
    const b = this.blockSize;
    const ctx = this.ctx;
    ctx.fillStyle = color || '#0b1220';
    // Usar enteros para evitar antialiasing
    const px = Math.round(x * b) + 1;
    const py = Math.round(y * b) + 1;
    const size = Math.max(0, Math.round(b) - 2);
    ctx.fillRect(px, py, size, size);
    if (color) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeRect(px, py, size, size);
    }
  }

  draw(){
    const ctx = this.ctx; const b = this.blockSize;
    const width = Math.ceil(this.blockSize * 10);
    const height = Math.ceil(this.blockSize * this.board.rows);
    
    // Limpiar solo el área necesaria
    ctx.fillStyle = '#081023';
    ctx.fillRect(0, 0, width, height);
    
    // Dibujar tablero con una sola pasada
    for(let r=0;r<this.board.rows;r++){
      for(let c=0;c<this.board.cols;c++){
        const cell = this.board.grid[r][c];
        if(cell) {
          this.drawCell(c,r, cell);
        } else {
          this.drawCell(c,r, null);
        }
      }
    }
    
    // Dibujar fantasma con alpha reducido
    const ghostY = this.calculateGhostY();
    if(typeof ghostY === 'number'){
      ctx.save(); 
      ctx.globalAlpha = 0.28;
      const sG = this.current.shape;
      for(let r=0;r<sG.length;r++){
        for(let c=0;c<sG[r].length;c++){
          if(sG[r][c]){
            const x = this.current.x + c;
            const y = ghostY + r;
            if(y>=0) this.drawCell(x,y,this.current.color);
          }
        }
      }
      ctx.restore();
    }
    
    // Dibujar pieza actual
    const s = this.current.shape;
    for(let r=0;r<s.length;r++){
      for(let c=0;c<s[r].length;c++){
        if(s[r][c]){
          const x = this.current.x + c;
          const y = this.current.y + r;
          if(y>=0) this.drawCell(x,y,this.current.color);
        }
      }
    }
    this.drawNext();
  }

  drawNext(){
    // draw into the standard next canvas (sidebar) using instance refs
    if(this.nextCanvas && this.nextCtx){
      const ctx = this.nextCtx;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Limpiar con una sola operación
      ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
      // Fondo sutil más eficiente
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(0,0,this.nextCanvas.width, this.nextCanvas.height);
      // pass logical sizes (CSS pixels) to renderer
      const logicalW = Math.round(this.nextCanvas.width / dpr);
      const logicalH = Math.round(this.nextCanvas.height / dpr);
      this.renderNextInto(ctx, this.next, logicalW, logicalH);
    }
    
    // overlay movil - optimizado para reducir accesos DOM
    const overlay = document.getElementById('nextOverlay');
    if (overlay && window.innerWidth <= 780) { // Solo renderizar en móvil
      const octx = overlay.getContext('2d');
      const odpr = Math.min(window.devicePixelRatio || 1, 2);
      
      // Cache del ancho CSS para evitar múltiples getBoundingClientRect
      if (!this._cachedOverlayWidth) {
        let cssW = overlay.getBoundingClientRect().width;
        if(!cssW || cssW < 2){
          const cs = window.getComputedStyle(overlay);
          cssW = parseFloat(cs.width) || parseFloat(cs.maxWidth) || 72;
        }
        this._cachedOverlayWidth = Math.max(24, Math.floor(cssW));
      }
      
      const cssW = this._cachedOverlayWidth;
      overlay.style.width = cssW + 'px';
      overlay.width = Math.round(cssW * odpr);
      overlay.height = Math.round(cssW * odpr);
      octx.setTransform(odpr,0,0,odpr,0,0);
      octx.clearRect(0, 0, overlay.width, overlay.height);
      octx.globalAlpha = 0.95;
      const logicalOW = Math.round(overlay.width / odpr);
      const logicalOH = Math.round(overlay.height / odpr);
      this.renderNextInto(octx, this.next, logicalOW, logicalOH);
      octx.globalAlpha = 1;
    }
  }

  renderNextInto(ctx, next, w, h){
    if (!next || !next.shape) return;
    const shape = next.shape;
    const rows = shape.length;
    const cols = shape[0].length;
    
    // Cálculos optimizados
    const basePadding = 4;
    const padding = Math.round(basePadding + Math.max(0, (100 - Math.min(w,h)) * 0.08));
    const cellSize = Math.max(1, Math.min(
      Math.floor((w - padding * 2) / cols), 
      Math.floor((h - padding * 2) / rows)
    ));
    const offsetX = Math.floor((w - cols * cellSize) / 2);
    const offsetY = Math.floor((h - rows * cellSize) / 2);

    ctx.save();
    ctx.fillStyle = next.color || '#FF8C00';
    
    // Una sola pasada para dibujar todas las celdas
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = shape[r][c];
        if (val) {
          const x = Math.round(offsetX + c * cellSize) + 1;
          const y = Math.round(offsetY + r * cellSize) + 1;
          const size = Math.max(1, Math.round(cellSize) - 3);
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    ctx.restore();
  }

  calculateGhostY(){
    if(!this.current) return null;
    let testY = this.current.y;
    while(true){
      if(this.collideAt(this.current, this.current.x, testY + 1)) break;
      testY += 1;
      if(testY > this.board.rows) break;
    }
    return testY;
  }

  // Método de cleanup para evitar memory leaks
  cleanup(){
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    clearInterval(this.timeInterval);
    if (this.resizeThrottle) {
      cancelAnimationFrame(this.resizeThrottle);
      this.resizeThrottle = null;
    }
    window.removeEventListener('resize', this.throttledResize);
    this._cachedOverlayWidth = null;
  }
}