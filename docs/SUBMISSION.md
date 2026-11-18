# Devpost submission draft

## One-line pitch

NoticeTrail turns dense notices into clear next steps and compares updates, with a visible choice between private on-device AI and hybrid cloud fallback.

## What it does

People receive school, community, and workplace notices that bury important details in long paragraphs. NoticeTrail accepts pasted text, a TXT file, or a screenshot and creates a short summary, action checklist, key dates, and questions to ask. Its comparison workflow reads an original and an updated notice, then flags changed, added, and removed requirements with excerpts from both. For pasted text, the app drops items whose quoted evidence does not match the input. Users can check off steps and export results.

## How it uses Firebase AI Logic

The Chrome web app imports and calls Firebase AI Logic directly in `src/firebase.ts` for both briefing and comparison. Each workflow creates a hybrid `GenerativeModel` with structured response schemas for both Chrome's on-device model and Gemini cloud fallback. Automatic mode uses `PREFER_ON_DEVICE`; Device only uses `ONLY_ON_DEVICE`. The app initializes the on-device model after a user click and reads `inferenceSource` from the model response to label the actual route. Firebase App Check protects the AI Logic integration. The source repository includes the full implementation and configuration instructions.

## Why this matters

The design addresses two concrete problems: users must find what to do, and they must spot when an update changes their plan. Evidence from the original wording makes both tasks easier to review. Local inference can improve privacy and availability on supported devices; hybrid fallback extends the same experience to other Chrome desktops. A user can prohibit cloud AI processing when a notice is sensitive.

## Built during the hackathon

The entire NoticeTrail app, its two hybrid inference workflows, interface, sample notices, service worker, and documentation were built during the 2026 contest period. Standard open-source libraries and Google Fonts are listed in the README. No pre-existing application code was incorporated.

## Before submitting

- [ ] Create Firebase project, web app, and App Check reCAPTCHA Enterprise configuration.
- [ ] Verify live inference and the reported source in Chrome. Test Automatic and Device only.
- [ ] Deploy the app with production Firebase values and a registered production App Check provider.
- [ ] Publish this repository on GitHub or GitLab with the root `LICENSE` visible.
- [ ] Record a real demo under three minutes, upload it publicly to YouTube, and add its link.
- [ ] Add hosted app URL, public repo URL, screenshots, and this description to Devpost.
- [ ] Recheck the official deadline and submission form before filing.

Do not claim a successful on-device or cloud inference run in the final submission until it has actually been observed.
