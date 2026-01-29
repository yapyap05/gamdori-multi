// --------------------------------------------
// Config
// --------------------------------------------
const STAGES = [
    { stage: 1, op: '+', name: '덧셈', waitSec: 3, needCorrect: 5, timeLimitSec: 6 },
    { stage: 2, op: '-', name: '뺄셈', waitSec: 3, needCorrect: 5, timeLimitSec: 7 },
    { stage: 3, op: '÷', name: '나눗셈(몫)', waitSec: 5, needCorrect: 3, timeLimitSec: 8 },
    { stage: 4, op: '×', name: '곱셈', waitSec: 5, needCorrect: 3, timeLimitSec: 8 },
];

const DIGIT_PAIR_WEIGHTS = [
    { key: '1-1', p: 0.30 },
    { key: '1-2', p: 0.50 },
    { key: '2-2', p: 0.20 },
];

const LOG_LIMIT = 150;

// --------------------------------------------
// DOM
// --------------------------------------------
const btnStart = document.getElementById('btnStart');
const btnRestartStage = document.getElementById('btnRestartStage');
const btnRestartAll = document.getElementById('btnRestartAll');
const btnGotoIndex = document.getElementById('btnGotoIndex');

const stageSelect = document.getElementById('stageSelect');
const soundSelect = document.getElementById('soundSelect');

const hudStage = document.getElementById('hudStage');
const hudRule = document.getElementById('hudRule');
const hudNeed = document.getElementById('hudNeed');
const hudRemain = document.getElementById('hudRemain');
const hudTimeLimit = document.getElementById('hudTimeLimit');

const hudStreak = document.getElementById('hudStreak');
const hudScore = document.getElementById('hudScore');
const hudCorrect = document.getElementById('hudCorrect');
const hudWrong = document.getElementById('hudWrong');
const hudTimeout = document.getElementById('hudTimeout');
const hudAttempt = document.getElementById('hudAttempt');

const progressBar = document.getElementById('progressBar');

const reelA = document.getElementById('reelA');
const reelB = document.getElementById('reelB');
const stackA = document.getElementById('stackA');
const stackB = document.getElementById('stackB');
const windowA = document.getElementById('windowA');
const windowB = document.getElementById('windowB');
const opSymbol = document.getElementById('opSymbol');
const questionLine = document.getElementById('questionLine');
const spinBadge = document.getElementById('spinBadge');

const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');
const btnSubmit = document.getElementById('btnSubmit');

const timerRing = document.getElementById('timerRing');
const timerText = document.getElementById('timerText');

const logBody = document.getElementById('logBody');
const btnClearLog = document.getElementById('btnClearLog');
const btnDownloadCsv = document.getElementById('btnDownloadCsv');

const toastEl = document.getElementById('toast');
const toastBody = document.getElementById('toastBody');
const toast = new bootstrap.Toast(toastEl, { delay: 1700 });

// --------------------------------------------
// Audio (WebAudio) - slot-ish beeps
// --------------------------------------------
const AudioFX = (() => {
    let ctx = null;
    function ensure() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
    }
    function enabled() {
    return soundSelect.value !== 'off';
    }
    function beep({ freq = 440, dur = 0.08, type = 'sine', gain = 0.06 } = {}) {
    if (!enabled()) return;
    const c = ensure();
    const t0 = c.currentTime;

    const o = c.createOscillator();
    const g = c.createGain();

    o.type = type;
    o.frequency.value = freq;

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    }
    function sequence(steps) {
    if (!enabled()) return;
    const c = ensure();
    let at = c.currentTime;
    for (const s of steps) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = s.type || 'sine';
        o.frequency.value = s.freq || 440;
        const dur = s.dur ?? 0.07;
        const gain = s.gain ?? 0.06;

        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

        o.connect(g).connect(c.destination);
        o.start(at);
        o.stop(at + dur + 0.02);

        at += (dur + (s.gap ?? 0.02));
    }
    }

    return {
    unlock() { if (enabled()) ensure().resume?.(); },
    spinTick() { beep({ freq: 820 + Math.random()*120, dur: 0.03, type: 'square', gain: 0.03 }); },
    correct() { sequence([{freq:660,dur:.07,type:'triangle',gain:.07},{freq:880,dur:.09,type:'triangle',gain:.08},{freq:990,dur:.11,type:'sine',gain:.08}]); },
    wrong() { sequence([{freq:220,dur:.12,type:'sawtooth',gain:.06},{freq:180,dur:.14,type:'sawtooth',gain:.06}]); },
    timeout() { sequence([{freq:320,dur:.08,type:'square',gain:.05},{freq:240,dur:.16,type:'square',gain:.06}]); },
    stageUp() { sequence([{freq:523.25,dur:.08,type:'sine',gain:.06},{freq:659.25,dur:.08,type:'sine',gain:.06},{freq:783.99,dur:.12,type:'sine',gain:.07}]); },
    };
})();

