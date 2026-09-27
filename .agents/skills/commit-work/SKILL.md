---
name: commit-work
description: "Create high-quality git commits and carry them through branch creation, push, PR and merge: review/stage intended changes, split into logical commits, write clear commit messages (including Conventional Commits), then push, wait for the manual PR, and merge once approved. Use when the user asks to commit, craft a commit message, stage changes, split work into multiple commits, create a branch for a change, push a branch, or merge an approved PR."
---

# Commit work

## Goal
Make commits that are easy to review and safe to ship, and carry the branch through to a merged,
cleaned-up state without touching shared state without permission:
- only intended changes are included
- commits are logically scoped (split when needed)
- commit messages describe what changed and why
- the branch reaches a pull request and, once approved, gets merged and deleted

## Inputs to ask for (if missing)
- Is there already a working branch, or does one need to be created from `desarrollo`?
- Single commit or multiple commits? (If unsure: default to multiple small commits when there are unrelated changes.)
- Commit style: Conventional Commits are required.
- Any rules: max subject length, required scopes.

## Workflow (checklist)

### Branch
0) If there is no working branch yet for this change, create one from `desarrollo`, named
   `tipo/descripcion-corta` using the same `tipo` as the commit(s) that will go on it:
   ```
   git checkout desarrollo
   git pull
   git checkout -b tipo/descripcion-corta
   ```

### Commit
1) Inspect the working tree before staging
   - `git status`
   - `git diff` (unstaged)
   - If many changes: `git diff --stat`
2) Decide commit boundaries (split if needed)
   - Split by: feature vs refactor, backend vs frontend, formatting vs logic, tests vs prod code, dependency bumps vs behavior changes.
   - If changes are mixed in one file, plan to use patch staging.
3) Stage only what belongs in the next commit
   - Prefer patch staging for mixed changes: `git add -p`
   - To unstage a hunk/file: `git restore --staged -p` or `git restore --staged <path>`
4) Review what will actually be committed
   - `git diff --cached`
   - Sanity checks:
     - no secrets or tokens
     - no accidental debug logging
     - no unrelated formatting churn
5) Describe the staged change in 1-2 sentences (before writing the message)
   - "What changed?" + "Why?"
   - If you cannot describe it cleanly, the commit is probably too big or mixed; go back to step 2.
6) Write the commit message
   - Use Conventional Commits (required):
     - `type(scope): short summary`
     - blank line
     - body (what/why, not implementation diary)
     - footer (BREAKING CHANGE) if needed
   - Prefer an editor for multi-line messages: `git commit -v`
   - Use `references/commit-message-template.md` if helpful.
7) Run the smallest relevant verification
   - Run the repo's fastest meaningful check (unit tests, lint, or build) before moving on.
8) Repeat for the next commit until the working tree is clean

### Push, PR and merge
9) Push the branch. This touches shared state (a remote ref) — confirm with the person first,
   this repo does not grant standing authorization to push.
   ```
   git push -u origin tipo/descripcion-corta
   ```
10) Open the pull request against `desarrollo`. Always manual, regardless of which agent is
    running: stop here and let a person open it.
11) Once the PR is approved, merge and delete the branch. This also touches shared state (the
    shared `desarrollo` branch) — confirm with the person first.
    ```
    gh pr merge --squash --delete-branch
    ```

## Deliverable
Provide:
- the final commit message(s)
- a short summary per commit (what/why)
- the commands used to stage/review (at minimum: `git diff --cached`, plus any tests run)
- once pushed: the branch name, and the PR link once a person opens it
