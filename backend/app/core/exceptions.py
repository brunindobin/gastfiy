"""Exceções de domínio e handlers globais de erro da API.

Objetivo de segurança (regra "no leak"): qualquer falha devolvida ao cliente é
um JSON curto, em português, sem stack trace, sem SQL, sem nome de tabela e sem
credenciais. O erro real (com traceback) é registrado apenas no log interno do
servidor, via `logging`.

Formato padrão de erro adotado:
    {
      "erro": "Mensagem amigável em PT-BR",
      "codigo": "CODIGO_ESTAVEL_PARA_O_APP",
      "detalhes": ["..."]            # opcional, nunca contém dados sensíveis
    }
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Logger do módulo: os handlers usam este logger (e não `print`) para que a
# equipe possa direcionar os logs para arquivo/observabilidade depois.
logger = logging.getLogger("gastify.erros")


# ---------------------------------------------------------------------------
# Exceções de domínio
# ---------------------------------------------------------------------------
class ErroGastify(Exception):
    """Erro de negócio base, já com status HTTP e código estáveis.

    Usar exceções tipadas (em vez de HTTPException espalhada nos routers) mantém
    a camada de serviços independente do FastAPI e garante respostas uniformes.
    """

    status_code: int = 500
    mensagem_padrao: str = "Erro interno no servidor"
    codigo: str = "ERRO_INTERNO"

    def __init__(
        self,
        mensagem: str | None = None,
        *,
        detalhes: list[str] | None = None,
        codigo: str | None = None,
    ) -> None:
        self.mensagem = mensagem or self.mensagem_padrao
        self.detalhes = detalhes or []
        self.codigo = codigo or self.codigo
        super().__init__(self.mensagem)


class ErroValidacaoNegocio(ErroGastify):
    """Regra de negócio violada (ex.: data no futuro). Retorna 422."""

    status_code = 422
    mensagem_padrao = "Regra de negócio violada"
    codigo = "REGRA_NEGOCIO"


class ErroNaoEncontrado(ErroGastify):
    """Recurso inexistente (ex.: gasto com id desconhecido). Retorna 404."""

    status_code = 404
    mensagem_padrao = "Recurso não encontrado"
    codigo = "NAO_ENCONTRADO"


class ErroConflito(ErroGastify):
    """Conflito com o estado atual (ex.: e-mail já cadastrado). Retorna 409."""

    status_code = 409
    mensagem_padrao = "Conflito ao processar a requisição"
    codigo = "CONFLITO"


class ErroNaoAutorizado(ErroGastify):
    """Falta de credenciais válidas (usado a partir da Fase 2, com JWT)."""

    status_code = 401
    mensagem_padrao = "Credenciais inválidas"
    codigo = "NAO_AUTORIZADO"


class ErroBancoIndisponivel(ErroGastify):
    """Banco principal fora do ar. Retorna 503 para o app tentar de novo depois."""

    status_code = 503
    mensagem_padrao = "Serviço temporariamente indisponível. Tente novamente em instantes."
    codigo = "BANCO_INDISPONIVEL"


class ErroConfiguracao(ErroGastify):
    """Configuração inválida (ex.: SECRET_KEY ausente).

    Responde 500 genérico para o cliente (sem revelar qual variável falta) e
    registra o problema real no log do servidor.
    """

    status_code = 500
    mensagem_padrao = "Erro interno no servidor"
    codigo = "ERRO_INTERNO"


# ---------------------------------------------------------------------------
# Tradução de mensagens de validação do Pydantic
# ---------------------------------------------------------------------------
# O Pydantic responde em inglês por padrão. Para o app Android exibir algo
# compreensível (e sem jargão técnico), traduzimos os tipos mais comuns.
TRADUCOES_VALIDACAO: dict[str, str] = {
    "missing": "Campo obrigatório.",
    "string_type": "Deve ser um texto.",
    "string_too_short": "Texto muito curto (mínimo de {min_length} caractere(s)).",
    "string_too_long": "Texto muito longo (máximo de {max_length} caractere(s)).",
    "greater_than": "Deve ser maior que {gt}.",
    "greater_than_equal": "Deve ser maior ou igual a {ge}.",
    "less_than": "Deve ser menor que {lt}.",
    "less_than_equal": "Deve ser menor ou igual a {le}.",
    "decimal_parsing": "Informe um número válido (ex.: 19.90).",
    "decimal_max_places": "Use no máximo {decimal_places} casas decimais.",
    "decimal_type": "Informe um número válido (ex.: 19.90).",
    "int_parsing": "Informe um número inteiro válido.",
    "int_type": "Informe um número inteiro válido.",
    "date_parsing": "Data inválida. Use o formato AAAA-MM-DD.",
    "date_from_datetime_parsing": "Data inválida. Use o formato AAAA-MM-DD.",
    "date_type": "Data inválida. Use o formato AAAA-MM-DD.",
    "enum": "Valor não permitido para este campo.",
    "uuid_parsing": "Identificador inválido.",
    "json_invalid": "O corpo da requisição não é um JSON válido.",
}


def _traduzir_erro_validacao(erro: dict[str, Any]) -> str:
    """Converte um item de erro do Pydantic em mensagem amigável em PT-BR.

    Recebe o dicionário cru do Pydantic e devolve apenas texto. Nunca devolvemos
    o campo `input`, pois ele pode conter dados do usuário (possível vetor de
    vazamento/reflexão de conteúdo).
    """
    tipo = str(erro.get("type", ""))
    contexto = erro.get("ctx") or {}

    if tipo == "value_error":
        # Validadores próprios já lançam ValueError com texto em português.
        mensagem = str(erro.get("msg", "")).removeprefix("Value error, ").strip()
        return mensagem or "Valor inválido."

    template = TRADUCOES_VALIDACAO.get(tipo)
    if not template:
        return "Valor inválido."
    try:
        return template.format(**contexto)
    except (KeyError, IndexError):
        return "Valor inválido."


def _nome_do_campo(localizacao: tuple[Any, ...] | list[Any]) -> str:
    """Extrai o nome do campo a partir da localização (`loc`) do Pydantic.

    `loc` costuma vir como ("body", "valor"); descartamos o primeiro elemento
    (origem: body/query/path) para o app receber só "valor".
    """
    partes = [str(p) for p in localizacao if p not in ("body", "query", "path", "header")]
    return ".".join(partes) or "corpo"


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
async def handler_erro_gastify(_: Request, exc: ErroGastify) -> JSONResponse:
    """Responde qualquer `ErroGastify` com o JSON padrão e o status definido."""
    corpo: dict[str, Any] = {"erro": exc.mensagem, "codigo": exc.codigo}
    if exc.detalhes:
        corpo["detalhes"] = exc.detalhes
    return JSONResponse(status_code=exc.status_code, content=corpo)


async def handler_validacao(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Trata erros de validação do Pydantic (422) sem expor detalhes internos."""
    detalhes = [
        {
            "campo": _nome_do_campo(erro.get("loc", ())),
            "mensagem": _traduzir_erro_validacao(erro),
        }
        for erro in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"erro": "Dados inválidos", "codigo": "VALIDACAO", "detalhes": detalhes},
    )


