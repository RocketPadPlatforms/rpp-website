// The DOM itself is provided by vitest's `happy-dom` environment (see the
// composer project in vitest.config.mts). Under Bun this file also had to call
// GlobalRegistrator.register() by hand; vitest sets the globals up before this
// setup file runs, so only the clipboard patch is left.

// Make navigator.clipboard assignable so tests can mock it via Object.assign.
// happy-dom defines clipboard as a getter-only on the prototype; re-define
// it on the instance as a writable/configurable data property.
Object.defineProperty(navigator, "clipboard", {
  value: navigator.clipboard ?? {},
  writable: true,
  configurable: true,
});