// --------------------------------------------
// State
// --------------------------------------------
const state = {
    running: false,
    stageIndex: 0,
    gotCorrectThisStage: 0,

    streak: 0,
    score: 0,

    correct: 0,
    wrong: 0,
    timeout: 0,
    attempt: 0,

    current: null, // { a,b,op,answer,display, stage, startedAt, timeLimitSec }
    lockInput: true,
    phase: 'idle', // idle | spinning | waiting | answering | finished

    timers: {
    spin: null,
    waitUnlock: null,
    questionTick: null,
    questionTimeout: null,
    },

    log: [],
    seq: 0,
};

// --------------------------------------------
// Utils
// --------------------------------------------
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
    const r = Math.random();
    let acc = 0;
    for (const it of items) {
    acc += it.p;
    if (r <= acc) return it;
    }
    return items[items.length - 1];
}

function randByDigits(d) {
    return (d === 1) ? randInt(1, 9) : randInt(10, 99);
}

function pickDigitPair() {
    const { key } = pickWeighted(DIGIT_PAIR_WEIGHTS);
    const [d1, d2] = key.split('-').map(Number);
    if (d1 === 1 && d2 === 2) return (Math.random() < 0.5) ? [1, 2] : [2, 1];
    return [d1, d2];
}

function stageInfo() {
    return STAGES[state.stageIndex];
}

function setToast(msg, kind = 'dark') {
    toastEl.className = `toast align-items-center text-bg-${kind} border-0`;
    toastBody.textContent = msg;
    toast.show();
}

function clearTimers() {
    for (const k of Object.keys(state.timers)) {
    if (state.timers[k]) {
        if (k === 'spin' || k === 'questionTick') clearInterval(state.timers[k]);
        else clearTimeout(state.timers[k]);
    }
    state.timers[k] = null;
    }
}

function setInputLocked(locked) {
    state.lockInput = locked;
    answerInput.disabled = locked;
    btnSubmit.disabled = locked;
    if (!locked) {
    answerInput.focus();
    answerInput.select();
    }
}

function setRingProgress(pct, text) {
    timerRing.style.setProperty('--p', `${Math.max(0, Math.min(100, pct))}%`);
    timerText.textContent = text;
}

function updateHUD() {
    const info = stageInfo();
    hudStage.textContent = `${info.stage}`;
    hudRule.textContent = `${info.name} (${info.op})`;
    hudNeed.textContent = `${info.needCorrect}`;
    hudRemain.textContent = `${Math.max(0, info.needCorrect - state.gotCorrectThisStage)}`;
    hudTimeLimit.textContent = `${info.timeLimitSec}`;

    hudStreak.textContent = `${state.streak}`;
    hudScore.textContent = `${state.score}`;
    hudCorrect.textContent = `${state.correct}`;
    hudWrong.textContent = `${state.wrong}`;
    hudTimeout.textContent = `${state.timeout}`;
    hudAttempt.textContent = `${state.attempt}`;

    const pct = (state.gotCorrectThisStage / info.needCorrect) * 100;
    progressBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    progressBar.classList.toggle('bg-success', pct >= 100);
    progressBar.classList.toggle('bg-info', pct < 100);
}

