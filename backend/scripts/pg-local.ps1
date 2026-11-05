# =============================================================================
# PostgreSQL portátil do GASTIFY — liga/desliga o banco local sem instalador
# =============================================================================
# Uso (a partir de backend/):
#     powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 status
#     powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 start
#     powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 stop
#     powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 init     # 1ª vez
#     powershell -ExecutionPolicy Bypass -File scripts\pg-local.ps1 psql     # console SQL
#
# Por que existe: em máquinas sem Docker e sem permissão de administrador, os
# binários ZIP do PostgreSQL rodam direto do usuário. O script evita decorar
# caminhos/comandos do pg_ctl.
#
# SEGURANÇA: a senha NUNCA fica neste arquivo — ela é lida do backend/.env
# (que está no .gitignore). O script só falha se o .env não existir.
# =============================================================================

param(
    [ValidateSet("init", "start", "stop", "status", "psql")]
    [string]$Acao = "status",
    [int]$Porta = 0   # 0 = usa POSTGRES_PORT do .env
)

$ErrorActionPreference = "Stop"

# --- Caminhos (usuário, sem precisar de admin) -------------------------------
# Local escolhido: E:\gastify (disco com mais espaço nesta máquina). Para usar
# outro local, defina a variável de ambiente GASTIFY_PG_DIR antes de chamar o
# script — nada fica fixo em C:.
$Raiz = if ($env:GASTIFY_PG_DIR) { $env:GASTIFY_PG_DIR } elseif (Test-Path "E:\") { "E:\gastify" } else { Join-Path $env:LOCALAPPDATA "gastify" }
$PgBin  = Join-Path $Raiz "pgsql\bin"
$PgData = Join-Path $Raiz "pgdata"
$PgLog  = Join-Path $Raiz "postgres.log"

# --- Credenciais vindas do .env ---------------------------------------------
$ArquivoEnv = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (-not (Test-Path $ArquivoEnv)) {
    throw "Arquivo .env nao encontrado em $ArquivoEnv. Copie .env.example para .env e preencha POSTGRES_PASSWORD."
}

$EnvVars = @{}
Get-Content $ArquivoEnv | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
        $EnvVars[$Matches[1]] = $Matches[2].Trim()
    }
}

$Usuario = if ($EnvVars["POSTGRES_USER"]) { $EnvVars["POSTGRES_USER"] } else { "postgres" }
$Senha   = $EnvVars["POSTGRES_PASSWORD"]
$Banco   = if ($EnvVars["POSTGRES_DB"])   { $EnvVars["POSTGRES_DB"] }   else { "gastify" }
if ($Porta -eq 0) { $Porta = if ($EnvVars["POSTGRES_PORT"]) { [int]$EnvVars["POSTGRES_PORT"] } else { 5432 } }

if (-not $Senha) { throw "POSTGRES_PASSWORD vazio no .env." }
if (-not (Test-Path (Join-Path $PgBin "pg_ctl.exe"))) {
    throw "Binarios do PostgreSQL nao encontrados em $PgBin. Baixe o zip oficial e extraia la (ver README)."
}

switch ($Acao) {
    "init" {
        # Primeira execução: cria o cluster de dados com senha forte em SCRAM.
        if (Test-Path $PgData) { throw "Ja existe cluster em $PgData. Use 'start'." }
        $ArquivoSenha = Join-Path $env:TEMP "gastify-pg-senha.txt"
        # Senha vai por arquivo temporário (nunca por linha de comando, que fica
        # visível no histórico/processos) e é apagada em seguida.
        Set-Content -Path $ArquivoSenha -Value $Senha -NoNewline
        try {
            & (Join-Path $PgBin "initdb.exe") -D $PgData -U $Usuario -E UTF8 --locale=C `
                --auth=scram-sha-256 --pwfile=$ArquivoSenha | Out-Host
        } finally {
            Remove-Item $ArquivoSenha -Force -ErrorAction SilentlyContinue
        }
        & $PSCommandPath -Acao start -Porta $Porta
        Start-Sleep -Seconds 2
        # Cria o banco da aplicação se ainda não existir.
        # A conexão TCP exige senha (SCRAM): passamos via PGPASSWORD para o
        # comando não ficar travado esperando digitação.
        $env:PGPASSWORD = $Senha
        try {
            & (Join-Path $PgBin "createdb.exe") -h 127.0.0.1 -p $Porta -U $Usuario $Banco
        } finally {
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        }
        Write-Host "Banco '$Banco' pronto em 127.0.0.1:$Porta" -ForegroundColor Green
    }
    "start" {
        & (Join-Path $PgBin "pg_ctl.exe") -D $PgData -l $PgLog -o "-p $Porta" -w start
    }
    "stop" {
        & (Join-Path $PgBin "pg_ctl.exe") -D $PgData -m fast stop
    }
    "status" {
        & (Join-Path $PgBin "pg_ctl.exe") -D $PgData status
    }
    "psql" {
        # Senha via PGPASSWORD (não fica no histórico de comandos e evita prompt).
        $env:PGPASSWORD = $Senha
        try {
            & (Join-Path $PgBin "psql.exe") -h 127.0.0.1 -p $Porta -U $Usuario -d $Banco
        } finally {
            Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        }
    }
}
