# Private Diary upgrade

## What changed

- A closed private diary is shown before journal content is loaded.
- First use creates a separate diary password; later visits require it.
- The cover opens only after successful cryptographic decryption.
- Entry title, writing, moods, tags, and gratitude are encrypted in the browser.
- The API and SQLite store ciphertext for new entries.
- Existing plaintext entries migrate after the next successful unlock.
- Drafts use encrypted local storage instead of readable JSON.
- The diary locks after five minutes without activity and whenever Lock is used.
- It also locks after the tab has stayed hidden for one minute.
- Four selectable animated covers make the locked diary feel personal.
- Caveat handwriting is the default, with six additional font choices.
- Eight paper colours, six paper styles, six ink colours, and nine cute decoration sets are available.
- Every encrypted entry stores its own paper, font, ink, decoration, mood, and gratitude details. Reopening it restores the same designed page.
- Rain, forest wind, birds, ocean waves, a fireplace, and deep focus noise are generated with Web Audio; no audio files are required.
- Up to three sounds can be mixed, with separate volume controls and a master volume.
- The password screen includes password strength guidance, a Caps Lock warning, a failed-unlock shake, and a page-opening reveal.
- Encrypted drafts are isolated per account on shared devices and save immediately after edits.
- Concurrent expired-session requests share one safe refresh, so journal startup does not accidentally redirect a signed-in user.

## How the diary works

1. Sign in and open **Journal**.
2. On the first visit, choose a separate diary password and confirm it.
3. Pick a cover, enter the password, and watch the diary unlock.
4. Select **New entry**, then choose a paper colour, paper pattern, handwriting font, ink, and decorations.
5. Use **Soundscape** to mix calming background audio while writing.
6. Save the page. Its writing and design are encrypted together.
7. Use **Lock** before leaving. The diary also auto-locks when inactive.

## Reliability fixes included

- The saved-and-encrypted confirmation now appears after a successful save.
- The page counter uses actual journal entries instead of mood check-ins.
- Quick Back or Lock actions no longer cancel the latest encrypted draft save.
- A late autosave can no longer restore a draft after that entry was saved.
- Delete and journal-loading failures are visible to the user.
- Invalid saved sound volumes are safely reset instead of breaking audio.
- Simultaneous diary-vault setup requests return a clean conflict instead of a server error.

## Important password behaviour

The diary password is never sent to the API. Vichar cannot recover encrypted
pages if the password is forgotten. This version does not include a recovery
key or password-change flow. The API rejects plaintext journal writes after a
private vault has been configured.

## Run locally

Use Node 22 or newer. Install each application separately:

```powershell
npm --prefix apps/api install
npm --prefix apps/web install
```

Then use two VS Code terminals:

```powershell
npm --prefix apps/api run dev
npm --prefix apps/web run dev
```

Open `http://localhost:3000`, sign in, and select Journal. Avoid running
`npm install` at the repository root on the current Windows setup.

## Production note

Use strong JWT secrets, HTTPS, secure deployment headers, dependency monitoring,
and an independent security review before storing real users' sensitive data.
