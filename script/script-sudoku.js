/**
 * Sudoku Game Logic for Gamdori Arcade
 */

const state = {
    answerBoard: [], // 정답 판
    currentBoard: [], // 사용자가 보는 판
    startTime: null,
    timerInterval: null,
    isPlaying: false,
    difficulty: 'easy',
    log: [],
    seq: 0
};

// DOM Elements
const boardEl = document.getElementById('sudoku-board');
const diffSelect = document.getElementById('diffSelect');
const hudDiff = document.getElementById('hudDiff');
const hudTime = document.getElementById('hudTime');
const hudStatus = document.getElementById('hudStatus');
const timerText = document.getElementById('timerText');
const logBody = document.getElementById('logBody');
const toastEl = document.getElementById('toast');
const toastBody = document.getElementById('toastBody');
const toast = new bootstrap.Toast(toastEl, { delay: 2000 });

// --- Sudoku Core Logic ---

function createSeed() {
    return [
        [5,3,4,6,7,8,9,1,2], [6,7,2,1,9,5,3,4,8], [1,9,8,3,4,2,5,6,7],
        [8,5,9,7,6,1,4,2,3], [4,2,6,8,5,3,7,9,1], [7,1,3,9,2,4,8,5,6],
        [9,6,1,5,3,7,2,8,4], [2,8,7,4,1,9,6,3,5], [3,4,5,2,8,6,1,7,9]
    ];
}

function shuffleBoard(grid) {
    let newGrid = JSON.parse(JSON.stringify(grid));
    for (let i = 0; i < 3; i++) {
        let r1 = Math.floor(Math.random() * 3) + i * 3;
        let r2 = Math.floor(Math.random() * 3) + i * 3;
        [newGrid[r1], newGrid[r2]] = [newGrid[r2], newGrid[r1]];
    }
    return newGrid;
}

function removeNumbers(grid, difficulty) {
    let count = difficulty === 'easy' ? 30 : difficulty === 'medium' ? 45 : 60;
    let puzzle = JSON.parse(JSON.stringify(grid));
    while (count > 0) {
        let r = Math.floor(Math.random() * 9);
        let c = Math.floor(Math.random() * 9);
        if (puzzle[r][c] !== 0) {
            puzzle[r][c] = 0;
            count--;
        }
    }
    return puzzle;
}

// --- UI & Timer Logic ---

function showToast(msg, type = 'dark') {
    toastEl.className = `toast align-items-center text-bg-${type} border-0`;
    toastBody.textContent = msg;
    toast.show();
}

function startTimer() {
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
        hudTime.textContent = elapsed;
        timerText.textContent = elapsed;
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
}

function drawBoard(puzzle) {
    boardEl.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            if (puzzle[r][c] !== 0) {
                cell.textContent = puzzle[r][c];
                cell.classList.add('fixed');
            } else {
                const input = document.createElement('input');
                input.type = 'number';
                input.min = 1;
                input.max = 9;
                input.dataset.row = r;
                input.dataset.col = c;
                // 한 글자만 입력되도록 제한
                input.oninput = function() { if(this.value.length > 1) this.value = this.value.slice(0,1); };
                cell.appendChild(input);
            }
            boardEl.appendChild(cell);
        }
    }
}

function startGame() {
    state.difficulty = diffSelect.value;
    state.isPlaying = true;
    state.answerBoard = shuffleBoard(createSeed());
    state.currentBoard = removeNumbers(state.answerBoard, state.difficulty);
    
    hudDiff.textContent = state.difficulty.toUpperCase();
    hudStatus.textContent = "진행 중";
    
    stopTimer();
    startTimer();
    drawBoard(state.currentBoard);
    showToast(`${state.difficulty} 난이도로 시작합니다!`, 'primary');
}

function checkAnswer() {
    if (!state.isPlaying) return;

    const inputs = boardEl.querySelectorAll('input');
    let isCorrect = true;
    let isFull = true;

    inputs.forEach(input => {
        const r = input.dataset.row;
        const c = input.dataset.col;
        const val = parseInt(input.value);

        if (!val) isFull = false;
        if (val !== state.answerBoard[r][c]) isCorrect = false;
    });

    if (!isFull) {
        showToast("아직 빈칸이 있습니다!", "warning");
        return;
    }

    const duration = hudTime.textContent;
    if (isCorrect) {
        stopTimer();
        state.isPlaying = false;
        hudStatus.textContent = "완료!";
        showToast("축하합니다! 정답입니다.", "success");
        addLog(state.difficulty, "성공", duration);
    } else {
        showToast("틀린 부분이 있습니다. 다시 확인해보세요!", "danger");
    }
}

function addLog(diff, result, time) {
    state.seq++;
    const entry = {
        no: state.seq,
        diff: diff,
        result: result,
        time: time
    };
    state.log.unshift(entry);
    renderLog();
}

function renderLog() {
    if (state.log.length === 0) {
        logBody.innerHTML = '<tr><td colspan="4" class="text-white-50 text-center">기록이 없습니다.</td></tr>';
        return;
    }
    logBody.innerHTML = state.log.map(item => `
        <tr>
            <td class="mono text-white-50">${item.no}</td>
            <td class="mono">${item.diff}</td>
            <td><span class="badge ${item.result === '성공' ? 'text-bg-success' : 'text-bg-danger'}">${item.result}</span></td>
            <td class="mono">${item.time}s</td>
        </tr>
    `).join('');
}

// Events
document.getElementById('btnStart').addEventListener('click', startGame);
document.getElementById('btnCheck').addEventListener('click', checkAnswer);
document.getElementById('btnGotoIndex').addEventListener('click', () => location.href = "../index.html");
document.getElementById('btnClearLog').addEventListener('click', () => {
    state.log = [];
    renderLog();
});

// 초기화면
drawBoard(createSeed()); // 샘플 보드 표시