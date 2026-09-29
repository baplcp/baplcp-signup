$ErrorActionPreference = 'Stop'

& (Join-Path $PSScriptRoot 'deploy-supabase.ps1') `
    -TargetLabel '正式環境' `
    -EnvFileName '.env.production' `
    -WithMigrations
