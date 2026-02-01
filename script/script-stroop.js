const COLORS = [
    { n: '빨강', v: '#ff4d6d', id: 'red' },
    { n: '파랑', v: '#00e5ff', id: 'blue' },
    { n: '초록', v: '#38ef7d', id: 'green' },
    { n: '노랑', v: '#ffd54f', id: 'yellow' }
];

const STAGES = [
    { count: 2, limit: 3.0, need: 5 },
    { count: 3, limit: 2.5, need: 5 },
    { count: 4, limit: 2.0, need: 7 },
    { count: 4, limit: 1.5, need: 10 },
    { count: 4, limit: 1.2, need: 15 }
];

let state = { stageIdx: 0, got: 0, score: 0, correct: 0, wrong: 0, lock: true, ans: '', timer: null, seq: 0 };

function next() {
    const cfg = STAGES[state.stageIdx];
    const pool = COLORS.slice(0, cfg.count);
    
    // 무작위 텍스트와 무작위 색상 추출
    const wordIdx = Math.floor(Math.random() * pool.length);
    const colorIdx = Math.floor(Math.random() * pool.length);
    
    const el = document.getElementById('wordDisplay');
    el.textContent = pool[wordIdx].n;
    el.style.color = pool[colorIdx].v;
    state.ans = pool[colorIdx].id; // 정답은 '색상'

    const area = document.getElementById('buttonArea');
    area.innerHTML = '';
    
    // 버튼 배치 (실제 옵션들 셔플)
    [...pool].sort(() => Math.random() - 0.5).forEach(c => {
        const col = document.createElement('div');
        col.className = 'col-6';
        col.innerHTML = `<button class="btn btn-outline-light w-100 btn-color-choice" 
            style="border-color:${c.v}; color:${c.v}" onclick="check('${c.id}')">${c.n}</button>`;
        area.appendChild(col);
    });

    state.lock = false;
    startTimer(cfg.limit);
}

function check(id) {
    if (state.lock) return;
    state.lock = true;
    clearInterval(state.timer);

    const isCorrect = (id === state.ans);
    if (isCorrect) {
        state.score += 20; state.got++; state.correct++;
        if (state.got >= STAGES[state.stageIdx].need && state.stageIdx < 4) {
            state.stageIdx++; state.got = 0;
        }
    } else {
        state.wrong++;
        state.score = Math.max(0, state.score - 10);
    }
    
    addLog(isCorrect);
    updateHUD();
    setTimeout(next, 500);
}

function startTimer(sec) {
    let r = sec * 100;
    state.timer = setInterval(() => {
        r--;
        document.getElementById('timerRing').style.setProperty('--p', `${(r/(sec*100))*100}%`);
        document.getElementById('timerText').textContent = (r/100).toFixed(1);
        if(r<=0) { check('timeout'); }
    }, 10);
}

function updateHUD() {
    document.getElementById('hudStage').textContent = state.stageIdx + 1;
    document.getElementById('hudScore').textContent = state.score;
    document.getElementById('hudCorrect').textContent = state.correct;
    document.getElementById('hudWrong').textContent = state.wrong;
}

function addLog(res) {
    state.seq++;
    const time = document.getElementById('timerText').textContent;
    const row = `<tr><td>${state.seq}</td><td class="${res?'text-success':'text-danger'}">${res?'정답':'오답'}</td><td class="mono">${time}s</td></tr>`;
    document.getElementById('logBody').insertAdjacentHTML('afterbegin', row);
}

document.getElementById('btnStart').onclick = () => {
    state.stageIdx = parseInt(document.getElementById('stageSelect').value) - 1;
    state.got = 0; state.score = 0; state.correct = 0; state.wrong = 0;
    next();
};
document.getElementById('btnRestartAll').onclick = () => location.reload();
document.getElementById('btnGotoIndex').onclick = () => location.href='../index.html';
document.getElementById('btnClearLog').onclick = () => { document.getElementById('logBody').innerHTML=''; state.seq=0; };