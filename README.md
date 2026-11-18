# NoticeTrail

NoticeTrail turns dense everyday notices into plain-language action plans. It can also compare an original notice with an update to reveal changed dates, locations, and requirements. It is an installable Chrome web app built for the **#BuildHybridAI 2026** hackathon.

## Why hybrid AI fits

Many notices contain personal details, and users may have limited connectivity. NoticeTrail uses the Firebase AI Logic Hybrid Inference SDK in `PREFER_ON_DEVICE` mode to try Gemini Nano locally, then use Gemini in the cloud when the local model is unavailable. The **Device only** choice uses `ONLY_ON_DEVICE`; it never sends the notice to cloud AI. The app displays `response.inferenceSource` after every live response so the user can see what actually happened. The text and image inputs use Firebase AI Logic at runtime in [`src/firebase.ts`](src/firebase.ts). There is no separate AI API key in client code.

The starter includes a **clearly labeled, prewritten sample** so the interface can be explored before Firebase is connected. This is not a simulated AI response. Live inference needs your own Firebase project and App Check configuration.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
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

## Product behavior

- Paste text, add a TXT file (up to 12,000 characters), or add a PNG/JPEG screenshot up to 8 MB.
- Structured output captures a summary, actions, dates, and unanswered questions.
- Each action and date includes an excerpt from the source notice for review. For pasted text, the app filters out action and date items whose quoted evidence does not occur in the input.
- Compare two pasted text notices and receive changed, added, or removed items with evidence from both versions. Unsupported comparisons are filtered out in the browser.
- Check off steps in the current session, copy the brief, or download it as a TXT file.
- Once visited in a production build, the app shell is cached for offline reload. Local AI inference still depends on Chrome's on-device model and any Firebase App Check requirements being ready.
- Input and results stay in browser memory; NoticeTrail does not save them or send them to its own server. Automatic mode **can** send notice content to the Gemini cloud model through Firebase AI Logic.
- The model is instructed to avoid invented dates and actions, but results still need human review.

## Limits and next build targets

- Chrome's on-device Prompt API currently needs a supported desktop Chrome version, flags, and enough storage. On-device inference is single-turn text or text-and-image; this app uses exactly those capabilities.
- Firebase credentials and an App Check site key are needed to verify live inference. They are intentionally absent from this repository.
- Next: connect a Firebase project and capture both inference paths in a demo; validate the live flow on a compatible Chrome desktop; port the brief schema and design to Android or iOS for a stronger multi-platform submission.
- A hackathon submission also needs a public GitHub/GitLab repository, hosted app, English demo video (at most 3 minutes), and Devpost description.

## Contest project scope

Created during the 2026 contest period. All application code and visual design in this repository were created for this project. Standard dependencies are Firebase, React, Vite, TypeScript, Lucide, and Inter via Google Fonts. The sample notices are fictional. This project is licensed under MIT. The visual palette uses Firebase's published yellow, orange, and red colors. Its app mark is original and is not the Firebase logo or an endorsement claim; see the [Firebase brand guidelines](https://firebase.google.com/brand-guidelines).

## Submission preparation

- [`docs/DEMO.md`](docs/DEMO.md) is a short video shot list. Capture live inference only after verifying the Firebase project.
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) contains a Devpost description draft and remaining submission tasks.
