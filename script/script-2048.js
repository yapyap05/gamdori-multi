/* script-2048.js */
(() => {
    "use strict";

    // ===== Config / Const =====
    const GRID_SIZE = 4;
    const WIN_VALUE = 2048;

    // ===== DOM Elements =====
    const $ = (sel) => document.querySelector(sel);
    const gridEl = $("#grid2048");
    const scoreCurrentEl = $("#scoreCurrent");
    const scoreBestEl = $("#scoreBest");

    // Buttons
    const btnNewGame = $("#btnNewGame");
    const btnGotoIndex = $("#btnGotoIndex");
    const btnTryAgain = $("#btnTryAgain");
    const btnClearLog = $("#btnClearLog");
    const logBody = $("#logBody");

    // Overlay
    const overlay = $("#gameOverlay");
    const overlayMessage = $("#overlayMessage");

    // ===== State =====
    // Instead of a simple 2D array of numbers, we track Tile objects
    // grid cells will hold: null OR { id, val, x, y, ... }
    let grid = [];
    let score = 0;
    let bestScore = localStorage.getItem("gamdori-2048-best") || 0;
    let isGameOver = false;
    let isWon = false;
    let keepPlaying = false;

    let gameStartTime = 0;
    let logs = [];

    // Unique ID counter for tiles to track them across moves (crucial for animation)
    let tileIdCounter = 1;

    // ===== Init =====
    function init() {
        scoreBestEl.textContent = bestScore;
        loadLogs();
        startNewGame();
    }

    function startNewGame() {
        // Clear grid
        grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

        // Remove existing tile elements
        const existingTiles = gridEl.querySelectorAll('.tile:not(.tile-empty)');
        existingTiles.forEach(t => t.remove());

        score = 0;
        isGameOver = false;
        isWon = false;
        keepPlaying = false;
        gameStartTime = Date.now();
        tileIdCounter = 1;

        updateScoreDisplay();
        hideOverlay();

        // Initial tiles
        addRandomTile();
        addRandomTile();

        renderGrid();
    }

    // ===== Core Logic =====

    // Create a tile object
    function createTile(val, x, y) {
        return {
            id: tileIdCounter++,
            val: val,
            x: x, // logic coordinate
            y: y,
            mergedFrom: null, // if this tile was result of merge, store component tiles
            isNew: true // for pop animation
        };
    }

    function addRandomTile() {
        const emptyCells = [];
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (!grid[r][c]) emptyCells.push({ r, c });
            }
        }

        if (emptyCells.length === 0) return;

        const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const val = Math.random() < 0.9 ? 2 : 4;

        grid[r][c] = createTile(val, r, c);
    }

    // Calculate position in pixels for a tile at (row, col)
    // We rely on the .tile-empty grid layout to find positions.
    function getTilePosition(r, c) {
        // Find the background cell at this position
        // The background cells are always present as .tile-empty
        // 0-indexed in DOM order: r * 4 + c
        const index = r * GRID_SIZE + c;
        const placeholders = gridEl.querySelectorAll('.tile-empty');
        const target = placeholders[index];
        if (!target) return { top: 0, left: 0 };

        return {
            top: target.offsetTop,
            left: target.offsetLeft,
            width: target.offsetWidth,
            height: target.offsetHeight
        };
    }

    function move(direction) {
        if (isGameOver) return;
        if (isWon && !keepPlaying) return;

        // 1. Prepare for move: Reset merge flags
        // We will reconstruct the grid based on movement
        let moved = false;
        let addedScore = 0;

        // Vector
        const vector = { x: 0, y: 0 }; // x=row, y=col (delta)
        if (direction === 'Up') vector.x = -1;
        if (direction === 'Down') vector.x = 1;
        if (direction === 'Left') vector.y = -1;
        if (direction === 'Right') vector.y = 1;

        // Traversal order

        const rows = [];
        const cols = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            rows.push(i);
            cols.push(i);
        }

        if (direction === 'Down') rows.reverse();
        if (direction === 'Right') cols.reverse();

        // We process cells in the correct order to slide them
        rows.forEach(r => {
            cols.forEach(c => {
                const cell = grid[r][c];
                if (cell) {
                    // Try to move this tile as far as possible in 'direction'
                    const next = findFarthestPosition(r, c, vector);

                    const target = getTarget(r, c, vector);
                    const obstacle = cellAt(target.next);

                    if (obstacle && obstacle.val === cell.val && !obstacle.mergedFrom) {
                        // MERGE
                        const merged = createTile(cell.val * 2, obstacle.x, obstacle.y);
                        merged.mergedFrom = [cell, obstacle];
                        merged.isNew = false; // It's a merge result

                        grid[r][c] = null; // Remove from old pos
                        grid[obstacle.x][obstacle.y] = merged; // Place merged

                        // Update original cell's internal pos for animation target
                        cell.x = obstacle.x;
                        cell.y = obstacle.y;

                        addedScore += merged.val;
                        moved = true;
                    } else {
                        // JUST MOVE
                        if (target.farthest.r !== r || target.farthest.c !== c) {
                            grid[r][c] = null;
                            grid[target.farthest.r][target.farthest.c] = cell;
                            cell.x = target.farthest.r;
                            cell.y = target.farthest.c;
                            moved = true;
                        }
                    }
                }
            });
        });

        if (moved) {
            score += addedScore;
            updateScoreDisplay();

            addRandomTile();

            renderGrid();
            checkGameStatus();
        }
    }

    function cellAt(pos) {
        if (pos.r < 0 || pos.r >= GRID_SIZE || pos.c < 0 || pos.c >= GRID_SIZE) return null;
        return grid[pos.r][pos.c];
    }

    function findFarthestPosition(r, c, vector) {
        // Helper wrapper if needed, but getTarget does the work
        // Kept for logical clarity if referenced, else getTarget is used directly
        return getTarget(r, c, vector).farthest;
    }

    function getTarget(r, c, vector) {
        let prev = { r, c };
        let curr = { r: r + vector.x, c: c + vector.y };

        while (curr.r >= 0 && curr.r < GRID_SIZE && curr.c >= 0 && curr.c < GRID_SIZE) {
            if (grid[curr.r][curr.c]) {
                // Obstacle found
                return { farthest: prev, next: curr };
            }
            prev = curr;
            curr = { r: curr.r + vector.x, c: curr.c + vector.y };
        }
        return { farthest: prev, next: curr };
    }

    // ===== Rendering =====
    function renderGrid() {
        // We sync the DOM elements with the grid state.

        // 1. Mark all existing DOM tiles as 'stale'
        const domTiles = Array.from(gridEl.querySelectorAll('.tile:not(.tile-empty)'));
        const domMap = new Map();
        domTiles.forEach(el => {
            domMap.set(parseInt(el.dataset.id), el);
        });

        // 2. Iterate Grid and Update/Create
        const visitedIds = new Set();

        // Helper to update a DOM element's position/class
        const updateDom = (tile) => {
            visitedIds.add(tile.id);
            let el = domMap.get(tile.id);

            if (!el) {
                // Create New
                el = document.createElement("div");
                el.className = `tile tile-${tile.val}`;
                if (tile.val > 2048) el.classList.add("tile-super");
                if (tile.isNew) el.classList.add("tile-new"); // Pop animation
                el.dataset.id = tile.id;
                el.textContent = tile.val;

                // Initial Pos
                const pos = getTilePosition(tile.x, tile.y);
                el.style.width = pos.width + "px";
                el.style.height = pos.height + "px";
                el.style.top = pos.top + "px";
                el.style.left = pos.left + "px";

                if (tile.mergedFrom) {
                    el.classList.add("tile-merged"); // Pulse animation
                    el.style.zIndex = 100; // Above moving tiles
                }

                gridEl.appendChild(el);
            } else {
                // Update Existing
                // Update position (triggers CSS transition)
                const pos = getTilePosition(tile.x, tile.y);
                el.style.top = pos.top + "px";
                el.style.left = pos.left + "px";

                // Class and Value
                el.className = `tile tile-${tile.val}`;
                if (tile.val > 2048) el.classList.add("tile-super");
                el.textContent = tile.val;

                // Remove stale animation classes
                el.classList.remove("tile-new", "tile-merged");
            }
        };

        // Render current tiles
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const tile = grid[r][c];
                if (tile) {
                    updateDom(tile);

                    if (tile.mergedFrom) {
                        tile.mergedFrom.forEach(parent => {
                            // If parent was already rendered (it should be)
                            if (domMap.has(parent.id)) {
                                const pEl = domMap.get(parent.id);
                                // Move parent to new Child's position
                                const pos = getTilePosition(tile.x, tile.y);
                                pEl.style.top = pos.top + "px";
                                pEl.style.left = pos.left + "px";
                                // Mark as visited so we handle removal specifically
                                visitedIds.add(parent.id);

                                // Schedule removal
                                setTimeout(() => pEl.remove(), 150); // Match CSS transition time
                            }
                        });
                    }
                }
            }
        }

        // 3. Remove tiles that are gone (and not part of a merge animation)
        domMap.forEach((el, id) => {
            if (!visitedIds.has(id)) {
                el.remove();
            }
        });

        // Clear isNew/merged flags for next turn's logic
        setTimeout(() => {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (grid[r][c]) {
                        grid[r][c].isNew = false;
                        grid[r][c].mergedFrom = null;

                        const el = gridEl.querySelector(`.tile[data-id="${grid[r][c].id}"]`);
                        if (el) el.classList.remove("tile-new", "tile-merged");
                    }
                }
            }
        }, 200);
    }

    // Resize Handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Force re-calculate positions
            const domTiles = gridEl.querySelectorAll('.tile:not(.tile-empty)');
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const tile = grid[r][c];
                    if (tile) {
                        const el = gridEl.querySelector(`.tile[data-id="${tile.id}"]`);
                        if (el) {
                            const pos = getTilePosition(r, c);
                            // Disable transition for resize?
                            el.style.transition = 'none';
                            el.style.top = pos.top + "px";
                            el.style.left = pos.left + "px";
                            // Restore transition
                            setTimeout(() => el.style.transition = '', 50);
                        }
                    }
                }
            }
        }, 100);
    });

    // Added Missing Function
    function updateScoreDisplay() {
        scoreCurrentEl.textContent = score;
        if (score > bestScore) {
            bestScore = score;
            scoreBestEl.textContent = bestScore;
            localStorage.setItem("gamdori-2048-best", bestScore);
        }
    }

    function checkGameStatus() {
        if (!isWon) {
            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    if (grid[r][c] && grid[r][c].val === WIN_VALUE) {
                        isWon = true;
                        gameMsg("YOU WON!", true);
                        return;
                    }
                }
            }
        }

        // Check full
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (!grid[r][c]) return; // Empty spot
            }
        }

        // Check merges
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const val = grid[r][c].val;
                if (c < GRID_SIZE - 1 && grid[r][c + 1].val === val) return;
                if (r < GRID_SIZE - 1 && grid[r + 1][c].val === val) return;
            }
        }

        isGameOver = true;
        gameMsg("GAME OVER");
        addLog("DEFEAT");
    }

    function gameMsg(msg, isWin = false) {
        overlayMessage.textContent = msg;
        overlay.classList.add("active");
        if (isWin) {
            btnTryAgain.textContent = "Continue Playing";
        } else {
            btnTryAgain.textContent = "Try Again";
        }
    }

    function hideOverlay() {
        overlay.classList.remove("active");
    }

    function addLog(resultStr) {
        const vals = grid.flat().map(t => t ? t.val : 0);
        const maxTile = Math.max(...vals);
        const duration = (Date.now() - gameStartTime) / 1000;

        logs.push({
            no: logs.length + 1,
            result: resultStr,
            score: score,
            maxTile: maxTile,
            time: duration.toFixed(1) + "s"
        });

        renderLogs();
    }

    function renderLogs() {
        if (!logBody) return;
        if (logs.length === 0) {
            logBody.innerHTML = `<tr><td colspan="5" class="text-white-50 text-center py-3">No games played yet.</td></tr>`;
            return;
        }

        logBody.innerHTML = logs.map(l => `
            <tr>
                <td class="text-white-50">${l.no}</td>
                <td class="${l.result === 'WIN' ? 'text-success' : 'text-danger'} fw-bold big">${l.result}</td>
                <td class="mono">${l.score}</td>
                <td><span class="mono log-tile tile-${l.maxTile}">${l.maxTile}</span></td>
                <td class="mono text-white-50 small">${l.time}</td>
            </tr>
        `).reverse().join("");
    }

    function loadLogs() { } // Stub

    // Input Handling
    let touchStartX = 0;
    let touchStartY = 0;

    function handleInput(key) {
        const map = {
            'ArrowUp': 'Up', 'w': 'Up',
            'ArrowDown': 'Down', 's': 'Down',
            'ArrowLeft': 'Left', 'a': 'Left',
            'ArrowRight': 'Right', 'd': 'Right',
        };
        const dir = map[key];
        if (dir) {
            move(dir);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
            e.preventDefault();
        }
        handleInput(e.key);
    });

    // Swipe
    gridEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false });

    gridEl.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > 30) move(dx > 0 ? "Right" : "Left");
        } else {
            if (Math.abs(dy) > 30) move(dy > 0 ? "Down" : "Up");
        }
    }, { passive: false });

    btnNewGame.addEventListener('click', () => {
        addLog("GIVE UP");
        startNewGame();
    });

    btnTryAgain.addEventListener('click', () => {
        if (isWon && !keepPlaying && !isGameOver) {
            keepPlaying = true;
            hideOverlay();
            addLog("WIN");
        } else {
            startNewGame();
        }
    });

    btnGotoIndex.addEventListener('click', () => location.href = "../index.html");

    btnClearLog.addEventListener('click', () => {
        logs = [];
        renderLogs();
    });

    init();

})();
