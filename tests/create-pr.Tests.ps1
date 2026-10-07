#Requires -Version 7.3
$ErrorActionPreference = 'Stop'
$WarningPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true

$publicationScript = Join-Path $PSScriptRoot '../scripts/create-pr.ps1'
$stubScript = Join-Path $PSScriptRoot 'fixtures/gh.ps1'
$prepublicationScript = Join-Path $PSScriptRoot 'fixtures/create-pr-prepublication.ps1'
$testPowerShell = (Get-Process -Id $PID).Path
$parameters = @{
    Repository = 'example/repository'
    Base = 'main'
    Head = 'topic-branch'
    Title = 'feat: preserve "quoted" titles'
    Body = [string][char]0xFEFF + @'
## Summary
Zażółć gęślą jaźń 🚀. Keep "quotes", 'apostrophes', `backticks`, and $(literal).

## Validation
Local checks only.
'@
}
$expectedBodyBytes = [System.Text.Encoding]::UTF8.GetBytes($parameters.Body)
$testCases = @(
    @{ Name = 'success'; ArgumentPassing = 'Legacy'; GhExitCode = 0; Cleanup = 'remove'; Draft = $false }
    @{ Name = 'draft'; ArgumentPassing = 'Legacy'; GhExitCode = 0; Cleanup = 'remove'; Draft = $true }
    @{ Name = 'gh failure'; ArgumentPassing = 'Standard'; GhExitCode = 17; Cleanup = 'remove'; Draft = $false }
    @{ Name = 'cleanup failure'; ArgumentPassing = 'Windows'; GhExitCode = 0; Cleanup = 'throw'; Draft = $false }
    @{ Name = 'gh and cleanup failure'; ArgumentPassing = 'Legacy'; GhExitCode = 17; Cleanup = 'throw'; Draft = $true }
    @{ Name = 'cleanup leaves file'; ArgumentPassing = 'Standard'; GhExitCode = 0; Cleanup = 'retain'; Draft = $false }
)

function Assert-Condition([bool] $Condition, [string] $Message) {
    if (-not $Condition) {
        throw $Message
    }
}

function gh {
    & $testPowerShell -NoProfile -NonInteractive -File $stubScript @args
}

function Remove-Item {
    [CmdletBinding()]
    param([Parameter(Mandatory)] [string] $LiteralPath)

    $fixture.CleanupCount++
    $fixture.PublicationsAtCleanup = [System.IO.File]::ReadAllLines($capturePath).Count
    $fixture.BodyPath = $LiteralPath
    Assert-Condition ($PSBoundParameters['ErrorAction'] -eq 'Stop') 'Deletion must use -ErrorAction Stop.'
    # Simulate an unrelated native command overwriting the last exit code.
    $global:LASTEXITCODE = 91
    if ($testCase.Cleanup -eq 'throw') {
        throw 'Simulated cleanup failure.'
    }
    if ($testCase.Cleanup -eq 'retain') {
        return
    }
    Microsoft.PowerShell.Management\Remove-Item -LiteralPath $LiteralPath -ErrorAction Stop
}

