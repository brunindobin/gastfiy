# =============================================================================
# MongoDB portátil do GASTIFY — banco secundário do Double Backup
# =============================================================================
# Uso (a partir de backend/):
#     powershell -ExecutionPolicy Bypass -File scripts\mongo-local.ps1 start
#     powershell -ExecutionPolicy Bypass -File scripts\mongo-local.ps1 status
#     powershell -ExecutionPolicy Bypass -File scripts\mongo-local.ps1 stop
#
# O MongoDB é OPCIONAL para a API funcionar: se ele estiver fora, o PostgreSQL
# continua sendo a fonte da verdade e o espelho apenas deixa de ser atualizado
# (a falha fica registrada no log). Use este script quando quiser validar o
# Double Backup de verdade.
#
# Caminhos padrão (disco E:, sem admin):
#     binários -> E:\gastify\mongodb\bin\mongod.exe
#     dados    -> E:\gastify\mongodata
# =============================================================================

param(
    [ValidateSet("start", "stop", "status")]
    [string]$Acao = "status",
    [int]$Porta = 27017
)

$ErrorActionPreference = "Stop"

# Permite usar outro disco/pasta sem editar o script.
$Raiz   = if ($env:GASTIFY_PG_DIR) { $env:GASTIFY_PG_DIR } elseif (Test-Path "E:\") { "E:\gastify" } else { Join-Path $env:LOCALAPPDATA "gastify" }
$MongoBin = Join-Path $Raiz "mongodb\bin\mongod.exe"
$Dados    = Join-Path $Raiz "mongodata"
$Log      = Join-Path $Raiz "mongod.log"

if (-not (Test-Path $MongoBin)) {
    throw "mongod.exe nao encontrado em $MongoBin. Extraia o zip oficial em $Raiz\mongodb."
}

switch ($Acao) {
    "start" {
        if (-not (Test-Path $Dados)) { New-Item -ItemType Directory -Force $Dados | Out-Null }
        # `--bind_ip 127.0.0.1` deixa o banco acessível apenas na máquina local.
        # Sem autenticação de propósito: uso exclusivamente de desenvolvimento.
        # Em produção, habilite --auth e crie usuário/senha (vindos do .env).
        $processo = Start-Process -FilePath $MongoBin `
            -ArgumentList "--dbpath", "`"$Dados`"", "--port", "$Porta", "--bind_ip", "127.0.0.1", "--logpath", "`"$Log`"", "--logappend" `
            -PassThru -WindowStyle Hidden
        Start-Sleep -Seconds 3
        if ($processo.HasExited) { throw "MongoDB encerrou ao iniciar. Veja $Log." }
        Write-Host "MongoDB rodando em 127.0.0.1:$Porta (PID $($processo.Id))" -ForegroundColor Green
    }
    "stop" {
        # Encerra apenas o mongod desta máquina (uso de desenvolvimento).
        $processos = Get-Process mongod -ErrorAction SilentlyContinue
        if (-not $processos) { Write-Host "MongoDB ja esta parado."; break }
        $processos | Stop-Process -Force
        Write-Host "MongoDB parado." -ForegroundColor Yellow
    }
    "status" {
        $processos = Get-Process mongod -ErrorAction SilentlyContinue
        if ($processos) { Write-Host "MongoDB rodando (PID $($processos.Id -join ', '))" -ForegroundColor Green }
        else { Write-Host "MongoDB parado." -ForegroundColor Yellow }
    }
}
