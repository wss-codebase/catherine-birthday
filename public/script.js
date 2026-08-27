(function () {
  const confettiColors = ['#e8c27a', '#8a2846', '#c98a4b', '#f4e3c1', '#5c1f3f', '#d97b9c'];
  const confettiField = document.getElementById('confettiField');
  const introScreen = document.getElementById('introScreen');
  const giftsScreen = document.getElementById('giftsScreen');
  const openGiftsBtn = document.getElementById('openGiftsBtn');

  function burstConfetti(originX) {
    const pieceCount = 26;
    for (let i = 0; i < pieceCount; i++) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      piece.style.background = color;
      piece.style.left = (originX + (Math.random() * 200 - 100)) + 'px';
      piece.style.animationDuration = (2.2 + Math.random() * 1.4) + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
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
        burstConfetti(rect.left + rect.width / 2);
      }
    });
  });
})();
