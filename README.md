# Go In For

A sideline substitution planner for 6v6 rec soccer. It tells you exactly who goes in for whom, speaks the call into your AirPods, honors the rules your team needs, and works offline as a Home Screen app on iPhone.

No accounts, no server. Everything stays in the phone's browser.

## Use it

Live at https://andersoneng-ux.github.io/Go-in-for/

1. Open the app link in Safari on your iPhone.
2. Share, then **Add to Home Screen**. Open it from the Home Screen from then on.
3. Roster & rules: tap who is here, set the game format, add rules. Start the game, check or change the starters, then tap Kick off at the whistle.

Load a saved roster on any phone with a **roster link** (Roster link card on the setup screen). The link carries the roster, rules, and settings and never touches a server.

## What it does

- **Names the swap.** "Chase in for Craig. Knox in for Nolan." Two at a time by default, on a timer you set.
- **Speaks it.** A heads-up before the swap, the call when the timer hits, repeats until you confirm, plus period breaks and check-ins. Routes to AirPods.
- **Honors rules.** Not on the field together. Never come off in the same swap. Always keep at least one (or two) of a group on. A defender replaces a defender when minutes are close.
- **Protects kids who just came on.** It would rather do a one-kid swap than pull someone who has been on for 40 seconds.
- **Handles the kid who walks off.** Tap Left. It names who to send in, checks back with you after a few minutes, and puts the kid straight back in ahead of the bench when they are ready.
- **Pocket screen.** Only the clock and the call, unlocks on a one-second hold. Pair it with iOS Guided Access to lock the phone to the app.
- **Sunlight palette.** White surfaces, near-black type, every text pair at 7:1 contrast or better. Dark theme for night games.
- Attendance, late arrivals, goalie lock, tap-to-swap by hand, undo, halves or quarters, and a final minutes table.
- Lost track of who switched? Drag a kid by the handle on their row to the field or the bench so the app matches what is really out there. Drop a kid on another kid to swap them. Too many on, and the plan says who comes off.
- Back-to-back games: end the game, then "Next game, carry on". The kids who were waiting start the next game, longest wait first, and the minutes carry over so the day stays fair (good for 12 hours).

## Known limits

- The screen has to stay on. iOS freezes web apps when the screen locks, so there are no locked-screen alerts. The app holds a screen wake lock while the clock runs.
- The ringer switch must be on for the voice and the beep.
- The first open needs a signal so the service worker can cache the app. After that it runs with no signal.

## Develop

Static files, no build step. `index.html` + `app.js` (UI) + `engine.js` (all game logic, also runs in Node) + `styles.css` + `sw.js` + `manifest.webmanifest`.

```
npm test          # engine unit + property tests, contrast check
npm run test:flows   # phone-size Chromium flows (needs a local server on :8765 and Playwright)
npm run icons     # regenerate icons/ from the app font
npm run build:artifact   # dist/artifact.html for the claude.ai artifact host
```

Deploys to GitHub Pages from `.github/workflows/pages.yml` on every push to `main`. Tests gate the deploy.
