(() => {
  'use strict';

  const TOTAL_PLAYS_KEY = 'totalPlays';
  const MIN_TOTAL_PLAYS = 10000;
  const MAX_INCREMENT = 25;

  const getInitialTotalPlays = () => {
    const saved = Number(localStorage.getItem(TOTAL_PLAYS_KEY));

    if (!saved || saved < MIN_TOTAL_PLAYS) {
      const initial =
        MIN_TOTAL_PLAYS + Math.floor(Math.random() * 3000);

      localStorage.setItem(TOTAL_PLAYS_KEY, initial);
      return initial;
    }

    return saved;
  };

  const getNextTotalPlays = (prev) => {
    const increment = Math.floor(Math.random() * (MAX_INCREMENT + 1));
    const next = prev + increment;

    localStorage.setItem(TOTAL_PLAYS_KEY, next);
    return next;
  };

  const getRandomOnline = () =>
    Math.floor(Math.random() * (499 - 40 + 1)) + 40;

  const formatNumber = (num) =>
    num.toLocaleString('en-US');

  const render = () => {
    const totalPlays = getNextTotalPlays(getInitialTotalPlays());
    const online = getRandomOnline();

    const totalPlaysEl = document.getElementById('totalPlays');
    const onlineEl = document.getElementById('onlineCount');

    if (!totalPlaysEl || !onlineEl) return;

    totalPlaysEl.textContent =
      `Total Plays: ${formatNumber(totalPlays)}`;
    onlineEl.textContent =
      `Online: ${online}`;
  };

  // DOM 이 준비된 이후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
