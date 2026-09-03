# Git Operations & Autonomous Commit/Push Rules

This rule defines autonomous git execution standards for Himmel POS.

---

## Autonomous Commit and Push

When prompted or instructed by the user to commit, save progress, or push (e.g., "commit changes", "commit and push", "commit", "push", "/commit", or "/push"):

1. **Verify Quality Gates First**:
   - Ensure modified code has no syntax errors and passes relevant unit tests and linter (`npm run test`, `npm run lint`, backend tests).
2. **Stage Surgical Changes**:
   - Run `git add` specifically on the files modified or created for the task.
   - Do not stage unrelated temporary files or test artifacts.
3. **Draft Conventional Commit**:
   - Subject line ≤ 50 characters, following Conventional Commits (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `chore:`).
   - Concise bullet list in body if explanation of "why" is needed.
4. **Execute Autonomously**:
   - Run `git commit -m "..."`.
   - Run `git push origin <current-branch>`.
   - Report the commit hash and status directly without stalling or requesting redundant confirmation.
