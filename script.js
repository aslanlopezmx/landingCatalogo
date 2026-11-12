// ==========================================================================
// Carrusel de diseños (infinito) con carga diferida (sin filtros)
// ==========================================================================
(function () {
  const pista = document.getElementById("demos-container");
  const contenedorPuntos = document.getElementById("demos-dots");
  if (!pista || !contenedorPuntos) return;

  const base = Array.from(pista.querySelectorAll(".demo-card"));
  if (!base.length) return;

  const btnPrev = document.querySelector(".carousel-btn.prev");
  const btnNext = document.querySelector(".carousel-btn.next");
  const ctaPlantilla = document.getElementById("cta-plantilla");

  let n = base.length;
  let tarjetas = [];
  let puntos = [];
  let observadorFondos = null;

  const paso = () =>
    tarjetas[0].offsetWidth + parseFloat(getComputedStyle(pista).gap || 0);
  const indiceActual = () => Math.round(pista.scrollLeft / paso());
  const logicoActual = () => ((indiceActual() % n) + n) % n;

  const colocar = (indice) => {
    pista.style.scrollBehavior = "auto";
    pista.style.scrollSnapType = "none";
    pista.scrollLeft = indice * paso();
    void pista.offsetWidth;
    pista.style.scrollBehavior = "";
    pista.style.scrollSnapType = "";
  };

  const cargarFondo = (tarjeta) => {
    const ruta = tarjeta.dataset.bg;
    if (!ruta) return;
    tarjeta.style.backgroundImage = 'url("' + ruta + '")';
    delete tarjeta.dataset.bg;
  };

  const observarFondos = () => {
    if (observadorFondos) observadorFondos.disconnect();
    if (!("IntersectionObserver" in window)) {
      tarjetas.forEach(cargarFondo);
      return;
    }
    observadorFondos = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) {
            cargarFondo(e.target);
            observadorFondos.unobserve(e.target);
          }
        });
      },
      { root: pista, rootMargin: "0px 700px 0px 700px" },
    );
    tarjetas.forEach((t) => observadorFondos.observe(t));
  };

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

  const actualizarCta = () => {
    if (!ctaPlantilla) return;
    const centro = tarjetas[indiceActual()];
    const nombre = centro ? centro.dataset.nombre : "";
    if (!nombre) return;
    const mensaje =
      "Hola, quiero mi tienda digital. La plantilla que me gusta es: " + nombre;
    ctaPlantilla.href =
      "https://wa.me/523312892022?text=" + encodeURIComponent(mensaje);
    ctaPlantilla.textContent = "Quiero la plantilla " + nombre;
  };

  const actualizar = () => {
    efectoCentro();
    const activo = logicoActual();
    puntos.forEach((p, i) => {
      p.classList.toggle("active", i === activo);
      if (i === activo) p.setAttribute("aria-current", "true");
      else p.removeAttribute("aria-current");
    });
    actualizarCta();
  };

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

  const mover = (dir) => {
    pista.scrollBy({ left: dir * paso(), behavior: "smooth" });
  };

  // Construcción fija de todas las tarjetas con copias para bucle infinito
  const construir = () => {
    const visibles = base;
    if (!visibles.length) return;

    pista.replaceChildren();
    for (let k = 0; k < 3; k++) {
      visibles.forEach((t) => {
        const c = t.cloneNode(true);
        if (k !== 1) {
          c.setAttribute("aria-hidden", "true");
          c.tabIndex = -1;
        }
        pista.appendChild(c);
      });
    }
    tarjetas = Array.from(pista.children);

    tarjetas.forEach((t, i) => {
      t.addEventListener("click", (e) => {
        if (i !== indiceActual()) {
          e.preventDefault();
          pista.scrollTo({ left: i * paso(), behavior: "smooth" });
        }
      });
    });

    contenedorPuntos.replaceChildren();
    puntos = visibles.map((t, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Ir al diseño " + t.dataset.nombre);
      b.addEventListener("click", () => {
        const actual = indiceActual();
        const baseIdx = Math.floor(actual / n) * n + i;
        const destino = [baseIdx - n, baseIdx, baseIdx + n]
          .filter((c) => c >= 0 && c < tarjetas.length)
          .sort((a, b2) => Math.abs(a - actual) - Math.abs(b2 - actual))[0];
        pista.scrollTo({ left: destino * paso(), behavior: "smooth" });
      });
      contenedorPuntos.appendChild(b);
      return b;
    });

    observarFondos();
    colocar(n);
    actualizar();
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

  if (btnPrev) btnPrev.addEventListener("click", () => mover(-1));
  if (btnNext) btnNext.addEventListener("click", () => mover(1));
  pista.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") mover(1);
    if (e.key === "ArrowLeft") mover(-1);
  });

  window.addEventListener("resize", () => {
    const logico = logicoActual();
    colocar(n + logico);
    actualizar();
  });

  construir();
  window.addEventListener("load", () => {
    colocar(n + logicoActual());
    actualizar();
  });
})();

// ==========================================================================
// Encabezado: sombra al hacer scroll y enlace de la sección visible
// ==========================================================================
(function () {
  const encabezado = document.getElementById("site-header");
  if (encabezado) {
    const alScroll = () =>
      encabezado.classList.toggle("scrolled", window.scrollY > 8);
    window.addEventListener("scroll", alScroll, { passive: true });
    alScroll();
  }

  if (!("IntersectionObserver" in window)) return;
  const enlaces = Array.from(document.querySelectorAll('nav a[href^="#"]'));
  const mapa = new Map();
  enlaces.forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    const seccion = id && document.getElementById(id);
    if (seccion) mapa.set(seccion, a);
  });
  if (!mapa.size) return;

  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        enlaces.forEach((a) => a.classList.remove("active"));
        mapa.get(e.target).classList.add("active");
      });
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  mapa.forEach((_, seccion) => observador.observe(seccion));
})();

// ==========================================================================
// Botón flotante de WhatsApp: se oculta si ya hay un botón verde a la vista
// ==========================================================================
(function () {
  const flotante = document.getElementById("wa-float");
  if (!flotante || !("IntersectionObserver" in window)) return;
  const visibles = new Set();
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (e.isIntersecting) visibles.add(e.target);
      else visibles.delete(e.target);
    });
    flotante.classList.toggle("oculto", visibles.size > 0);
  });
  document
    .querySelectorAll("[data-cta]")
    .forEach((el) => observador.observe(el));
})();

// ==========================================================================
// Aparición suave al hacer scroll
// ==========================================================================
const objetivos = document.querySelectorAll(
  ".section-title, .benefit-card, .faq-card, .gifs-grid > div, .final-cta > *, .pain h2, .pain-list li, .compare-wrap",
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
