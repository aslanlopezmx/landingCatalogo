// Carrusel de diseños (infinito)
(function () {
  const pista = document.getElementById("demos-container");
  const contenedorPuntos = document.getElementById("demos-dots");
  if (!pista) return;
  const originales = Array.from(pista.querySelectorAll(".demo-card"));
  const n = originales.length;
  if (!n) return;
  const btnPrev = document.querySelector(".carousel-btn.prev");
  const btnNext = document.querySelector(".carousel-btn.next");

  // Para dar la vuelta completa: una copia de las tarjetas antes y otra después.
  // Cuando el carrusel se detiene en una copia, salta en silencio a la tarjeta
  // original equivalente, así que nunca se llega a un inicio ni a un final.
  const clonar = () =>
    originales.map((t) => {
      const c = t.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      c.tabIndex = -1;
      return c;
    });
  clonar().forEach((c) => pista.insertBefore(c, originales[0]));
  clonar().forEach((c) => pista.appendChild(c));
  const tarjetas = Array.from(pista.querySelectorAll(".demo-card")); // 3 * n

  const paso = () =>
    tarjetas[0].offsetWidth + parseFloat(getComputedStyle(pista).gap || 0);
  const indiceActual = () => Math.round(pista.scrollLeft / paso());

  // Colocar el carrusel sin animación ni imán
  const colocar = (indice) => {
    pista.style.scrollBehavior = "auto";
    pista.style.scrollSnapType = "none";
    pista.scrollLeft = indice * paso();
    void pista.offsetWidth; // fuerza el cálculo antes de restaurar
    pista.style.scrollBehavior = "";
    pista.style.scrollSnapType = "";
  };

  // Puntos indicadores (uno por diseño)
  const puntos = originales.map((_, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.addEventListener("click", () => {
      const actual = indiceActual();
      const base = Math.floor(actual / n) * n + i;
      // Elegir la copia más cercana para que el recorrido sea corto
      const destino = [base - n, base, base + n]
        .filter((c) => c >= 0 && c < tarjetas.length)
        .sort((a, b) => Math.abs(a - actual) - Math.abs(b - actual))[0];
      pista.scrollTo({ left: destino * paso(), behavior: "smooth" });
    });
    contenedorPuntos.appendChild(b);
    return b;
  });

  // Escala y opacidad según la distancia de cada tarjeta al centro
  const ESCALA_CENTRO = 1.1;
  const ESCALA_LADOS = 0.85;
  const OPACIDAD_LADOS = 0.45;
  const efectoCentro = () => {
    const r = pista.getBoundingClientRect();
    const centro = r.left + r.width / 2;
    const unPaso = paso();
    tarjetas.forEach((t) => {
      const tr = t.getBoundingClientRect();
      const d = Math.min(1, Math.abs(tr.left + tr.width / 2 - centro) / unPaso);
      t.style.setProperty(
        "--s",
        (ESCALA_CENTRO - (ESCALA_CENTRO - ESCALA_LADOS) * d).toFixed(3),
      );
      t.style.setProperty("--o", (1 - (1 - OPACIDAD_LADOS) * d).toFixed(3));
    });
  };

  const actualizar = () => {
    efectoCentro();
    const activo = ((indiceActual() % n) + n) % n;
    puntos.forEach((p, i) => p.classList.toggle("active", i === activo));
  };

  // Al detenerse: si está en una copia, saltar a la tarjeta original equivalente
  let temporizador = null;
  let tocando = false;
  const normalizar = () => {
    if (tocando) return;
    const i = indiceActual();
    if (i < n) colocar(i + n);
    else if (i >= 2 * n) colocar(i - n);
    actualizar();
  };
  const programarNormalizar = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(normalizar, 140);
  };

  let cuadro = null;
  pista.addEventListener(
    "scroll",
    () => {
      if (!cuadro) {
        cuadro = requestAnimationFrame(() => {
          cuadro = null;
          actualizar();
        });
      }
      programarNormalizar();
    },
    { passive: true },
  );
  pista.addEventListener("touchstart", () => (tocando = true), {
    passive: true,
  });
  const soltar = () => {
    tocando = false;
    programarNormalizar();
  };
  pista.addEventListener("touchend", soltar, { passive: true });
  pista.addEventListener("touchcancel", soltar, { passive: true });

  // Avanza de una tarjeta en una
  const mover = (dir) => {
    pista.scrollBy({ left: dir * paso(), behavior: "smooth" });
  };

  // Tocar una tarjeta lateral la centra; tocar la central abre la demo
  tarjetas.forEach((t, i) => {
    t.addEventListener("click", (e) => {
      if (i !== indiceActual()) {
        e.preventDefault();
        pista.scrollTo({ left: i * paso(), behavior: "smooth" });
      }
    });
  });

  btnPrev.addEventListener("click", () => mover(-1));
  btnNext.addEventListener("click", () => mover(1));
  pista.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") mover(1);
    if (e.key === "ArrowLeft") mover(-1);
  });

  // Al cambiar el tamaño de la ventana, mantener el mismo diseño al centro
  window.addEventListener("resize", () => {
    const logico = ((indiceActual() % n) + n) % n;
    colocar(n + logico);
    actualizar();
  });

  // Empezar con el primer diseño original al centro
  colocar(n);
  actualizar();
  window.addEventListener("load", () => {
    colocar(n + (((indiceActual() % n) + n) % n));
    actualizar();
  });
})();

// Aparición suave al hacer scroll
const objetivos = document.querySelectorAll(
  ".section-title, .benefit-card, .faq-card, .gifs-grid > div, .final-cta > *",
);
if ("IntersectionObserver" in window) {
  objetivos.forEach((el) => el.classList.add("reveal"));
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observador.unobserve(e.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -40px 0px" },
  );
  objetivos.forEach((el) => observador.observe(el));
}
