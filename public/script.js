(function () {
  const confettiColors = ['#e8c27a', '#8a2846', '#c98a4b', '#f4e3c1', '#5c1f3f', '#d97b9c'];
  const confettiField = document.getElementById('confettiField');
  const introScreen = document.getElementById('introScreen');
  const giftsScreen = document.getElementById('giftsScreen');
  const openGiftsBtn = document.getElementById('openGiftsBtn');

  function burstConfetti(originX, originY) {
    const pieceCount = 30;
    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      piece.style.background = color;
      piece.style.left = originX + 'px';
      piece.style.top = originY + 'px';

      // shoot mostly up and outward, like it's popping out of the box
      const angle = (Math.random() * 150 - 75) * (Math.PI / 180);
      const distance = 60 + Math.random() * 110;
      const dx = Math.sin(angle) * distance;
      const dy = -Math.cos(angle) * distance;
      const fx = dx + (Math.random() * 60 - 30);
      const fy = dy + 130 + Math.random() * 90;

      piece.style.setProperty('--dx', dx + 'px');
      piece.style.setProperty('--dy', dy + 'px');
      piece.style.setProperty('--fx', fx + 'px');
      piece.style.setProperty('--fy', fy + 'px');
      piece.style.setProperty('--rot1', (Math.random() * 360 - 180) + 'deg');
      piece.style.setProperty('--rot2', (Math.random() * 720 - 360) + 'deg');
      piece.style.animationDuration = (1.1 + Math.random() * 0.6) + 's';
      piece.style.width = (6 + Math.random() * 6) + 'px';
      piece.style.height = (10 + Math.random() * 8) + 'px';
      confettiField.appendChild(piece);
      piece.addEventListener('animationend', () => piece.remove());
    }
  }

  openGiftsBtn.addEventListener('click', () => {
    introScreen.classList.add('screen-exit');
    introScreen.addEventListener('animationend', () => {
      introScreen.classList.add('is-hidden');
      giftsScreen.classList.remove('is-hidden');
      giftsScreen.classList.add('screen-enter');
      const heading = giftsScreen.querySelector('h2');
      if (heading) heading.focus();
    }, { once: true });
  });

  document.querySelectorAll('.gift').forEach((gift) => {
    const box = gift.querySelector('.gift-box');
    box.addEventListener('click', () => {
      const isOpen = gift.classList.toggle('is-open');
      box.setAttribute('aria-expanded', String(isOpen));

      if (isOpen) {
        const rect = box.getBoundingClientRect();
        burstConfetti(rect.left + rect.width / 2, rect.top + rect.height * 0.25);

        const revealEl = gift.querySelector('.reveal');
        setTimeout(() => {
          const revealRect = revealEl.getBoundingClientRect();
          const fitsInView = revealRect.top >= 0 && revealRect.bottom <= window.innerHeight;
          if (!fitsInView) {
            revealEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 350);
      }
    });
  });
})();
