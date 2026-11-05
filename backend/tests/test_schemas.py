"""Testes dos schemas Pydantic (`GastoCreate`, `GastoUpdate`, `GastoRead`).

Por que estes testes importam mais que os de endpoint nesta fase: o schema é a
ÚNICA porta de entrada de dados do usuário. Se ele deixar passar valor negativo,
nome em branco, categoria inventada ou data futura, o banco recebe lixo — e é
exatamente esse tipo de entrada que abre espaço para abuso.

Todos os testes rodam sem banco: validação é puramente em memória.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.models import CategoriaGasto, Gasto
from app.schemas import GastoCreate, GastoRead, GastoUpdate

HOJE = date.today()


def _payload_valido(**ajustes) -> dict:
    """Payload mínimo válido, sobrescrito pelos testes conforme o caso."""
    dados = {"nome": "Aluguel", "valor": "1500.00", "data": HOJE.isoformat()}
    dados.update(ajustes)
    return dados


# ---------------------------------------------------------------------------
# Caminho feliz
# ---------------------------------------------------------------------------
def test_cria_gasto_com_categoria_padrao() -> None:
    """Sem categoria no payload, o padrão deve ser OUTROS."""
    gasto = GastoCreate(**_payload_valido())

    assert gasto.categoria is CategoriaGasto.OUTROS
    assert gasto.valor == Decimal("1500.00")


def test_sanitiza_espacos_do_nome() -> None:
    """Nome com espaços nas pontas é normalizado (evita poluir listagens)."""
    gasto = GastoCreate(**_payload_valido(nome="   Cinema   "))

    assert gasto.nome == "Cinema"


def test_normaliza_valor_para_duas_casas() -> None:
    """19.5 deve virar 19.50 (formato financeiro previsível)."""
    gasto = GastoCreate(**_payload_valido(valor="19.5"))

    assert gasto.valor == Decimal("19.50")


def test_aceita_categoria_valida_em_minusculas() -> None:
    """A API usa slugs em minúsculas — o que o app Android envia."""
    gasto = GastoCreate(**_payload_valido(categoria="lazer"))

    assert gasto.categoria is CategoriaGasto.LAZER


# ---------------------------------------------------------------------------
# Entradas inválidas (todas devem gerar 422 no endpoint, nunca 500)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("valor_invalido", ["0", "-0.01", "-10"])
def test_rejeita_valor_nao_positivo(valor_invalido: str) -> None:
    """Valor zero ou negativo é recusado na validação."""
    with pytest.raises(ValidationError):
        GastoCreate(**_payload_valido(valor=valor_invalido))


def test_rejeita_valor_com_tres_casas_decimais() -> None:
    """Mais de 2 casas é recusado com mensagem clara (não truncado em silêncio)."""
    with pytest.raises(ValidationError):
        GastoCreate(**_payload_valido(valor="19.999"))


def test_rejeita_nome_apenas_com_espacos() -> None:
    """`min_length` não pega "   "; o validador de sanitização pega."""
    with pytest.raises(ValidationError):
        GastoCreate(**_payload_valido(nome="   "))


def test_rejeita_categoria_inexistente() -> None:
    """Categoria fora do Enum não entra no banco."""
    with pytest.raises(ValidationError):
        GastoCreate(**_payload_valido(categoria="viagens"))


def test_rejeita_data_futura() -> None:
    """Regra de negócio: gasto é despesa realizada, não planejada."""
    amanha = (HOJE + timedelta(days=1)).isoformat()

    with pytest.raises(ValidationError):
        GastoCreate(**_payload_valido(data=amanha))


def test_rejeita_campo_desconhecido() -> None:
    """`extra=forbid` bloqueia mass assignment (ex.: tentar definir `id`)."""
    with pytest.raises(ValidationError):
        GastoCreate(**_payload_valido(id=str(uuid.uuid4())))


# ---------------------------------------------------------------------------
# GastoUpdate
# ---------------------------------------------------------------------------
def test_update_vazio_e_detectado() -> None:
    """PUT sem campos deve ser recusado pelo serviço (evita UPDATE inútil)."""
    assert GastoUpdate().esta_vazio() is True


def test_update_parcial_nao_e_vazio() -> None:
    """Enviar apenas um campo já caracteriza atualização válida."""
    assert GastoUpdate(valor="99.90").esta_vazio() is False


def test_update_tambem_valida_data_futura() -> None:
    """A mesma regra de negócio vale na atualização parcial."""
    amanha = HOJE + timedelta(days=1)

    with pytest.raises(ValidationError):
        GastoUpdate(data=amanha)


# ---------------------------------------------------------------------------
# GastoRead (contrato de saída consumido pelo app)
# ---------------------------------------------------------------------------
def test_read_serializa_valor_como_numero_e_rotulo_da_categoria() -> None:
    """O app recebe `valor` numérico e o rótulo pronto em PT-BR."""
    instante = datetime.now(timezone.utc)
    registro = Gasto(
        id=uuid.uuid4(),
        nome="Cinema",
        valor=Decimal("45.90"),
        data=HOJE,
        categoria=CategoriaGasto.LAZER,
        criado_em=instante,
        atualizado_em=instante,
    )

    saida = GastoRead.model_validate(registro)
    json_saida = saida.model_dump(mode="json")

    assert json_saida["valor"] == 45.9          # número, não string
    assert json_saida["categoria"] == "lazer"   # slug estável
    assert json_saida["categoria_rotulo"] == "Lazer"  # texto para a UI
