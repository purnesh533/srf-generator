param(
    [Parameter(Mandatory=$true)] [string] $ConfigPath
)

$ErrorActionPreference = "Stop"

function Write-Log($msg) { Write-Host "[outlook] $msg" }

if (-not (Test-Path -LiteralPath $ConfigPath)) {
    Write-Error "Config file not found: $ConfigPath"
    exit 2
}

try {
    $cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    Write-Error "Failed to parse config JSON: $_"
    exit 3
}

try {
    $outlook = New-Object -ComObject Outlook.Application
} catch {
    Write-Error "Outlook is not installed or not accessible via COM. $_"
    exit 1
}

$mail = $outlook.CreateItem(0) # 0 = olMailItem
$mail.To = [string]$cfg.To
if ($cfg.Cc) { $mail.CC = [string]$cfg.Cc }
$mail.Subject = [string]$cfg.Subject
$mail.Body    = [string]$cfg.Body

if ($cfg.Attachments) {
    foreach ($raw in @($cfg.Attachments)) {
        $f = ([string]$raw).Trim()
        if ($f -and (Test-Path -LiteralPath $f)) {
            try {
                $mail.Attachments.Add($f, 1) | Out-Null
                Write-Log "attached: $f"
            } catch {
                Write-Warning "Failed to attach $f : $_"
            }
        } else {
            Write-Warning "Attachment not found: $f"
        }
    }
}

Write-Log ("attachment count: " + $mail.Attachments.Count)

if ($cfg.SendImmediately) {
    $mail.Send()
    Write-Output "SENT"
} else {
    $mail.Display($true)
    Write-Output "OPENED"
}
