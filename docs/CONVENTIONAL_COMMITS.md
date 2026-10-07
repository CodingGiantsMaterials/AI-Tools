# Commit messages

Use Conventional Commits 1.0.0 and the
[shared rules](../AGENTS.md#execution-rules). Describe the primary purpose of
the actual change.

## Format

```text
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

## Types

Choose the type that best describes the purpose:

| Type | Purpose |
| --- | --- |
| `feat` | New functionality |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Internal restructuring without changing behavior |
| `test` | Test additions or corrections |
| `build` | Build system, packaging, or dependencies |
| `ci` | Continuous integration configuration |
| `perf` | Performance improvement |
| `style` | Formatting without changing behavior |
| `revert` | Reverting an earlier change |
| `chore` | Maintenance that does not fit a more specific type |

## Writing the message

- Use a lowercase type and add a short scope only when it clarifies the area.
- Write a precise imperative subject, such as `fix(parser): accept empty input`.
  Do not end it with a period. Prefer fewer than 72 characters without losing
  essential meaning.
- Name products or providers only when they are the subject of the change.
- Use a subject alone for straightforward changes. Add a short body only for
  useful rationale, constraints, or consequences that the subject cannot convey.
  Do not repeat the subject, list every changed file, or recount the work.
- Separate the body and footers with blank lines. Wrap prose at about 72
  characters where practical; keep identifiers and URLs intact.
- Use footers for relevant issue references, breaking changes, or human
  `Co-authored-by:` trailers. Footer tokens use `: ` or ` #` before the value
  and hyphens instead of spaces, except for `BREAKING CHANGE`.

## Breaking changes

Mark an incompatible change with `!` before the colon or an uppercase
`BREAKING CHANGE:` footer. Explain the impact and migration when the subject
alone is insufficient:

```text
feat(api)!: return paginated results

BREAKING CHANGE: read items from data and follow next for additional pages.
```

## Pull request titles

Use the same concise subject format for PR titles. Describe the final outcome
of the complete PR. For the body, follow the
[PR workflow](workflows/commit-changes.md#pull-request); commit bodies do not
need PR sections.
