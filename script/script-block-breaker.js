/**
 * 벽돌 철거맨 - Gamdori Casino Edition (Updated)
 */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const logBody = document.getElementById("logBody");
const hudLevel = document.getElementById("hudLevel");
const hudLives = document.getElementById("hudLives");
const hudTime = document.getElementById("hudTime");
const hudBestTime = document.getElementById("hudBestTime");
const timerText = document.getElementById("timerText");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlayText");
const overlayAction = document.getElementById("overlayAction");
const btnOverlayRestart = document.getElementById("btnOverlayRestart");

let state = {
    level: 1,
    lives: 3,
    running: false,
    startTime: 0,
    elapsed: 0,
    speedMul: 1,
    log: [] // 게임 오버 되어도 초기화하지 않음
};

const paddle = { width: 100, height: 12, x: canvas.width / 2 - 50, speed: 8, left: false, right: false };
const ball = { r: 8, x: 0, y: 0, dx: 4, dy: -4 };
const blockCfg = { cols: 8, rows: 4, w: 75, h: 22, gap: 10, top: 50, left: 15 };
let blocks = [];

function init() {
    const best = localStorage.getItem("breakerBest");
    hudBestTime.textContent = best ? best + "s" : "-";
    updateHUD();
}

function updateHUD() {
    hudLevel.textContent = state.level;
    hudLives.textContent = state.lives > 0 ? "❤️".repeat(state.lives) : "💀";
    hudTime.textContent = state.elapsed;
    timerText.textContent = state.elapsed;
}

function addLog(type, lv, time) {
    state.log.unshift({ id: state.log.length + 1, type, level: lv, time });
    renderLog();
}

function renderLog() {
    if (state.log.length === 0) {
        logBody.innerHTML = '<tr><td colspan="4" class="py-4">기록이 없습니다.</td></tr>';
        return;
    }
    logBody.innerHTML = state.log.map(i => `
        <tr>
            <td>${i.id}</td>
            <td><span class="badge ${i.type === 'CLEAR' ? 'bg-success' : 'bg-danger'}">${i.type}</span></td>
            <td class="mono">Lv.${i.level}</td>
            <td class="mono">${i.time}s</td>
        </tr>
    `).join('');
}

function initBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height - 60;
    ball.dx = (Math.random() > 0.5 ? 4 : -4) * state.speedMul;
    ball.dy = -4 * state.speedMul;
}

function initBlocks() {
    blocks = [];
    const rows = Math.min(blockCfg.rows + Math.floor(state.level / 2), 8);
    for (let r = 0; r < rows; r++) {
        blocks[r] = [];
        for (let c = 0; c < blockCfg.cols; c++) {
            blocks[r][c] = { alive: true, color: `hsl(${r * 40 + 200}, 70%, 60%)` };
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    blocks.forEach((row, r) => {
        row.forEach((b, c) => {
            if (!b.alive) return;
            ctx.fillStyle = b.color;
            ctx.fillRect(c * (blockCfg.w + blockCfg.gap) + blockCfg.left, r * (blockCfg.h + blockCfg.gap) + blockCfg.top, blockCfg.w, blockCfg.h);
        });
    });
    ctx.fillStyle = "#00e5ff";
    ctx.fillRect(paddle.x, canvas.height - 20, paddle.width, paddle.height);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
}

function move() {
    if (!state.running) return;
    if (ball.x + ball.dx > canvas.width - ball.r || ball.x + ball.dx < ball.r) ball.dx *= -1;
    if (ball.y + ball.dy < ball.r) ball.dy *= -1;
    if (ball.y + ball.dy > canvas.height - 20 - ball.r) {
        if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
            let hit = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
            ball.dx = hit * 5 * state.speedMul;
            ball.dy *= -1;
        } else if (ball.y > canvas.height) handleLifeLost();
    }
    blocks.forEach((row) => {
        row.forEach((b) => {
            if (!b.alive) return;
            const bx = row.indexOf(b) * (blockCfg.w + blockCfg.gap) + blockCfg.left; // 간략화된 인덱스 계산
            // 실제 루프에서는 정확한 좌표 체크 필요 (위 draw 루직 참고)
        });
    });
    // 블록 충돌 로직 상세 (생략 없이 유지)
    for(let r=0; r<blocks.length; r++) {
        for(let c=0; c<blocks[r].length; c++) {
            let b = blocks[r][c];
            if(!b.alive) continue;
            let bx = c * (blockCfg.w + blockCfg.gap) + blockCfg.left;
            let by = r * (blockCfg.h + blockCfg.gap) + blockCfg.top;
            if(ball.x > bx && ball.x < bx+blockCfg.w && ball.y > by && ball.y < by+blockCfg.h) {
                ball.dy *= -1; b.alive = false; checkClear();
            }
        }
    }
    ball.x += ball.dx; ball.y += ball.dy;
    if (paddle.left && paddle.x > 0) paddle.x -= paddle.speed;
    if (paddle.right && paddle.x < canvas.width - paddle.width) paddle.x += paddle.speed;
    state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    updateHUD();
}

function checkClear() {
    if (blocks.every(row => row.every(b => !b.alive))) {
        state.running = false;
        addLog('CLEAR', state.level, state.elapsed);
        showOverlay(`STAGE ${state.level} CLEAR! 🎰`, "#38ef7d");
        setTimeout(() => { state.level++; state.speedMul += 0.15; startNewLevel(); }, 2000);
    }
}

function handleLifeLost() {
    state.lives--;
    state.running = false;
    updateHUD();
    if (state.lives <= 0) {
        addLog('FAIL', state.level, state.elapsed);
        saveBest();
        showOverlay("GAME OVER 💸", "#ff4d6d", true);
    } else {
        showOverlay("LIFE LOST ⚠️", "#ffd54f");
        setTimeout(() => { hideOverlay(); initBall(); state.running = true; }, 1500);
    }
}

function saveBest() {
    const best = localStorage.getItem("breakerBest");
    if (!best || state.elapsed < best) localStorage.setItem("breakerBest", state.elapsed);
}

function showOverlay(text, color = "#fff", showBtn = false) {
    overlayText.textContent = text;
    overlayText.style.textShadow = `0 0 20px ${color}`;
    overlayAction.style.display = showBtn ? "block" : "none";
    overlay.classList.add("active");
}

function hideOverlay() { overlay.classList.remove("active"); }

function startNewLevel() {
    initBlocks(); initBall(); hideOverlay();
    state.startTime = Date.now(); state.running = true;
}

function restartGame() {
    state.level = 1; state.lives = 3; state.speedMul = 1;
    startNewLevel();
}

// Events
document.getElementById("btnStart").onclick = restartGame;
btnOverlayRestart.onclick = restartGame;
document.getElementById("btnRestartAll").onclick = () => location.reload();
document.getElementById("btnClearLog").onclick = () => { state.log = []; renderLog(); };
document.getElementById("btnGotoIndex").onclick = () => { location.href="../index.html"; };

document.addEventListener("keydown", e => { if (e.key === "ArrowLeft") paddle.left = true; if (e.key === "ArrowRight") paddle.right = true; });
document.addEventListener("keyup", e => { if (e.key === "ArrowLeft") paddle.left = false; if (e.key === "ArrowRight") paddle.right = false; });

function loop() { if (state.running) { move(); draw(); } requestAnimationFrame(loop); }
init(); loop();