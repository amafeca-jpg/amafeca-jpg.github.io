document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".miembro-card img").forEach((img) => {
    img.addEventListener("click", () => {
      img.parentElement.classList.toggle("activa");
    });
  });
});
