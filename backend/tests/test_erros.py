"""Testes do tratamento global de erros (regra "no leak" do AGENTS.md).

Montamos uma aplicação mínima com os MESMOS handlers registrados por
`app.main.create_app`. Assim testamos a política de erro sem depender de rotas
que ainda não existem (o CRUD só chega na Fase 3).

O que precisa ser verdade, sempre:
  * erro de negócio -> status correto + JSON `{erro, codigo}`;
  * erro inesperado -> 500 genérico, SEM stack trace e SEM o texto original;
  * nada de SQL, nome de tabela, host ou senha na resposta.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.exceptions import ErroNaoEncontrado, ErroValidacaoNegocio, registrar_handlers


def _app_com_handlers() -> FastAPI:
    """Cria uma app isolada só com os handlers e rotas que explodem de propósito."""
    app = FastAPI()
    registrar_handlers(app)

    @app.get("/erro-negocio")
    def erro_negocio() -> None:
        raise ErroNaoEncontrado("Gasto não encontrado.")

    @app.get("/erro-regra")
    def erro_regra() -> None:
        raise ErroValidacaoNegocio("A data do gasto não pode ser futura.")

    @app.get("/erro-generico")
    def erro_generico() -> None:
        # Mensagem "vazada" de propósito: simula driver/ORM revelando detalhe
        # interno. Ela NÃO pode aparecer na resposta HTTP.
        raise RuntimeError("password=super-secreta host=db-interno")

    return app


def test_erro_de_negocio_devolve_json_padronizado() -> None:
    """404 de domínio com mensagem amigável e código estável."""
    cliente = TestClient(_app_com_handlers())

    resposta = cliente.get("/erro-negocio")

    assert resposta.status_code == 404
    assert resposta.json() == {"erro": "Gasto não encontrado.", "codigo": "NAO_ENCONTRADO"}


def test_erro_de_regra_devolve_422() -> None:
    """Violação de regra de negócio => 422 (o app sabe que o dado é inválido)."""
    cliente = TestClient(_app_com_handlers())

    resposta = cliente.get("/erro-regra")

    assert resposta.status_code == 422
    assert resposta.json()["codigo"] == "REGRA_NEGOCIO"


def test_erro_inesperado_nao_vaza_detalhe_interno() -> None:
    """Erro não tratado => 500 genérico, sem stack trace nem credenciais."""
    # `raise_server_exceptions=False` faz o TestClient se comportar como um
    # cliente real: recebe a resposta do handler em vez de propagar a exceção.
    cliente = TestClient(_app_com_handlers(), raise_server_exceptions=False)

    resposta = cliente.get("/erro-generico")

    assert resposta.status_code == 500
    corpo = resposta.json()
    assert corpo["erro"] == "Erro interno no servidor"
    assert corpo["codigo"] == "ERRO_INTERNO"

    texto = resposta.text.lower()
    for vazamento in ("super-secreta", "password", "host", "traceback", "runtimeerror"):
        assert vazamento not in texto
