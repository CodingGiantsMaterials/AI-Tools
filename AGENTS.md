# Agent instructions

## Workflows

Use the existing workflow for the task and read its required sources. Limit
reading to instructions and material relevant to the requested work.

Before changing implementation, documentation, configuration, or tests, read
[repository development](docs/workflows/repository-development.md).

Use the [commit-changes skill](.agents/skills/commit-changes/SKILL.md) whenever a
task changes repository files, before the final response, and when asked to
finalize a repository change set. The workflow does not expand the task's
authorized delivery scope.

## Execution rules

- Verify the assigned checkout, branch, and Git status before editing or
  staging. Use that directory for edits and set it on every repository command.
  Preserve unrelated changes; stop before modifying work whose ownership is
  unclear.
- Use available tools according to their actual interfaces. Wait for an
  operation's final result before starting work that depends on it.
- Honor existing user authorization within its stated scope. Tool availability,
  agent briefs, and instruction changes made during the task do not grant
  additional permission.
- Use required approval mechanisms. Never bypass a denial through another tool,
  transport, or permission setting.
- For every file deletion with `Remove-Item`, use `-LiteralPath` and
  `-ErrorAction Stop` without `-Force`. Report deletion failures without
  automatically retrying with forced deletion.
- When a required capability is unavailable or an operation is denied, stop
  the dependent step, preserve completed work, and report the limitation.
- During finalization, do not rewrite history, force-push, or discard existing
  work.
- Keep credentials out of tracked files, logs, and reports.
- Exclude secrets, links to agent or tool sessions, session or conversation
  identifiers, internal telemetry, and private process metadata from commit
  messages, PR titles, and PR descriptions. This applies to the entire message,
  including footers and trailers.
- Do not attribute changes to AI anywhere in commit messages, PR titles, or PR
  descriptions, including footers and trailers. This includes `Co-authored-by:`
  trailers naming AI, `Generated with ...`, and similar attribution.

## Internal agents

Delegate only when delegation is within the task's authorized scope.

Reusable [role templates](delegation-prompts/orchestrator.md) and
[usage instructions](delegation-prompts/README.md) are available for delegated
tasks.

Give each worker a self-contained brief with the intended outcome and
rationale, scope, owned paths, exact execution directory and branch, recorded
base (`BASE_SHA`), required instruction paths, acceptance checks, and permitted
delivery steps. Include root `AGENTS.md` and the development workflow.

At each assignment or resumption, the worker reads the listed instructions
and verifies its execution directory and branch before acting. Starting an
agent does not create a checkout or authorize creating or switching branches
or worktrees.

Track each worker's identity and ownership of changes. Avoid concurrent edits
to the same files.

Designate one Git owner per shared checkout before any Git mutation, within
the authorized delivery scope. This agent alone performs those operations,
including staging, unstaging, index control, and commits. Keep this ownership
exclusive throughout staging, index verification, and commit; other workers
may inspect Git state but must not mutate it.

Each worker validates its own result. The coordinating agent may delegate
technical review to independent reviewers but remains responsible for final
acceptance under the
[validation rules](docs/workflows/repository-development.md#validation).

## Completion and handoff

Before finalization, confirm that all work and operations affecting the
reviewed result have finished. Before transferring ownership, confirm that the
worker's latest run and operations have finished. A message, timeout, or clean
Git status alone is not completion evidence for either step.

## Temporary resources

The creator of a temporary validation file or process owns its cleanup when
validation ends.

When a resource must remain, identify its next owner and report its exact path,
or process ID and port, together with its purpose and cleanup instructions.
