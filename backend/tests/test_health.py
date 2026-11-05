"""Testes dos endpoints de fundação: `/`, `/health/live` e `/health`.

Estratégia: nenhum teste abre conexão real com o PostgreSQL. A função que fala
com o banco (`verificar_conexao_banco`) é substituída por `monkeypatch`, o que
permite testar os DOIS caminhos do `/health` (banco ok e banco fora) de forma
rápida e determinística — requisito de uma suíte que roda em CI sem banco.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.routers import health as health_router

# Cliente em memória: exercita a aplicação real (middlewares, routers, handlers)
# sem abrir porta de rede.
cliente = TestClient(app)


def test_raiz_devolve_metadados_sem_vazar_configuracao() -> None:
    """`GET /` deve responder 200 com metadados e sem dados sensíveis."""
    resposta = cliente.get("/")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["status"] == "online"
    assert corpo["versao"]
    assert corpo["ambiente"] == "test"

    # Regra de segurança: a resposta pública não pode conter credenciais.
    texto = resposta.text.lower()
    for termo_proibido in ("senha", "password", "postgres", "secret", "token"):
        assert termo_proibido not in texto


def test_liveness_nao_depende_do_banco() -> None:
    """`/health/live` deve responder 200 mesmo sem banco configurado."""
    resposta = cliente.get("/health/live")

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


def test_health_ok_quando_banco_responde(monkeypatch) -> None:
    """Banco disponível => 200 e status `ok`."""
    monkeypatch.setattr(health_router, "verificar_conexao_banco", lambda: True)

    resposta = cliente.get("/health")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["status"] == "ok"
    assert corpo["database"] == "connected"


def test_health_degradado_quando_banco_falha(monkeypatch) -> None:
    """Banco fora do ar => 503 (degradado), nunca 500 nem stack trace."""
    monkeypatch.setattr(health_router, "verificar_conexao_banco", lambda: False)

    resposta = cliente.get("/health")

    assert resposta.status_code == 503
    corpo = resposta.json()
    assert corpo["status"] == "degraded"
    assert corpo["database"] == "unavailable"
    # Sem detalhe técnico na resposta.
    assert "Traceback" not in resposta.text


def test_rota_inexistente_usa_json_amigavel() -> None:
    """404 deve seguir o formato do projeto (`erro`/`codigo`), não o padrão."""
    resposta = cliente.get("/rota-que-nao-existe")

    assert resposta.status_code == 404
    corpo = resposta.json()
    assert corpo["erro"]
    assert corpo["codigo"] == "HTTP_404"
    assert "detail" not in corpo


def test_router_de_gastos_exige_autenticacao() -> None:
    """O CRUD existe, mas sem token a resposta é 401 (nunca dados)."""
    resposta = cliente.get("/api/v1/gastos")

    assert resposta.status_code == 401
    assert resposta.json()["codigo"] == "NAO_AUTORIZADO"
