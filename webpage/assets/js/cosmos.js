// The lazy composer embed and the mobile nav.
// Ported from the design reference; unminified so it can be maintained here.

// --- Composer embed ---------------------------------------------------------
// The composer is a React bundle served from this origin at /composer. It is
// only loaded when someone actually asks for it, so the page costs nothing
// extra to everyone who does not - which matters here, because the bundle is
// two orders of magnitude larger than this script.
const stage = document.querySelector(".cm-cstage");
const playButton = stage?.querySelector(".cm-cplay");
const embedUrl = stage?.dataset.embed;

if (stage && playButton && embedUrl) {
  playButton.addEventListener(
    "click",
    () => {
      const frame = document.createElement("iframe");
      frame.className = "cm-cframe";
      frame.src = embedUrl;
      frame.title = "RPP Composer";
      frame.loading = "lazy";
      // The composer's export bar writes the config to the clipboard.
      frame.setAttribute("allow", "clipboard-write");

      stage.textContent = "";
      stage.appendChild(frame);
      stage.classList.add("is-live");
    },
    { once: true },
  );
}

// --- Mobile nav -------------------------------------------------------------
// The panel is a <details>; close it once a link inside has been followed.
const mobileNav = document.querySelector(".cm-mnav");
mobileNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => mobileNav.removeAttribute("open"));
});
