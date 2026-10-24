// Filtro interactivo de la galería de demos
function filtrarDemos(categoria) {
  const botones = document.querySelectorAll(".filter-btn");
  botones.forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  const tarjetas = document.querySelectorAll(".demo-card");
  tarjetas.forEach((tarjeta) => {
    if (
      categoria === "todos" ||
      tarjeta.getAttribute("data-categoria") === categoria
    ) {
      tarjeta.style.display = "flex";
    } else {
      tarjeta.style.display = "none";
    }
  });
}
