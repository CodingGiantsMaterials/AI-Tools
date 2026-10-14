# Delegation prompts

These role templates support large repository tasks whose implementation and
review would overload one conversation. Use an environment with actual subagent
tools, fresh reviewer conversations, and access to the repository and shared
task artifacts.

## Start a task

Give the coordinating agent the task and explicitly assign
[orchestrator.md](orchestrator.md). For example:

> Act as the orchestrator described in delegation-prompts/orchestrator.md.
> Plan and carry out the following task in stages, using actual subagents for
> implementation and independent review. Give each subagent only its assigned
> role, task brief, and relevant references. Task: [insert the complete request].

Assign only the orchestrator initially; it starts [workers](worker.md) and
[reviewers](reviewer.md) for individual assignments. The templates supplement
the target repository's instructions and workflows. In this repository, use
[AGENTS.md](../AGENTS.md) and the
[development workflow](../docs/workflows/repository-development.md).
