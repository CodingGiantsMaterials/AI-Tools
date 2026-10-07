#Requires -Version 7.3
$ErrorActionPreference = 'Stop'

$receivedArguments = @($args)
$bodyIndex = [Array]::IndexOf($receivedArguments, '--body-file')
if ($bodyIndex -lt 0 -or $bodyIndex + 1 -ge $receivedArguments.Count) {
    throw 'Missing --body-file argument.'
}
$bodyPath = $receivedArguments[$bodyIndex + 1]
$invocation = @{
    Arguments = $receivedArguments
    BodyBytes = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($bodyPath))
}
[System.IO.File]::AppendAllText(
    $env:CREATE_PR_TEST_CAPTURE,
    (ConvertTo-Json -InputObject $invocation -Compress) + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

$exitCode = [int] $env:CREATE_PR_TEST_EXIT_CODE
if ($exitCode -eq 0) {
    [Console]::Out.WriteLine('https://example.invalid/pull/1')
}
else {
    [Console]::Error.WriteLine('Simulated gh failure.')
}
exit $exitCode