// --------------------------------------------
// Problem generation (same rules + division exact)
// --------------------------------------------
function makeProblemForStage(info) {
    const [dA, dB] = pickDigitPair();
    let a = randByDigits(dA);
    let b = randByDigits(dB);

    if (info.op === '+') {
    return { a, b, op: '+', answer: a + b, display: `${a} + ${b}` };
    }
    if (info.op === '-') {
    const x = Math.max(a, b);
    const y = Math.min(a, b);
    return { a: x, b: y, op: '-', answer: x - y, display: `${x} - ${y}` };
    }
    if (info.op === '×') {
    return { a, b, op: '×', answer: a * b, display: `${a} × ${b}` };
    }
    if (info.op === '÷') {
    const targetDividendDigits = dA;
    const targetDivisorDigits = dB;

    for (let tries = 0; tries < 5000; tries++) {
        const divisor = randByDigits(targetDivisorDigits);
        const quotient = randInt(1, 99);
        const dividend = divisor * quotient;
        if (dividend < 1 || dividend > 99) continue;

        const dividendDigits = (dividend <= 9) ? 1 : 2;
        const divisorDigits = (divisor <= 9) ? 1 : 2;

        if (dividendDigits !== targetDividendDigits) continue;
        if (divisorDigits !== targetDivisorDigits) continue;

        return { a: dividend, b: divisor, op: '÷', answer: quotient, display: `${dividend} ÷ ${divisor}` };
    }

    // fallback
    const divisor = randInt(1, 9);
    const quotient = randInt(1, 9);
    const dividend = divisor * quotient;
    return { a: dividend, b: divisor, op: '÷', answer: quotient, display: `${dividend} ÷ ${divisor}` };
    }
    throw new Error('Unknown op');
}

// --------------------------------------------
// Slot animation helpers
// --------------------------------------------
function buildStack(el, count = 18) {
    el.innerHTML = '';
    for (let i = 0; i < count; i++) {
    const n = document.createElement('div');
    n.className = 'n mono';
    n.textContent = String(randInt(0, 9));
    el.appendChild(n);
    }
}

function spinReelsOnce(targetA, targetB, op) {
    // Setup
    opSymbol.textContent = op;
    spinBadge.classList.remove('d-none');

    buildStack(stackA);
    buildStack(stackB);

    let posA = 0;
    let posB = 0;

    const speedA = 28 + Math.random()*10;
    const speedB = 24 + Math.random()*10;

    reelA.classList.add('pulse');
    reelB.classList.add('pulse');
    setTimeout(() => { reelA.classList.remove('pulse'); reelB.classList.remove('pulse'); }, 700);

    // Spin tick: just moving the stack up
    const startAt = performance.now();
    const spinMs = 900;      // base spin
    const slowMs = 520;      // slow down phase
    const totalMs = spinMs + slowMs;

    windowA.textContent = '-';
    windowB.textContent = '-';

    state.phase = 'spinning';
    setInputLocked(true);

    if (state.timers.spin) clearInterval(state.timers.spin);

    state.timers.spin = setInterval(() => {
    const t = performance.now() - startAt;
    const k = Math.max(0, Math.min(1, t / totalMs)); // 0..1

    // ease-out slowdown
    const ease = 1 - Math.pow(1 - k, 3);
    const factor = 1 - (ease * 0.85);

    posA += speedA * factor;
    posB += speedB * factor;

    stackA.style.transform = `translateY(${-posA}px)`;
    stackB.style.transform = `translateY(${-posB}px)`;

    AudioFX.spinTick();

    if (t >= totalMs) {
        clearInterval(state.timers.spin);
        state.timers.spin = null;
        spinBadge.classList.add('d-none');

        // reveal target
        windowA.textContent = String(targetA);
        windowB.textContent = String(targetB);

        // reset stacks (keep visuals clean)
        stackA.innerHTML = '';
        stackB.innerHTML = '';

        reelA.classList.add('pulse');
        reelB.classList.add('pulse');
        setTimeout(() => { reelA.classList.remove('pulse'); reelB.classList.remove('pulse'); }, 700);
    }
    }, 33);
}

