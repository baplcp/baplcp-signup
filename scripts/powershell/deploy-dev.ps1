$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'deploy-supabase.ps1') `
    -TargetLabel '測試環境' `
    -EnvFileName '.env.development' `
    -WithMigrations
