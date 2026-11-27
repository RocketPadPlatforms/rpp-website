# Website app

The Express server, the Handlebars views and the composer SPA. The repository
README (`../README.md`) covers the architecture, development setup, checks and
deployment; this file collects notes that only matter when working in here.

## Temporarily disabled features

These were switched off deliberately and are meant to come back. Each entry lists
every place that has to change to turn it back on.

### Compose from description (composer)

The composer drawer used to offer a free-text "Description" field next to the
"Paste JSON" field, and the landing page advertised it. **Note:** the field was
never wired to anything — `handleCompose` only cleared it, and no backend ever
read it. Restoring the markup alone gives you a textarea that does nothing, so
plan to build the natural-language → config step at the same time.

To reactivate:

1. **`client/composer/ui/ComposeDrawer.tsx`** — the `TODO` comment marks the
   removal point, just above the "Paste JSON" `<label>`. Restore the state hook
   and the textarea, and clear it on a successful compose:

   ```tsx
   // with the other useState calls
   const [description, setDescription] = useState("");

   // in handleCompose(), next to setJsonInput("")
   setDescription("");

   // replacing the TODO comment
   <label className="block space-y-1">
     <span className="text-xs font-semibold" style={{ color: RPP.textDim }}>
       Description
     </span>
     <textarea
       aria-label="Description"
       value={description}
       onChange={(e) => setDescription(e.target.value)}
       rows={4}
       placeholder="e.g. Small Node backend with Postgres and Redis on GCP"
       className="w-full rounded p-2 text-xs"
       style={{
         background: RPP.bg,
         color: RPP.textPrimary,
         border: `1px solid ${RPP.border}`,
         fontFamily: FONTS.body,
       }}
     />
   </label>
   ```

   Then point `FRAMING_COPY` back at the description again — it currently only
   describes presets and JSON import:

   ```
   Optionally you can describe your current goals, infrastructure or how do you
   envision your future platform so we can tailor it according to your needs.
   ```

2. **`client/composer/ui/App.tsx`** — change the header button label back from
   `Presets & import` to `Compose from description`.

3. **`views/index.hbs`** — in the `#modules` section, uncomment the `cm-hook`
   line. It sits in a `{{!-- ... --}}` block right after the `<h2>`. Its text
   now has to come from the locale files: add `home.modules.hook` to both
   `src/locales/en.json` ("or describe it in plain words — the composer builds
   it for you") and `src/locales/de.json`, and render it with
   `{{t "home.modules.hook"}}`.

4. **`client/composer/ui/ComposeDrawer.test.tsx`** — delete the
   `does not render the description textarea` test, and put the description
   assertions back in `renders framing copy and inputs when open`:

   ```tsx
   expect(
     screen.getByText(/Optionally you can describe your current goals/i),
   ).toBeTruthy();
   expect(screen.getByLabelText(/description/i)).toBeTruthy();
   ```

Then run `npm run typecheck && npm run lint && npm test`.
