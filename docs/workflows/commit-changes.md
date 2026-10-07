# Review and finalize changes

Follow the [repository development rules](repository-development.md). Perform
only the phases covered by the task and existing authorization. A review request
does not authorize edits or commits; a local checkpoint does not authorize
publication or merge.

## Review and validation

1. Verify the [working state](../../AGENTS.md#execution-rules) and recorded
   [task base](repository-development.md#task-base-and-review-scope).
2. Review the task diff and commits against the accepted outcome.
3. Apply the [validation rules](repository-development.md#validation) to the
   reviewed result.
4. Resolve blocking findings when fixes are in scope. If blocking findings
   remain unresolved, report them and stop finalization. Then confirm
   [completion](../../AGENTS.md#completion-and-handoff). For review-only
   requests, report actionable findings with file locations and validation
   limits, then stop.

## Local checkpoint

1. Group the checkpoint under the
   [scope rules](repository-development.md#scope-and-implementation). In a
   shared checkout, the [Git owner](../../AGENTS.md#internal-agents) performs
   the Git steps below.
2. Stage explicit paths or hunks; do not use `git add .` or `git add -A`.
   Inspect the complete staged diff and run `git diff --cached --check`.
   Require the index to contain only the intended checkpoint. Preserve unrelated
   staged work and stop before committing if it cannot be isolated safely.
3. Apply the [validation rules](repository-development.md#validation) to the
   contents prepared in the index.
4. Derive the message from the staged result using the
   [message format](../CONVENTIONAL_COMMITS.md).
5. Commit the reviewed index, verify the commit's contents, and inspect the
   remaining status. Report the hash, subject, validation outcome, and any
   remaining work briefly.

## Pull request

1. Verify the destination repository, remote, and agreed target branch. Fetch
   their current state and record the candidate commit and target commit.
   Require all intended changes to be committed.
2. Review the full PR under the
   [review scope](repository-development.md#task-base-and-review-scope). Resolve
   unexpected scope and gaps in integration or validation evidence before
   publishing.
3. Push the reviewed commit to the intended branch without overwriting
   unexpected remote changes. Verify that the remote head matches the reviewed
   commit.
4. Create or update one PR for the coherent outcome, using the
   [PR template](../../.github/pull_request_template.md). Derive its title and
   body from the complete result under the
   [change-description rules](repository-development.md#change-descriptions)
   and [message format](../CONVENTIONAL_COMMITS.md#pull-request-titles). For a
   new PR, use the [creation script](#create-a-pull-request).
5. Check CI results and required reviews for the published head. Pending,
   missing, cancelled, or failing required checks are not successful validation.
   Report unresolved blockers.

### Create a pull request

Run [scripts/create-pr.ps1](../../scripts/create-pr.ps1) from the repository
root in PowerShell 7.3 or later on Windows, macOS, or Linux, with an authenticated
GitHub CLI and the reviewed head already pushed. The script uses `Standard`
native argument passing in its own scope. Supply the verified repository,
target branch, head branch, title, and complete description. Add `-Draft` to
create a draft PR; omitting it creates a regular PR. For example:

```powershell
$body = @'
## Summary
Describe the reviewed change.

## Validation
List the completed checks and their results.
'@

./scripts/create-pr.ps1 -Repository 'owner/repository' -Base 'main' `
    -Head 'topic-branch' -Title 'feat: describe the change' -Body $body
$publicationExitCode = $LASTEXITCODE
```

The script runs three stages sequentially:

1. Encode the description as UTF-8 without adding a BOM, rejecting invalid
   Unicode before creating a file. Write the bytes to a unique file in the
   system temporary directory and verify its exact bytes before publication.
2. Publish once with `gh pr create --body-file`, save `$LASTEXITCODE` immediately,
   and check it. The script returns that code and preserves the command's output,
   including the PR URL on success. Inspect the repository's PR state before
   deciding whether to retry a failed publication.
3. In `finally`, remove the temporary file using
   `Remove-Item -LiteralPath ... -ErrorAction Stop` and verify its absence.
   Cleanup failures produce a separate warning with the cause and full file
   path, preserving the publication result. They do not trigger another
   publication. Handle any retained file separately under the
   [file deletion rules](../../AGENTS.md#execution-rules).

Run `pwsh -NoProfile -File ./tests/create-pr.Tests.ps1` to verify regular and
draft publication, quoted arguments, publication failure, and cleanup failure.
A local substitute for `gh` forwards arguments to a separate PowerShell process
that records them and reads the body file. Cases cover inherited `Legacy`,
`Standard`, and `Windows` argument passing. The tests create no PRs and remove
their temporary files.

## Merge and handoff

1. When merge is in scope, recheck the PR repository, target, head, required
   reviews, and checks immediately before merging. If the head or target changed
   since review, reassess the affected diff and validation first.
2. Pass the reviewed head SHA as a precondition enforced atomically by the merge
   operation. A separate state read is insufficient. If no supported operation
   can enforce this precondition, stop the merge phase and report the limitation.
   If the head no longer matches, return to review before retrying. Use a merge
   method permitted by the repository without bypassing required checks or
   reviews. Ensure the resulting commit messages follow the
   [message format](../CONVENTIONAL_COMMITS.md).
3. Verify that the reviewed head was merged into the intended target and that
   the resulting changes match the reviewed outcome. Record the merge result.
4. Report the commit or PR link, validation outcome, remaining work, and any
   [retained resources](../../AGENTS.md#temporary-resources). Keep the handoff
   proportional to the change.