// --------------------------------------------
// Question lifecycle: spin -> wait -> answering (timer) -> submit/timeout -> next
// --------------------------------------------
function startQuestionTimer(timeLimitSec) {
    const startedAt = performance.now();
    const deadline = startedAt + timeLimitSec * 1000;

    // set ring initial
    setRingProgress(0, String(timeLimitSec));

    if (state.timers.questionTick) clearInterval(state.timers.questionTick);
    if (state.timers.questionTimeout) clearTimeout(state.timers.questionTimeout);

    state.timers.questionTick = setInterval(() => {
    const now = performance.now();
    const remainMs = Math.max(0, deadline - now);
    const remainSec = remainMs / 1000;

    const pct = (1 - (remainMs / (timeLimitSec * 1000))) * 100;
    const text = remainSec.toFixed(1);

    setRingProgress(pct, text);

    // warning vibe
    if (remainSec <= 2.0) {
        timerRing.style.boxShadow = '0 0 12px rgba(255,77,109,.65), 0 0 30px rgba(255,213,79,.18)';
    } else {
        timerRing.style.boxShadow = 'var(--glow)';
    }
    }, 60);

    state.timers.questionTimeout = setTimeout(() => {
    onTimeout();
    }, timeLimitSec * 1000);
}

function stopQuestionTimer() {
    if (state.timers.questionTick) clearInterval(state.timers.questionTick);
    if (state.timers.questionTimeout) clearTimeout(state.timers.questionTimeout);
    state.timers.questionTick = null;
    state.timers.questionTimeout = null;
    timerRing.style.boxShadow = 'var(--glow)';
}

function nextQuestion() {
    clearTimers();
    stopQuestionTimer();
    updateHUD();

    const info = stageInfo();
    const p = makeProblemForStage(info);

    state.current = {
    ...p,
    stage: info.stage,
    timeLimitSec: info.timeLimitSec,
    waitSec: info.waitSec,
    startedAt: null,
    };

    // Spin reels
    questionLine.textContent = 'SPIN...';
    questionLine.classList.add('blink');
    spinReelsOnce(state.current.a, state.current.b, info.op);

    // After spin ends, show question text + wait lock + then unlock
    state.timers.waitUnlock = setTimeout(() => {
    state.phase = 'waiting';

    questionLine.classList.remove('blink');
    questionLine.textContent = `${state.current.display} = ?`;
    questionLine.classList.add('pulse');
    setTimeout(() => questionLine.classList.remove('pulse'), 650);

    // wait phase lock (stage waitSec)
    setInputLocked(true);
    answerInput.value = '';

    const waitMs = info.waitSec * 1000;

    // show wait on ring: fill from 0->100 during wait, then start question timer
    const waitStart = performance.now();
    const waitEnd = waitStart + waitMs;

    setRingProgress(0, `${info.waitSec}`);

    state.timers.questionTick = setInterval(() => {
        const now = performance.now();
        const remain = Math.max(0, waitEnd - now);
        const pct = (1 - (remain / waitMs)) * 100;
        setRingProgress(pct, (remain/1000).toFixed(1));
        if (remain <= 0) {
        clearInterval(state.timers.questionTick);
        state.timers.questionTick = null;

        // Now answering phase
        state.phase = 'answering';
        state.current.startedAt = performance.now();
        setInputLocked(false);
        AudioFX.unlock();

        startQuestionTimer(info.timeLimitSec);
        }
    }, 60);
    }, 1500); // spin visual time buffer (matches reel spin duration)
}

function logAttempt({ input, result, remainSec }) {
    const info = stageInfo();
    state.seq += 1;

    const row = {
    no: state.seq,
    stage: info.stage,
    problem: `${state.current.display} = ?`,
    input: (input === null || input === undefined) ? '' : String(input),
    answer: String(state.current.answer),
    result,
    remainSec: (remainSec === null || remainSec === undefined) ? '' : remainSec.toFixed(1),
    };

    state.log.unshift(row);
    if (state.log.length > LOG_LIMIT) state.log.pop();
    renderLog();
}