$savedCapturePath = [Environment]::GetEnvironmentVariable('CREATE_PR_TEST_CAPTURE')
$savedExitCode = [Environment]::GetEnvironmentVariable('CREATE_PR_TEST_EXIT_CODE')
$capturePath = $null
$prepublicationDirectory = $null
try {
    $capturePath = [System.IO.Path]::GetTempFileName()
    $env:CREATE_PR_TEST_CAPTURE = $capturePath
    foreach ($testCase in $testCases) {
        $PSNativeCommandArgumentPassing = $testCase.ArgumentPassing
        $env:CREATE_PR_TEST_EXIT_CODE = [string] $testCase.GhExitCode
        [System.IO.File]::WriteAllText($capturePath, '')
        $fixture = @{
            CleanupCount = 0
            PublicationsAtCleanup = 0
            BodyPath = $null
        }
        $invocationParameters = $parameters.Clone()
        if ($testCase.Draft) {
            $invocationParameters.Draft = $true
        }
        try {
            $records = @(& $publicationScript @invocationParameters 2>&1 3>&1)
            $actualExitCode = $LASTEXITCODE
            $warnings = @($records | Where-Object { $_ -is [System.Management.Automation.WarningRecord] })
            $errors = @($records | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] })
            $invocations = @([System.IO.File]::ReadAllLines($capturePath) | ConvertFrom-Json)
            Assert-Condition ($invocations.Count -eq 1) 'Publication must run exactly once.'
            $observed = $invocations[0]
            $expectedArguments = @(
                'pr', 'create', '--repo', $parameters.Repository,
                '--base', $parameters.Base, '--head', $parameters.Head,
                '--title', $parameters.Title, '--body-file', $fixture.BodyPath
            )
            if ($testCase.Draft) {
                $expectedArguments += '--draft'
            }

            Assert-Condition ($actualExitCode -eq $testCase.GhExitCode) 'Publication exit code changed.'
            Assert-Condition ($PSNativeCommandArgumentPassing -eq $testCase.ArgumentPassing) 'The caller argument passing preference changed.'
            Assert-Condition ($fixture.CleanupCount -eq 1) 'Cleanup must run exactly once.'
            Assert-Condition ($fixture.PublicationsAtCleanup -eq 1) 'Cleanup ran before publication.'
            Assert-Condition (
                [System.Linq.Enumerable]::SequenceEqual([string[]] $observed.Arguments, [string[]] $expectedArguments)
            ) 'Publication arguments changed across the native process boundary.'
            Assert-Condition ([System.IO.Path]::IsPathFullyQualified($fixture.BodyPath)) 'Body path must be absolute.'
            Assert-Condition (
                $observed.BodyBytes -ceq [Convert]::ToBase64String($expectedBodyBytes)
            ) 'The body file must contain the exact UTF-8 description without an added BOM.'

            if ($testCase.GhExitCode -eq 0) {
                Assert-Condition ($errors.Count -eq 0) 'Successful publication emitted an error.'
                Assert-Condition ($records -contains 'https://example.invalid/pull/1') 'The PR URL was lost.'
            }
            else {
                Assert-Condition (($errors | Out-String).Contains('Simulated gh failure.')) 'The gh diagnostic was lost.'
                Assert-Condition (($errors | Out-String).Contains('exit code 17')) 'The gh exit code was not reported.'
            }

            if ($testCase.Cleanup -ne 'remove') {
                $expectedCause = if ($testCase.Cleanup -eq 'throw') {
                    'Simulated cleanup failure.'
                }
                else {
                    'The temporary PR body file still exists after deletion.'
                }
                Assert-Condition ($warnings.Count -eq 1) 'Cleanup failure must emit a separate warning.'
                Assert-Condition ($warnings[0].Message.Contains($expectedCause)) 'Cleanup cause was lost.'
                Assert-Condition ($warnings[0].Message.Contains($fixture.BodyPath)) 'The retained file path was lost.'
                Assert-Condition (Test-Path -LiteralPath $fixture.BodyPath -ErrorAction Stop) 'The failed deletion must leave the file for manual cleanup.'
            }
            else {
                Assert-Condition ($warnings.Count -eq 0) 'Successful cleanup emitted a warning.'
                Assert-Condition (-not (Test-Path -LiteralPath $fixture.BodyPath -ErrorAction Stop)) 'Cleanup left a temporary file.'
            }
            Write-Output "PASS: $($testCase.Name) (inherited $($testCase.ArgumentPassing))"
        }
        finally {
            if ($fixture.BodyPath -and (Test-Path -LiteralPath $fixture.BodyPath -ErrorAction Stop)) {
                Microsoft.PowerShell.Management\Remove-Item -LiteralPath $fixture.BodyPath -ErrorAction Stop
                Assert-Condition (-not (Test-Path -LiteralPath $fixture.BodyPath -ErrorAction Stop)) 'Test cleanup left a temporary file.'
            }
        }
    }

    $prepublicationDirectory = [System.IO.Directory]::CreateTempSubdirectory('create-pr-tests-').FullName
    $failureCases = @(
        @{ Name = 'unavailable temp directory'; ErrorType = 'System.IO.DirectoryNotFoundException'; CleanupCount = 0 }
        @{ Name = 'invalid description'; ErrorType = 'System.Text.EncoderFallbackException'; CleanupCount = 0 }
        @{ Name = 'missing gh'; ErrorType = 'System.Management.Automation.CommandNotFoundException'; CleanupCount = 1 }
    )
    foreach ($failureCase in $failureCases) {
        $result = & $testPowerShell -NoProfile -NonInteractive -File $prepublicationScript `
            -PublicationScript $publicationScript -TemporaryDirectory $prepublicationDirectory -Failure $failureCase.Name
        Assert-Condition ($LASTEXITCODE -eq 0) 'The prepublication fixture failed.'
        $observed = $result | ConvertFrom-Json
        Assert-Condition ($observed.ErrorType -eq $failureCase.ErrorType) "$($failureCase.Name): expected a terminating error."
        Assert-Condition ($observed.PublicationCount -eq 0) 'Preparation failure must not publish a PR.'
        Assert-Condition ($observed.CleanupCount -eq $failureCase.CleanupCount) 'Preparation failure did not clean up the created file exactly once.'
        if ($failureCase.CleanupCount -eq 1) {
            Assert-Condition ($observed.BodyExistedAtCleanup) 'Cleanup must remove an already created body file.'
            Assert-Condition ([System.IO.Path]::IsPathFullyQualified($observed.BodyPath)) 'Body path must be absolute.'
            Assert-Condition (-not (Test-Path -LiteralPath $observed.BodyPath -ErrorAction Stop)) 'Preparation failure left the body file.'
        }
        else {
            Assert-Condition ($null -eq $observed.BodyPath) 'Cleanup must not run when no body file was created.'
        }
        Assert-Condition ([System.IO.Directory]::GetFileSystemEntries($prepublicationDirectory).Count -eq 0) 'Preparation failure left temporary resources.'
        Write-Output "PASS: $($failureCase.Name)"
    }
}
finally {
    [Environment]::SetEnvironmentVariable('CREATE_PR_TEST_CAPTURE', $savedCapturePath)
    [Environment]::SetEnvironmentVariable('CREATE_PR_TEST_EXIT_CODE', $savedExitCode)
    if ($capturePath -and (Test-Path -LiteralPath $capturePath -ErrorAction Stop)) {
        Microsoft.PowerShell.Management\Remove-Item -LiteralPath $capturePath -ErrorAction Stop
        Assert-Condition (-not (Test-Path -LiteralPath $capturePath -ErrorAction Stop)) 'Test cleanup left the invocation log.'
    }
    if ($prepublicationDirectory -and (Test-Path -LiteralPath $prepublicationDirectory -ErrorAction Stop)) {
        foreach ($file in [System.IO.Directory]::GetFiles($prepublicationDirectory)) {
            Microsoft.PowerShell.Management\Remove-Item -LiteralPath $file -ErrorAction Stop
        }
        Microsoft.PowerShell.Management\Remove-Item -LiteralPath $prepublicationDirectory -ErrorAction Stop
        Assert-Condition (-not (Test-Path -LiteralPath $prepublicationDirectory -ErrorAction Stop)) 'Test cleanup left the prepublication directory.'
    }
}

exit 0
