/* ============================================================
   UNIFIED.JS — Lógica centralizada
   ============================================================ */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQ9hvP2F11Nn7SjxGSbMDpoXFxlbqIiETOUzPcisujhyVkgcTYcoCQME_3zwVjEA/pub?output=csv";
const WHATSAPP_NUMERO = "5213312892022";

const DISENOS_VALIDOS = [
  "terracota",
  "soft",
  "rose",
  "purple",
  "orange",
  "matcha",
  "liquidglass",
  "green",
  "frost",
  "emerald",
  "ember",
  "bubble",
  "blue",
  "banana",
  "aurora",
];
const NEGOCIOS_VALIDOS = [
  "celulares",
  "computadoras",
  "joyeria",
  "ropa",
  "calzado",
  "belleza",
  "plantas",
  "mascotas",
  "hogar",
];
const LS_DESIGN = "mi-tienda-design";
const LS_NEGOCIO = "mi-tienda-negocio";

let todosLosProductos = [];
let productosFiltrados = [];
let negocioActual = "todos";
let ordenPrecio = "ninguno";
let textoBusqueda = "";
let limiteVisible = 30;
const PRODUCTOS_POR_TANDA = 30;
let temporizadorBusqueda = null;
let carrito = JSON.parse(localStorage.getItem("carrito_leafora")) || [];

