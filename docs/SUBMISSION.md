# Devpost submission draft

## One-line pitch

NoticeTrail turns notices into an explorable world of facts, evidence, revisions, and actions, with hybrid on-device and cloud AI.

## What it does

NoticeTrail accepts text, TXT files, and screenshots. A shared graph connects events, locations, requirements, deadlines, and unresolved questions. The world and connections views expose each fact and its evidence. The time machine tracks revisions. The action journey links saved steps to source versions so users can review changed obligations before updating their plans. Calendar exports require complete dates confirmed by the user. Workspaces can be saved locally, exported, and deleted. Earlier saved tasks remain accessible.

## How it uses Firebase AI Logic

The Chrome web app imports and calls Firebase AI Logic through `src/extractWorkspace.ts`, `src/assistant.ts`, and `src/firebase.ts` for extraction, questions, and comparison. Each workflow creates a hybrid `GenerativeModel` with structured response schemas for both Chrome's on-device model and Gemini cloud fallback. Automatic mode uses `PREFER_ON_DEVICE`; Device only uses `ONLY_ON_DEVICE`. The app initializes the on-device model after a user click and reads `inferenceSource` from the model response to label the actual route. Firebase App Check protects the AI Logic integration. The source repository includes the full implementation and configuration instructions.

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
