const canvas = document.getElementById("renderCanvas");
const label  = document.getElementById("name");
const btnUp  = document.getElementById("btnUp");
const btnDown= document.getElementById("btnDown");

// Engine con alpha para respetar tu fondo negro del CSS
const engine = new BABYLON.Engine(canvas, true, { antialias: true, alpha: true });
const scene  = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0,0,0,0);

// -------- Cámara (top-down ligera inclinación) ----------
const CAMERA_ALPHA = Math.PI * 0.25;
const CAMERA_BETA  = 0.6;
const CAMERA_RADIUS = 12; // fijo: mantiene tamaño aparente constante

const camera = new BABYLON.ArcRotateCamera("cam", CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.panningSensibility = 0;
camera.wheelPrecision = 999999; // desactiva zoom con rueda
if (camera.inputs && camera.inputs.removeMouseWheel) camera.inputs.removeMouseWheel?.();
camera.lowerRadiusLimit = CAMERA_RADIUS;
camera.upperRadiusLimit = CAMERA_RADIUS; // bloquea cambios de radio

// -------- Luz básica ----------
new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);

// -------- Planetas ----------
const BASE = "/static/models/";
const PLANETS = [
  { name: "Sun",     file: "Sun.glb"     },
  { name: "Mercury", file: "Mercury.glb" },
  { name: "Venus",   file: "Venus.glb"   },
  { name: "Earth",   file: "Earth.glb"   },
  { name: "Mars",    file: "Mars.glb"    },
  { name: "Jupiter", file: "Jupiter.glb" },
  { name: "Saturn",  file: "Saturn.glb"  },
  { name: "Uranus",  file: "Uranus.glb"  },
  { name: "Neptune", file: "Neptune.glb" }
];

// -------- Estado ----------
let idx = 0;
let holder = null;     // planeta actual
let nextHolder = null; // planeta entrante
let animating = false;

// -------- Timing / Easing ----------
const D_MS = 600;
const easeInOut = t => (t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2);

// -------- Normalización de tamaño --------
const TARGET_DIAMETER = 4.0; // súbelo para verlos más grandes, bájalo para más pequeños

function centerAndNormalize(node) {
  const { min, max } = node.getHierarchyBoundingVectors(true);
  const center = min.add(max).scale(0.5);
  const size   = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  // centrar en el origen
  node.position.subtractInPlace(center);

  // factor para que el "diámetro" pase a TARGET_DIAMETER
  const scaleFactor = TARGET_DIAMETER / maxDim;
  node.scaling.setAll(scaleFactor);
}

// Distancia para “sacar” el planeta fuera del viewport verticalmente
function offscreenY() {
  return CAMERA_RADIUS * 1.7; // ajusta si quieres deslizamientos más largos/cortos
}

// Carga un planeta dentro de un TransformNode
async function createHolderFor(index) {
  const cfg = PLANETS[index];
  const res = await BABYLON.SceneLoader.ImportMeshAsync("", BASE, cfg.file, scene);

  const h = new BABYLON.TransformNode(`holder_${cfg.name}`, scene);
  res.meshes.forEach(m => {
    if ((m instanceof BABYLON.Mesh || m instanceof BABYLON.TransformNode) && m !== h) {
      m.parent = h;
      if (m instanceof BABYLON.Mesh) m.isPickable = true; // clickable
    }
  });

  h.isPickable = false; // el contenedor no estorba al pick
  centerAndNormalize(h);
  return h;
}

// --- UI: habilita/deshabilita botones según índice/animación
function updateNavButtons() {
  const MAX = PLANETS.length - 1;
  const disableUp   = (idx <= 0) || animating;
  const disableDown = (idx >= MAX) || animating;

  btnUp.disabled = disableUp;
  btnDown.disabled = disableDown;

  btnUp.setAttribute('aria-disabled', String(disableUp));
  btnDown.setAttribute('aria-disabled', String(disableDown));
}

// Init
async function init() {
  try {
    holder = await createHolderFor(idx);
    holder.position.set(0, 0, 0); // en centro
    label.textContent = PLANETS[idx].name;
  } catch (e) {
    console.error(e);
    label.textContent = "No se pudo cargar el modelo. Revisa rutas en /static/models/";
  } finally {
    updateNavButtons();
  }
}
init();

