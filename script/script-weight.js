// AudioFX (script-multi.js 기반)
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
        correct: () => beep(880, 0.1, 'sine', 0.1),
        wrong: () => beep(220, 0.15, 'sawtooth', 0.1),
        stageUp: () => beep(523, 0.2, 'sine', 0.1)
    };
})();

const ITEMS = [
    { n: '🎈', w: 10 }, { n: '🍃', w: 15 }, { n: '🍎', w: 40 }, { n: '🎳', w: 150 },
    { n: '🧱', w: 200 }, { n: '💰', w: 500 }, { n: '🥇', w: 505 }, { n: '💎', w: 1000 }, { n: '🏰', w: 9999 }
];

const STAGES = [
    { need: 5, limit: 5.0, range: [0, 4] },
    { need: 5, limit: 4.0, range: [1, 5] },
    { need: 7, limit: 3.0, range: [2, 7] },
    { need: 7, limit: 2.5, range: [3, 8] },
    { need: 10, limit: 2.0, range: [0, 9] }
];

let state = {
    running: false, stageIdx: 0, got: 0, score: 0,
    correct: 0, wrong: 0, streak: 0,
    lock: true, timers: { tick: null }, seq: 0
};

function setToast(msg, kind='dark') {
    const el = document.getElementById('toastEl');
    el.className = `toast show align-items-center text-bg-${kind} border-0`;
    document.getElementById('toastBody').textContent = msg;
    setTimeout(() => el.classList.remove('show'), 1500);
}

function startQuestion() {
    if (!state.running) return;
    const cfg = STAGES[state.stageIdx];
    const pool = ITEMS.slice(cfg.range[0], cfg.range[1]);
    
    let a = pool[Math.floor(Math.random() * pool.length)];
    let b; do { b = pool[Math.floor(Math.random() * pool.length)]; } while (a === b);

    state.current = { answer: a.w > b.w ? 'left' : 'right' };
    document.getElementById('itemA').textContent = a.n;
    document.getElementById('itemB').textContent = b.n;
    document.getElementById('scaleBeam').className = 'scale-beam';
    
    state.lock = false;
    updateHUD();
    startTimer(cfg.limit);
}

function handleInput(choice) {
    if (state.lock) return;
    state.lock = true;
    clearInterval(state.timers.tick);

    const isCorrect = choice === state.current.answer;
    document.getElementById('scaleBeam').classList.add(state.current.answer === 'left' ? 'tilt-left' : 'tilt-right');

    if (isCorrect) {
        state.score += 10; state.got++; state.correct++; state.streak++;
        AudioFX.correct();
        setToast("정답! +10", "success");
    } else {
        state.wrong++; state.streak = 0;
        AudioFX.wrong();
        setToast("오답!", "danger");
    }

    addLog(isCorrect);
    if (state.got >= STAGES[state.stageIdx].need) {
        if (state.stageIdx < 4) { 
            state.stageIdx++; state.got = 0; 
            AudioFX.stageUp();
            setToast("Level UP!", "info");
        }
        else { finishGame(); return; }
    }
    setTimeout(startQuestion, 800);
}

function startTimer(sec) {
    let rem = sec * 100;
    state.timers.tick = setInterval(() => {
        rem--;
        const pct = (rem / (sec * 100)) * 100;
        document.getElementById('timerRing').style.setProperty('--p', `${pct}%`);
        document.getElementById('timerText').textContent = (rem / 100).toFixed(1);
        if (rem <= 0) { handleInput('timeout'); }
    }, 10);
}

function updateHUD() {
    document.getElementById('hudStage').textContent = state.stageIdx + 1;
    document.getElementById('hudScore').textContent = state.score;
    document.getElementById('hudCorrect').textContent = state.correct;
    document.getElementById('hudWrong').textContent = state.wrong;
    document.getElementById('hudStreak').textContent = state.streak;
    document.getElementById('btnLeft').disabled = state.lock;
    document.getElementById('btnRight').disabled = state.lock;
    const p = (state.got / STAGES[state.stageIdx].need) * 100;
    document.getElementById('progressBar').style.width = `${p}%`;
}

function addLog(res) {
    state.seq++;
    const row = `<tr><td class="mono">${state.seq}</td><td class="${res?'text-success':'text-danger'}">${res?'정답':'실패'}</td><td class="mono">${document.getElementById('timerText').textContent}s</td></tr>`;
    document.getElementById('logBody').insertAdjacentHTML('afterbegin', row);
}

function finishGame() {
    state.running = false;
    document.getElementById('itemA').textContent = '🏆';
    document.getElementById('itemB').textContent = '🏆';
    setToast("ALL STAGES CLEAR!", "당신은 관상의 달인입니다! 🎉");
}

document.getElementById('btnStart').onclick = () => {
    state.stageIdx = parseInt(document.getElementById('stageSelect').value) - 1;
    state.running = true; state.got = 0; state.score = 0;
    startQuestion();
};
document.getElementById('btnRestartAll').onclick = () => location.reload();
document.getElementById('btnGotoIndex').onclick = () => location.href='../index.html';
document.getElementById('btnClearLog').onclick = () => { document.getElementById('logBody').innerHTML=''; state.seq=0; };
document.getElementById('btnLeft').onclick = () => handleInput('left');
document.getElementById('btnRight').onclick = () => handleInput('right');