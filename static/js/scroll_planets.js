const canvas = document.getElementById("renderCanvas");
const label  = document.getElementById("name");

// Engine con alpha para respetar tu fondo negro del CSS
const engine = new BABYLON.Engine(canvas, true, { antialias: true, alpha: true });
const scene  = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0,0,0,0);

// Cámara: vista desde arriba con ligera inclinación; desactivamos zoom de rueda
const camera = new BABYLON.ArcRotateCamera("cam", Math.PI*0.25, 0.6, 10, BABYLON.Vector3.Zero(), scene);
camera.attachControl(canvas, true);
camera.panningSensibility = 0;
camera.wheelPrecision = 999999; // neutraliza el zoom de rueda
if (camera.inputs && camera.inputs.removeMouseWheel) camera.inputs.removeMouseWheel?.();

// Luz básica
new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0,1,0), scene);

// ================== Planetas (ajusta scale si tu GLB se ve muy grande/pequeño) ==================
const BASE = "/static/models/";
const PLANETS = [
  { name: "Sun", file: "Sun.glb", scale: 3.0},
  { name: "Mercury", file: "Mercury.glb", scale: 1.00 },
  { name: "Venus",   file: "Venus.glb",   scale: 1.05 },
  { name: "Earth",   file: "Earth.glb",   scale: 1.00 },
  { name: "Mars",    file: "Mars.glb",    scale: 0.95 },
  { name: "Jupiter", file: "Jupiter.glb", scale: 0.70 },
  { name: "Saturn",  file: "Saturn.glb",  scale: 2.00 },
  { name: "Uranus",  file: "Uranus.glb",  scale: 0.85 },
  { name: "Neptune", file: "Neptune.glb", scale: 0.85 }
];

// Estado
let idx = 0;
let holder = null;     // planeta actual
let nextHolder = null; // planeta entrante
let animating = false;

// Easing y timing
const D_MS = 550;
const easeInOutCubic = t => (t<0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2);

// Utilidad: centra y ajusta cámara a tamaño
function frameAndSize(node, scale = 1.0) {
  const { min, max } = node.getHierarchyBoundingVectors(true);
  const center = min.add(max).scale(0.5);
  const size   = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;

  node.position.subtractInPlace(center);
  node.scaling.scaleInPlace(scale); // escala por-planeta

  camera.target = BABYLON.Vector3.Zero();
  camera.radius = Math.max(6, maxDim * 2.6); // sube el factor para ver más pequeño

  // límites suaves (por si el usuario hace pinch/zoom en touch)
  camera.lowerRadiusLimit = camera.radius * 0.9;
  camera.upperRadiusLimit = camera.radius * 3.0;

  return maxDim;
}

// Carga simple de un planeta en un holder
async function createHolderFor(index) {
  const cfg = PLANETS[index];
  const res = await BABYLON.SceneLoader.ImportMeshAsync("", BASE, cfg.file, scene);
  const h = new BABYLON.TransformNode(`holder_${cfg.name}`, scene);
  res.meshes.forEach(m => {
    if ((m instanceof BABYLON.Mesh || m instanceof BABYLON.TransformNode) && m !== h) {
      m.parent = h;
    }
  });
  frameAndSize(h, cfg.scale);
  return h;
}

// Carga inicial
async function init() {
  try {
    holder = await createHolderFor(idx);
    label.textContent = PLANETS[idx].name;
    // aparición sutil
    holder.scaling.scaleInPlace(0.7);
    const t0 = performance.now(), dur = 280;
    function appear(t){
      let k = (t - t0)/dur; if (k>1) k=1;
      const e = easeInOutCubic(k);
      const s = 0.7 + (1 - 0.7) * e;
      holder.scaling.setAll(s);
      if (k<1) requestAnimationFrame(appear);
    }
    requestAnimationFrame(appear);
  } catch (e) {
    console.error(e);
    label.textContent = "No se pudo cargar el modelo. Revisa rutas en /static/models/";
  }
}
init();

// Distancia de deslizamiento (en unidades de mundo)
function offscreenY() {
  return camera.radius * 1.6; // ajusta si quieres un viaje más largo/corto
}

// Transición deslizante: actual baja, nuevo entra desde arriba (o inverso)
async function slideTo(nextIndex, direction = 1) {
  if (animating) return;
  animating = true;

  try {
    // Pre-carga el siguiente
    nextHolder = await createHolderFor(nextIndex);
    nextHolder.scaling.setAll(1.0);

    const DY = offscreenY();

    // Posición inicial del entrante
    if (direction === 1) {
      nextHolder.position.set(0, +DY, 0); // entra desde arriba
    } else {
      nextHolder.position.set(0, -DY, 0); // entra desde abajo
    }

    // Oculta label durante la transición
    label.style.opacity = "0";

    // Animación manual con easing
    const t0 = performance.now();
    await new Promise(resolve => {
      function step(t) {
        let k = (t - t0) / D_MS; if (k > 1) k = 1;
        const e = easeInOutCubic(k);

        if (holder) {
          const yOutStart = 0;
          const yOutEnd   = (direction === 1) ? -DY : +DY;
          holder.position.y = yOutStart + (yOutEnd - yOutStart) * e;

          // pequeño fade/scale al salir
          const s = 1 - 0.15 * e;
          holder.scaling.setAll(s);
        }

        if (nextHolder) {
          const yInStart = (direction === 1) ? +DY : -DY;
          const yInEnd   = 0;
          nextHolder.position.y = yInStart + (yInEnd - yInStart) * e;

          const s = 0.85 + 0.15 * e;
          nextHolder.scaling.setAll(s);
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

// Scroll handler con umbral
let acc = 0, last = 0;
const THRESHOLD = 220;

window.addEventListener("wheel", async (e) => {
  e.preventDefault?.(); // evitamos scroll de la página

  acc += e.deltaY;

  // siguiente
  if (acc - last > THRESHOLD && idx < PLANETS.length - 1) {
    last = acc;
    await slideTo(idx + 1, 1);
  }
  // anterior
  if (last - acc > THRESHOLD && idx > 0) {
    last = acc;
    await slideTo(idx - 1, -1);
  }
}, { passive: false });

// Render loop
engine.runRenderLoop(() => {
  if (holder) holder.rotation.y += 0.002; // toque sutil
  scene.render();
});
window.addEventListener("resize", () => engine.resize());
