# Filigrane

Application web pour ajouter un filigrane aux pièces d'un dossier de location (avis d'imposition,
fiches de paie, pièce d'identité, RIB, bilans…) avant de les envoyer à un bailleur.

**Tout se passe dans le navigateur.** Aucun fichier n'est envoyé, aucune API externe, aucun stockage distant.

## Prérequis

- Node.js 20.9 ou plus récent (testé avec Node 26)
- npm

## Installation et lancement en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000.

`npm install` copie aussi les ressources de pdf.js (worker, wasm, polices, cmaps) dans `public/pdfjs/`,
pour qu'elles soient servies par l'application elle-même et jamais par un CDN.

## Build de production (site 100 % statique)

```bash
npm run build
npm run preview
```

`npm run build` produit un site statique dans `out/` (HTML, JS, CSS : aucun code serveur).
`npm run preview` le sert sur http://localhost:3000. Le dossier `out/` peut être déposé sur n'importe
quel hébergement de fichiers statiques.

## Tests

```bash
npm test
npx playwright install chromium
npm run test:e2e
```

- `npm test` : tests unitaires (variables, géométrie de la mosaïque, mots de passe, noms de fichiers).
- `npm run test:e2e` : build de production puis scénario complet dans Chromium, sur des fichiers générés :
  un PDF de 4 pages (portrait, paysage, page tournée, page au contenu mal formé), une photo JPG, un scan PNG,
  un PDF protégé, des PDF corrompus, un `.txt` et un fichier de 51 Mo. Le test vérifie notamment :
  les messages d'erreur, l'aperçu en direct, le ZIP, le chiffrement (le PDF refuse de s'ouvrir sans le mot
  de passe), l'absence de texte extractible après aplatissement, la suppression des métadonnées,
  la présence du filigrane sur chaque page en mode vectoriel, l'exécution dans le Web Worker, le contenu
  du localStorage, et qu'aucune requête ne part vers un autre domaine.

Les fichiers produits sont enregistrés dans `test-results/outputs/` pour inspection.

Autres commandes : `npm run lint`, `npm run typecheck`.

## Fonctionnement

| Étape | Où | Outil |
| --- | --- | --- |
| Import, détection du format (signature binaire), validation | thread principal | pdf.js |
| Image → PDF A4 (orientation EXIF appliquée, métadonnées EXIF/GPS supprimées) | thread principal + worker | canvas, pdf-lib |
| Aperçu de la 1re page + filigrane en direct | thread principal | pdf.js, canvas |
| Aplatissement : rendu de chaque page à 150/200/300 dpi, filigrane incrusté, JPEG | thread principal, une page à la fois (l'interface reste réactive) | pdf.js, canvas |
| Assemblage du PDF, filigrane vectoriel, suppression des métadonnées, chiffrement | **Web Worker** | @cantoo/pdf-lib |
| ZIP | thread principal | fflate |

Le même calcul de mosaïque (`src/lib/layout.ts`) sert à l'aperçu, à l'aplatissement et au mode vectoriel :
l'aperçu correspond donc au résultat.

### Choix techniques

- **@cantoo/pdf-lib** plutôt que `pdf-lib` : fork compatible qui sait chiffrer (AES-256). Les PDF protégés
  s'ouvrent avec le mot de passe ; modification et copie sont interdites (un mot de passe propriétaire
  aléatoire est généré puis oublié).
- **Bundler webpack** (`next dev --webpack`, `next build --webpack`) : avec Turbopack (Next 16.3), le
  `new Worker(new URL(...))` était copié tel quel en fichier `.ts` au lieu d'être compilé, ce qui cassait
  le worker en production. Webpack le compile correctement (vérifié par le test E2E).
- **Content-Security-Policy** (`src/app/layout.tsx`) : le navigateur bloque toute connexion vers un autre
  domaine (`connect-src 'self'`). Même un bug ou une dépendance compromise ne pourrait pas exfiltrer
  un document.
- **localStorage** : ne contient que les réglages de « Mon modèle » (texte du modèle, angle, opacité,
  taille, couleur, densité, aplatissement, résolution). Jamais les documents, ni le destinataire ou l'objet
  saisis, ni le mot de passe.

## Limites à connaître

- **Aplatir** rend le filigrane impossible à retirer avec un éditeur PDF, mais le texte n'est plus
  sélectionnable et le fichier est plus lourd (surtout à 300 dpi).
- **Sans aplatissement**, le filigrane est un calque de texte : un outil PDF avancé peut le supprimer.
- Un PDF protégé par mot de passe à l'ouverture est refusé : enregistrez d'abord une copie non protégée.
  Un PDF avec de simples restrictions (sans mot de passe d'ouverture) n'est traité qu'en mode aplati.
- Le filigrane vectoriel utilise Helvetica : les caractères hors alphabet latin (emoji…) sont remplacés par `?`.
- Taille maximale : 50 Mo par fichier. Tout reste en mémoire le temps de la session.

## Structure

```
src/
  app/                    page unique, layout (CSP), styles
  components/             interface (dépôt, liste, aperçu, réglages, progression)
  lib/
    layout.ts             géométrie de la mosaïque (partagée)
    template.ts           variables {date}, {destinataire}, {objet}
    pdf-build.ts          assemblage, filigrane vectoriel, métadonnées, chiffrement
    process.ts            orchestration aplati / vectoriel
    file-import.ts        détection de format, conversion d'images, validation
    pdf-worker-client.ts  communication avec le Web Worker (repli si indisponible)
  workers/pdf.worker.ts
scripts/                  copie des ressources pdf.js, mini serveur statique
tests/                    tests end-to-end Playwright
```