function normalizarTexto(texto) {
  if (!texto) return "";
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parseCSVRow(text) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += char;
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^["'](.*)["']$/, "$1").trim());
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ------------------------------------------------------------------
// PANEL DE PERSONALIZACIÓN
// ------------------------------------------------------------------
function togglePanel() {
  const panel = document.getElementById("design-panel");
  if (!panel) return;
  const abrir = !panel.classList.contains("open");
  panel.classList.toggle("open", abrir);
  panel.setAttribute("aria-hidden", abrir ? "false" : "true");
  document.body.classList.toggle("panel-open", abrir);
  if (!abrir) {
    document
      .querySelectorAll(".customizer-section.abierta")
      .forEach((s) => s.classList.remove("abierta"));
  }
}

function alternarSeccion(btn) {
  const seccion = btn.closest(".customizer-section");
  const estaAbierta = seccion.classList.contains("abierta");

  document.querySelectorAll(".customizer-section").forEach((s) => {
    s.classList.remove("abierta");
  });

  if (!estaAbierta) {
    seccion.classList.add("abierta");
  }
}

function aplicarDiseno(nombre) {
  if (!DISENOS_VALIDOS.includes(nombre)) nombre = "terracota";
  const link = document.getElementById("design-link");
  if (link) link.href = `designs/${nombre}.css`;
  document.documentElement.dataset.design = nombre;
  document
    .querySelectorAll(".panel-design-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.design === nombre));
  try {
    localStorage.setItem(LS_DESIGN, nombre);
  } catch (e) {}
  actualizarURL();
}

function aplicarNegocio(nombre) {
  if (nombre !== "todos" && !NEGOCIOS_VALIDOS.includes(nombre))
    nombre = "todos";
  negocioActual = nombre;
  document.documentElement.dataset.negocio = nombre;
  document
    .querySelectorAll(".panel-negocio-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.negocio === nombre));
  try {
    localStorage.setItem(LS_NEGOCIO, nombre);
  } catch (e) {}
  filtrarYRenderizar();
  actualizarURL();
}

function actualizarURL() {
  const params = new URLSearchParams();
  if (document.documentElement.dataset.design !== "terracota")
    params.set("design", document.documentElement.dataset.design);
  if (negocioActual !== "todos") params.set("negocio", negocioActual);

  const qs = params.toString();
  const url = qs ? `${location.pathname}?${qs}` : location.pathname;
  history.replaceState(null, "", url);
}

function catalogoTieneNegocios() {
  return todosLosProductos.some((p) =>
    NEGOCIOS_VALIDOS.includes(normalizarTexto(p.categoria)),
  );
}

function productosDelNegocio() {
  if (negocioActual === "todos") return todosLosProductos;
  if (!catalogoTieneNegocios()) return todosLosProductos;
  return todosLosProductos.filter(
    (p) => normalizarTexto(p.categoria) === negocioActual,
  );
}

// ------------------------------------------------------------------
// CARGA DEL CATÁLOGO
// ------------------------------------------------------------------
async function cargarCatalogo() {
  const contenedor = document.getElementById("catalogo");
  contenedor.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Cargando catálogo...</p></div>`;
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Error al conectar");
    const data = await response.text();
    const lineas = data.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lineas.length < 2) return;
    const cabeceras = parseCSVRow(lineas[0]).map(
      (h) => normalizarTexto(h).replace(/\s+/g, "_") || "columna_vacia",
    );

    todosLosProductos = lineas
      .slice(1)
      .map((linea) => {
        const row = parseCSVRow(linea);
        if (row.length === 0 || !row[0]) return null;
        const producto = {};
        cabeceras.forEach((claveOriginal, index) => {
          let clave = claveOriginal;
          let val = row[index] || "";
          if (["url_imagen", "imagen", "imagenes"].includes(clave))
            clave = "imagenes_raw";
          if (
            ["precio_descuento", "preciodescuento", "descuento"].includes(clave)
          )
            clave = "precio_descuento";
          producto[clave] = val;
        });
        const rawImgs =
          producto.imagenes_raw ||
          "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=300&auto=format&fit=crop";
        const listaImgs = rawImgs
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean);
        producto.imagen_url = listaImgs[0];
        producto.imagenes_array = listaImgs;
        return producto;
      })
      .filter(
        (p) =>
          p &&
          p.id &&
          p.nombre &&
          p.nombre.trim() &&
          parseFloat(p.precio) > 0 &&
          normalizarTexto(p.estado) !== "inactivo",
      );

    const idsVigentes = new Set(todosLosProductos.map((p) => p.id));
    const carritoFiltrado = carrito.filter((it) => idsVigentes.has(it.id));
    if (carritoFiltrado.length !== carrito.length) {
      carrito = carritoFiltrado;
      localStorage.setItem("carrito_leafora", JSON.stringify(carrito));
    }

    filtrarYRenderizar();
    configurarBusqueda();
    actualizarContadorCarrito();
  } catch (error) {
    contenedor.innerHTML = `<p style="grid-column: span 1; text-align: center; color: #ff6b6b; padding: 2rem;">Error al cargar los productos.</p>`;
  }
}

// ------------------------------------------------------------------
// RENDER Y FILTROS
// ------------------------------------------------------------------
function toggleFilterMenu(event) {
  event.stopPropagation();
  document.getElementById("filter-dropdown")?.classList.toggle("show");
}
window.addEventListener("click", () =>
  document.getElementById("filter-dropdown")?.classList.remove("show"),
);

function aplicarOrdenamiento(orden) {
  ordenPrecio = orden;
  document.getElementById("filter-dropdown")?.classList.remove("show");
  filtrarYRenderizar();
}

function filtrarYRenderizar() {
  let filtrados = [...productosDelNegocio()];
  if (textoBusqueda.trim() !== "") {
    const q = normalizarTexto(textoBusqueda);
    filtrados = filtrados.filter(
      (p) =>
        normalizarTexto(p.nombre).includes(q) ||
        normalizarTexto(p.descripcion).includes(q),
    );
  }

  if (ordenPrecio === "menor-mayor") {
    filtrados.sort(
      (a, b) =>
        (parseFloat(a.precio_descuento) || parseFloat(a.precio)) -
        (parseFloat(b.precio_descuento) || parseFloat(b.precio)),
    );
  } else if (ordenPrecio === "mayor-menor") {
    filtrados.sort(
      (a, b) =>
        (parseFloat(b.precio_descuento) || parseFloat(b.precio)) -
        (parseFloat(a.precio_descuento) || parseFloat(a.precio)),
    );
  }

  productosFiltrados = filtrados;
  limiteVisible = PRODUCTOS_POR_TANDA;
  renderizarProductos(filtrados);
}

function verMasProductos() {
  const desde = limiteVisible;
  limiteVisible += PRODUCTOS_POR_TANDA;
  renderizarProductos(productosFiltrados, desde);
}

function configurarBusqueda() {
  const input = document.querySelector(".search-input");
  if (!input) return;
  input.addEventListener("input", (e) => {
    textoBusqueda = e.target.value;
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(filtrarYRenderizar, 300);
  });
}

function renderizarProductos(productos, desde = 0) {
  const contenedor = document.getElementById("catalogo");
  if (desde === 0) contenedor.innerHTML = "";
  contenedor.querySelector(".ver-mas-container")?.remove();
  if (productos.length === 0) {
    contenedor.innerHTML = `<p style="grid-column: span 1; text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron productos.</p>`;
    return;
  }

  const CAMPOS_OMITIDOS = new Set([
    "id",
    "nombre",
    "descripcion",
    "precio",
    "precio_descuento",
    "categoria",
    "marca",
    "imagenes_raw",
    "imagen_url",
    "imagenes_array",
    "estado",
    "undefined",
    "columna_vacia",
  ]);

  productos.slice(desde, limiteVisible).forEach((prod) => {
    const card = document.createElement("div");
    card.className = "producto-card";
    const imagenSrc =
      prod.imagen_url ||
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=300&auto=format&fit=crop";

    let variantsHtml = "";
    for (const [key, value] of Object.entries(prod)) {
      if (CAMPOS_OMITIDOS.has(key) || !value || !String(value).trim()) continue;
      const nombreCampo = key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (String(value).includes(",")) {
        variantsHtml += `<div class="variant-group"><label>${nombreCampo}:</label><select class="variant-select" id="card-select-${prod.id}-${key}">${String(
          value,
        )
          .split(",")
          .map((o) => `<option value="${o.trim()}">${o.trim()}</option>`)
          .join("")}</select></div>`;
      } else {
        variantsHtml += `<div class="variant-group"><label>${nombreCampo}:</label><div style="padding: 0.55rem 0.75rem; background: rgba(11,26,19,0.9); border: 1px solid var(--border-glass); border-radius: 16px; font-size: 0.9rem; color: var(--text-main);">${value}</div></div>`;
      }
    }

    const precioBase = parseFloat(prod.precio) || 0;
    const precioDesc = prod.precio_descuento
      ? parseFloat(prod.precio_descuento)
      : null;
    let precioHtml = `<span class="card-price">$${precioBase.toFixed(2)}</span>`;
    if (precioDesc && !isNaN(precioDesc) && precioDesc > 0) {
      precioHtml = `<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;"><span class="precio-original">$${precioBase.toFixed(2)}</span><span class="card-price" style="color:#34d399;">$${precioDesc.toFixed(2)}</span></div>`;
    }

    card.innerHTML = `
      <div class="card-image-container">
        <img src="${imagenSrc}" alt="${prod.nombre}" loading="lazy">
        ${prod.marca ? `<span class="card-brand">${prod.marca}</span>` : ""}
        <span class="card-category">${prod.categoria || "General"}</span>
      </div>
      <div class="card-info">
        <h3 class="card-title">${prod.nombre}</h3>
      </div>
      ${variantsHtml ? `<div class="variants-grid">${variantsHtml}</div>` : ""}
      <div class="card-footer">
        ${precioHtml}
        <div class="card-actions-row">
          <button class="btn-add-cart-main" onclick="agregarAlCarritoDesdeCard('${prod.id}')">Añadir al carrito</button>
          <button class="btn-details-link" data-id="${prod.id}">Detalles</button>
        </div>
      </div>`;

    card
      .querySelector(".btn-details-link")
      .addEventListener("click", () => verDetallesProducto(prod.id));
    contenedor.appendChild(card);
  });

  const restantes = productos.length - limiteVisible;
  if (restantes > 0) {
    const cont = document.createElement("div");
    cont.className = "ver-mas-container";
    cont.innerHTML = `<button class="btn-ver-mas" onclick="verMasProductos()">Ver más productos <span>(${restantes} restantes)</span></button>`;
    contenedor.appendChild(cont);
  }
}

// ------------------------------------------------------------------
// CARRITO
// ------------------------------------------------------------------
function guardarYActualizarCarrito() {
  localStorage.setItem("carrito_leafora", JSON.stringify(carrito));
  actualizarContadorCarrito();
}

function actualizarContadorCarrito() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = carrito.reduce((s, i) => s + i.cantidad, 0);
}

function agregarAlCarritoDesdeCard(idProducto) {
  const prod = todosLosProductos.find((p) => p.id === idProducto);
  if (!prod) return;
  const CAMPOS_OMITIDOS = new Set([
    "id",
    "nombre",
    "descripcion",
    "precio",
    "precio_descuento",
    "categoria",
    "marca",
    "imagenes_raw",
    "imagen_url",
    "imagenes_array",
    "estado",
    "undefined",
    "columna_vacia",
  ]);
  const variantes = {};
  for (const [key, value] of Object.entries(prod)) {
    if (CAMPOS_OMITIDOS.has(key) || !value || !String(value).trim()) continue;
    if (String(value).includes(",")) {
      const sel = document.getElementById(`card-select-${idProducto}-${key}`);
      if (sel) variantes[key] = sel.value;
    } else variantes[key] = value;
  }
  const varString = Object.entries(variantes)
    .map(([k, v]) => `${k}:${v}`)
    .join("-");
  const cartId = idProducto + "-" + varString;
  const precioBase = parseFloat(prod.precio) || 0;
  const precioDesc = prod.precio_descuento
    ? parseFloat(prod.precio_descuento)
    : null;
  const precioEfectivo = precioDesc && precioDesc > 0 ? precioDesc : precioBase;
  const idx = carrito.findIndex((i) => i.cartId === cartId);
  if (idx !== -1) carrito[idx].cantidad += 1;
  else
    carrito.push({
      ...prod,
      precio: precioEfectivo,
      variantes,
      cartId,
      cantidad: 1,
    });
  guardarYActualizarCarrito();
}

function agregarAlCarritoDesdeDetalle(idProducto) {
  const prod = todosLosProductos.find((p) => p.id === idProducto);
  if (!prod) return;
  const CAMPOS_OMITIDOS = new Set([
    "id",
    "nombre",
    "descripcion",
    "precio",
    "precio_descuento",
    "categoria",
    "marca",
    "imagenes_raw",
    "imagen_url",
    "imagenes_array",
    "estado",
    "undefined",
    "columna_vacia",
  ]);
  const variantes = {};
  for (const [key, value] of Object.entries(prod)) {
    if (CAMPOS_OMITIDOS.has(key) || !value || !String(value).trim()) continue;
    if (String(value).includes(",")) {
      const sel = document.getElementById(`select-${key}`);
      if (sel) variantes[key] = sel.value;
    } else variantes[key] = value;
  }
  const varString = Object.entries(variantes)
    .map(([k, v]) => `${k}:${v}`)
    .join("-");
  const cartId = idProducto + "-" + varString;
  const precioBase = parseFloat(prod.precio) || 0;
  const precioDesc = prod.precio_descuento
    ? parseFloat(prod.precio_descuento)
    : null;
  const precioEfectivo = precioDesc && precioDesc > 0 ? precioDesc : precioBase;
  const idx = carrito.findIndex((i) => i.cartId === cartId);
  if (idx !== -1) carrito[idx].cantidad += 1;
  else
    carrito.push({
      ...prod,
      precio: precioEfectivo,
      variantes,
      cartId,
      cantidad: 1,
    });
  guardarYActualizarCarrito();
  cerrarDetalles();
}

function cambiarCantidad(cartId, cambio) {
  const idx = carrito.findIndex((i) => i.cartId === cartId);
  if (idx === -1) return;
  carrito[idx].cantidad += cambio;
  if (carrito[idx].cantidad <= 0) carrito.splice(idx, 1);
  guardarYActualizarCarrito();
  abrirCarrito();
}

function eliminarDelCarrito(cartId) {
  carrito = carrito.filter((i) => i.cartId !== cartId);
  guardarYActualizarCarrito();
  abrirCarrito();
}

function abrirCarrito() {
  const modal = document.getElementById("cart-modal");
  const cont = document.getElementById("cart-items-container");
  const totalEl = document.getElementById("cart-total-price");
  cont.innerHTML = "";
  let total = 0;
  if (carrito.length === 0) {
    cont.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:1.5rem;">Tu carrito está vacío.</p>`;
  } else {
    carrito.forEach((item) => {
      const precioNum = parseFloat(item.precio) || 0;
      total += precioNum * item.cantidad;
      let varsTxt = "";
      if (item.variantes && Object.keys(item.variantes).length > 0) {
        varsTxt = Object.entries(item.variantes)
          .map(
            ([k, v]) =>
              `<span style="font-size:0.75rem;color:var(--accent-light);">${k.replace(/_/g, " ").toUpperCase()}: ${v}</span>`,
          )
          .join(" | ");
      }
      const fila = document.createElement("div");
      fila.className = "cart-item-row";
      fila.innerHTML = `
        <div><div style="font-weight:600;margin-bottom:0.1rem;">${item.nombre}</div>${varsTxt ? `<div style="margin-bottom:0.2rem;">${varsTxt}</div>` : ""}<div style="font-size:0.8rem;color:var(--text-muted);">$${item.precio} c/u</div></div>
        <div class="cart-item-controls"><button class="qty-btn" onclick="cambiarCantidad('${item.cartId}', -1)">-</button><span style="font-weight:600;min-width:20px;text-align:center;">${item.cantidad}</span><button class="qty-btn" onclick="cambiarCantidad('${item.cartId}', 1)">+</button><button class="btn-remove-item" onclick="eliminarDelCarrito('${item.cartId}')">🗑️</button></div>`;
      cont.appendChild(fila);
    });
  }
  totalEl.textContent = `$${total.toFixed(2)}`;
  modal.style.display = "flex";
}

function cerrarCarrito() {
  document.getElementById("cart-modal").style.display = "none";
}

function enviarPedido(event) {
  event.preventDefault();
  const inputNombre = document.getElementById("nombre-cliente");
  const inputTelefono = document.getElementById("telefono-cliente");
  const inputCorreo = document.getElementById("correo-cliente");
  [inputNombre, inputTelefono, inputCorreo].forEach((i) =>
    i.setCustomValidity(""),
  );

  if (carrito.length === 0) return alert("Agrega al menos un producto.");
  if (!inputNombre.value.trim()) {
    inputNombre.setCustomValidity("Completa este campo.");
    inputNombre.reportValidity();
    return;
  }
  const tel = inputTelefono.value.trim().replace(/\D/g, "");
  if (tel.length < 10) {
    inputTelefono.setCustomValidity("Teléfono inválido.");
    inputTelefono.reportValidity();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputCorreo.value.trim())) {
    inputCorreo.setCustomValidity("Correo inválido.");
    inputCorreo.reportValidity();
    return;
  }

  const detalle = carrito
    .map((p) => {
      const vars = p.variantes
        ? Object.entries(p.variantes)
            .map(([k, v]) => `[${k.replace(/_/g, " ").toUpperCase()}: ${v}]`)
            .join(" ")
        : "";
      return `- ${p.cantidad}x ${p.nombre} ${vars} ($${(parseFloat(p.precio) * p.cantidad).toFixed(2)})`;
    })
    .join("\n");

  const total = carrito.reduce(
    (s, p) => s + (parseFloat(p.precio) || 0) * p.cantidad,
    0,
  );
  const mensaje = `Hola, quiero hacer el siguiente pedido:\n\n${detalle}\n\n*Total: $${total.toFixed(2)}*\n\n*Datos de contacto:*\nNombre: ${inputNombre.value.trim()}\nTeléfono: ${inputTelefono.value.trim()}\nCorreo: ${inputCorreo.value.trim()}`;

  window.open(
    `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`,
    "_blank",
  );
  carrito = [];
  guardarYActualizarCarrito();
  cerrarCarrito();
  document.getElementById("order-form").reset();
}

let indiceImagenActual = 0;

function verDetallesProducto(idProducto) {
  const prod = todosLosProductos.find((p) => p.id === idProducto);
  if (!prod) return;
  const modal = document.getElementById("details-modal");
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");
  titleEl.textContent = "";
  titleEl.parentElement.classList.add("sin-titulo");
  bodyEl.innerHTML = "";
  indiceImagenActual = 0;

  const imagenes = prod.imagenes_array?.length
    ? prod.imagenes_array
    : [
        "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=300&auto=format&fit=crop",
      ];
  const CAMPOS_OMITIDOS = new Set([
    "id",
    "nombre",
    "descripcion",
    "precio",
    "precio_descuento",
    "categoria",
    "marca",
    "imagenes_raw",
    "imagen_url",
    "imagenes_array",
    "estado",
    "undefined",
    "columna_vacia",
  ]);

  let variantsHtml = "";
  for (const [key, value] of Object.entries(prod)) {
    if (CAMPOS_OMITIDOS.has(key) || !value || !String(value).trim()) continue;
    const nombreCampo = key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    if (String(value).includes(",")) {
      variantsHtml += `<div class="variant-group"><label>${nombreCampo}:</label><select class="variant-select" id="select-${key}">${String(
        value,
      )
        .split(",")
        .map((o) => `<option value="${o.trim()}">${o.trim()}</option>`)
        .join("")}</select></div>`;
    } else {
      variantsHtml += `<div class="variant-group"><label>${nombreCampo}:</label><div style="padding:0.55rem 0.75rem;background:rgba(11,26,19,0.9);border:1px solid var(--border-glass);border-radius:16px;font-size:0.9rem;color:var(--text-main);">${value}</div></div>`;
    }
  }

  let carouselHtml = `<div class="carousel-container"><div class="carousel-track" id="carousel-track">${imagenes.map((img) => `<img src="${img}" class="carousel-img" alt="${prod.nombre}">`).join("")}</div>`;
  if (imagenes.length > 1) {
    carouselHtml += `<button class="carousel-btn carousel-prev" onclick="cambiarSlide(-1)">&#10094;</button><button class="carousel-btn carousel-next" onclick="cambiarSlide(1)">&#10095;</button><div class="carousel-indicators">${imagenes.map((_, i) => `<button class="carousel-dot ${i === 0 ? "active" : ""}" onclick="irASlide(${i})"></button>`).join("")}</div>`;
  }
  carouselHtml += `</div>`;

  const precioBase = parseFloat(prod.precio) || 0;
  const precioDesc = prod.precio_descuento
    ? parseFloat(prod.precio_descuento)
    : null;
  let precioHtml = `<span class="card-price">$${precioBase.toFixed(2)}</span>`;
  if (precioDesc && precioDesc > 0) {
    precioHtml = `<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;"><span class="precio-original">$${precioBase.toFixed(2)}</span><span class="card-price" style="color:#34d399;">$${precioDesc.toFixed(2)}</span></div>`;
  }

  bodyEl.innerHTML = `
    <div class="producto-card" style="box-shadow:none;padding:0;background:transparent;border:none;">
      <div class="card-image-container" style="background:transparent;padding:0;">
        ${carouselHtml}
        ${prod.marca ? `<span class="card-brand" style="top:10px;left:10px;">${prod.marca}</span>` : ""}
        <span class="card-category" style="top:10px;right:10px;">${prod.categoria || "General"}</span>
      </div>
      <div class="card-info"><h3 class="card-title">${prod.nombre}</h3><p class="card-desc" style="margin-top:0.5rem;">${prod.descripcion || ""}</p></div>
      ${variantsHtml ? `<div class="variants-grid">${variantsHtml}</div>` : ""}
      <div class="card-footer" style="padding-top:1rem;">${precioHtml}<button class="btn-add-cart-main" onclick="agregarAlCarritoDesdeDetalle('${prod.id}')">Añadir al carrito</button></div>
    </div>`;

  modal.style.display = "flex";
  window._modalImgsLength = imagenes.length;
}

function cambiarSlide(dir) {
  if (!window._modalImgsLength || window._modalImgsLength <= 1) return;
  indiceImagenActual += dir;
  if (indiceImagenActual < 0) indiceImagenActual = window._modalImgsLength - 1;
  else if (indiceImagenActual >= window._modalImgsLength)
    indiceImagenActual = 0;
  actualizarPosicionCarousel();
}
function irASlide(i) {
  indiceImagenActual = i;
  actualizarPosicionCarousel();
}
function actualizarPosicionCarousel() {
  const track = document.getElementById("carousel-track");
  if (!track) return;
  track.style.transform = `translateX(-${indiceImagenActual * 100}%)`;
  document
    .querySelectorAll(".carousel-dot")
    .forEach((d, i) => d.classList.toggle("active", i === indiceImagenActual));
}
function cerrarDetalles() {
  document.getElementById("details-modal").style.display = "none";
}

function abrirPoliticas() {
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");
  titleEl.textContent = "Aviso de Privacidad";
  titleEl.parentElement.classList.remove("sin-titulo");
  bodyEl.innerHTML = `<div class="legal-content"><p class="legal-date">Última actualización: 2026</p><h4>1. Responsable</h4><p><strong>[Nombre del Comercio]</strong> es responsable del uso de sus datos.</p><h4>2. Datos</h4><p>Recabamos nombre, teléfono y correo para procesar pedidos.</p></div>`;
  document.getElementById("details-modal").style.display = "flex";
}

function abrirTerminos() {
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");
  titleEl.textContent = "Términos y Condiciones";
  titleEl.parentElement.classList.remove("sin-titulo");
  bodyEl.innerHTML = `<div class="legal-content"><p class="legal-date">Última actualización: 2026</p><h4>1. Aceptación</h4><p>El uso de este catálogo implica la aceptación de estos términos.</p><h4>2. Servicio</h4><p>Catálogo para enviar pedidos por WhatsApp. No se procesan pagos en línea.</p></div>`;
  document.getElementById("details-modal").style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const designParam = params.get("design");
  const negocioParam = params.get("negocio");

  let designInicial = "terracota";
  if (designParam && DISENOS_VALIDOS.includes(designParam))
    designInicial = designParam;
  else {
    try {
      const g = localStorage.getItem(LS_DESIGN);
      if (g && DISENOS_VALIDOS.includes(g)) designInicial = g;
    } catch (e) {}
  }

  let negocioInicial = "todos";
  if (
    negocioParam &&
    (negocioParam === "todos" || NEGOCIOS_VALIDOS.includes(negocioParam))
  )
    negocioInicial = negocioParam;
  else {
    try {
      const g = localStorage.getItem(LS_NEGOCIO);
      if (g && (g === "todos" || NEGOCIOS_VALIDOS.includes(g)))
        negocioInicial = g;
    } catch (e) {}
  }

  aplicarDiseno(designInicial);

  negocioActual = negocioInicial;
  document.documentElement.dataset.negocio = negocioInicial;
  document
    .querySelectorAll(".panel-negocio-btn")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.negocio === negocioInicial),
    );

  document
    .querySelectorAll(".panel-design-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () => aplicarDiseno(btn.dataset.design)),
    );
  document
    .querySelectorAll(".panel-negocio-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () => aplicarNegocio(btn.dataset.negocio)),
    );

  cargarCatalogo();
});
