#Requires -Version 7.3
param(
    [Parameter(Mandatory)] [string] $PublicationScript,
    [Parameter(Mandatory)] [string] $TemporaryDirectory,
    [Parameter(Mandatory)]
    [ValidateSet('unavailable temp directory', 'invalid description', 'missing gh')]
    [string] $Failure
)

$ErrorActionPreference = 'Stop'
$env:PATH = ''
if ($Failure -eq 'unavailable temp directory') {
    $TemporaryDirectory = Join-Path $TemporaryDirectory 'unavailable'
}
foreach ($name in @('TMP', 'TEMP', 'TMPDIR')) {
    [Environment]::SetEnvironmentVariable($name, $TemporaryDirectory)
}

$fixture = @{
    PublicationCount = 0
    CleanupCount = 0
    BodyPath = $null
    BodyExistedAtCleanup = $false
    ErrorType = $null
}
if ($Failure -ne 'missing gh') {
    function gh {
        $fixture.PublicationCount++
        throw 'Publication must not run after preparation fails.'
    }
}

function Remove-Item {
    [CmdletBinding()]
    param([Parameter(Mandatory)] [string] $LiteralPath)

    $fixture.CleanupCount++
    $fixture.BodyPath = $LiteralPath
    $fixture.BodyExistedAtCleanup = [System.IO.File]::Exists($LiteralPath)
    if ($PSBoundParameters['ErrorAction'] -ne 'Stop') {
        throw 'Deletion must use -ErrorAction Stop.'
    }
    Microsoft.PowerShell.Management\Remove-Item -LiteralPath $LiteralPath -ErrorAction Stop
}

$parameters = @{
    Repository = 'example/repository'
    Base = 'main'
    Head = 'topic-branch'
    Title = 'test: fail before publication'
    Body = 'Valid description.'
}
if ($Failure -eq 'invalid description') {
    # An unpaired UTF-16 surrogate cannot round-trip through UTF-8.
    $parameters.Body = [string][char] 0xD800
}
try {
    & $PublicationScript @parameters *> $null
}
catch {
    $fixture.ErrorType = $_.Exception.GetBaseException().GetType().FullName
}
$fixture | ConvertTo-Json -Compress
