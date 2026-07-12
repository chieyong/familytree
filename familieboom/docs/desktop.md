# Desktop-app (Tauri) — offline, lokaal, single-user

De offline desktop-versie hergebruikt **dezelfde React-frontend** als de web-app,
maar met een lokale datalaag (geen Supabase, geen netwerk). De data blijft op de
pc van de gebruiker.

De web-/Supabase-versie blijft ongewijzigd: de frontend detecteert of hij binnen
Tauri draait (`__TAURI_INTERNALS__`) en schakelt dan naar de `local`-backend.
Dezelfde build werkt dus als web-app in de browser én als desktop-app.

## Status per fase

- **Fase 1 ✅:** Tauri-scaffold + backend-schakelaar (`__TAURI_INTERNALS__` /
  `?backend=local` → `local`).
- **Fase 2 ✅:** lokale datalaag. **Engineering-keuze: JSON-documentopslag i.p.v.
  SQLite** — een familieboom is kleine data, single-user, geen RLS; de `FamilyGraph`
  is meteen het opslagformaat én de back-up. `LocalStore` (`src/data/local/store.ts`)
  houdt de graaf in geheugen, persisteert naar **localStorage** (werkt in de browser
  én de Tauri-webview), en spiegelt de schrijf-operaties uit `mutations.ts`. Die
  dispatchen in lokale modus naar de store. Getest met unit-tests; te proberen in de
  browser met `?backend=local`. Een echt bestand op schijf (Tauri fs) is later een
  swap achter `SnapshotStore`.
- **Fase 3 ✅:** lokale modus is bewerkbaar. Een synthetische "eigen boom"
  (`activeFamily = {id:'local', …}`) laat de bewerk-UI werken; `canEdit`/`isOwner`
  zijn geforceerd. De multi-user-UI is verborgen in lokale modus: familie-menu,
  inloggen (AuthBar), delen (ShareFamily), "Bekijk als" (ViewAsControl), bruggen,
  "dit ben ik", en de foto-UI (foto's komen in fase 4). Te proberen in de browser
  met `?backend=local` — bewerkingen persisteren in localStorage.
- **Fase 4 (grotendeels ✅):** foto's lokaal (data-URL in de graaf), JSON-back-up/
  herstel en "nieuwe boom" (begint met alleen jezelf) — in het ⚙-menu in lokale
  modus. **Nog te doen (laatste mijl, vereist lokale Tauri-build):** de installers
  bouwen (`npm run tauri:build`) + hosten, en een downloadknop in de web-app.

> **Let op — foto-opslag.** Lokale foto's staan als data-URL in dezelfde JSON in
> localStorage (limiet ~5–10 MB). Prima voor een handvol foto's; bij veel/grote
> foto's is IndexedDB of Tauri-fs-opslag een latere verbetering.

## Lokaal draaien (dit kan niet in de CI-sandbox — doe dit op je eigen pc)

**Eenmalig — vereisten:**

1. **Rust** installeren: https://www.rust-lang.org/tools/install
2. Platform-afhankelijke webview-libs:
   - **Windows:** WebView2 (meestal al aanwezig op Win10/11).
   - **macOS:** Xcode Command Line Tools (`xcode-select --install`).
   - **Linux:** `webkit2gtk` + build-essentials (zie Tauri-docs).
3. In `familieboom/`: `npm install` (haalt o.a. `@tauri-apps/cli` op).
4. **Icons genereren** (nodig vóór de eerste build) uit de Bloom-logo (dezelfde
   als de PWA):
   ```bash
   npm run tauri icon public/pwa-512.png
   ```
   Dit vult `src-tauri/icons/` met alle vereiste formaten. (Een eigen logo kan ook —
   geef dan dat pad mee; vierkante PNG, bij voorkeur ≥1024×1024.)

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
