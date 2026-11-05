"""Schemas Pydantic v2 do recurso `Gasto` — contrato de entrada e saída da API.

Por que este arquivo existe:
  * **Segurança**: é a única porta de entrada de dados do usuário. Tudo que chega
    por JSON passa por validação/tipagem aqui antes de tocar no ORM — o que
    elimina a possibilidade de injeção (nenhum valor é concatenado em SQL) e
    rejeita payloads malformados com erro 422 amigável.
  * **Contrato**: os mesmos schemas geram a documentação automática do Swagger e
    definem exatamente o JSON que o app Android (e o Postman) recebem.

Decisões de modelagem relevantes:
  * `valor` é `Decimal` (e não `float`): dinheiro exige precisão exata. O JSON de
    SAÍDA, porém, expõe número (`float` com 2 casas), formato que o app Android e
    o Postman consomem sem conversão — ver `GastoRead.valor_serializado`.
  * `data` NÃO pode ser futura. Justificativa: o GASTIFY registra despesas que já
    aconteceram (a home lista "gastos do dia" e o dashboard soma o realizado).
    Aceitar data futura inflaria gráficos com valores que ainda não saíram do
    bolso. A regra fica isolada em um validador: se o produto passar a suportar
    despesas planejadas, basta remover o `if` documentado abaixo.
  * `extra="forbid"`: campos desconhecidos no corpo da requisição geram erro em
    vez de serem silenciosamente ignorados. Isso evita "mass assignment" (tentar
    injetar `id`/`criado_em` no POST) e deixa o erro explícito para o app.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_serializer,
    field_validator,
)

from app.models.gasto import ROTULOS_CATEGORIA, CategoriaGasto

# ---------------------------------------------------------------------------
# Tipos reutilizáveis (evitam repetir as mesmas regras em Create/Update/Read)
# ---------------------------------------------------------------------------
# `NomeGasto`: texto de 1 a 120 caracteres. O `strip` é aplicado por um validador
# para que "   Aluguel " vire "Aluguel" (sanitização de entrada).
NomeGasto = Annotated[str, Field(min_length=1, max_length=120)]

# `ValorGasto`: Decimal positivo, compatível com Numeric(12, 2) do PostgreSQL.
# `gt=0` bloqueia zero/negativo; `max_digits`/`decimal_places` espelham a coluna
# e impedem que o banco seja a primeira linha de defesa a reclamar.
ValorGasto = Annotated[
    Decimal,
    Field(gt=0, max_digits=12, decimal_places=2, description="Valor em reais, maior que zero."),
]


def _validar_nome_sem_espacos(valor: str) -> str:
    """Sanitiza o nome: remove espaços das pontas e recusa texto vazio.

    Por que: nomes como "   " passam na checagem de `min_length` (o tamanho conta
    os espaços) e poluiriam listagens/gráficos. Aqui o valor é normalizado ANTES
    de qualquer uso, então o banco sempre recebe texto limpo.
    """
    limpo = valor.strip()
    if not limpo:
        raise ValueError("O nome do gasto não pode ser vazio.")
    return limpo


def _validar_valor_monetario(valor: Decimal) -> Decimal:
    """Normaliza o valor para exatamente 2 casas decimais.

    Por que: o contrato fica previsível — o que a API devolve é exatamente o que
    foi gravado (Numeric(12,2) no PostgreSQL). Valores com mais de 2 casas já são
    recusados antes daqui pela constraint `decimal_places` do Pydantic (erro 422
    amigável "Use no máximo 2 casas decimais"), então este validador cuida do
    formato: 19.5 -> 19.50, com `ROUND_HALF_UP` (padrão financeiro).
    """
    # `quantize` com expoente -2 => 2 casas decimais; import local para deixar
    # claro que o arredondamento é exclusivo desta validação.
    from decimal import ROUND_HALF_UP

    return valor.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _validar_data_nao_futura(data_gasto: date) -> date:
    """Recusa datas posteriores a hoje (regra de negócio documentada no topo).

    Comparação feita no fuso do servidor (`date.today()`), que é o mesmo usado
    para calcular "gastos do dia" na home do app — assim não há divergência de
    um dia entre validação e listagem.
    """
    if data_gasto > date.today():
        raise ValueError("A data do gasto não pode ser futura.")
    return data_gasto


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class GastoBase(BaseModel):
    """Campos comuns a criação e leitura (evita duplicação de regras)."""

    model_config = ConfigDict(
        extra="forbid",  # campo desconhecido => 422 (proteção contra mass assignment)
        str_strip_whitespace=False,  # o strip é explícito no validador (com mensagem PT-BR)
    )

    nome: NomeGasto = Field(description="Descrição curta do gasto (ex.: Aluguel, Cinema).")
    valor: ValorGasto
    data: date = Field(description="Data em que o gasto ocorreu (AAAA-MM-DD). Não pode ser futura.")
    categoria: CategoriaGasto = Field(
        default=CategoriaGasto.OUTROS,
        description="Categoria do gasto. Omitida => 'outros'.",
    )

    # ----------------------------- Validadores -----------------------------
    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str) -> str:
        """Aplica a sanitização de nome (ver `_validar_nome_sem_espacos`)."""
        return _validar_nome_sem_espacos(valor)

    @field_validator("valor")
    @classmethod
    def validar_valor(cls, valor: Decimal) -> Decimal:
        """Arredonda o valor para 2 casas (ver `_validar_valor_monetario`)."""
        return _validar_valor_monetario(valor)

    @field_validator("data")
    @classmethod
    def validar_data(cls, valor: date) -> date:
        """Garante que a data não está no futuro."""
        return _validar_data_nao_futura(valor)


class GastoCreate(GastoBase):
    """Payload do POST /api/v1/gastos (criação de gasto).

    Não aceita `id` nem timestamps: são gerados pelo servidor/banco, o que
    impede que o cliente escolha identificadores ou forje datas de auditoria.
    """


class GastoUpdate(BaseModel):
    """Payload do PUT/PATCH /api/v1/gastos/{id} — atualização PARCIAL.

    Todos os campos são opcionais: o app pode enviar apenas o que mudou (ex.:
    corrigir o valor). Campos ausentes permanecem intactos; `None` explícito é
    recusado nos campos obrigatórios do modelo (nome/valor/data), pois a coluna
    é NOT NULL — evitando erro 500 do banco e devolvendo 422 amigável.
    """

    model_config = ConfigDict(extra="forbid")

    nome: NomeGasto | None = Field(default=None, description="Novo nome (opcional).")
    valor: ValorGasto | None = Field(default=None, description="Novo valor (opcional).")
    data: date | None = Field(default=None, description="Nova data (opcional).")
    categoria: CategoriaGasto | None = Field(default=None, description="Nova categoria (opcional).")

    # ----------------------------- Validadores -----------------------------
    # Os validadores abaixo só rodam quando o campo foi enviado (None é tratado
    # antes pelo Pydantic, portanto não caem aqui e não quebram o `strip`).
    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str) -> str:
        """Sanitiza o nome quando ele é enviado."""
        return _validar_nome_sem_espacos(valor)

    @field_validator("valor")
    @classmethod
    def validar_valor(cls, valor: Decimal) -> Decimal:
        """Arredonda o valor quando ele é enviado."""
        return _validar_valor_monetario(valor)

    @field_validator("data")
    @classmethod
    def validar_data(cls, valor: date) -> date:
        """Recusa data futura quando ela é enviada."""
        return _validar_data_nao_futura(valor)

    def esta_vazio(self) -> bool:
        """Indica se nenhum campo foi enviado (PUT sem corpo útil).

        Usado pela camada de serviço na Fase 3 para responder 422
        ("Nenhum campo para atualizar") em vez de executar um UPDATE inútil.
        """
        return not self.model_dump(exclude_unset=True)


class GastoRead(BaseModel):
    """Representação de saída de um gasto (resposta de GET/POST/PUT).

    `from_attributes=True` permite construir direto do objeto ORM
    (`GastoRead.model_validate(gasto)`), sem dicionário intermediário — menos
    código e menos chance de divergência entre modelo e contrato.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID = Field(description="Identificador único (UUID) do gasto.")
    nome: str
    valor: Decimal = Field(description="Valor em reais (sempre 2 casas decimais).")
    data: date
    categoria: CategoriaGasto
    criado_em: datetime = Field(description="Instante de criação (UTC).")
    atualizado_em: datetime = Field(description="Instante da última alteração (UTC).")

    @field_serializer("valor")
    def valor_serializado(self, valor: Decimal) -> float:
        """Serializa o valor como número JSON (ex.: 19.9), e não como string.

        Motivo: o app Android e o Postman esperam `valor` numérico para somar e
        formatar sem parse extra. Como o valor já está limitado a 2 casas, a
        conversão para `float` não perde precisão na faixa usada pelo produto;
        as somas oficiais são feitas no PostgreSQL (Numeric), não no cliente.
        """
        return float(valor)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def categoria_rotulo(self) -> str:
        """Rótulo pronto para exibição (ex.: 'Gastos Obrigatórios').

        Evita que o frontend duplique a tabela de acentuação: o app recebe o
        texto final e só renderiza.
        """
        return ROTULOS_CATEGORIA[self.categoria]


class GastoLista(BaseModel):
    """Envelope de listagem (GET /api/v1/gastos) — preparado para a Fase 3.

        {
          "total": 42,          # total de registros que casam com o filtro
          "itens": [ ... ]      # página atual (GastoRead)
        }

    O envelope (em vez de um array cru) permite paginação sem quebrar o
    contrato já consumido pelo app Android.
    """

    total: int = Field(ge=0, description="Quantidade total de gastos no filtro.")
    itens: list[GastoRead] = Field(default_factory=list, description="Gastos da página atual.")
