export const garageIntro = {
  panels: 16,
  failsafeMs: 8000,
  // Timeline offsets are milliseconds from the Enter click.
  unlockAt: 420,
  shackleAt: 660,
  dropAt: 850,
  rollAt: 1290,
  finishAt: 2900,
} as const;

export function animateGarageDoor(
  dialog: HTMLDialogElement,
  callbacks: { unlock: () => void; open: () => void; finish: () => void },
) {
  const slats = [...dialog.querySelectorAll<HTMLElement>('.door-slat')];
  const height = slats[0]?.getBoundingClientRect().height;
  if (!height || typeof dialog.animate !== 'function') {
    callbacks.finish();
    return;
  }

  const animations: Animation[] = [];
  const easeOut = 'cubic-bezier(.21,.65,.31,1)';
  function animate(
    target: Element,
    frames: Keyframe[],
    delay: number,
    duration: number,
    easing = easeOut,
  ) {
    animations.push(target.animate(frames, { delay, duration, easing, fill: 'forwards' }));
  }

  function play(
    selector: string,
    frames: Keyframe[],
    delay: number,
    duration: number,
    easing?: string,
  ) {
    for (const target of dialog.querySelectorAll(selector)) {
      animate(target, frames, delay, duration, easing);
    }
  }

  play('.intro-copy button', [{ opacity: 1 }, { opacity: 0, transform: 'scale(.96)' }], 0, 250);
  play(
    '.intro-key',
    [
      { opacity: 0, transform: 'translateX(38px)' },
      { opacity: 1, transform: 'none', offset: garageIntro.unlockAt / garageIntro.dropAt },
      { opacity: 1, transform: 'scaleY(-.68)' },
    ],
    0,
    garageIntro.dropAt,
    'linear',
  );
  play(
    '.intro-shackle',
    [{ transform: 'none' }, { transform: 'translateY(-8px) rotate(-24deg)' }],
    garageIntro.shackleAt,
    240,
  );
  play(
    '.intro-padlock, .intro-key',
    [{ opacity: 1 }, { opacity: 0, transform: 'translate(-12px, 68px) rotate(23deg)' }],
    garageIntro.dropAt,
    410,
    'ease-in',
  );

  play(
    '.door-slats',
    [0, 3, -3, 2, 0].map((x) => ({ transform: 'translateX(' + x + 'px)' })),
    1050,
    220,
  );
  play(
    '.intro-copy',
    [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-14px)' }],
    garageIntro.rollAt,
    320,
  );
  play(
    '.bottom-light',
    [
      { transform: 'scaleY(1)', opacity: 1 },
      { transform: 'scaleY(18)', opacity: 0.65, offset: 0.45 },
      { transform: 'scaleY(20)', opacity: 0 },
    ],
    garageIntro.rollAt,
    garageIntro.finishAt - garageIntro.rollAt,
  );
  play(
    '.amber-haze',
    [{ opacity: 0 }, { opacity: 0.82, transform: 'scale(1.18)', offset: 0.45 }, { opacity: 0 }],
    garageIntro.rollAt,
    garageIntro.finishAt - garageIntro.rollAt,
  );

  slats.forEach((slat, index) => {
    const stagger = (slats.length - index - 1) * 21;
    animate(
      slat,
      [
        { transform: 'none', transformOrigin: '50% 0%' },
        {
          transform: 'translateY(' + -(index + 1) * height + 'px) scaleY(.13)',
          transformOrigin: '50% 0%',
        },
      ],
      garageIntro.rollAt + stagger,
      1190,
      'ease-in-out',
    );
  });
  play('.door-shade', [{ opacity: 1 }, { opacity: 0 }], 1680, 830);
  play('.door-slats', [{ opacity: 1 }, { opacity: 0 }], garageIntro.finishAt - 450, 450);

  const unlock = setTimeout(callbacks.unlock, garageIntro.unlockAt);
  const open = setTimeout(callbacks.open, garageIntro.rollAt);
  const finish = setTimeout(callbacks.finish, garageIntro.finishAt);
  return () => {
    clearTimeout(unlock);
    clearTimeout(open);
    clearTimeout(finish);
    for (const animation of animations) animation.cancel();
  };
}
