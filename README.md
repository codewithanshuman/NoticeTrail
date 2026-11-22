# NoticeTrail 2.0

NoticeTrail connects notices, source evidence, document versions, and personal actions in one workspace. A deterministic SVG world, connection graph, time machine, and action journey display the same facts and share selection.

## Use your own notices

1. Choose **Open your notice** and paste text or attach a TXT file.
2. Choose **Build workspace** for hybrid AI extraction, or **Open text without AI** to select passages yourself.
3. Select an object, inspect its supporting words, and save a useful step to **My journey**.
4. Choose **Save on device** to persist the workspace and subsequent changes in IndexedDB.
5. Add a revised notice and inspect it in **Time machine**.
6. Review affected saved steps. Accept a matched update, explicitly choose its revised source, or keep the original for later review.
7. Confirm a full date, including year, before exporting open steps to your calendar.

The optional garden example uses two fictional, prewritten notices. It is labeled throughout and remains separate from live AI output.

## Data and privacy

Each fact includes its kind, source quote, evidence status, obligation type, and original date wording when present. Relationships carry their own evidence. Text matching verifies that words occur in the notice; the reader must still check their interpretation. Screenshot-derived facts remain marked for review.

Unchanged facts retain identities. Wording changes that cannot be matched confidently require manual source matching. Accepted revisions preserve task identity and completion, and clear the previous confirmed date. Steps awaiting review are excluded from calendar export.

Workspaces start in memory. **Save on device** enables local persistence, including source text, images, versions, tasks, and review history. Delete workspace removes that complete record. Earlier standalone tasks remain available independently. Export workspace downloads a JSON copy.

Automatic inference tries the device and may send notice content and questions to cloud AI. Device-only requests stop if local inference is unavailable. Firebase credentials and App Check configuration are still needed to test the live integration in this project.

Supported inputs are text, TXT up to 30 KB and 12,000 characters, and PNG/JPEG up to 8 MB. The graph is bounded to 24 objects with paginated rendering. PDF extraction is a future extension.

## Run locally

1. Install Node.js 22.12 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Create a Firebase project and a web app. In **AI Services → AI Logic**, select the Gemini Developer API and complete its setup. Check **Security → App Check → APIs** and confirm enforcement for Firebase AI Logic.
5. Copy the Firebase web configuration values into `.env`.
6. Register the web app with **App Check using reCAPTCHA Enterprise**. Put its site key in `VITE_APPCHECK_SITE_KEY`.
7. For localhost only, set `VITE_APPCHECK_DEBUG=true`. Run `npm run dev`, open the site, find the App Check debug token in the Chrome DevTools console, and register that token under **App Check → Apps → Manage debug tokens**. Never commit the token or enable debug mode in a production build.
8. Use Chrome desktop 139+ with `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` enabled for local inference. The model may need to download. Automatic mode can use the cloud while it downloads. Device-only mode waits for it.
9. Run `npm run dev` and open the printed local URL. Run `npm run build` for a production build.

## Host on Firebase Hosting

Firebase Hosting is the recommended host for this static Vite app. The repository includes `firebase.json` with `dist` as the public directory, a single-page-app rewrite, and a non-cached service worker. After you create the Firebase project and configure production App Check:

1. Copy `.env.example` to `.env` and fill in the Firebase web config and production reCAPTCHA Enterprise site key. Keep `VITE_APPCHECK_DEBUG=false`.
2. Run `npm ci` and `npm run build`.
3. Install or run the Firebase CLI, sign in, and associate this directory with your Firebase project (`firebase use --add`).
4. Run `firebase deploy --only hosting`.
5. Register the deployed `web.app` domain with your App Check provider and verify a real AI request on the hosted site.

The Vite `VITE_*` values are compiled into the browser bundle. Firebase web configuration is public app configuration, but never publish an App Check **debug token**. Do not deploy the prewritten sample as if it were live AI. [Firebase Hosting guide](https://firebase.google.com/docs/hosting) · [App Check guide](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)

Firebase setup: [web hybrid guide](https://firebase.google.com/docs/ai-logic/hybrid/web/get-started) · [App Check](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) · [hybrid structured output](https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output)

## Development checks

Run npm test for evidence, extraction, and revision regression cases. Run npm run build for TypeScript, the production bundle, and the generated offline cache manifest. Browser operations still depend on their required AI and App Check services being ready.

The main shell is src/App.tsx. Shared models are in src/domain.ts, extraction validation in src/factValidation.ts, revision logic in src/trailEngine.ts, and persistence in src/workspaceStore.ts. src/WorldView.tsx renders the interactive world. Legacy task storage remains accessible through the earlier planner.

Built with React, TypeScript, Vite, Firebase AI Logic, Lucide, and jsdiff. Fonts are DM Sans and Instrument Serif with system fallbacks. The app mark is original. Application code and fictional sample notices are included under the MIT license.
