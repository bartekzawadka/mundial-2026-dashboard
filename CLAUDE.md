<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at [`specs/001-live-data/plan.md`](specs/001-live-data/plan.md).
<!-- SPECKIT END -->

## Git workflow

Every code change MUST follow this workflow — no exceptions:

1. **Feature branch.** Create a new feature branch off `main`. Never commit, push, or merge directly to `main`.
2. **Pull request.** Push the feature branch and open a PR targeting `main`. Every change ships through a PR — even tiny edits, even solo work.
3. **Auto-merge enabled.** Immediately after opening the PR, turn on auto-merge with a merge commit:
   ```
   gh pr merge <pr-number> --auto --merge
   ```
   This is required for every PR. Do not leave a PR without auto-merge enabled.
4. **Hands off after auto-merge is set.** GitHub will merge the PR automatically the moment all required status checks pass, and the feature branch will be auto-deleted. Do not merge manually unless auto-merge is somehow unavailable.

Branch protection (`master-block` ruleset on `main`): direct pushes, force-pushes, and branch deletion are blocked; changes must come through a PR. No approving review is required (solo-developer setup), but all required status checks must pass before auto-merge fires. Required checks: `claude-review`.

The Claude GitHub App auto-reviews every PR (see `.github/workflows/claude-code-review.yml`) and is a **required** status check — its run must complete successfully before auto-merge fires. The review completes successfully regardless of feedback content, so it gates timing (auto-merge waits for the review to finish) but not outcome (a critical review comment is still informational, not a blocker).

Do not bypass branch protection (e.g., `gh pr merge --admin`). If auto-merge is blocked, fix the underlying issue (failing check, conflict) rather than overriding.