function renderLog() {
    if (state.log.length === 0) {
    logBody.innerHTML = '<tr><td colspan="7" class="text-white-50">아직 기록이 없습니다.</td></tr>';
    return;
    }

    const escapeHtml = (s) => String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

    logBody.innerHTML = state.log.map(r => {
    const badge =
        r.result === '정답' ? 'text-bg-success' :
        r.result === '오답' ? 'text-bg-danger' :
        'text-bg-warning text-dark';

    return `
        <tr>
        <td class="mono text-white-50">${r.no}</td>
        <td class="mono">${r.stage}</td>
        <td class="mono">${escapeHtml(r.problem)}</td>
        <td class="mono">${escapeHtml(r.input)}</td>
        <td class="mono">${escapeHtml(r.answer)}</td>
        <td><span class="badge ${badge}">${escapeHtml(r.result)}</span></td>
        <td class="mono text-white-50">${escapeHtml(r.remainSec)}</td>
        </tr>
    `;
    }).join('');
}

function remainSecNow() {
    if (!state.current?.startedAt) return null;
    const limit = state.current.timeLimitSec;
    const elapsed = (performance.now() - state.current.startedAt) / 1000;
    return Math.max(0, limit - elapsed);
}

function onTimeout() {
    if (!state.running) return;
    if (state.phase !== 'answering') return;

    stopQuestionTimer();
    setInputLocked(true);

    state.attempt += 1;
    state.timeout += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 1);

    AudioFX.timeout();
    setToast(`타임아웃! 정답: ${state.current.answer}`, 'warning');

    questionLine.classList.add('shake');
    setTimeout(() => questionLine.classList.remove('shake'), 380);

    logAttempt({ input: null, result: '타임아웃', remainSec: 0 });

    updateHUD();
    setTimeout(() => { if (state.running) nextQuestion(); }, 450);
}

function checkStageAdvanceOrFinish() {
    const info = stageInfo();
    if (state.gotCorrectThisStage < info.needCorrect) return;

    if (state.stageIndex < STAGES.length - 1) {
    state.stageIndex += 1;
    state.gotCorrectThisStage = 0;
    AudioFX.stageUp();
    setToast(`${STAGES[state.stageIndex].stage}단계로 이동!`, 'info');
    updateHUD();
    nextQuestion();
    return;
    }

    state.running = false;
    state.phase = 'finished';
    clearTimers();
    stopQuestionTimer();
    setInputLocked(true);

    questionLine.classList.remove('blink');
    questionLine.textContent = `JACKPOT! 완료 🎰  (정답 ${state.correct} / 오답 ${state.wrong} / 타임아웃 ${state.timeout})`;
    setRingProgress(100, 'END');
    setToast('전체 단계 완료!', 'success');

    btnStart.disabled = false;
    stageSelect.disabled = false;
}

function submitAnswer() {
    if (!state.running) return;
    if (state.phase !== 'answering') return;
    if (state.lockInput) return;

    const raw = answerInput.value;
    if (raw === '' || raw == null) {
    setToast('정답을 입력하세요.', 'secondary');
    answerInput.focus();
    return;
    }

    const user = Number(raw);
    const ans = state.current.answer;

    const remain = remainSecNow();
    stopQuestionTimer();
    setInputLocked(true);

    state.attempt += 1;

    if (Number.isFinite(user) && user === ans) {
    state.correct += 1;
    state.streak += 1;
    state.gotCorrectThisStage += 1;

    // score: 기본 10 + 남은시간 보너스(최대 10) + 연속 보너스
    const timeBonus = remain == null ? 0 : Math.floor(Math.min(10, remain));
    const streakBonus = Math.min(10, state.streak);
    state.score += (10 + timeBonus + streakBonus);

    AudioFX.correct();
    setToast(`정답! (+${10 + timeBonus + streakBonus}점)`, 'success');

    logAttempt({ input: user, result: '정답', remainSec: remain ?? null });

    updateHUD();
    checkStageAdvanceOrFinish();
    if (state.running) setTimeout(() => nextQuestion(), 320);
    } else {
    state.wrong += 1;
    state.streak = 0;
    state.score = Math.max(0, state.score - 2);

    AudioFX.wrong();
    setToast(`오답! 정답: ${ans}`, 'danger');

    questionLine.classList.add('shake');
    setTimeout(() => questionLine.classList.remove('shake'), 380);

    logAttempt({ input: user, result: '오답', remainSec: remain ?? null });

    updateHUD();
    setTimeout(() => { if (state.running) nextQuestion(); }, 450);
    }
}

