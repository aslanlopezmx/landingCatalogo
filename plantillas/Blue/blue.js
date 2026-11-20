/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: iniciarApp()
 * DESCRIPCIÓN: Oculta la pantalla de bienvenida (Splash Screen) con una transición
 * suave de opacidad y muestra la aplicación principal del catálogo.
 * --------------------------------------------------------------------------
 */
function iniciarApp() {
  const splashScreen = document.getElementById("splash-screen");
  const mainApp = document.getElementById("main-app");

  splashScreen.style.opacity = "0";
  setTimeout(() => {
    splashScreen.style.display = "none";
    mainApp.style.display = "block";
  }, 500);
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: scrollToTop()
 * DESCRIPCIÓN: Desplaza la ventana suavemente hacia el inicio de la página web.
 * --------------------------------------------------------------------------
 */
function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// --------------------------------------------------------------------------
// CONFIGURACIÓN Y ESTADO GLOBAL DE LA APLICACIÓN
// --------------------------------------------------------------------------
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRCs6r_BBKeU7bAyH5SPIxBKct17ew6hLNgShlYuKLP97sjAmKrp7xWmRGaAkMDPQ/pub?output=csv";

let todosLosProductos = [];
let categoriaActual = "todas";
let ordenPrecio = "ninguno"; // 'ninguno', 'menor-mayor', 'mayor-menor'
let textoBusqueda = "";

// PAGINACIÓN: cantidad de productos que se muestran por tanda
const PRODUCTOS_POR_TANDA = 30;
let limiteVisible = PRODUCTOS_POR_TANDA;
let productosFiltrados = [];
let temporizadorBusqueda = null; // Espera (debounce) del buscador

// RECUPERACIÓN DE DATOS: Carga el carrito guardado previamente en localStorage o inicia vacío
let carrito = JSON.parse(localStorage.getItem("carrito_leafora")) || [];

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: normalizarTexto(texto)
 * DESCRIPCIÓN: Convierte el texto a minúsculas, elimina tildes/acentos y espacios
 * sobrantes para facilitar comparaciones y búsquedas exactas.
 * --------------------------------------------------------------------------
 */
function normalizarTexto(texto) {
  if (!texto) return "";
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: parseCSVRow(text)
 * DESCRIPCIÓN: Analiza de forma segura una línea de texto CSV respetando comillas
 * y comas internas para evitar errores en celdas complejas.
 * --------------------------------------------------------------------------
 */
function parseCSVRow(text) {
  let result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((val) => val.replace(/^["'](.*)["']$/, "$1").trim());
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: cargarCatalogo()
 * DESCRIPCIÓN: Realiza la petición HTTP para descargar el CSV de Google Sheets,
 * procesa las cabeceras, filtra productos inactivos, gestiona carritos huérfanos
 * y divide las URLs de imágenes y precios de descuento.
 * --------------------------------------------------------------------------
 */
async function cargarCatalogo() {
  const contenedor = document.getElementById("catalogo");

  // Muestra el indicador visual de carga (Spinner)
  contenedor.innerHTML = `
    <div class="loading-container">
      <div class="spinner"></div>
      <p>Cargando catálogo...</p>
    </div>
  `;

  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) throw new Error("Error al conectar con Google Sheets");
    const data = await response.text();

    const lineas = data.split(/\r?\n/).filter((linea) => linea.trim() !== "");
    if (lineas.length < 2) return;

    const cabeceras = parseCSVRow(lineas[0]).map((h) => {
      const norm = normalizarTexto(h).replace(/\s+/g, "_");
      return norm || "columna_vacia";
    });

    todosLosProductos = lineas
      .slice(1)
      .map((linea) => {
        const row = parseCSVRow(linea);
        if (row.length === 0 || !row[0]) return null;
        let producto = {};
        cabeceras.forEach((clave, index) => {
          let val = row[index] ? row[index] : "";
          if (
            clave === "url_imagen" ||
            clave === "imagen" ||
            clave === "imagenes"
          )
            clave = "imagenes_raw";
          if (
            clave === "precio_descuento" ||
            clave === "preciodescuento" ||
            clave === "descuento"
          )
            clave = "precio_descuento";
          producto[clave] = val;
        });

        // Procesamiento de múltiples imágenes separadas por comas
        const rawImgs =
          producto.imagenes_raw ||
          "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=300&auto=format&fit=crop";
        const listaImgs = rawImgs
          .split(",")
          .map((url) => url.trim())
          .filter((url) => url !== "");

        producto.imagen_url = listaImgs[0]; // Primera imagen para miniatura principal
        producto.imagenes_array = listaImgs; // Arreglo completo para el carrusel de detalles

        return producto;
      })
      .filter((p) => {
        // Excluye filas vacías, sin ID y productos con estado "inactivo"
        if (!p || !p.id) return false;
        // Excluye filas "preparadas" sin datos: requiere nombre y precio mayor a 0
        if (!p.nombre || !p.nombre.trim()) return false;
        if (!(parseFloat(p.precio) > 0)) return false;
        const estadoNorm = normalizarTexto(p.estado);
        return estadoNorm !== "inactivo";
      });

    // VALIDACIÓN DE CARRITO HUÉRFANO:
    // Compara los IDs almacenados en localStorage con los IDs vigentes del catálogo actual.
    const idsVigentes = new Set(todosLosProductos.map((p) => p.id));
    const carritoFiltrado = carrito.filter((item) => idsVigentes.has(item.id));
    if (carritoFiltrado.length !== carrito.length) {
      carrito = carritoFiltrado;
      localStorage.setItem("carrito_leafora", JSON.stringify(carrito));
    }

    poblarMenuCategoriasDinamico();
    filtrarYRenderizar();
    configurarBusqueda();
    actualizarContadorCarrito();
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);
    contenedor.innerHTML = `<p style="grid-column: span 1; text-align: center; color: #ff6b6b; padding: 2rem;">Error al cargar los productos. Intente recargar la página.</p>`;
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: poblarMenuCategoriasDinamico()
 * DESCRIPCIÓN: Extrae las categorías únicas del catálogo cargado y genera
 * automáticamente las opciones del menú desplegable de filtros.
 * --------------------------------------------------------------------------
 */
function poblarMenuCategoriasDinamico() {
  const contenedorCategorias = document.getElementById(
    "dynamic-categories-list",
  );
  if (!contenedorCategorias) return;

  const categoriasUnicas = [
    ...new Set(
      todosLosProductos.map((p) =>
        p.categoria ? p.categoria.trim() : "General",
      ),
    ),
  ];

  let html = `
    <div class="filter-option ${categoriaActual === "todas" ? "active" : ""}" onclick="seleccionarCategoriaFiltro('todas')">
      Todas las categorías
    </div>
  `;

  categoriasUnicas.forEach((cat) => {
    const norm = normalizarTexto(cat);
    const activo = categoriaActual === norm ? "active" : "";
    html += `
      <div class="filter-option ${activo}" onclick="seleccionarCategoriaFiltro('${cat}')">
        ${cat}
      </div>
    `;
  });

  contenedorCategorias.innerHTML = html;
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: toggleFilterMenu(event)
 * DESCRIPCIÓN: Muestra u oculta el menú desplegable de filtros y ordenamiento.
 * --------------------------------------------------------------------------
 */
function toggleFilterMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById("filter-dropdown");
  dropdown.classList.toggle("show");
}

// Cierra el menú desplegable si se hace clic fuera de él
window.addEventListener("click", () => {
  const dropdown = document.getElementById("filter-dropdown");
  if (dropdown && dropdown.classList.contains("show")) {
    dropdown.classList.remove("show");
  }
});

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: seleccionarCategoriaFiltro(cat)
 * DESCRIPCIÓN: Actualiza la categoría activa seleccionada y refresca la vista.
 * --------------------------------------------------------------------------
 */
function seleccionarCategoriaFiltro(cat) {
  categoriaActual = cat === "todas" ? "todas" : normalizarTexto(cat);
  poblarMenuCategoriasDinamico();
  document.getElementById("filter-dropdown").classList.remove("show");
  filtrarYRenderizar();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: aplicarOrdenamiento(orden)
 * DESCRIPCIÓN: Configura el criterio de ordenamiento por precio y refresca el grid.
 * --------------------------------------------------------------------------
 */
function aplicarOrdenamiento(orden) {
  ordenPrecio = orden;
  document.getElementById("filter-dropdown").classList.remove("show");
  filtrarYRenderizar();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: filtrarYRenderizar()
 * DESCRIPCIÓN: Aplica filtros por categoría, texto de búsqueda y reglas de
 * ordenamiento por precio sobre el arreglo general de productos.
 * --------------------------------------------------------------------------
 */
function filtrarYRenderizar() {
  let filtrados = [...todosLosProductos];

  if (categoriaActual !== "todas") {
    filtrados = filtrados.filter(
      (p) => normalizarTexto(p.categoria) === categoriaActual,
    );
  }

  if (textoBusqueda.trim() !== "") {
    const busquedaNorm = normalizarTexto(textoBusqueda);
    filtrados = filtrados.filter(
      (p) =>
        normalizarTexto(p.nombre).includes(busquedaNorm) ||
        normalizarTexto(p.descripcion).includes(busquedaNorm),
    );
  }

  // Ordenamiento basado en el precio efectivo (usa precio con descuento si existe, de lo contrario el base)
  if (ordenPrecio === "menor-mayor") {
    filtrados.sort((a, b) => {
      const pA =
        a.precio_descuento && parseFloat(a.precio_descuento) > 0
          ? parseFloat(a.precio_descuento)
          : parseFloat(a.precio) || 0;
      const pB =
        b.precio_descuento && parseFloat(b.precio_descuento) > 0
          ? parseFloat(b.precio_descuento)
          : parseFloat(b.precio) || 0;
      return pA - pB;
    });
  } else if (ordenPrecio === "mayor-menor") {
    filtrados.sort((a, b) => {
      const pA =
        a.precio_descuento && parseFloat(a.precio_descuento) > 0
          ? parseFloat(a.precio_descuento)
          : parseFloat(a.precio) || 0;
      const pB =
        b.precio_descuento && parseFloat(b.precio_descuento) > 0
          ? parseFloat(b.precio_descuento)
          : parseFloat(b.precio) || 0;
      return pB - pA;
    });
  }

  // Cada vez que cambia un filtro, orden o búsqueda se reinicia la paginación
  productosFiltrados = filtrados;
  limiteVisible = PRODUCTOS_POR_TANDA;
  renderizarProductos(filtrados);
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: verMasProductos()
 * DESCRIPCIÓN: Agrega la siguiente tanda de productos sin volver a dibujar
 * las tarjetas ya mostradas (así no se pierden las variantes elegidas).
 * --------------------------------------------------------------------------
 */
function verMasProductos() {
  const desde = limiteVisible;
  limiteVisible += PRODUCTOS_POR_TANDA;
  renderizarProductos(productosFiltrados, desde);
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: configurarBusqueda()
 * DESCRIPCIÓN: Escucha el evento input en la barra de búsqueda para actualizar
 * los resultados en tiempo real.
 * --------------------------------------------------------------------------
 */
function configurarBusqueda() {
  const inputBusqueda = document.querySelector(".search-input");
  if (inputBusqueda) {
    inputBusqueda.addEventListener("input", (e) => {
      textoBusqueda = e.target.value;
      // Espera 300 ms después de la última letra antes de buscar
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(filtrarYRenderizar, 300);
    });
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: guardarYActualizarCarrito()
 * DESCRIPCIÓN: Sincroniza el estado actual del carrito en el localStorage y
 * actualiza el número indicador en la cabecera.
 * --------------------------------------------------------------------------
 */
function guardarYActualizarCarrito() {
  localStorage.setItem("carrito_leafora", JSON.stringify(carrito));
  actualizarContadorCarrito();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: agregarAlCarritoDesdeCard(idProducto)
 * DESCRIPCIÓN: Captura las variantes elegidas en la tarjeta del producto, calcula
 * el precio efectivo (descuento si aplica) y añade el ítem al carrito.
 * --------------------------------------------------------------------------
 */
function agregarAlCarritoDesdeCard(idProducto) {
  const prod = todosLosProductos.find((p) => p.id === idProducto);
  if (!prod) return;

  let variantesSeleccionadas = {};
  const camposOmitidos = [
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
  ];

  for (const [key, value] of Object.entries(prod)) {
    if (!camposOmitidos.includes(key) && value && value.trim() !== "") {
      if (value.includes(",")) {
        const selectEl = document.getElementById(
          `card-select-${idProducto}-${key}`,
        );
        if (selectEl) {
          variantesSeleccionadas[key] = selectEl.value;
        }
      } else {
        variantesSeleccionadas[key] = value;
      }
    }
  }

  const variantesString = Object.entries(variantesSeleccionadas)
    .map(([k, v]) => `${k}:${v}`)
    .join("-");
  const cartId = idProducto + "-" + variantesString;

  // Determinar precio efectivo (precio de descuento o precio normal)
  const precioBase = parseFloat(prod.precio) || 0;
  const precioDesc = prod.precio_descuento
    ? parseFloat(prod.precio_descuento)
    : null;
  const precioEfectivo =
    precioDesc && !isNaN(precioDesc) && precioDesc > 0
      ? precioDesc
      : precioBase;

  const index = carrito.findIndex((item) => item.cartId === cartId);
  if (index !== -1) {
    carrito[index].cantidad += 1;
  } else {
    carrito.push({
      ...prod,
      precio: precioEfectivo, // Se guarda el precio efectivo a cobrar
      variantes: variantesSeleccionadas,
      cartId: cartId,
      cantidad: 1,
    });
  }

  guardarYActualizarCarrito();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: agregarAlCarritoDesdeDetalle(idProducto)
 * DESCRIPCIÓN: Captura las variantes seleccionadas dentro del modal de detalles
 * del producto, determina el precio efectivo y lo añade al carrito.
 * --------------------------------------------------------------------------
 */
function agregarAlCarritoDesdeDetalle(idProducto) {
  const prod = todosLosProductos.find((p) => p.id === idProducto);
  if (!prod) return;

  let variantesSeleccionadas = {};
  const camposOmitidos = [
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
  ];

  for (const [key, value] of Object.entries(prod)) {
    if (!camposOmitidos.includes(key) && value && value.trim() !== "") {
      if (value.includes(",")) {
        const selectEl = document.getElementById(`select-${key}`);
        if (selectEl) {
          variantesSeleccionadas[key] = selectEl.value;
        }
      } else {
        variantesSeleccionadas[key] = value;
      }
    }
  }

  const variantesString = Object.entries(variantesSeleccionadas)
    .map(([k, v]) => `${k}:${v}`)
    .join("-");
  const cartId = idProducto + "-" + variantesString;

  const precioBase = parseFloat(prod.precio) || 0;
  const precioDesc = prod.precio_descuento
    ? parseFloat(prod.precio_descuento)
    : null;
  const precioEfectivo =
    precioDesc && !isNaN(precioDesc) && precioDesc > 0
      ? precioDesc
      : precioBase;

  const index = carrito.findIndex((item) => item.cartId === cartId);
  if (index !== -1) {
    carrito[index].cantidad += 1;
  } else {
    carrito.push({
      ...prod,
      precio: precioEfectivo,
      variantes: variantesSeleccionadas,
      cartId: cartId,
      cantidad: 1,
    });
  }

  guardarYActualizarCarrito();
  cerrarDetalles();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: cambiarCantidad(cartId, cambio)
 * DESCRIPCIÓN: Aumenta o disminuye la cantidad de un producto específico en el carrito.
 * --------------------------------------------------------------------------
 */
function cambiarCantidad(cartId, cambio) {
  const index = carrito.findIndex((item) => item.cartId === cartId);
  if (index !== -1) {
    carrito[index].cantidad += cambio;
    if (carrito[index].cantidad <= 0) {
      carrito.splice(index, 1);
    }
    guardarYActualizarCarrito();
    abrirCarrito();
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: eliminarDelCarrito(cartId)
 * DESCRIPCIÓN: Elimina por completo un producto del carrito según su identificador único.
 * --------------------------------------------------------------------------
 */
function eliminarDelCarrito(cartId) {
  carrito = carrito.filter((item) => item.cartId !== cartId);
  guardarYActualizarCarrito();
  abrirCarrito();
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: actualizarContadorCarrito()
 * DESCRIPCIÓN: Calcula el número total de artículos en el carrito y actualiza la vista.
 * --------------------------------------------------------------------------
 */
function actualizarContadorCarrito() {
  const contadorElemento = document.getElementById("cart-count");
  if (contadorElemento) {
    const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);
    contadorElemento.textContent = totalItems;
  }
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: abrirCarrito()
 * DESCRIPCIÓN: Renderiza el listado de productos en el modal del carrito,
 * calcula el total a pagar y abre la ventana flotante.
 * --------------------------------------------------------------------------
 */
function abrirCarrito() {
  const modal = document.getElementById("cart-modal");
  const contenedorItems = document.getElementById("cart-items-container");
  const totalPrecioElemento = document.getElementById("cart-total-price");

  contenedorItems.innerHTML = "";
  let totalGeneral = 0;

  if (carrito.length === 0) {
    contenedorItems.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Tu carrito está vacío.</p>`;
  } else {
    carrito.forEach((item) => {
      const precioNum = parseFloat(item.precio) || 0;
      const subtotal = precioNum * item.cantidad;
      totalGeneral += subtotal;

      let variantesTexto = "";
      if (item.variantes && Object.keys(item.variantes).length > 0) {
        variantesTexto = Object.entries(item.variantes)
          .map(([k, v]) => {
            let nombreFormateado = k.replace(/_/g, " ");
            nombreFormateado =
              nombreFormateado.charAt(0).toUpperCase() +
              nombreFormateado.slice(1);
            return `<span style="font-size: 0.75rem; color: var(--accent-light);">${nombreFormateado}: ${v}</span>`;
          })
          .join(" | ");
      }

      const fila = document.createElement("div");
      fila.className = "cart-item-row";
      fila.innerHTML = `
        <div>
            <div style="font-weight: 600; margin-bottom: 0.1rem;">${item.nombre}</div>
            ${variantesTexto ? `<div style="margin-bottom: 0.2rem;">${variantesTexto}</div>` : ""}
            <div style="font-size: 0.8rem; color: var(--text-muted);">$${item.precio} c/u</div>
        </div>
        <div class="cart-item-controls">
            <button class="qty-btn" onclick="cambiarCantidad('${item.cartId}', -1)">-</button>
            <span style="font-weight: 600; min-width: 20px; text-align: center;">${item.cantidad}</span>
            <button class="qty-btn" onclick="cambiarCantidad('${item.cartId}', 1)">+</button>
            <button class="btn-remove-item" onclick="eliminarDelCarrito('${item.cartId}')" title="Eliminar producto">🗑️</button>
        </div>
      `;
      contenedorItems.appendChild(fila);
    });
  }

  totalPrecioElemento.textContent = `$${totalGeneral.toFixed(2)}`;
  modal.style.display = "flex";
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: cerrarCarrito()
 * DESCRIPCIÓN: Oculta el modal del carrito de compras.
 * --------------------------------------------------------------------------
 */
function cerrarCarrito() {
  const modal = document.getElementById("cart-modal");
  modal.style.display = "none";
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: enviarPedido(event)
 * DESCRIPCIÓN: Valida los datos del cliente, estructura el mensaje detallado
 * del pedido y abre una pestaña de WhatsApp para enviarlo de forma directa.
 * --------------------------------------------------------------------------
 */
function enviarPedido(event) {
  event.preventDefault();

  const inputNombre = document.getElementById("nombre-cliente");
  const inputTelefono = document.getElementById("telefono-cliente");
  const inputCorreo = document.getElementById("correo-cliente");

  inputNombre.setCustomValidity("");
  inputTelefono.setCustomValidity("");
  inputCorreo.setCustomValidity("");

  if (carrito.length === 0) {
    alert("Agrega al menos un producto al carrito antes de generar el pedido.");
    return;
  }

  if (!inputNombre.value.trim()) {
    inputNombre.setCustomValidity("Por favor, completa este campo.");
    inputNombre.reportValidity();
    return;
  }

  const telefonoLimpio = inputTelefono.value.trim().replace(/\D/g, "");
  if (telefonoLimpio.length < 10) {
    inputTelefono.setCustomValidity(
      "Por favor, introduce un número de teléfono válido (al menos 10 dígitos).",
    );
    inputTelefono.reportValidity();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(inputCorreo.value.trim())) {
    inputCorreo.setCustomValidity(
      "Por favor, introduce un correo electrónico válido.",
    );
    inputCorreo.reportValidity();
    return;
  }

  const nombre = inputNombre.value.trim();
  const telefono = inputTelefono.value.trim();
  const correo = inputCorreo.value.trim();

  let detalleProductos = carrito
    .map((p) => {
      let vars = p.variantes
        ? Object.entries(p.variantes)
            .map(([k, v]) => {
              let nombreFormateado = k.replace(/_/g, " ");
              nombreFormateado =
                nombreFormateado.charAt(0).toUpperCase() +
                nombreFormateado.slice(1);
              return `[${nombreFormateado}: ${v}]`;
            })
            .join(" ")
        : "";
      return `- ${p.cantidad}x ${p.nombre} ${vars} ($${(parseFloat(p.precio) * p.cantidad).toFixed(2)})`;
    })
    .join("\n");

  let total = carrito.reduce(
    (sum, p) => sum + (parseFloat(p.precio) || 0) * p.cantidad,
    0,
  );

  let mensaje = `Hola, quiero hacer el siguiente pedido:\n\n${detalleProductos}\n\n*Total: $${total.toFixed(2)}*\n\n*Datos de contacto:*\nNombre: ${nombre}\nTeléfono: ${telefono}\nCorreo: ${correo}`;

  const numeroWhatsApp = "5213312892022";
  const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;

  window.open(urlWhatsApp, "_blank");

  carrito = [];
  guardarYActualizarCarrito();
  cerrarCarrito();
  document.getElementById("order-form").reset();
}

/**
 * --------------------------------------------------------------------------
 * LÓGICA DEL CARRUSEL DE IMÁGENES Y MODAL DE DETALLES
 * --------------------------------------------------------------------------
 */
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

  const imagenes =
    prod.imagenes_array && prod.imagenes_array.length > 0
      ? prod.imagenes_array
      : [
          "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=300&auto=format&fit=crop",
        ];

  const camposOmitidos = [
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
  ];

  let variantsHtml = "";
  for (const [key, value] of Object.entries(prod)) {
    if (!camposOmitidos.includes(key) && value && value.trim() !== "") {
      let nombreCampo = key.replace(/_/g, " ");
      nombreCampo = nombreCampo.charAt(0).toUpperCase() + nombreCampo.slice(1);

      if (value.includes(",")) {
        let opciones = value.split(",").map((opt) => opt.trim());
        let optionsHtml = opciones
          .map((opt) => `<option value="${opt}">${opt}</option>`)
          .join("");
        variantsHtml += `
          <div class="variant-group">
              <label>${nombreCampo}:</label>
              <select class="variant-select" id="select-${key}">
                  ${optionsHtml}
              </select>
          </div>
        `;
      } else {
        variantsHtml += `
          <div class="variant-group">
              <label>${nombreCampo}:</label>
              <div style="padding: 0.55rem 0.75rem; background: rgba(11, 26, 19, 0.9); border: 1px solid var(--border-glass); border-radius: 16px; font-size: 0.9rem; color: var(--text-main);">
                  ${value}
              </div>
          </div>
        `;
      }
    }
  }

  // Generación del HTML para el carrusel de imágenes
  let carouselHtml = `
    <div class="carousel-container">
      <div class="carousel-track" id="carousel-track">
        ${imagenes.map((img) => `<img src="${img}" class="carousel-img" alt="${prod.nombre}">`).join("")}
      </div>
  `;

  if (imagenes.length > 1) {
    carouselHtml += `
      <button class="carousel-btn carousel-prev" onclick="cambiarSlide(-1)">&#10094;</button>
      <button class="carousel-btn carousel-next" onclick="cambiarSlide(1)">&#10095;</button>
      <div class="carousel-indicators">
        ${imagenes.map((_, i) => `<button class="carousel-dot ${i === 0 ? "active" : ""}" onclick="irASlide(${i})"></button>`).join("")}
      </div>
    `;
  }
  carouselHtml += `</div>`;

  // Renderizado del precio con soporte para descuento
  const precioBase = parseFloat(prod.precio) || 0;
  const precioDesc = prod.precio_descuento
    ? parseFloat(prod.precio_descuento)
    : null;
  let precioHtml = `<span class="card-price">$${precioBase.toFixed(2)}</span>`;

  if (precioDesc && !isNaN(precioDesc) && precioDesc > 0) {
    precioHtml = `
      <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <span class="precio-original">$${precioBase.toFixed(2)}</span>
          <span class="card-price" style="color: #34d399;">$${precioDesc.toFixed(2)}</span>
      </div>
    `;
  }

  bodyEl.innerHTML = `
    <div class="producto-card" style="box-shadow: none; padding: 0; background: transparent; border: none;">
        <div class="card-image-container" style="background: transparent; padding: 0;">
            ${carouselHtml}
            ${prod.marca ? `<span class="card-brand" style="top: 10px; left: 10px;">${prod.marca}</span>` : ""}
            <span class="card-category" style="top: 10px; right: 10px;">${prod.categoria || "General"}</span>
        </div>
        <div class="card-info">
            <h3 class="card-title">${prod.nombre}</h3>
            <p class="card-desc" style="margin-top: 0.5rem;">${prod.descripcion || ""}</p>
        </div>
        ${variantsHtml ? `<div class="variants-grid">${variantsHtml}</div>` : ""}
        <div class="card-footer" style="padding-top: 1rem;">
            ${precioHtml}
            <button class="btn-add-cart-main" onclick="agregarAlCarritoDesdeDetalle('${prod.id}')">Añadir al carrito</button>
        </div>
    </div>
  `;

  modal.style.display = "flex";
  window._modalImgsLength = imagenes.length;
}

/**
 * Funciones de navegación para el carrusel del modal
 */
function cambiarSlide(direccion) {
  if (!window._modalImgsLength || window._modalImgsLength <= 1) return;
  indiceImagenActual += direccion;
  if (indiceImagenActual < 0) {
    indiceImagenActual = window._modalImgsLength - 1;
  } else if (indiceImagenActual >= window._modalImgsLength) {
    indiceImagenActual = 0;
  }
  actualizarPosicionCarousel();
}

function irASlide(indice) {
  indiceImagenActual = indice;
  actualizarPosicionCarousel();
}

function actualizarPosicionCarousel() {
  const track = document.getElementById("carousel-track");
  if (!track) return;
  track.style.transform = `translateX(-${indiceImagenActual * 100}%)`;

  const dots = document.querySelectorAll(".carousel-dot");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("active", idx === indiceImagenActual);
  });
}

function cerrarDetalles() {
  const modal = document.getElementById("details-modal");
  modal.style.display = "none";
}

/**
 * --------------------------------------------------------------------------
 * FUNCIONES PARA POLÍTICAS Y TÉRMINOS (MODALES LEGALES)
 * --------------------------------------------------------------------------
 */
function abrirPoliticas() {
  const modal = document.getElementById("details-modal");
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");

  titleEl.textContent = "Aviso de Privacidad";
  titleEl.parentElement.classList.remove("sin-titulo");
  bodyEl.innerHTML = `
    <div class="legal-content">
        <p class="legal-date">Última actualización: 2026</p>
        <h4>1. Responsable del Tratamiento de Datos</h4>
        <p><strong>[Nombre del Comercio / Razón Social]</strong>, con domicilio en [Ciudad o País], es responsable del uso y protección de sus datos personales, en concordancia con la legislación aplicable en materia de protección de datos.</p>

        <h4>2. Datos Personales Recabados</h4>
        <p>Para llevar a cabo las finalidades descritas en el presente aviso, recabamos los siguientes datos personales a través de nuestros formularios de pedido:</p>
        <ul>
            <li>Nombre completo.</li>
            <li>Número telefónico de contacto.</li>
            <li>Correo electrónico.</li>
        </ul>

        <h4>3. Finalidades del Tratamiento</h4>
        <p>Los datos personales que recopilamos serán utilizados para las siguientes finalidades necesarias para el servicio:</p>
        <ul>
            <li>Gestionar, procesar y dar seguimiento a los pedidos de productos solicitados a través de nuestro catálogo digital y canal de WhatsApp.</li>
            <li>Establecer contacto con el cliente para aclaraciones, confirmaciones o coordinación de entregas.</li>
        </ul>

        <h4>4. Derechos ARCO</h4>
        <p>Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los utilizamos y las condiciones del uso que les damos (Acceso). Asimismo, es su derecho solicitar la corrección de sus datos personales (Rectificación), su eliminación de nuestros registros (Cancelación), así como oponerse al uso de sus datos para fines específicos (Oposición).</p>
        <p>Para el ejercicio de cualquiera de estos derechos, puede enviar su solicitud al correo electrónico: <strong>[Correo Electrónico de Contacto]</strong>.</p>
    </div>
  `;
  modal.style.display = "flex";
}

function abrirTerminos() {
  const modal = document.getElementById("details-modal");
  const titleEl = document.getElementById("detail-title");
  const bodyEl = document.getElementById("detail-body");

  titleEl.textContent = "Términos y Condiciones";
  titleEl.parentElement.classList.remove("sin-titulo");
  bodyEl.innerHTML = `
    <div class="legal-content">
        <p class="legal-date">Última actualización: 2026</p>
        <h4>1. Aceptación de los Términos</h4>
        <p>El acceso y uso de este catálogo digital atribuye la condición de usuario, quien acepta desde dicho momento los presentes Términos y Condiciones. Le sugerimos leerlos detenidamente antes de realizar cualquier pedido.</p>

        <h4>2. Descripción del Servicio</h4>
        <p>Este sitio web opera como un catálogo digital interactivo que permite a los usuarios visualizar productos, seleccionar variantes y generar un resumen de compra estructurado para ser enviado mediante mensajería instantánea (WhatsApp) al proveedor <strong>[Nombre del Comercio]</strong>.</p>

        <h4>3. Precios y Disponibilidad</h4>
        <p>Los precios y la disponibilidad de los productos mostrados en el catálogo están sujetos a cambios sin previo aviso. Nos esforzamos por mantener la información actualizada en todo momento; sin embargo, pueden existir variaciones menores de inventario o errores tipográficos involuntarios.</p>

        <h4>4. Proceso de Compra y Pedidos</h4>
        <p>Al hacer clic en "Enviar Pedido por WhatsApp", el usuario genera un mensaje directo al comercio. Ninguna transacción de pago se procesa de forma automatizada dentro de esta plataforma web; los métodos de pago, confirmación de stock y logística de entrega se acuerdan directamente entre el comprador y el vendedor a través del chat.</p>

        <h4>5. Modificaciones</h4>
        <p><strong>[Nombre del Comercio]</strong> se reserva el derecho de modificar, actualizar o suspender en cualquier momento y sin previo aviso la presentación, configuración y contenidos del catálogo.</p>
    </div>
  `;
  modal.style.display = "flex";
}

/**
 * --------------------------------------------------------------------------
 * FUNCIÓN: renderizarProductos(productos)
 * DESCRIPCIÓN: Recorre el listado de productos filtrados y construye dinámicamente
 * las tarjetas visuales con soporte para precios con descuento e imágenes principales.
 * --------------------------------------------------------------------------
 */
function renderizarProductos(productos, desde = 0) {
  const contenedor = document.getElementById("catalogo");
  if (desde === 0) contenedor.innerHTML = "";

  // Quita el botón "Ver más" anterior (se vuelve a crear al final si hace falta)
  const botonViejo = contenedor.querySelector(".ver-mas-container");
  if (botonViejo) botonViejo.remove();

  if (productos.length === 0) {
    contenedor.innerHTML = `<p style="grid-column: span 1; text-align: center; color: var(--text-muted); padding: 2rem;">No se encontraron productos.</p>`;
    return;
  }

  productos.slice(desde, limiteVisible).forEach((prod) => {
    const card = document.createElement("div");
    card.className = "producto-card";

    const imagenSrc =
      prod.imagen_url ||
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?q=80&w=300&auto=format&fit=crop";

    const camposOmitidos = [
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
    ];

    let variantsHtml = "";
    for (const [key, value] of Object.entries(prod)) {
      if (!camposOmitidos.includes(key) && value && value.trim() !== "") {
        let nombreCampo = key.replace(/_/g, " ");
        nombreCampo =
          nombreCampo.charAt(0).toUpperCase() + nombreCampo.slice(1);

        if (value.includes(",")) {
          let opciones = value.split(",").map((opt) => opt.trim());
          let optionsHtml = opciones
            .map((opt) => `<option value="${opt}">${opt}</option>`)
            .join("");
          variantsHtml += `
            <div class="variant-group">
                <label>${nombreCampo}:</label>
                <select class="variant-select" id="card-select-${prod.id}-${key}">
                    ${optionsHtml}
                </select>
            </div>
          `;
        } else {
          variantsHtml += `
            <div class="variant-group">
                <label>${nombreCampo}:</label>
                <div style="padding: 0.55rem 0.75rem; background: rgba(11, 26, 19, 0.9); border: 1px solid var(--border-glass); border-radius: 16px; font-size: 0.9rem; color: var(--text-main);">
                    ${value}
                </div>
            </div>
          `;
        }
      }
    }

    // Lógica para mostrar precio normal o con descuento en la tarjeta del catálogo
    const precioBase = parseFloat(prod.precio) || 0;
    const precioDesc = prod.precio_descuento
      ? parseFloat(prod.precio_descuento)
      : null;
    let precioHtml = `<span class="card-price">$${precioBase.toFixed(2)}</span>`;

    if (precioDesc && !isNaN(precioDesc) && precioDesc > 0) {
      precioHtml = `
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span class="precio-original">$${precioBase.toFixed(2)}</span>
            <span class="card-price" style="color: #34d399;">$${precioDesc.toFixed(2)}</span>
        </div>
      `;
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
        </div>
    `;

    card.querySelector(".btn-details-link").addEventListener("click", () => {
      verDetallesProducto(prod.id);
    });

    contenedor.appendChild(card);
  });

  // Botón "Ver más" si todavía quedan productos por mostrar
  const restantes = productos.length - limiteVisible;
  if (restantes > 0) {
    const cont = document.createElement("div");
    cont.className = "ver-mas-container";
    cont.innerHTML = `<button class="btn-ver-mas" onclick="verMasProductos()">Ver más productos <span>(${restantes} restantes)</span></button>`;
    contenedor.appendChild(cont);
  }
}

/**
 * --------------------------------------------------------------------------
 * INICIALIZACIÓN AUTOMÁTICA
 * DESCRIPCIÓN: Carga el catálogo en cuanto el DOM esté completamente listo.
 * --------------------------------------------------------------------------
 */
document.addEventListener("DOMContentLoaded", () => {
  cargarCatalogo();
});
