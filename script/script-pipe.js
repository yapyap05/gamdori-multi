const AudioFX = (() => {
    let ctx = null;
    const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; };
    const beep = (f, d, t, g) => {
        const c = ensure(); const t0 = c.currentTime; const o = c.createOscillator(); const gain = c.createGain();
        o.type = t; o.frequency.value = f; gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(g, t0 + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(gain).connect(c.destination); o.start(); o.stop(t0 + d + 0.02);
    };
    return {
        rotate: () => beep(600, 0.05, 'sine', 0.05),
        win: () => beep(880, 0.3, 'sine', 0.1),
        fail: () => beep(150, 0.4, 'sawtooth', 0.1)
    };
})();

const STAGES = [
    { size: 3, limit: 20 }, { size: 4, limit: 40 },
    { size: 5, limit: 60 }, { size: 6, limit: 80 }, { size: 7, limit: 100 }
];

const TYPES = { I: [true, false, true, false], L: [true, true, false, false] };

let state = {
    running: false, stageIdx: 0, score: 0,
    grid: [], timer: null, seq: 0
};

function showToast(msg, bg = 'danger') {
    const toastEl = document.getElementById('gameToast');
    const toastBody = document.getElementById('toastBody');
    toastEl.className = `toast show align-items-center text-bg-${bg} border-0`;
    toastBody.textContent = msg;
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function initBoard() {
    const size = STAGES[state.stageIdx].size;
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    const gridEl = document.createElement('div');
    gridEl.className = 'pipe-grid';
    gridEl.style.gridTemplateColumns = `repeat(${size}, 65px)`;
    
    state.grid = [];
    for (let y = 0; y < size; y++) {
        state.grid[y] = [];
        for (let x = 0; x < size; x++) {
            const tile = { x, y, type: Math.random() > 0.5 ? 'I' : 'L', rotation: Math.floor(Math.random() * 4), fixed: false };
            if (x === 0 && y === 0) { tile.isStart = true; tile.fixed = true; tile.type = 'L'; tile.rotation = 1; }
            if (x === size - 1 && y === size - 1) { tile.isEnd = true; tile.fixed = true; tile.type = 'L'; tile.rotation = 3; }
            state.grid[y][x] = tile;
            gridEl.appendChild(renderTile(tile));
        }
    }
    board.appendChild(gridEl);
    updateFlow();
}

function renderTile(tile) {
    const el = document.createElement('div');
    el.className = `pipe-tile ${tile.fixed ? 'fixed' : ''}`;
    el.id = `tile-${tile.y}-${tile.x}`;
    if (tile.isStart) el.innerHTML = '<span class="tile-s">S</span>';
    else if (tile.isEnd) el.innerHTML = '<span class="tile-e">E</span>';
    
    const svg = `<svg class="pipe-svg" viewBox="0 0 100 100">${tile.type === 'I' ? '<line x1="50" y1="0" x2="50" y2="100" />' : '<path d="M50,0 Q50,50 100,50" />'}</svg>`;
    el.insertAdjacentHTML('beforeend', svg);
    el.style.transform = `rotate(${tile.rotation * 90}deg)`;
    
    if (!tile.fixed) {
        el.onclick = () => {
            if (!state.running) return;
            tile.rotation = (tile.rotation + 1) % 4;
            el.style.transform = `rotate(${tile.rotation * 90}deg)`;
            AudioFX.rotate();
            updateFlow();
        };
    }
    return el;
}

function updateFlow() {
    const size = STAGES[state.stageIdx].size;
    const connected = new Set();
    const stack = [[0, 0]];
    
    const getOpens = (t) => {
        let b = [...TYPES[t.type]];
        for (let i = 0; i < t.rotation; i++) b.unshift(base = b.pop());
        return b;
    };

    while (stack.length > 0) {
        const [y, x] = stack.pop();
        const key = `${y},${x}`;
        if (connected.has(key)) continue;
        connected.add(key);
        
        const curOpens = getOpens(state.grid[y][x]);
        const dirs = [[-1, 0, 0, 2], [0, 1, 1, 3], [1, 0, 2, 0], [0, -1, 3, 1]];
        dirs.forEach(([dy, dx, curIdx, nextIdx]) => {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < size && nx >= 0 && nx < size) {
                if (curOpens[curIdx] && getOpens(state.grid[ny][nx])[nextIdx]) stack.push([ny, nx]);
            }
        });
    }
    
    document.querySelectorAll('.pipe-tile').forEach(el => el.classList.remove('connected'));
    connected.forEach(k => document.getElementById(`tile-${k.split(',')[0]}-${k.split(',')[1]}`).classList.add('connected'));

    if (connected.has(`${size-1},${size-1}`)) finishStage(true);
}

function finishStage(success) {
    state.running = false;
    clearInterval(state.timer);
    if (success) {
        AudioFX.win();
        state.score += (state.stageIdx + 1) * 100;
        showToast("연결 성공! 다음 단계로...", "success");
        setTimeout(() => { state.stageIdx = Math.min(state.stageIdx + 1, 4); startNewGame(); }, 1500);
    } else {
        AudioFX.fail();
        showToast("시간 초과! 다시 도전하세요.", "danger");
    }
    addLog(success);
    updateHUD();
}

function startTimer(sec) {
    let rem = sec * 100;
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => {
        if (!state.running) { clearInterval(state.timer); return; }
        rem--;
        const pct = (rem / (sec * 100)) * 100;
        document.getElementById('timerRing').style.setProperty('--p', `${pct}%`);
        document.getElementById('timerText').textContent = (rem / 100).toFixed(1);
        document.getElementById('progressBar').style.width = `${pct}%`;
        if (rem <= 0) finishStage(false);
    }, 10);
}

function startNewGame() {
    state.running = true;
    initBoard();
    updateHUD();
    startTimer(STAGES[state.stageIdx].limit);
}

function updateHUD() {
    document.getElementById('hudStage').textContent = state.stageIdx + 1;
    document.getElementById('hudScore').textContent = state.score;
}

function addLog(res) {
    state.seq++;
    const row = `<tr><td>${state.seq}</td><td class="${res?'text-info':'text-danger'}">${res?'SUCCESS':'FAILED'}</td><td>${document.getElementById('timerText').textContent}s</td></tr>`;
    document.getElementById('logBody').insertAdjacentHTML('afterbegin', row);
}

document.getElementById('btnStart').onclick = () => {
    state.stageIdx = parseInt(document.getElementById('stageSelect').value) - 1;
    state.score = 0;
    startNewGame();
};
document.getElementById('btnRestartAll').onclick = () => location.reload();
document.getElementById('btnGotoIndex').onclick = () => location.href = '../index.html';