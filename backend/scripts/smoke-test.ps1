# =============================================================================
# Smoke test end-to-end da API GASTIFY
# =============================================================================
# Exercita o fluxo real do app contra um servidor rodando:
#   saúde -> cadastro -> login -> CRUD -> filtros -> agregações -> remoção
#
# Uso (com a API no ar em outra janela):
#     powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1
#     powershell -ExecutionPolicy Bypass -File scripts\smoke-test.ps1 -BaseUrl http://127.0.0.1:8010
#
# Sai com código 1 se qualquer etapa falhar (útil em CI).
# =============================================================================

param(
    [string]$BaseUrl = "http://127.0.0.1:8000"
)

$ErrorActionPreference = "Stop"
$falhas = 0

function Passo([string]$titulo, [scriptblock]$acao) {
    try {
        $resultado = & $acao
        Write-Host "  [OK] $titulo" -ForegroundColor Green
        return $resultado
    } catch {
        $script:falhas++
        Write-Host "  [FALHOU] $titulo -> $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

Write-Host "GASTIFY smoke test em $BaseUrl" -ForegroundColor Cyan

# --- 1. Saúde ---------------------------------------------------------------
Passo "GET /health" {
    $r = Invoke-RestMethod "$BaseUrl/health" -TimeoutSec 20
    if ($r.status -ne "ok") { throw "status=$($r.status)" }
    $r
} | Out-Null

# --- 2. Cadastro ------------------------------------------------------------
$email = "smoke-$(Get-Random)@gastify.dev"
$senha = "senha12345"

Passo "POST /auth/registrar" {
    Invoke-RestMethod "$BaseUrl/api/v1/auth/registrar" -Method Post -ContentType "application/json" `
        -Body (@{ nome = "Smoke Test"; email = $email; senha = $senha } | ConvertTo-Json) -TimeoutSec 20
} | Out-Null

# --- 3. Login ---------------------------------------------------------------
$token = Passo "POST /auth/login" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/auth/login" -Method Post -ContentType "application/json" `
        -Body (@{ email = $email; senha = $senha } | ConvertTo-Json) -TimeoutSec 20
    if (-not $r.access_token) { throw "sem access_token" }
    $r.access_token
}
if (-not $token) { Write-Host "Sem token: abortando." -ForegroundColor Red; exit 1 }

$cabecalhos = @{ Authorization = "Bearer $token" }
$hoje = (Get-Date).ToString("yyyy-MM-dd")
$ontem = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

# --- 4. Usuário atual -------------------------------------------------------
Passo "GET /auth/eu" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/auth/eu" -Headers $cabecalhos -TimeoutSec 20
    if ($r.email -ne $email) { throw "e-mail divergente" }
    $r
} | Out-Null

# --- 5. CRUD -----------------------------------------------------------------
$gasto = Passo "POST /gastos" {
    Invoke-RestMethod "$BaseUrl/api/v1/gastos" -Method Post -Headers $cabecalhos -ContentType "application/json" `
        -Body (@{ nome = "Cafe"; valor = 12.5; data = $hoje; categoria = "alimentacao" } | ConvertTo-Json) -TimeoutSec 20
}
Passo "POST /gastos (lazer)" {
    Invoke-RestMethod "$BaseUrl/api/v1/gastos" -Method Post -Headers $cabecalhos -ContentType "application/json" `
        -Body (@{ nome = "Cinema"; valor = 45.9; data = $hoje; categoria = "lazer" } | ConvertTo-Json) -TimeoutSec 20
} | Out-Null
Passo "POST /gastos (ontem)" {
    Invoke-RestMethod "$BaseUrl/api/v1/gastos" -Method Post -Headers $cabecalhos -ContentType "application/json" `
        -Body (@{ nome = "Padaria"; valor = 8; data = $ontem; categoria = "alimentacao" } | ConvertTo-Json) -TimeoutSec 20
} | Out-Null

$doDia = Passo "GET /gastos?data=hoje" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/gastos?data=$hoje" -Headers $cabecalhos -TimeoutSec 20
    if ($r.total -ne 2) { throw "esperado 2, veio $($r.total)" }
    $r
}
Passo "GET /gastos?categoria=lazer" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/gastos?categoria=lazer" -Headers $cabecalhos -TimeoutSec 20
    if ($r.total -ne 1) { throw "esperado 1, veio $($r.total)" }
    $r
} | Out-Null

Passo "PUT /gastos/{id}" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/gastos/$($gasto.id)" -Method Put -Headers $cabecalhos -ContentType "application/json" `
        -Body (@{ valor = 15.75 } | ConvertTo-Json) -TimeoutSec 20
    if ($r.valor -ne 15.75) { throw "valor nao atualizado" }
    $r
} | Out-Null

# --- 6. Agregações -----------------------------------------------------------
Passo "GET /agregacoes/resumo" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/agregacoes/resumo?data=$hoje" -Headers $cabecalhos -TimeoutSec 20
    if ($r.quantidade -ne 2) { throw "quantidade=$($r.quantidade)" }
    $r
} | Out-Null

Passo "GET /agregacoes/mensal" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/agregacoes/mensal?ano=$(Get-Date -Format yyyy)&mes=$(Get-Date -Format MM)" -Headers $cabecalhos -TimeoutSec 20
    if ($r.total -le 0) { throw "total zerado" }
    $r
} | Out-Null

Passo "GET /agregacoes/anual" {
    $r = Invoke-RestMethod "$BaseUrl/api/v1/agregacoes/anual?ano=$(Get-Date -Format yyyy)" -Headers $cabecalhos -TimeoutSec 20
    if ($r.por_mes.Count -ne 12) { throw "esperado 12 meses" }
    $r
} | Out-Null

# --- 7. Segurança ------------------------------------------------------------
Passo "GET /gastos sem token deve dar 401" {
    try {
        Invoke-RestMethod "$BaseUrl/api/v1/gastos" -TimeoutSec 20 | Out-Null
        throw "deveria ter falhado"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw "status inesperado" }
    }
} | Out-Null

# --- 8. Remoção --------------------------------------------------------------
Passo "DELETE /gastos/{id}" {
    Invoke-RestMethod "$BaseUrl/api/v1/gastos/$($gasto.id)" -Method Delete -Headers $cabecalhos -TimeoutSec 20 | Out-Null
    $depois = Invoke-RestMethod "$BaseUrl/api/v1/gastos?data=$hoje" -Headers $cabecalhos -TimeoutSec 20
    if ($depois.total -ne 1) { throw "esperado 1 apos remocao, veio $($depois.total)" }
} | Out-Null

Write-Host ""
if ($falhas -eq 0) {
    Write-Host "SMOKE TEST: TUDO OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SMOKE TEST: $falhas etapa(s) com falha" -ForegroundColor Red
    exit 1
}
