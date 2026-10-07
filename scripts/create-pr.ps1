#Requires -Version 7.3
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string] $Repository,

    [Parameter(Mandatory)]
    [string] $Base,

    [Parameter(Mandatory)]
    [string] $Head,

    [Parameter(Mandatory)]
    [string] $Title,

    [Parameter(Mandatory)]
    [string] $Body,

    [switch] $Draft
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$PSNativeCommandArgumentPassing = 'Standard'
$bodyPath = $null

try {
    # Preparation
    $bodyBytes = [System.Text.UTF8Encoding]::new($false, $true).GetBytes($Body)
    $bodyPath = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllBytes($bodyPath, $bodyBytes)
    if (-not [System.Linq.Enumerable]::SequenceEqual([System.IO.File]::ReadAllBytes($bodyPath), $bodyBytes)) {
        throw "Temporary PR body verification failed for '$bodyPath'."
    }

    # Publication
    $publicationArguments = @(
        '--repo', $Repository, '--base', $Base, '--head', $Head,
        '--title', $Title, '--body-file', $bodyPath
    )
    if ($Draft) {
        $publicationArguments += '--draft'
    }
    gh pr create @publicationArguments
    $publicationExitCode = $LASTEXITCODE
    if ($publicationExitCode -ne 0) {
        Write-Error "gh pr create failed with exit code $publicationExitCode." -ErrorAction Continue
    }
}
finally {
    # Cleanup
    if ($null -ne $bodyPath) {
        try {
            Remove-Item -LiteralPath $bodyPath -ErrorAction Stop
            if (Test-Path -LiteralPath $bodyPath -ErrorAction Stop) {
                throw 'The temporary PR body file still exists after deletion.'
            }
        }
        catch {
            Write-Warning "Cleanup failed for temporary PR body file '$bodyPath': $($_.Exception.Message)" -WarningAction Continue
        }
    }
}

exit $publicationExitCode
