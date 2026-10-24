// El texto de cada tarjeta muestra el nombre del HTML al que redirige
document.querySelectorAll(".demo-card").forEach((tarjeta) => {
  tarjeta.querySelector(".demo-title").textContent = tarjeta
    .getAttribute("href")
    .split("/")
    .pop();
});
