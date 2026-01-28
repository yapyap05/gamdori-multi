// --------------------------------------------
// Config & Data
// --------------------------------------------
const STAGES = [
  { stage: 1, time: 12 },
  { stage: 2, time: 10 },
  { stage: 3, time: 8 },
  { stage: 4, time: 7 },
  { stage: 5, time: 5 },
];

const WORDS_KR = [
  "사과", "바나나", "컴퓨터", "제네시스", "홈텍스", "대한민국", "개발자", "코딩", "마우스", "키보드",
  "모니터", "갤럭시", "아이폰", "인공지능", "알고리즘", "데이터", "서버", "클라우드", "네트워크", "보안",
  "카페인", "야근", "프로젝트", "성공", "열정", "미래", "우주", "지구", "사랑", "행복",
  "자동차", "비행기", "여행", "휴가", "여권", "공항", "사진", "카메라", "영화", "음악"
];

const WORDS_EN = [
  "apple", "banana", "computer", "genesis", "hometax", "korea", "developer", "coding", "mouse", "keyboard",
  "monitor", "galaxy", "iphone", "ai", "algorithm", "data", "server", "cloud", "network", "security",
  "caffeine", "overtime", "project", "success", "passion", "future", "space", "earth", "love", "happy",
  "car", "airplane", "travel", "vacation", "passport", "airport", "photo", "camera", "movie", "music"
];

// --------------------------------------------
// DOM Elements
// --------------------------------------------
const btnStart = document.getElementById('btnStart');
const btnRestartAll = document.getElementById('btnRestartAll');
const btnGotoIndex = document.getElementById('btnGotoIndex');

const langSelect = document.getElementById('langSelect');
const soundSelect = document.getElementById('soundSelect');

const hudStage = document.getElementById('hudStage');
const hudLang = document.getElementById('hudLang');
const hudTimeLimit = document.getElementById('hudTimeLimit');
const hudScore = document.getElementById('hudScore');
const hudCorrect = document.getElementById('hudCorrect');
const hudWrong = document.getElementById('hudWrong');
const hudStreak = document.getElementById('hudStreak');

const progressBar = document.getElementById('progressBar');
const timerRing = document.getElementById('timerRing');
const timerText = document.getElementById('timerText');

const wordDisplay = document.getElementById('wordDisplay');
const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answerInput');

const logBody = document.getElementById('logBody');
const btnClearLog = document.getElementById('btnClearLog');

const toastEl = document.getElementById('toast');
const toastBody = document.getElementById('toastBody');
const toast = new bootstrap.Toast(toastEl, { delay: 1500 });

// --------------------------------------------
// Audio (WebAudio)
// --------------------------------------------
const AudioFX = (() => {
  let ctx = null;
  function ensure() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
  function enabled() { return soundSelect.value !== 'off'; }
  
  function playTone(freq, type, dur, gainVal = 0.05) {
    if (!enabled()) return;
    const c = ensure();
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gainVal, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  return {
    unlock() { if(enabled()) ensure().resume?.(); },
    typeKey() { playTone(800 + Math.random() * 200, 'sine', 0.05, 0.03); },
    typeSpace() { playTone(600, 'square', 0.08, 0.04); },
    correct() { 
      if(!enabled()) return;
      const c = ensure(); const t = c.currentTime;
      // Success chord
      [523.25, 659.25, 783.99].forEach((f, i) => {
        setTimeout(() => playTone(f, 'triangle', 0.2, 0.05), i*50);
      });
    },
    wrong() { 
      if(!enabled()) return;
      playTone(150, 'sawtooth', 0.3, 0.08); 
      setTimeout(() => playTone(120, 'sawtooth', 0.3, 0.08), 100);
    },
    stageClear() {
       if(!enabled()) return;
       [1046, 1318, 1568, 2093].forEach((f,i)=> setTimeout(()=>playTone(f, 'sine', 0.3, 0.05), i*80));
    }
  };
})();

// --------------------------------------------
// State
// --------------------------------------------
const state = {
  running: false,
  stageIndex: 0,
  targetWords: [], 
  targetString: "", // "word1 word2 word3"
  
  score: 0,
  correctCount: 0,
  wrongCount: 0,
  streak: 0,
  
  startTime: 0,
  timerInterval: null,
  
  logSeq: 0
};

// --------------------------------------------
// Utils
// --------------------------------------------
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function setToast(msg, kind = 'dark') {
  toastEl.className = `toast align-items-center text-bg-${kind} border-0`;
  toastBody.textContent = msg;
  toast.show();
}

function updateHUD() {
  const info = STAGES[state.stageIndex];
  hudStage.textContent = info ? info.stage : '-';
  hudLang.textContent = langSelect.value;
  hudTimeLimit.textContent = info ? info.time : '-';
  
  hudScore.textContent = state.score;
  hudCorrect.textContent = state.correctCount;
  hudWrong.textContent = state.wrongCount;
  hudStreak.textContent = state.streak;
}

// --------------------------------------------
// Game Logic
// --------------------------------------------
function pickWords(count) {
  const pool = langSelect.value === 'KR' ? WORDS_KR : WORDS_EN;
  const selected = [];
  for (let i = 0; i < count; i++) {
    selected.push(pool[randInt(0, pool.length - 1)]);
  }
  return selected;
}

function renderTargetText() {
  wordDisplay.innerHTML = '';
  const chars = state.targetString.split('');
  
  chars.forEach((char, idx) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = char;
    span.dataset.index = idx;
    if (char === ' ') span.classList.add('space');
    wordDisplay.appendChild(span);
  });
}

