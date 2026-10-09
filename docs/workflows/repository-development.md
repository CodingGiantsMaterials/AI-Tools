# Repository development

Follow the [shared execution rules](../../AGENTS.md). Finalization follows the
[commit workflow](commit-changes.md).

## Branches and working state

- Honor explicit user agreements about the checkout, branch, starting point,
  and task base before applying the defaults below.
- Reuse the checkout and branch assigned to the task. For a new task without
  an assigned branch, reuse the current non-default branch; when starting on
  `main` or the default branch, create a dedicated task branch from the current
  `HEAD` before editing.
- Commit all task changes on a separate task branch before the final response.
  A change task is complete only when all its changes have been committed.
  Do not edit or commit directly on `main` or the default branch.
- Use short, descriptive branch names with lowercase ASCII letters, digits,
  slashes, and hyphens.
- Do not include attribution to the authoring agent, assistant, model,
  or provider anywhere in branch names, including prefixes.
  Product and provider names may appear only when they are the subject
  of the change.

## Task base and review scope

For a new task, establish the working branch, then record its name and the
task's initial `HEAD` before editing. Use the full commit ID from
`git rev-parse HEAD` as `BASE_SHA`, unless the user explicitly agreed a different
task base. This also applies to a new task on an existing branch; earlier
branch commits are outside the task's review scope by default.

When resuming a task, recover and verify its recorded branch and `BASE_SHA`.
Preserve that base across checkpoints, corrections, and resumptions; do not
replace it with the current `HEAD`, the default branch, or the PR target unless
the user explicitly changes the agreed task base. Carry the branch and
`BASE_SHA` into subsequent stages and handoffs.

`BASE_SHA` defines the task's review scope. Review the full PR separately:
use the diff from the merge base of the recorded PR target and candidate
commits to the candidate, and the commits reachable from the candidate but
not the target. This may include changes preceding `BASE_SHA` and does not
change the task base.

## Scope and implementation

Before implementation, record a concise rationale: the need, supporting
evidence, relevant existing behavior, and intended outcome. An explicit user
requirement can establish a new need; verify claims about existing behavior
against the repository.

One change set delivers one coherent outcome, including directly required
tests and documentation. Follow agreed design decisions and fix the underlying
contract or data-flow failure. Remove unnecessary scope and temporary artifacts
when fixes are in scope.

Prefer the existing location that owns the responsibility. Among equally
correct solutions, choose fewer affected areas, mechanisms, and dependencies.
Reject unnecessary complexity even when the diff is small and tests pass.

Remove replaced behavior and its obsolete instructions, examples, tests, and
configuration. Remove structures and comments kept solely to memorialize a
discarded solution. Update affected consumers and required migrations while
preserving working contracts and authorization boundaries outside the scope.

If a complete fix requires expanding the agreed outcome, propose a narrower
result or independently useful stages before expanding the work.

## Validation

Choose the smallest sufficient set of checks for the changed behavior and run
all applicable required checks. Use existing repository commands and test
infrastructure.

Review the complete task diff and its commits against `BASE_SHA` and the
accepted outcome, including earlier checkpoints and staged and unstaged
changes. Review intended untracked files separately. Check correctness,
affected consumers, compatibility, migrations, and directly required tests
and documentation. Look for unrelated scope, regressions, exposed secrets,
debugging artifacts, and obsolete code. Set the shell variable `BASE_SHA` to
the recorded commit and run
`git diff --check "$BASE_SHA" --` to check whitespace errors in the tracked diff.

Add or extend tests for distinct observable behavior, real regressions, and
material integration, authorization, or state boundaries. Prefer extending
existing coverage over adding duplicates. Code changes do not automatically
require new tests when sufficient coverage already exists.

Test behavior and public interfaces rather than private implementation
details or redundant mock calls. For documentation and instruction changes,
inspect accuracy, links, and formatting; static checks usually suffice without
tests asserting exact prose. Use in-memory fixtures for pure transformations
unless filesystem behavior is part of the contract.

Evaluate test cost by executed cases and setup, not source length alone. Avoid
repeating identical cases across nested input dimensions. If the change
materially slows checks, measure the affected checks, improve their cost without
weakening coverage, and measure again. Report unrelated slow tests without
expanding the task to optimize them.

Reuse validation evidence while it remains applicable to the reviewed result.
For a local checkpoint, assess whether differences between the validated
contents and the index, including omitted hunks or files, affect a specific
check's validity. Consider other inputs, such as dependencies or environment,
only where they affect that result. Exact file equality is not required:
an omitted comment change with no effect on a check preserves its result.

Before repeating a check, identify the concrete difference or evidence gap
and explain why it undermines that result. Run only checks needed to address
that identified gap against the contents being finalized. Partial staging
or an incomplete environment description alone does not require rerunning
checks or creating an isolated environment. A commit or handoff alone does not
invalidate earlier results.

Report what was checked, the results, and any remaining limitations. Do not
describe skipped or unavailable checks as passing.

## Documentation

- Follow the repository's documentation language and terminology.
- Keep README files focused on their directory's purpose and essential usage.
- Keep paragraphs concise and avoid repeating rules owned by another document;
  link to the authoritative source.
- Preserve exact technical literals, including identifiers, commands, paths,
  URLs, schema keys, and API names, unless changing them is part of the task.
- Use syntactically parallel list items. End complete sentences with sentence
  punctuation; leave labels and sentence fragments without it.
- Update affected examples and instructions together with the behavior they
  describe.

## Change descriptions

In change reports and PR descriptions, describe the concrete problem,
resulting behavior, validation, and material limitations. Reuse the
implementation rationale without recounting the task's conversation history.

Describe changes and integrations through local code, observable contracts,
public interfaces, or published versions. Do not cite raw commit hashes from
other repositories or treat them as specifications.

For small PRs, one or two summary sentences plus validation evidence are
sufficient. Add migration details, risks, or constraints only when they help
review; remove empty sections.

Commit messages and PR titles follow the
[message format](../CONVENTIONAL_COMMITS.md).
