# Developing this game

How to change the game with Git, GitHub and Visual Studio Code. The game is published with GitHub Pages from the `main` branch.

**Anything that reaches `main` goes live within minutes.** Build each change on a separate branch first.

## Everyday workflow

| Step | What to do in VS Code |
|---|---|
| 1. Get the latest version | Make sure you're on `main` (bottom left), then click **Sync Changes** if it appears |
| 2. Create a branch | Click `main` at the bottom left, choose **Create new branch**, and name it, for example `add-night-mode` |
| 3. Make your change | Edit and save your files |
| 4. Test it | Right-click `index.html` and choose **Open with Live Server** (extension by Ritwick Dey) |
| 5. Commit it | In **Source Control** (`Ctrl+Shift+G`), write what you changed, then click **Commit** |
| 6. Upload the branch | Click **Publish Branch**, or **Sync Changes** if it's already published |
| 7. Merge it | On GitHub, click **Compare & pull request**, then **Create pull request**, then **Merge** |
| 8. Check it live | Open the live link after a few minutes, including on a phone |
| 9. Go back to `main` | Switch to `main` at the bottom left and click **Sync Changes** |

Make small commits with clear messages, like `Fix pause button on mobile`.

## Test before merging

1. Play a full round, including pause, game over and restart.
2. With the game open through Live Server, press `F12`, open **Console**, paste in all of `smoke-test.js` and press Enter.
3. Run `runFlappySmokeTest()`. You should see a list of checks. A red error names the check that failed.
4. Refresh the page to clear the test's effect on the record in memory.

Some game changes, such as physics values, also mean updating `smoke-test.js` and `README.md`.

GitHub Pages only publishes one branch, so a phone can't open a branch on the live link before you merge it.

## When something goes wrong

| Problem | What to do |
|---|---|
| Uncommitted changes you don't want | In **Source Control**, click the **Discard Changes** arrow next to the file. This can't be undone |
| A merged change broke the live game | On GitHub, open the merged pull request and click **Revert**, then merge that new pull request |
| VS Code won't let you switch branches | Commit your current work first |
| Sync is rejected or shows a merge conflict | Don't force anything. Ask for help before continuing |
| The live site still shows the old version | Check the **Actions** tab for a green check, then refresh or clear your browser cache |

## Rules

- **Never commit passwords or API keys.** The repository is public, and they stay in its history even after you delete them.
- **The game must keep working without a build step.** `index.html`, `style.css`, `game.js`, `phaser.min.js` and `lucide.min.js` must stay at the top level of the repository.
- **Saved data is shared between games on the same address.** Every game under `USERNAME.github.io` needs its own storage names. This game uses `flappy-best` and `flappy-sound`.