function startStage() {
  if (state.stageIndex >= STAGES.length) {
    finishGame();
    return;
  }
  
  const stageInfo = STAGES[state.stageIndex];
  state.targetWords = pickWords(3);
  state.targetString = state.targetWords.join(' ');
  
  renderTargetText();
  updateHUD();
  
  answerInput.value = '';
  answerInput.disabled = false;
  answerInput.focus();
  
  // Timer Start
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.startTime = performance.now();
  const durationMs = stageInfo.time * 1000;
  const endTime = state.startTime + durationMs;
  
  progressBar.style.width = '100%';
  progressBar.className = 'progress-bar bg-info';
  
  setToast(`${stageInfo.stage}단계 시작! (${stageInfo.time}초)`, 'primary');
  
  state.timerInterval = setInterval(() => {
    const now = performance.now();
    const remainMs = endTime - now;
    const remainSec = Math.max(0, remainMs / 1000);
    
    // Ring Update
    const pct = (remainMs / durationMs) * 100;
    timerRing.style.setProperty('--p', `${Math.max(0, pct)}%`);
    timerText.textContent = remainSec.toFixed(1);
    
    // Bar Update
    progressBar.style.width = `${pct}%`;
    if(pct < 30) progressBar.className = 'progress-bar bg-danger';
    else if(pct < 60) progressBar.className = 'progress-bar bg-warning';
    
    if (remainMs <= 0) {
      handleFail('Time Over');
    }
  }, 33);
}

function handleInput() {
  if (!state.running) return;
  
  const inputVal = answerInput.value;
  const targetVal = state.targetString;
  const spans = wordDisplay.querySelectorAll('.char');
  
  // Audio Effect
  const lastChar = inputVal.slice(-1);
  if(lastChar === ' ') AudioFX.typeSpace();
  else AudioFX.typeKey();
  
  // Validation Visuals
  spans.forEach((span, idx) => {
    span.classList.remove('current', 'correct', 'wrong');
    
    if (idx < inputVal.length) {
      // User has typed this char
      if (inputVal[idx] === targetVal[idx]) {
        span.classList.add('correct');
      } else {
        span.classList.add('wrong');
      }
    } else if (idx === inputVal.length) {
      // Cursor position
      span.classList.add('current');
    }
  });

  // Check Full Match Logic (Auto check if lengths match, or wait for Enter)
  // But prompt implies Enter is allowed, but let's allow Enter to force submit.
}

function submitAnswer() {
  if (!state.running) return;
  
  const inputVal = answerInput.value.trim(); // Trim to be safe
  const targetVal = state.targetString;
  
  if (inputVal === targetVal) {
    handleSuccess();
  } else {
    // If entered but wrong
    handleFail('오타 발생');
  }
}

