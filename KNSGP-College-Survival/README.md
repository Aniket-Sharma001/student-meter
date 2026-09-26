# K.N.S GP Samastipur - College Survival Simulator

A funny, offline-friendly 20-day college survival browser game built with plain HTML, CSS, and JavaScript.

## Project files

Keep these files together in the same folder:

- `index.html` - game markup and screen structure
- `style.css` - visual styling and responsive layout
- `script.js` - events, choices, stats, saving, and game logic
- `favicon.svg` - local browser tab icon

There are no npm packages, frameworks, backend services, databases, external APIs, remote fonts, or external media files.

## Test locally

Double-click `index.html` or open it in Chrome or Edge. The game is designed to work from a `file://` URL. A local web server is not required for playing or sharing the project folder.

## Publish with GitHub Pages

### 1. Create a GitHub repository

1. Sign in to [GitHub](https://github.com/).
2. Select **New repository**.
3. Name it `KNSGP-College-Survival`.
4. Choose **Public** so classmates can open the game.
5. Create the repository without adding another README or `.gitignore`.

### 2. Upload the project files

1. Open the new repository.
2. Select **Add file** and then **Upload files**.
3. Upload `index.html`, `style.css`, `script.js`, `favicon.svg`, and this `README.md` from this folder.
4. Select **Commit changes**.

The files must be at the repository root. In particular, `index.html`, `style.css`, and `script.js` must not be placed inside another nested folder.

### 3. Enable GitHub Pages

1. Open the repository's **Settings**.
2. Select **Pages** in the left sidebar.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Select the `main` branch and the `/ (root)` folder.
5. Select **Save**.
6. Wait for GitHub to finish deploying. This usually takes a short time.

### 4. Share the public URL

Use this URL, replacing `YOUR-USERNAME` with the GitHub username that owns the repository:

`https://YOUR-USERNAME.github.io/KNSGP-College-Survival/`

For example, if the GitHub username is `aniketkumar`, the URL is:

`https://aniketkumar.github.io/KNSGP-College-Survival/`

GitHub will also display the exact live URL in **Settings > Pages**.

## Deployment and data notes

All references in the game use relative paths, so the same files work from GitHub Pages, a downloaded folder, or a ZIP archive. There are no localhost URLs or absolute computer paths.

The game uses browser `localStorage` only for the individual player's name and game progress. That data stays in the player's own browser and is not sent to GitHub, a server, or a database. Each student gets a separate local save on their own device/browser.

The game has no client-side routes, so refreshing the main URL does not require a server rewrite. GitHub Pages serves `index.html` directly at the project URL.

## Mobile check

The layout is responsive and can be played from a phone browser. After publishing, open the public URL on a phone and refresh once to confirm the browser has loaded the newest deployment.
