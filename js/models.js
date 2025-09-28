class Tetromino {
  
  constructor(shape, color){
    this.shape = shape;
    this.color = color;
    this.x = 3;
    this.y = -1;
  }

  // Rota la pieza 90 grados hacia la izquierda
  rotateLeft(){
    const N = this.shape.length;
    const newShape = new Array(N);
    for(let r = 0; r < N; r++){
      newShape[r] = new Array(N);
    }
    for(let r = 0; r < N; r++){
      for(let c = 0; c < N; c++){
        newShape[N-1-c][r] = this.shape[r][c];
      }
    }
    this.shape = newShape;
  }

  // Rota la pieza 90 grados hacia la derecha
  rotateRight(){
    const N = this.shape.length;
    const newShape = new Array(N);
    for(let r = 0; r < N; r++){
      newShape[r] = new Array(N);
    }
    for(let r = 0; r < N; r++){
      for(let c = 0; c < N; c++){
        newShape[c][N-1-r] = this.shape[r][c];
      }
    }
    this.shape = newShape;
  }

  // Método genérico usado por el juego: por defecto rota a la derecha
  rotate(dir = 'right'){
    if(dir === 'left' || dir === 'ccw' || dir === -1) this.rotateLeft();
    else this.rotateRight();
  }

  get width(){
    return this.shape[0].length;
  }
}

// Convierte códigos de tecla a etiquetas legibles
function keyLabel(code){
  if(!code) return '';
  if(code.startsWith('Key')) return code.slice(3);
  if(code.startsWith('Digit')) return code.slice(5);
  if(code.startsWith('Arrow')) return code.slice(5);
  if(code === 'Space') return 'Space';
  if(code.startsWith('Numpad')) return code.slice(6);
  return code;
}

class Bag {
  constructor(){
    this.bag = [];
    this.pieces = Object.keys(Shapes); // Cache keys
  }
  
  // Obtiene la siguiente pieza
  next(){
    if(this.bag.length === 0) this.fill();
    return this.bag.pop();
  }
  
  // Llena la bolsa con piezas aleatorias (Fisher-Yates shuffle optimizado)
  fill(){
    this.bag = [...this.pieces]; // Copy array
    
    // Fisher-Yates shuffle - más eficiente que sort random
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
  }
}

class Board {
  constructor(cols=10, rows=20){
    this.cols = cols; this.rows = rows;
    this.grid = this.createGrid();
  }
  // Crea la rejilla vacía
  createGrid(){
    return Array.from({length:this.rows}, ()=>Array(this.cols).fill(0));
  }
  // Verifica si está dentro del tablero
  inside(x,y){
    return x>=0 && x<this.cols && y<this.rows;
  }
  cell(x,y){
    if(y<0) return 0;
    return this.grid[y][x];
  }
  // Coloca una pieza en el tablero
  place(tetromino){
    const s = tetromino.shape;
    for(let r=0;r<s.length;r++){
      for(let c=0;c<s[r].length;c++){
        if(s[r][c]){
          const x = tetromino.x + c;
          const y = tetromino.y + r;
          if(y>=0) this.grid[y][x] = tetromino.color;
        }
      }
    }
  }
  // Elimina líneas completas
  clearLines(){
    let cleared = 0;
    outer: for(let r=this.rows-1;r>=0;r--){
      for(let c=0;c<this.cols;c++){
        if(!this.grid[r][c]){ continue outer; }
      }
      this.grid.splice(r,1);
      this.grid.unshift(Array(this.cols).fill(0));
      cleared++;
      r++;
    }
    return cleared;
  }
}

const Shapes = {
  I: [
    [0,0,0,0],
    [1,1,1,1],
    [0,0,0,0],
    [0,0,0,0]
  ],
  J: [
    [1,0,0],
    [1,1,1],
    [0,0,0]
  ],
  L: [
    [0,0,1],
    [1,1,1],
    [0,0,0]
  ],
  O: [
    [1,1],
    [1,1]
  ],
  S: [
    [0,1,1],
    [1,1,0],
    [0,0,0]
  ],
  T: [
    [0,1,0],
    [1,1,1],
    [0,0,0]
  ],
  Z: [
    [1,1,0],
    [0,1,1],
    [0,0,0]
  ]
};

const Colors = {
  I: '#06b6d4',
  J: '#6366f1',
  L: '#f97316',
  O: '#facc15',
  S: '#10b981',
  T: '#a78bfa',
  Z: '#ef4444'
};

// Funciones auxiliares optimizadas
function deepCopy(obj){

  if (Array.isArray(obj)) {
    return obj.map(row => Array.isArray(row) ? [...row] : row);
  }
  
  return JSON.parse(JSON.stringify(obj));
}

function pad(n){ 
  return n < 10 ? '0' + n : String(n); 
}
