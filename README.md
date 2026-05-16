# REACH Web

Static web version of REACH. No build step is required.

## Local Preview

From this folder:

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8766/index.html
```

Design preview mode works only on localhost:

```text
http://127.0.0.1:8766/index.html?preview=1#chats
```

## Before Publishing

Set the Android APK download link in `js/api.js`:

```js
const APK_DRIVE_URL = "YOUR_APK_DOWNLOAD_LINK";
```

## Deploy Options

GitHub Pages:

1. Create a GitHub repo named `reach-web`.
2. Upload the contents of this folder.
3. In GitHub: Settings -> Pages -> Deploy from branch -> `main` / root.

Netlify:

1. Drag this folder into Netlify Deploys, or connect the repo.
2. Publish directory is `.`.

