const canvas = document.getElementById("renderCanvas");
const label  = document.getElementById("name");

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
  { name: "Sun", file: "Sun.glb" },
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
    }
  });

  // Normaliza tamaño y centra
  centerAndNormalize(h);

  return h;
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
  }
}
init();

// Transición deslizante: actual baja, nuevo entra desde arriba (o al revés)
async function slideTo(nextIndex, direction = 1) {
  if (animating) return;
  animating = true;

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
          // sale en sentido opuesto
          const yOutStart = 0;
          const yOutEnd   = (direction === 1) ? -DY : +DY;
          holder.position.y = yOutStart + (yOutEnd - yOutStart) * e;
        }

        if (nextHolder) {
          // entra hacia el centro
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
  }
}

// --------- DELIMITADOR DE SCROLL ---------
// No se acumula scroll cuando ya estamos en los extremos.
let acc = 0, last = 0;
const THRESHOLD = 200;
const MAX_INDEX = PLANETS.length - 1;
// Para evitar “picos” de trackpad (delta enormes que saltan el umbral)
const DELTA_CAP = 140; // ajusta si tu touchpad es muy “nervioso”

window.addEventListener("wheel", async (e) => {
  e.preventDefault?.(); // evita que scrollee el body

  // Si estamos en el límite y la dirección va “hacia afuera”, NO contamos el scroll
  if ((idx === 0 && e.deltaY < 0) || (idx === MAX_INDEX && e.deltaY > 0)) {
    return; // ← delimitador: no acumula, no dispara transición
  }

  // Suaviza picos de deltaY
  const dy = Math.max(-DELTA_CAP, Math.min(DELTA_CAP, e.deltaY));
  acc += dy;

  // siguiente
  if (acc - last > THRESHOLD && idx < MAX_INDEX) {
    last = acc;
    await slideTo(idx + 1, 1);
  }
  // anterior
  if (last - acc > THRESHOLD && idx > 0) {
    last = acc;
    await slideTo(idx - 1, -1);
  }
}, { passive: false });

// Render
engine.runRenderLoop(() => {
  if (holder) holder.rotation.y += 0.002; // rotación sutil
  scene.render();
});
window.addEventListener("resize", () => engine.resize());
