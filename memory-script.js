/* macao-memory.js */
(() => {
    "use strict";

    // ===== Config =====
    const STAGE_WORD_COUNTS = [2, 4, 6, 8, 10];
    const PREVIEW_MS = 5000;
    const PLAY_MS = 5000;

    const WORD_POOL = [
        "마카오", "슬롯", "야시장", "카지노", "에그타르트",
        "야경", "대성당", "곤돌라", "전차", "홍콩",
        "호텔", "쿠폰", "여권", "환전", "분수",
        "사진", "공연", "쇼핑", "버스", "산책",
        "맛집", "디저트", "기념품", "거리", "광장"
    ];

    // ===== DOM =====
    const $ = (sel) => document.querySelector(sel);

    const btnStart = $("#btnStart");
    // const btnRestartStage = $("#btnRestartStage");
    const btnRestartAll = $("#btnRestartAll");
    const btnGotoIndex = $("#btnGotoIndex");
    const btnClearPick = $("#btnClearPick");
    const btnRevealAnswer = $("#btnRevealAnswer");

    const btnDownloadCsv = $("#btnDownloadCsv");
    const btnClearLog = $("#btnClearLog");
    const logBody = $("#logBody");

    const hudStage = $("#hudStage");
    const hudPhase = $("#hudPhase");
    const hudWordCount = $("#hudWordCount");
    const hudPick = $("#hudPick");
    const hudNeed = $("#hudNeed");
    const hudTimeLimit = $("#hudTimeLimit");

    const hudWin = $("#hudWin");
    const hudLose = $("#hudLose");
    const hudTimeout = $("#hudTimeout");
    const hudAttempt = $("#hudAttempt");

    const timerRing = $("#timerRing");
    const timerText = $("#timerText");
    const progressBar = $("#progressBar");

    const hintLine = $("#hintLine");
    const orderChips = $("#orderChips");
    const wordGrid = $("#wordGrid");
    const pickedLine = $("#pickedLine");

    // Toast (Bootstrap)
    const toastEl = $("#toast");
    const toastBody = $("#toastBody");
    const toast = toastEl ? new bootstrap.Toast(toastEl, { delay: 2200 }) : null;

    // ===== State =====
    const Phase = Object.freeze({
        IDLE: "idle",
        PREVIEW: "preview",
        PLAY: "play",
        RESULT: "result",
        DONE: "done",
    });

    let stageIndex = 0;                 // 0..4
    let phase = Phase.IDLE;

    let answer = [];                    // correct order
    let gridWords = [];                 // shuffled for grid
    let picked = [];                    // picked order

    let win = 0, lose = 0, timeout = 0, attempt = 0;

    let timerId = null;
    let phaseEndsAt = 0;

    /** @type {Array<{no:number, stage:number, question:string, input:string, answer:string, result:string, remainSec:number}>} */
    let logs = [];

    // ===== Utils =====
    function showToast(msg) {
        if (!toast) return;
        toastBody.textContent = msg;
        toast.show();
    }

    function clamp(n, a, b) {
        return Math.max(a, Math.min(b, n));
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function pickUnique(pool, n) {
        if (n > pool.length) throw new Error("WORD_POOL is too small for requested count");
        return shuffle(pool).slice(0, n);
    }

    function now() {
        return Date.now();
    }

    function clearTimer() {
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
    }

    function getRemainMs() {
        return Math.max(0, phaseEndsAt - now());
    }

    function setRingProgress(pct) {
        const p = clamp(pct, 0, 100);
        timerRing.style.setProperty("--p", `${p}%`);
        progressBar.style.width = `${p}%`;
    }

    function setPhase(nextPhase) {
        phase = nextPhase;
        hudPhase.textContent =
            phase === Phase.IDLE ? "-" :
                phase === Phase.PREVIEW ? "미리보기" :
                    phase === Phase.PLAY ? "선택" :
                        phase === Phase.RESULT ? "결과" :
                            phase === Phase.DONE ? "완료" : String(phase);
    }

    function setButtonsEnabled() {
        const inRun = phase === Phase.PREVIEW || phase === Phase.PLAY;
        btnStart.disabled = inRun;

        // btnRestartStage.disabled = phase === Phase.IDLE;
        btnRestartAll.disabled = false;

        btnClearPick.disabled = !(phase === Phase.PLAY && picked.length > 0);
        btnRevealAnswer.disabled = !(phase === Phase.RESULT || phase === Phase.DONE);
    }

    function updateHud() {
        hudStage.textContent = String(stageIndex + 1);
        hudWin.textContent = String(win);
        hudLose.textContent = String(lose);
        hudTimeout.textContent = String(timeout);
        hudAttempt.textContent = String(attempt);

        const need = STAGE_WORD_COUNTS[stageIndex];
        hudNeed.textContent = String(need);
        hudWordCount.textContent = String(need);
        hudPick.textContent = String(picked.length);

        hudTimeLimit.textContent = "5";
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function renderOrderChips(visible) {
        orderChips.innerHTML = "";
        if (!visible) return;

        answer.forEach((w, idx) => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.innerHTML = `<span class="badge badge-soft">${idx + 1}</span> <span class="mono fw-bold">${escapeHtml(w)}</span>`;
            orderChips.appendChild(chip);
        });
    }

    function renderPickedLine() {
        if (picked.length === 0) {
            pickedLine.textContent = "-";
            return;
        }
        pickedLine.textContent = picked.map((w, i) => `${i + 1}.${w}`).join("  ");
    }

    function renderGrid() {
        wordGrid.innerHTML = "";

        const count = gridWords.length;
        const col = count <= 10 ? "col-3" : "col-3";
            // count <= 4 ? "col-6" :
            //     count <= 6 ? "col-4" :
            //         count <= 10 ? "col-3" : "col-3";

        gridWords.forEach((w) => {
            const wrap = document.createElement("div");
            wrap.className = `${col} d-grid`;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "btn btn-outline-light btn-sm";
            btn.dataset.word = w;

            const clickable = phase === Phase.PLAY;
            btn.disabled = !clickable;

            btn.innerHTML = `<span class="mono fw-bold">${escapeHtml(w)}</span>`;
            btn.addEventListener("click", () => onWordClick(w, btn));

            wrap.appendChild(btn);
            wordGrid.appendChild(wrap);
        });

        if (phase === Phase.PLAY) disablePickedButtons();
    }

    function lockGridButtons() {
        wordGrid.querySelectorAll("button").forEach((b) => (b.disabled = true));
    }

    function disablePickedButtons() {
        const pickedSet = new Set(picked);
        wordGrid.querySelectorAll("button").forEach((b) => {
            const w = b.dataset.word;
            if (pickedSet.has(w)) b.disabled = true;
        });
    }

    // ===== Log =====
    function ensureLogEmptyRow() {
        if (!logBody) return;
        if (logs.length > 0) return;
        logBody.innerHTML = `<tr><td colspan="7" class="text-white-50">아직 기록이 없습니다.</td></tr>`;
    }

    function addLogRow({ stage, question, input, answerText, result, remainSec }) {
        logs.push({
            no: logs.length + 1,
            stage,
            question,
            input,
            answer: answerText,
            result,
            remainSec
        });

        if (!logBody) return;

        if (logs.length === 1) logBody.innerHTML = "";

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td class="text-white-50">${logs.length}</td>
      <td class="mono">${stage}</td>
      <td class="mono">${escapeHtml(question)}</td>
      <td class="mono">${escapeHtml(input)}</td>
      <td class="mono">${escapeHtml(answerText)}</td>
      <td class="mono">${escapeHtml(result)}</td>
      <td class="mono">${remainSec.toFixed(1)}s</td>
    `;
        logBody.appendChild(tr);

        // 최신 행이 보이도록 스크롤
        const container = logBody.closest(".table-responsive");
        if (container) container.scrollTop = container.scrollHeight;
    }

    function toCsv(rows) {
        const header = ["#", "Stage", "문제", "입력", "정답", "결과", "남은시간"];
        const esc = (v) => `"${String(v).replaceAll('"', '""')}"`;
        const lines = [header.map(esc).join(",")];

        for (const r of rows) {
            lines.push([
                r.no,
                r.stage,
                r.question,
                r.input,
                r.answer,
                r.result,
                `${r.remainSec.toFixed(1)}s`
            ].map(esc).join(","));
        }
        return lines.join("\n");
    }

    function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // ===== Flow =====
    function startGame(fromStageIndex = 0) {
        stageIndex = fromStageIndex;
        win = 0; lose = 0; timeout = 0; attempt = 0;

        logs = [];
        ensureLogEmptyRow();

        startStage();
    }

    function startStage() {
        clearTimer();
        picked = [];
        updateHud();
        renderPickedLine();

        const need = STAGE_WORD_COUNTS[stageIndex];
        answer = pickUnique(WORD_POOL, need);
        gridWords = shuffle(answer);

        setPhase(Phase.PREVIEW);
        hintLine.textContent = "순서를 외우세요 (5초)";
        renderOrderChips(true);
        renderGrid();

        setButtonsEnabled();
        runCountdown(PREVIEW_MS, () => startPlay());
    }

    function startPlay() {
        clearTimer();
        picked = [];
        updateHud();
        renderPickedLine();

        setPhase(Phase.PLAY);
        hintLine.textContent = "순서대로 클릭하세요 (5초)";
        renderOrderChips(false);
        renderGrid();
        setButtonsEnabled();

        runCountdown(PLAY_MS, () => {
            timeout += 1;
            attempt += 1;

            const remainSec = 0.0;
            addLogRow({
                stage: stageIndex + 1,
                question: `단어 ${STAGE_WORD_COUNTS[stageIndex]}개 순서`,
                input: picked.join(" → ") || "-",
                answerText: answer.join(" → "),
                result: "TIMEOUT",
                remainSec
            });

            showResult(false, true);
        });
    }

    function showResult(success, isTimeout) {
        clearTimer();

        const isLastStage = stageIndex === STAGE_WORD_COUNTS.length - 1;
        setPhase(isLastStage && success ? Phase.DONE : Phase.RESULT);

        lockGridButtons();
        renderOrderChips(true);
        btnRevealAnswer.disabled = false;

        if (success) {
            win += 1;
            hintLine.textContent = phase === Phase.DONE ? "🎉 마지막 단계 성공! (정답 공개)" : "성공! (정답 공개)";
            showToast(phase === Phase.DONE ? "마지막 단계까지 클리어!" : "성공! 다음 단계로 이동합니다.");
        } else {
            if (!isTimeout) lose += 1;
            hintLine.textContent = isTimeout ? "시간 초과! (정답 공개)" : "실패! (정답 공개)";
            showToast(isTimeout ? "시간 초과! 같은 단계를 다시 도전하세요." : "틀렸어요! 같은 단계를 다시 도전하세요.");
        }

        updateHud();
        setButtonsEnabled();
        setRingProgress(100);
        timerText.textContent = "0.0";

        setTimeout(() => {
            if (success) {
                if (!isLastStage) {
                    stageIndex += 1;
                    startStage();
                } else {
                    setButtonsEnabled();
                }
            } else {
                startStage();
            }
        }, 1400);
    }

    function gradeIfComplete() {
        const need = STAGE_WORD_COUNTS[stageIndex];
        if (picked.length !== need) return;

        const remainSec = getRemainMs() / 1000;
        attempt += 1;

        const ok = picked.every((w, i) => w === answer[i]);

        addLogRow({
            stage: stageIndex + 1,
            question: `단어 ${need}개 순서`,
            input: picked.join(" → "),
            answerText: answer.join(" → "),
            result: ok ? "OK" : "WRONG",
            remainSec
        });

        showResult(ok, false);
    }

    function onWordClick(word, btn) {
        if (phase !== Phase.PLAY) return;
        if (picked.includes(word)) return;

        picked.push(word);
        btn.disabled = true;

        updateHud();
        renderPickedLine();
        setButtonsEnabled();

        gradeIfComplete();
    }

    function clearPick() {
        if (phase !== Phase.PLAY) return;
        picked = [];
        updateHud();
        renderPickedLine();
        renderGrid();
        setButtonsEnabled();
    }

    function revealAnswer() {
        if (!(phase === Phase.RESULT || phase === Phase.DONE)) return;
        showToast(`정답: ${answer.join(" → ")}`);
    }

    function runCountdown(durationMs, onDone) {
        clearTimer();
        phaseEndsAt = now() + durationMs;

        const tick = () => {
            const remain = Math.max(0, phaseEndsAt - now());
            const pct = 100 - (remain / durationMs) * 100;
            setRingProgress(pct);
            timerText.textContent = (remain / 1000).toFixed(1);

            if (remain <= 0) {
                clearTimer();
                onDone();
            }
        };

        tick();
        timerId = setInterval(tick, 50);
    }

    // ===== Events =====
    btnStart?.addEventListener("click", () => {
        if (phase === Phase.PREVIEW || phase === Phase.PLAY) return;
        startGame(0);
    });

    // btnRestartStage?.addEventListener("click", () => {
    //     if (phase === Phase.IDLE) return;
    //     startStage();
    // });

    btnRestartAll?.addEventListener("click", () => {
        clearTimer();
        setPhase(Phase.IDLE);

        stageIndex = 0;
        answer = [];
        gridWords = [];
        picked = [];

        win = 0; lose = 0; timeout = 0; attempt = 0;

        logs = [];
        ensureLogEmptyRow();

        hintLine.textContent = "시작을 눌러주세요";
        orderChips.innerHTML = "";
        wordGrid.innerHTML = "";
        pickedLine.textContent = "-";

        timerText.textContent = "-";
        setRingProgress(0);

        updateHud();
        setButtonsEnabled();
        showToast("처음부터 다시 시작할 수 있어요.");
    });

    btnGotoIndex?.addEventListener("click", () => {
        location.href = "index.html";
    });

    btnClearPick?.addEventListener("click", clearPick);
    btnRevealAnswer?.addEventListener("click", revealAnswer);

    btnClearLog?.addEventListener("click", () => {
        logs = [];
        ensureLogEmptyRow();
        showToast("로그를 비웠습니다.");
    });

    btnDownloadCsv?.addEventListener("click", () => {
        if (logs.length === 0) {
            showToast("다운로드할 로그가 없습니다.");
            return;
        }
        const csv = toCsv(logs);
        downloadText("macao-memory-log.csv", csv, "text/csv;charset=utf-8");
    });

    // Esc: reset all
    window.addEventListener("keydown" || "click", (e) => {
        if (e.key === "Escape") btnRestartAll?.click();
    });

    // init
    ensureLogEmptyRow();
    setPhase(Phase.IDLE);
    updateHud();
    setButtonsEnabled();
    setRingProgress(0);
})();
