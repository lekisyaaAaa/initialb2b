### Summary

This pull request improves the Contact page UI and global header spacing:

- Removes hero-level call/email buttons and replaces card-level actions with copy-to-clipboard buttons.
- Aligns contact detail rows using a grid so icons and text are consistently lined up.
- Stacks and aligns CTA buttons in contact cards for better responsive layout; prevents label wrapping.
- Strengthens dark-mode colors for CTA buttons and footer for improved contrast.
- Adds global top padding equal to header height and increases header height slightly so page content isn't obscured by the fixed header.

### Files changed
- `frontend/src/pages/ContactPage.tsx`
- `frontend/src/index.css`

### Notes for reviewers
- The branch `cleanup/remove-temp-artifacts` contains the changes and has been pushed.
- Build completed locally with only existing lint warnings.

### Testing
- Run `npm run build` in `frontend/` and serve the build to visually confirm changes.

### Screenshots
- See commits / repo screenshots captured locally for dark-mode verification.

---
If you want me to open the PR from the command line, please install and authenticate the GitHub CLI (`gh`) in your environment and re-run the `gh pr create` command below.

Command to run when `gh` is available:
```
gh pr create --title "UI: Contact page polish + header spacing" --body "See description in PR template" --base master --head cleanup/remove-temp-artifacts --draft
```
