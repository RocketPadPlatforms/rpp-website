// Reveal-on-scroll, the lazy composer embed, and the mobile nav.
// Ported from the design reference; unminified so it can be maintained here.

// --- Reveal on scroll -------------------------------------------------------
// Anything marked .reveal starts hidden (see cosmos.css) and fades in once.
// Readers who ask for reduced motion, and browsers without IntersectionObserver,
// get the finished state immediately rather than an empty page.
const revealTargets = Array.from(document.querySelectorAll(".cm-root .reveal"));
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

if (prefersReducedMotion || !("IntersectionObserver" in window)) {
  revealTargets.forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
} else {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const el = entry.target;
        el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        el.style.opacity = "1";
        el.style.transform = "none";
        obs.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );

  revealTargets.forEach((el) => observer.observe(el));
}

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
