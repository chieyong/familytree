# Desktop-app (Tauri) — offline, lokaal, single-user

De offline desktop-versie hergebruikt **dezelfde React-frontend** als de web-app,
maar met een lokale datalaag (geen Supabase, geen netwerk). De data blijft op de
pc van de gebruiker.

De web-/Supabase-versie blijft ongewijzigd: de frontend detecteert of hij binnen
Tauri draait (`__TAURI_INTERNALS__`) en schakelt dan naar de `local`-backend.
Dezelfde build werkt dus als web-app in de browser én als desktop-app.

## Status per fase

- **Fase 1 (nu, deze branch):** Tauri-scaffold + backend-schakelaar. `LocalRepository`
  is nog een **placeholder** die de demo-familie teruggeeft (bewijs dat de schil +
  schakelaar werken). Nog geen echte lokale opslag/writes.
- **Fase 2:** SQLite (`tauri-plugin-sql`) + client-side `_build_graph` + persistente writes.
- **Fase 3:** multi-user-UI verbergen in lokale modus (delen/rollen/bruggen/voorstellen/"Bekijk als").
- **Fase 4:** foto's lokaal, JSON-backup/herstel, installers + downloadknop in de web-app.

## Lokaal draaien (dit kan niet in de CI-sandbox — doe dit op je eigen pc)

**Eenmalig — vereisten:**

1. **Rust** installeren: https://www.rust-lang.org/tools/install
2. Platform-afhankelijke webview-libs:
   - **Windows:** WebView2 (meestal al aanwezig op Win10/11).
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`).
   - **Linux:** `webkit2gtk` + build-essentials (zie Tauri-docs).
3. In `familieboom/`: `npm install` (haalt o.a. `@tauri-apps/cli` op).
4. **Icons genereren** (nodig vóór de eerste build) uit een vierkante PNG:
   ```bash
   npm run tauri icon pad/naar/logo.png
   ```
   Dit vult `src-tauri/icons/` met alle vereiste formaten.

**Ontwikkelen:**
```bash
npm run tauri:dev
```
Opent een desktop-venster met de app in `local`-modus (Vite draait eronder).

**Installer bouwen:**
```bash
npm run tauri:build
```
De installer verschijnt in `src-tauri/target/release/bundle/…` (`.msi`/`.exe` op
Windows, `.dmg` op macOS, `.deb`/`.AppImage` op Linux).

## Testen zonder Tauri

De lokale modus is ook in een gewone browser te bekijken met `?backend=local`
(gebruikt dezelfde `LocalRepository`). Handig om de UI-aanpassingen (fase 3) te
bouwen zonder telkens Rust te compileren.

## Let op

- Deze scaffold is **niet in de sandbox gebouwd/getest** — verifieer lokaal met
  `npm run tauri:dev`. Config: `src-tauri/tauri.conf.json` (Tauri v2).
- Offline werkt **geocoding** (Atlas-plaatsen opzoeken via Nominatim) niet;
  bestaande plaatsen blijven wel werken.
- Beveiliging verschuift naar het apparaat: schijfversleuteling (BitLocker/FileVault)
  en back-ups zijn dan de verantwoordelijkheid van de gebruiker.