// Transición deslizante: actual baja, nuevo entra desde arriba (o al revés)
async function slideTo(nextIndex, direction = 1) {
  if (animating) return;
  const MAX = PLANETS.length - 1;
  if (nextIndex < 0 || nextIndex > MAX) return;

  animating = true;
  updateNavButtons();

  try {
    nextHolder = await createHolderFor(nextIndex);
    const DY = offscreenY();

    // posiciona el nuevo fuera de pantalla
    nextHolder.position.set(0, direction === 1 ? +DY : -DY, 0);
    label.style.opacity = "0";

    const t0 = performance.now();
    await new Promise(resolve => {
      function step(t) {
        let k = (t - t0) / D_MS; if (k > 1) k = 1;
        const e = easeInOut(k);

        if (holder) {
          const yOutStart = 0;
          const yOutEnd   = (direction === 1) ? -DY : +DY;
          holder.position.y = yOutStart + (yOutEnd - yOutStart) * e;
        }

        if (nextHolder) {
          const yInStart = (direction === 1) ? +DY : -DY;
          const yInEnd   = 0;
          nextHolder.position.y = yInStart + (yInEnd - yInStart) * e;
        }

        if (k < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });

    // Swap
    if (holder) holder.dispose();
    holder = nextHolder;
    nextHolder = null;

    idx = nextIndex;
    label.textContent = PLANETS[idx].name;
    label.style.opacity = "1";
  } catch (e) {
    console.error(e);
  } finally {
    animating = false;
    updateNavButtons();
  }
}

// --------- DELIMITADOR DE SCROLL ---------
// No se acumula scroll cuando ya estamos en los extremos.
let acc = 0, last = 0;
const THRESHOLD = 200;
const MAX_INDEX = PLANETS.length - 1;
const DELTA_CAP = 140; // limita picos de trackpad

window.addEventListener("wheel", async (e) => {
  e.preventDefault?.(); // evita que scrollee el body

  if ((idx === 0 && e.deltaY < 0) || (idx === MAX_INDEX && e.deltaY > 0)) {
    return;
  }

  const dy = Math.max(-DELTA_CAP, Math.min(DELTA_CAP, e.deltaY));
  acc += dy;

  if (acc - last > THRESHOLD && idx < MAX_INDEX) {
    last = acc;
    await slideTo(idx + 1, 1);
  }
  if (last - acc > THRESHOLD && idx > 0) {
    last = acc;
    await slideTo(idx - 1, -1);
  }
}, { passive: false });

// --------- CLICK EN EL MODELO → /view/[Planeta] ---------
function isHitOnCurrentHolder(mesh) {
  if (!mesh || !holder) return false;
  return mesh === holder || mesh.isDescendantOf(holder);
}

function goToPlanetView() {
  const name = PLANETS[idx].name;
  const url = `/view/${encodeURIComponent(name)}`;
  window.location.href = url;
}

let pointerDownPos = null;
let pointerDownTime = 0;
const CLICK_MOVE_TOL = 6;
const CLICK_TIME_TOL = 300;

scene.onPointerObservable.add((pointerInfo) => {
  switch (pointerInfo.type) {
    case BABYLON.PointerEventTypes.POINTERMOVE: {
      const pick = scene.pick(scene.pointerX, scene.pointerY);
      if (!animating && pick?.hit && isHitOnCurrentHolder(pick.pickedMesh)) {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "";
      }
      break;
    }
    case BABYLON.PointerEventTypes.POINTERDOWN: {
      pointerDownPos = { x: scene.pointerX, y: scene.pointerY };
      pointerDownTime = performance.now();
      break;
    }
    case BABYLON.PointerEventTypes.POINTERUP: {
      if (animating) break;
      const dt = performance.now() - pointerDownTime;
      const dx = Math.abs(scene.pointerX - (pointerDownPos?.x ?? scene.pointerX));
      const dy = Math.abs(scene.pointerY - (pointerDownPos?.y ?? scene.pointerY));
      const smallMove = (dx + dy) <= CLICK_MOVE_TOL;

      const pick = scene.pick(scene.pointerX, scene.pointerY);
      if (dt <= CLICK_TIME_TOL && smallMove && pick?.hit && isHitOnCurrentHolder(pick.pickedMesh)) {
        goToPlanetView();
      }
      pointerDownPos = null;
      break;
    }
  }
});

// --------- Botones: arriba/abajo ---------
btnUp.addEventListener("click", async () => {
  if (animating) return;
  await slideTo(idx - 1, -1);
});
btnDown.addEventListener("click", async () => {
  if (animating) return;
  await slideTo(idx + 1, 1);
});

// Render
engine.runRenderLoop(() => {
  if (holder) holder.rotation.y += 0.002; // rotación sutil
  scene.render();
});
window.addEventListener("resize", () => engine.resize());