# Mensagens amigáveis para os status HTTP mais comuns levantados pelo Starlette.
MENSAGENS_HTTP: dict[int, str] = {
    400: "Requisição inválida",
    401: "Não autorizado. Faça login novamente.",
    403: "Acesso negado",
    404: "Rota não encontrada",
    405: "Método não permitido para esta rota",
    409: "Conflito ao processar a requisição",
    422: "Dados inválidos",
    429: "Muitas requisições. Aguarde alguns instantes.",
}


async def handler_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Padroniza respostas HTTP do Starlette (ex.: 404 de rota inexistente)."""
    mensagem = MENSAGENS_HTTP.get(exc.status_code, "Não foi possível processar a requisição")
    return JSONResponse(
        status_code=exc.status_code,
        content={"erro": mensagem, "codigo": f"HTTP_{exc.status_code}"},
    )


async def handler_banco(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Captura falhas de banco: devolve 503 genérico e loga o erro real.

    `logger.exception` grava o traceback completo no log interno — o cliente
    recebe apenas a mensagem amigável, sem SQL, tabela ou credenciais.
    """
    logger.exception("Falha de banco de dados não tratada: %s", exc.__class__.__name__)
    return JSONResponse(
        status_code=503,
        content={
            "erro": "Serviço temporariamente indisponível. Tente novamente em instantes.",
            "codigo": "BANCO_INDISPONIVEL",
        },
    )


async def handler_generico(_: Request, exc: Exception) -> JSONResponse:
    """Rede de segurança final: qualquer erro inesperado vira 500 amigável.

    O detalhe técnico vai para o log (`logger.exception`) e JAMAIS para a
    resposta HTTP — requisito explícito de segurança do GASTIFY.
    """
    logger.exception("Erro não tratado na API: %s", exc.__class__.__name__)
    return JSONResponse(
        status_code=500,
        content={
            "erro": "Erro interno no servidor",
            "codigo": "ERRO_INTERNO",
        },
    )


def registrar_handlers(app: FastAPI) -> None:
    """Registra todos os handlers globais na instância do FastAPI.

    Chamado por `app/main.py`. A ordem não importa para o FastAPI (o mapeamento é
    por tipo de exceção), mas manter tudo centralizado aqui garante que novos
    routers já nasçam protegidos pelo tratamento amigável de erros.
    """
    app.add_exception_handler(ErroGastify, handler_erro_gastify)
    app.add_exception_handler(RequestValidationError, handler_validacao)
    app.add_exception_handler(StarletteHTTPException, handler_http)
    app.add_exception_handler(SQLAlchemyError, handler_banco)
    app.add_exception_handler(Exception, handler_generico)