function handleSuccess() {
  clearInterval(state.timerInterval);
  AudioFX.correct();
  
  const now = performance.now();
  const elapsed = (now - state.startTime) / 1000;
  const stageInfo = STAGES[state.stageIndex];
  const remain = Math.max(0, stageInfo.time - elapsed);
  
  // WPM Calculation: (Characters / 5) / Minutes
  const wpm = Math.round((state.targetString.length / 5) / (elapsed / 60));
  
  // Score: Base 100 + RemainTime * 10 + Streak * 5
  const gainedScore = 100 + Math.floor(remain * 10) + (state.streak * 5);
  state.score += gainedScore;
  state.correctCount++;
  state.streak++;
  
  logResult('성공', remain, wpm);
  setToast(`성공! (+${gainedScore}점)`, 'success');
  
  // Next Stage
  state.stageIndex++;
  AudioFX.stageClear();
  setTimeout(() => startStage(), 1200);
}

function handleFail(reason) {
  clearInterval(state.timerInterval);
  AudioFX.wrong();
  
  state.wrongCount++;
  state.streak = 0;
  
  // Fail penalty? Just log and retry or game over? 
  // Let's restart current stage or just move on?
  // Usually speed games might game over, but let's allow retry of same stage logic or reset streak.
  // For this flow: Reset Streak and retry same stage with new words.
  
  logResult(`실패(${reason})`, 0, 0);
  setToast(`${reason}! 재시도합니다.`, 'danger');
  
  wordDisplay.classList.add('shake');
  setTimeout(()=> wordDisplay.classList.remove('shake'), 400);
  
  // Retry same stage
  setTimeout(() => startStage(), 1500);
}

function logResult(result, remain, wpm) {
  state.logSeq++;
  const row = `
    <tr>
      <td class="text-white-50">${state.logSeq}</td>
      <td>${STAGES[state.stageIndex]?.stage ?? 'End'}</td>
      <td><span class="badge ${result === '성공' ? 'text-bg-success' : 'text-bg-danger'}">${result}</span></td>
      <td class="mono">${remain.toFixed(1)}s</td>
      <td class="mono">${wpm}</td>
    </tr>
  `;
  logBody.insertAdjacentHTML('afterbegin', row);
}

function finishGame() {
  state.running = false;
  clearInterval(state.timerInterval);
  answerInput.disabled = true;
  answerInput.value = "";
  
  wordDisplay.innerHTML = `GAME CLEARED! <br> 최종 점수: ${state.score}`;
  setToast('모든 스테이지 완료! 축하합니다.', 'success');
  
  btnStart.disabled = false;
  langSelect.disabled = false;
  
  // Fire confetti or big sound
  AudioFX.stageClear();
}

// --------------------------------------------
// Controls
// --------------------------------------------
function initGame() {
  AudioFX.unlock();
  state.running = true;
  state.stageIndex = 0;
  state.score = 0;
  state.correctCount = 0;
  state.wrongCount = 0;
  state.streak = 0;
  state.logSeq = 0;
  
  logBody.innerHTML = '';
  btnStart.disabled = true;
  langSelect.disabled = true;
  
  updateHUD();
  startStage();
}

function resetGame() {
  state.running = false;
  clearInterval(state.timerInterval);
  
  answerInput.disabled = true;
  answerInput.value = '';
  wordDisplay.innerHTML = '시작 버튼을 눌러주세요';
  
  btnStart.disabled = false;
  langSelect.disabled = false;
  
  timerRing.style.setProperty('--p', '0%');
  timerText.textContent = '-';
  progressBar.style.width = '0%';
  
  setToast('게임이 리셋되었습니다.', 'secondary');
}

// --------------------------------------------
// Events
// --------------------------------------------
btnStart.addEventListener('click', initGame);
btnRestartAll.addEventListener('click', resetGame);
btnGotoIndex.addEventListener('click', () => location.href = 'index.html');

answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitAnswer();
});

answerInput.addEventListener('input', handleInput);

// Global Keys
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') resetGame();
});

btnClearLog.addEventListener('click', () => {
  logBody.innerHTML = '<tr><td colspan="5" class="text-white-50">기록 대기중...</td></tr>';
});