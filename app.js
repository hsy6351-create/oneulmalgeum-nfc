(() => {
  const DESIGN_W = 393;
  const DESIGN_H = 852;

  // 전시 체험용: 15분 루틴의 '마지막 20초'를 보여줍니다.
  // 실제 15분 전체를 재생하려면 false로 바꾸면 됩니다.
  const DEMO_MODE = true;
  const ROUTINE_TOTAL_SECONDS = 15 * 60;
  const DEMO_START_REMAINING_SECONDS = 20;
  const TIMER_SWEEP_DEG = 360; // 20초 남은 상태가 거의 끝 지점에 보이도록 전체 원형 궤적 사용

  const stage = document.getElementById('stage');
  const app = document.getElementById('app');
  const screens = [...document.querySelectorAll('.screen')];
  let currentScreen = 1;
  let loadingTimer = null;
  let countdownTimer = null;
  let isPaused = false;
  let rewardClaimed = false;
  let remainingSeconds = DEMO_MODE ? DEMO_START_REMAINING_SECONDS : ROUTINE_TOTAL_SECONDS;

  function fitCanvas() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / DESIGN_W, vh / DESIGN_H, vw >= 600 ? 1 : Infinity);
    app.style.transform = `scale(${scale})`;
    stage.style.setProperty('--current-scale', scale);
  }
  window.addEventListener('resize', fitCanvas, { passive: true });
  window.addEventListener('orientationchange', fitCanvas, { passive: true });
  fitCanvas();

  function resetLoadingAnimation() {
    const water = document.querySelector('.fill-check-water');
    const mark = document.querySelector('.fill-check-mark');
    water.style.animation = 'none';
    mark.style.animation = 'none';
    void water.offsetWidth;
    water.style.animation = '';
    mark.style.animation = '';
  }

  function showScreen(number, { immediate = false } = {}) {
    if (loadingTimer) clearTimeout(loadingTimer);
    screens.forEach(screen => {
      const active = Number(screen.dataset.screen) === number;
      if (immediate) screen.style.transition = 'none';
      screen.classList.toggle('active', active);
      if (immediate) requestAnimationFrame(() => screen.style.transition = '');
    });
    currentScreen = number;

    if (number === 1) {
      resetLoadingAnimation();
      loadingTimer = setTimeout(() => showScreen(2), 2380);
    }
    if (number === 3) startTimer();
    else stopTimerInterval();
    if (number === 5) resetReward();
  }

  function closeFlow() {
    // NFC로 직접 열린 경우에는 이전 Safari 화면으로 돌아가고,
    // 단독 미리보기라면 첫 화면으로 리셋합니다.
    if (document.referrer || history.length > 1) history.back();
    else showScreen(1);
  }
  document.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', closeFlow));
  document.getElementById('laterBtn').addEventListener('click', closeFlow);

  document.getElementById('startRoutine').addEventListener('click', () => showScreen(3));
  document.getElementById('completeBtn').addEventListener('click', () => showScreen(4));
  document.getElementById('saveRoutine').addEventListener('click', () => showScreen(5));

  // Timer
  const timerText = document.getElementById('timerText');
  const timerKnob = document.getElementById('timerKnob');
  const movingGradient = document.getElementById('movingGradient');
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseLabel = document.getElementById('pauseLabel');

  function formatTime(value) {
    const m = Math.floor(value / 60).toString().padStart(2, '0');
    const s = (value % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateTimerUI() {
    timerText.textContent = formatTime(remainingSeconds);

    // 15분 전체 흐름에서, 점은 12시 방향에서 시작해 시계방향으로 거의 한 바퀴 이동합니다.
    // 전시 데모에서는 20초 남은 시점이 원의 끝에 더 가깝게 보이도록 조정했습니다.
    const elapsed = ROUTINE_TOTAL_SECONDS - remainingSeconds;
    const progress = Math.max(0, Math.min(1, elapsed / ROUTINE_TOTAL_SECONDS));
    const angleDeg = -90 + (TIMER_SWEEP_DEG * progress);
    const angle = angleDeg * Math.PI / 180;
    const radius = 151;
    const center = 160;
    const knobSize = 48;
    const x = center + radius * Math.cos(angle) - knobSize / 2;
    const y = center + radius * Math.sin(angle) - knobSize / 2;
    timerKnob.style.transform = `translate(${x}px, ${y}px)`;

    // 그라데이션도 진행점과 함께 회전
    movingGradient.setAttribute('gradientTransform', `rotate(${angleDeg + 90} 160 160)`);
  }

  function stopTimerInterval() {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
  }

  function startTimer() {
    stopTimerInterval();
    remainingSeconds = DEMO_MODE ? DEMO_START_REMAINING_SECONDS : ROUTINE_TOTAL_SECONDS;
    isPaused = false;
    pauseBtn.classList.remove('is-paused');
    pauseLabel.textContent = '일시정지';
    updateTimerUI();
    countdownTimer = setInterval(() => {
      if (isPaused || currentScreen !== 3) return;
      if (remainingSeconds > 0) remainingSeconds -= 1;
      updateTimerUI();
      if (remainingSeconds <= 0) {
        stopTimerInterval();
        setTimeout(() => {
          if (currentScreen === 3) showScreen(4);
        }, 320);
      }
    }, 1000);
  }

  pauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseBtn.classList.toggle('is-paused', isPaused);
    pauseLabel.textContent = isPaused ? '계속하기' : '일시정지';
  });

  // Reward animation
  const rewardVisual = document.getElementById('rewardVisual');
  const claimReward = document.getElementById('claimReward');
  const rewardSpeech = document.getElementById('rewardSpeech');
  const rewardScreen = document.querySelector('.screen-reward');

  function resetReward() {
    rewardClaimed = false;
    claimReward.disabled = false;
    claimReward.textContent = '에너지 받기';
    rewardVisual.classList.remove('claimed');
    rewardScreen.classList.remove('show-speech');
    rewardVisual.querySelectorAll('.reward-star').forEach(star => {
      star.getAnimations().forEach(a => {
        // CSS infinite floating animation은 취소하지 않고, WAAPI claim 애니메이션만 정리
        if (a.id === 'claim') a.cancel();
      });
      star.style.opacity = '';
      star.style.transform = '';
    });
  }

  claimReward.addEventListener('click', () => {
    if (rewardClaimed) return;
    rewardClaimed = true;
    claimReward.disabled = true;
    rewardVisual.classList.add('claimed');

    const visualRect = rewardVisual.getBoundingClientRect();
    const centerX = visualRect.width / 2;
    const centerY = visualRect.height * .59;

    rewardVisual.querySelectorAll('.reward-star').forEach((star, i) => {
      const sr = star.getBoundingClientRect();
      const starCenterX = (sr.left - visualRect.left) + sr.width / 2;
      const starCenterY = (sr.top - visualRect.top) + sr.height / 2;
      const dx = centerX - starCenterX;
      const dy = centerY - starCenterY;
      const anim = star.animate([
        { transform: getComputedStyle(star).transform === 'none' ? 'translate(0,0) scale(1)' : getComputedStyle(star).transform, opacity: 1 },
        { transform: `translate(${dx * .35}px, ${dy * .35}px) scale(1.18)`, opacity: 1, offset: .42 },
        { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0 }
      ], {
        duration: 540 + i * 38,
        delay: i * 34,
        easing: 'cubic-bezier(.2,.9,.25,1)',
        fill: 'forwards'
      });
      anim.id = 'claim';
    });

    setTimeout(() => {
      claimReward.textContent = '에너지 받았어요 ✓';
      claimReward.style.background = '#C7E6FF';
      rewardScreen.classList.add('show-speech');
    }, 700);
  });

  // Query helpers for review: ?screen=3 / ?screen=5
  const params = new URLSearchParams(location.search);
  const requested = Number(params.get('screen'));
  if (requested >= 1 && requested <= 5) showScreen(requested, { immediate: true });
  else showScreen(1, { immediate: true });
})();
