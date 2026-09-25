# Indian Dance Studio

A lightweight, responsive dance-game experience built with HTML5, CSS3, and vanilla JavaScript. Choose a dancer, select a style, and play an animated studio scene with optional local music.

**Developer:** Aniket Kumar

## Run locally

Open `index.html` directly in a browser, or serve the folder with any static server. For example, from the project directory:

```text
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Structure

```text
index.html
css/style.css
js/app.js
assets/characters/character1.png
assets/characters/character2.png
assets/characters/character3.png
assets/music/character1.mp3
assets/music/character2.mp3
assets/music/character3.mp3
```

Character images and music are optional. Add images using the exact paths above and refresh; the app automatically uses each available image and keeps a built-in dancer for anything missing. Add only music you have permission to use. Missing tracks leave the app in silent mode without affecting the animation.

A loaded track begins at 0 seconds and is stopped and reset after approximately 50 seconds. Short tracks are handled by the browser. Audio only starts after the user presses Play Dance.

## Controls

Play, pause, stop, reset, previous/next character, music on/off, volume, fullscreen, and the four styles: Bollywood, Classical, Bhangra, and Garba. Keyboard shortcuts: `Space` play/pause, `Left/Right` previous/next, `1`-`3` select a character, `F` fullscreen, `M` music, and `R` reset.

Character, style, volume, and music settings use local storage when available. The layout supports desktop, tablet, and mobile screens without horizontal scrolling.

## GitHub Pages

1. Create or use a repository named `indian-dance-studio`.
2. Push the contents of this folder to the repository's default branch.
3. In repository **Settings > Pages**, choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
4. Wait for the Pages workflow to finish and open the URL shown by GitHub.