// --------------------------------------------
// Game start / restart
// --------------------------------------------
function moveToIndex() {
    location.href = "../index.html";
}

function startGameFromSelectedStage() {
    const selected = Number(stageSelect.value);
    const idx = STAGES.findIndex(s => s.stage === selected);
    state.stageIndex = (idx >= 0) ? idx : 0;

    state.running = true;
    state.phase = 'idle';
    state.gotCorrectThisStage = 0;

    state.streak = 0;
    state.score = 0;

    state.correct = 0;
    state.wrong = 0;
    state.timeout = 0;
    state.attempt = 0;

    state.current = null;

    clearTimers();
    stopQuestionTimer();
    setRingProgress(0, '-');
    windowA.textContent = '-';
    windowB.textContent = '-';
    opSymbol.textContent = '?';

    btnStart.disabled = true;
    stageSelect.disabled = true;

    updateHUD();
    setToast(`${STAGES[state.stageIndex].stage}단계부터 시작!`, 'primary');
    nextQuestion();
}

function restartCurrentStage() {
    if (!state.running) {
    // running 아니면 선택된 단계 기준으로 시작
    startGameFromSelectedStage();
    return;
    }

    clearTimers();
    stopQuestionTimer();

    state.gotCorrectThisStage = 0;
    state.streak = 0;
    // 점수/전체 정답오답은 유지할지 애매 -> "현재 단계 재시작"은 누적 유지로 처리
    updateHUD();

    setToast(`${stageInfo().stage}단계 재시작!`, 'info');
    nextQuestion();
}

function restartAll() {
    state.running = false;
    state.phase = 'idle';
    clearTimers();
    stopQuestionTimer();

    state.stageIndex = 0;
    state.gotCorrectThisStage = 0;

    state.streak = 0;
    state.score = 0;
    state.correct = 0;
    state.wrong = 0;
    state.timeout = 0;
    state.attempt = 0;

    state.current = null;

    btnStart.disabled = false;
    stageSelect.disabled = false;

    setInputLocked(true);
    answerInput.value = '';

    windowA.textContent = '-';
    windowB.textContent = '-';
    opSymbol.textContent = '?';
    questionLine.textContent = '시작을 눌러주세요';
    questionLine.classList.remove('blink');

    setRingProgress(0, '-');
    progressBar.style.width = '0%';
    progressBar.classList.remove('bg-success');
    progressBar.classList.add('bg-info');

    updateHUD();
    setToast('처음부터 리셋 완료', 'secondary');
}

// --------------------------------------------
// CSV
// --------------------------------------------
function downloadCsv() {
    const rows = [...state.log].reverse(); // oldest first
    const header = ['no','stage','problem','input','answer','result','remainSec'];
    const esc = (v) => {
    const s = String(v ?? '');
    const needs = /[",\n]/.test(s);
    const q = s.replaceAll('"', '""');
    return needs ? `"${q}"` : q;
    };

    const csv = [
    header.join(','),
    ...rows.map(r => header.map(h => esc(r[h])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'math-slot-log.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
}

// --------------------------------------------
// Events
// --------------------------------------------
btnStart.addEventListener('click', () => startGameFromSelectedStage());
// btnRestartStage.addEventListener('click', () => restartCurrentStage());
btnRestartAll.addEventListener('click', () => restartAll());
btnGotoIndex.addEventListener('click', () => moveToIndex());

answerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    submitAnswer();
});

btnClearLog.addEventListener('click', () => {
    state.log = [];
    renderLog();
    setToast('로그를 비웠습니다.', 'secondary');
});

btnDownloadCsv.addEventListener('click', () => {
    downloadCsv();
    setToast('CSV 다운로드를 시작했습니다.', 'info');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') restartAll();
    if (e.key === 'Enter') AudioFX.unlock(); // allow audio on first interaction
});

// init
function init() {
    renderLog();
    restartAll();
}
init();
