# HAMOS Make It Meme — Multiplayer development package

This updates the HAMOS game with a stage-style visual presentation, real WebSocket rooms, template-specific caption positions and an optional third caption. **It has not been deployed or verified with two live devices yet.** No changes were made to your existing Netlify site or Hamos Drift Boss.

## What is working in source code

- Rooms for 2–12 real connections; 6-character invitation codes; invite links; no required user account.
- Same Meme, Classic and Quick Fire. Ready states, host starts, automatic caption deadlines, anonymous voting, real server-stored votes, scores, recaps and rematches.
- Server-authoritative rules: no self-vote, duplicate-vote prevention, server-side score calculation and time limits. The score **formula isn't displayed in the game**.
- Each selected meme has pre-defined caption zones. Recognized templates such as Distracted Boyfriend and Two Buttons receive three fields; Drake receives two; certain reaction images receive one. Other templates receive top/bottom. Text fits the image and changes in the existing DOM, without recreating the image on every keypress.
- Staged championship: suspense, third-place reveal, second-place reveal, then champion + podium. Skip option and downloadable text-based victory PNG. The victory card doesn't yet embed third-party meme images (image CORS/usage rights restrictions).
- Mobile-responsive game screens and a separate HTML/CSS/JS frontend hosted from the same Node backend locally.

## Try locally

1. Install Node.js version 20 or newer, e.g. from https://nodejs.org/.
2. Extract the ZIP. Open a terminal in the extracted **hamos-make-it-meme-multiplayer** folder.
3. Run `npm install` and then `npm start`.
4. Go to **http://localhost:8787** in Chrome. Create a room.
5. In another browser or device on your home Wi-Fi, join the room with its code. For another device, open `http://YOUR_COMPUTER_LOCAL_IP:8787` and add that exact origin to `ALLOWED_ORIGINS` before running the server. You may have to permit port 8787 through your Windows firewall. For easier external multi-device testing, deploy first.
6. Test a full round with at least two independently connected players. The second player must click READY; the host clicks START.
7. Run `npm test` for the automated rules tests.

## Publishing: Render backend + Netlify website

**Don't deploy this over the existing Hamos Drift Boss site. Create a separate project/site.**

1. Create a **new GitHub repository** (for example `hamos-make-it-meme`) and upload the **contents of this folder** to the repository root. Keep `public/`, `server/`, `tests/`, `package.json`, `netlify.toml` and `render.yaml` together. Don't upload only the ZIP archive as a GitHub file.
2. On https://app.netlify.com, choose **Add new project → Import an existing project → GitHub**, select this repository. Set **publish directory `public`** and use **build command `echo Static client ready`**. Use an available unique site name. Deploy the initial frontend.
3. Copy the exact new Netlify site URL, e.g. `https://YOUR-SITE.netlify.app`.
4. On https://dashboard.render.com, create a new **Web Service** from the **same GitHub repository**. Use **Node**, build command `npm install`, start command `npm start`, and the repository root as the root directory. Pick a plan; plans and any free-tier availability may vary.
5. In the Render service's **Environment** tab, add `ALLOWED_ORIGINS=https://YOUR-SITE.netlify.app` (replace with the actual Netlify URL, no trailing slash). Deploy, then visit `https://YOUR-RENDER-SERVICE.onrender.com/api/health`. It should show `"ok":true`.
6. Edit **`public/config.js`** in your GitHub repository to read:

   `window.HAMOS_BACKEND_URL = 'https://YOUR-RENDER-SERVICE.onrender.com';`

   Replace with the actual Render URL and commit the change. Netlify should redeploy automatically.
7. Open your Netlify URL, create a room from one device, then join using the shared URL on a second device (ideally with a different internet connection). Have both submit and vote through a complete game, and test a rematch.
8. If connection fails, check exact origin and secure WebSocket `wss://`, Render service health, logs, browser console and Netlify's latest deployment. Avoid calling the release complete until those checks pass.

**Notes:** The server stores rooms in RAM. A server restart loses games. Some low-cost hosts sleep while idle, interrupting WebSockets; choose hosting appropriate for persistent real-time play. Images depend on external Imgflip availability and require source/rights review before broad public release. This package is not yet a curated or verified 1,000-meme collection. Server API `/api/templates` returns the current feed count, not the number of licensed or independently verified images.

## Test evidence

- `node --check public/game.js`: pass.
- `node --check server/index.js`: pass.
- `node --test tests/*.test.js`: 8/8 pass.
- `npm install` in this environment: blocked by npm registry DNS (`EAI_AGAIN`). No browser-to-server multiplayer playthrough has been verified here.

## What still requires work

- Production deployment and 2+ live-client tests; reliable persistent hosting and monitoring.
- Curated, legally cleared meme collection and current trends verification. Live library size is dynamic and not claimed as independently verified.
- Content reporting, profanity/spam moderation, user blocking and other public-game safety measures.
- Visual checks on real phones, accessibility testing and image/CORS permissions for exporting winning memes.
