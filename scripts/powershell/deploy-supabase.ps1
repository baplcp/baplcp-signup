[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TargetLabel,

    [Parameter(Mandatory = $true)]
    [string]$EnvFileName,

    [switch]$WithMigrations
)

$ErrorActionPreference = 'Stop'

function Pause-And-Exit {
    param([int]$ExitCode = 0)

    Write-Host ''
    Read-Host '按 Enter 關閉...' | Out-Null
    exit $ExitCode
}

function Fail {
    param([string]$Message)

    Write-Host $Message
    Pause-And-Exit 1
}

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $projectRoot

$envFile = Join-Path $projectRoot $EnvFileName
if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    Fail "找不到環境設定檔：$EnvFileName"
}

$projectRef = $null
foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*(?:#|$)') {
        continue
    }

    if ($line -match '^\s*SUPABASE_PROJECT_REF\s*=\s*(.*?)\s*$') {
        $projectRef = $Matches[1].Trim()
        break
    }
}

if ([string]::IsNullOrWhiteSpace($projectRef)) {
    Fail "$EnvFileName 缺少 SUPABASE_PROJECT_REF。"
}

if ($projectRef -notmatch '^[a-z0-9]+$') {
    Fail "$EnvFileName 的 SUPABASE_PROJECT_REF 格式不正確：$projectRef"
}

$functionsDirectory = Join-Path $projectRoot 'supabase/functions'
if (-not (Test-Path -LiteralPath $functionsDirectory -PathType Container)) {
    Fail '找不到 Supabase Edge Functions 目錄：supabase/functions'
}

# Edge Function 各自位於第一層子目錄；底線開頭目錄（例如 _shared）是共用程式碼，不部署。
$functions = @(
    Get-ChildItem -LiteralPath $functionsDirectory -Directory |
        Where-Object { $_.Name -notmatch '^_' } |
        Sort-Object -Property Name |
        Select-Object -ExpandProperty Name
)

if ($functions.Count -eq 0) {
    Fail 'supabase/functions 中沒有可部署的 Edge Function。'
}

$globalSupabase = Get-Command supabase -ErrorAction SilentlyContinue
if ($globalSupabase) {
    $supabaseExecutable = $globalSupabase.Source
    $supabasePrefixArguments = @()
}
else {
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npx) {
        Fail '找不到 Supabase CLI 或 npx。請先安裝 Node.js 20 以上與 Supabase CLI，再重新執行。'
    }

    Write-Host '找不到全域 Supabase CLI，將透過 npx 執行 Supabase CLI。'
    $supabaseExecutable = $npx.Source
    $supabasePrefixArguments = @('supabase')
}

function Invoke-Supabase {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    # npx.ps1 會將 npm 的 notice 寫到 stderr；在 $ErrorActionPreference = 'Stop'
    # 下，PowerShell 會把它當成 NativeCommandError 而提早中止。外部 CLI 的成功與否
    # 均由呼叫端以 $LASTEXITCODE 判斷，因此僅在此範圍允許 stderr 通過並合併為輸出。
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $supabaseExecutable @supabasePrefixArguments @Arguments 2>&1
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
}

Write-Host ''
Write-Host 'BAPLCP 報名系統 - 部署雲端功能'
Write-Host "目前資料夾：$(Get-Location)"
Write-Host "目標環境：$TargetLabel"
Write-Host "環境設定檔：$EnvFileName"
Write-Host "Supabase project ref：$projectRef"
Write-Host ''

Invoke-Supabase --version
if ($LASTEXITCODE -ne 0) {
    Fail '無法執行 Supabase CLI。請確認 Node.js、npx 與 Supabase CLI 安裝狀態。'
}

Write-Host ''
Write-Host '確認 Supabase 登入狀態...'
Invoke-Supabase projects list *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '尚未登入 Supabase，即將開啟瀏覽器進行登入...'
    Write-Host ''
    Invoke-Supabase login
    if ($LASTEXITCODE -ne 0) {
        Fail '登入失敗。請確認網路連線後再試。'
    }
}

if ($WithMigrations) {
    Write-Host ''
    Write-Host "切換 Supabase CLI 連線目標到 $TargetLabel（$projectRef）..."
    Write-Host '若要求輸入資料庫密碼，請到 Supabase 後台 Project Settings → Database 查看。'
    Write-Host ''
    # 一定要先 link 到目標專案，否則 db push 會推到上次 link 的專案（可能是正式環境）。
    Invoke-Supabase link --project-ref $projectRef
    if ($LASTEXITCODE -ne 0) {
        Fail '切換連線目標失敗，已停止，沒有套用任何資料庫變更。'
    }

    Write-Host ''
    Write-Host "以下是這次會套用到 $TargetLabel 資料庫的 migration："
    Write-Host ''
    Invoke-Supabase db push --dry-run
    if ($LASTEXITCODE -ne 0) {
        Fail '檢查 migration 失敗，已停止，沒有套用任何資料庫變更。'
    }

    Write-Host ''
    $confirmPush = Read-Host "確定要套用到 $TargetLabel 資料庫嗎？輸入 y 繼續，其他鍵跳過"
    if ($confirmPush -eq 'y') {
        Write-Host ''
        Invoke-Supabase db push
        if ($LASTEXITCODE -ne 0) {
            Fail '套用 migration 失敗，已停止，不會繼續部署雲端功能。'
        }
        Write-Host ''
        Write-Host "✓ 資料庫 migration 已套用到 $TargetLabel"
    }
    else {
        Write-Host '已跳過資料庫 migration。'
    }
}

Write-Host ''
$failed = @()
foreach ($functionName in $functions) {
    Write-Host "正在部署 $functionName..."
    Invoke-Supabase functions deploy $functionName --project-ref $projectRef --no-verify-jwt
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ $functionName 部署成功"
    }
    else {
        Write-Host "✗ $functionName 部署失敗"
        $failed += $functionName
    }
    Write-Host ''
}

if ($failed.Count -eq 0) {
    Write-Host "完成。所有雲端功能已成功部署到 $TargetLabel。"
}
else {
    Write-Host '以下功能部署失敗，請確認錯誤訊息後重試：'
    foreach ($functionName in $failed) {
        Write-Host "  - $functionName"
    }
}

Pause-And-Exit 0
