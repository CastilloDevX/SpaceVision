/* Partículas */
(function particles() {
  const canvas = document.getElementById("particle-canvas");
  const ctx = canvas.getContext("2d");
  function size() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  size();
  addEventListener("resize", size);

  const count = Math.max(
    60,
    Math.round((canvas.width * canvas.height) / 70000)
  );
  const parts = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 1.8 + 0.3,
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.15,
    alpha: Math.random() * 0.6 + 0.15,
  }));
  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255," + p.alpha * 0.9 + ")";
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(step);
  }
  step();
})();

/* Navegación entre panels */
const panels = Array.from(document.querySelectorAll(".panel"));
const navBtns = Array.from(document.querySelectorAll(".nav-btn"));
const dots = Array.from(document.querySelectorAll(".dot-btn"));
let current = 0;
const STAGGER_DELAY = 90;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function setActive(index, direction = 1) {
  index = clamp(index, 0, panels.length - 1);
  if (index === current) return;

  panels[current].classList.remove("active");
  navBtns[current].classList.remove("active");
  navBtns[current].setAttribute("aria-pressed", "false");
  dots[current].classList.remove("active");

  panels[index].classList.add("active");
  navBtns[index].classList.add("active");
  navBtns[index].setAttribute("aria-pressed", "true");
  dots[index].classList.add("active");

  revealStagger(panels[index]);
  current = index;
  history.replaceState(null, "", "#p" + index);
}

function revealStagger(panelEl) {
  const items = panelEl.querySelectorAll(".stagger");
  items.forEach((it, i) => {
    it.classList.remove("show");
    setTimeout(() => it.classList.add("show"), i * STAGGER_DELAY + 90);
  });
}

/* Clicks de nav & dots */
navBtns.forEach((b) =>
  b.addEventListener("click", () => {
    const target = Number(b.dataset.target);
    setActive(target, target > current ? 1 : -1);
  })
);
dots.forEach((d) =>
  d.addEventListener("click", () => {
    const target = Number(d.dataset.target);
    setActive(target, target > current ? 1 : -1);
  })
);

/* Teclado */
addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    setActive(current + 1, 1);
  }
  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    setActive(current - 1, -1);
  }
});

/* Swipe móvil */
(function swipe() {
  let sx = 0,
    sy = 0;
  addEventListener(
    "touchstart",
    (e) => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true }
  );
  addEventListener(
    "touchend",
    (e) => {
      const ex = e.changedTouches[0].clientX,
        ey = e.changedTouches[0].clientY;
      const dx = ex - sx,
        dy = ey - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) setActive(current + 1, 1);
        if (dx > 0) setActive(current - 1, -1);
      }
    },
    { passive: true }
  );
})();

/* Inicialización */
document.addEventListener("DOMContentLoaded", () => {
  revealStagger(panels[0]);
  const hash = window.location.hash;
  if (hash && hash.startsWith("#p")) {
    const idx = parseInt(hash.slice(2));
    if (!isNaN(idx) && idx >= 0 && idx < panels.length) setActive(idx);
  }
});
