"""Modelo ORM `Gasto` (tabela `gastos`) — banco principal PostgreSQL.

Estrutura exigida pelo produto: Nome, Valor, Data e Categoria.
Este é o coração do app: a home mostra "apenas os gastos do dia" (filtro por
`data`), o dashboard usa agregações mensais/anuais (também por `data`) e o
Double Backup espelha cada linha para o NoSQL usando o mesmo `id`.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Enum as SAEnum, ForeignKey, Numeric, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class CategoriaGasto(str, enum.Enum):
    """Categorias de gasto suportadas pelo app.

    Herda de `str` para serializar como texto simples no JSON e ser aceita
    diretamente em query strings (ex.: ?categoria=lazer), sem conversão extra.

    Os VALORES (usados na API e no banco) são slugs em minúsculas — legíveis em
    URL/JSON e estáveis para o app Android. O rótulo para exibição ao usuário fica
    em `rotulo`, evitando que o frontend duplique a regra de acentuação.
    """

    GASTOS_OBRIGATORIOS = "gastos_obrigatorios"
    LAZER = "lazer"
    ALIMENTACAO = "alimentacao"
    TRANSPORTE = "transporte"
    SAUDE = "saude"
    EDUCACAO = "educacao"
    OUTROS = "outros"

    @property
    def rotulo(self) -> str:
        """Nome amigável em PT-BR para exibir na interface."""
        return ROTULOS_CATEGORIA[self]


# Mapa valor -> rótulo exibido no app (usado pela propriedade `rotulo`).
ROTULOS_CATEGORIA: dict[CategoriaGasto, str] = {
    CategoriaGasto.GASTOS_OBRIGATORIOS: "Gastos Obrigatórios",
    CategoriaGasto.LAZER: "Lazer",
    CategoriaGasto.ALIMENTACAO: "Alimentação",
    CategoriaGasto.TRANSPORTE: "Transporte",
    CategoriaGasto.SAUDE: "Saúde",
    CategoriaGasto.EDUCACAO: "Educação",
    CategoriaGasto.OUTROS: "Outros",
}


class Gasto(Base):
    """Registro de um gasto do usuário.

    Escolha do `id`: UUID v4 gerado na aplicação (e não INTEGER autoincrement).
      * o mesmo identificador é replicado no NoSQL (Double Backup), então precisa
        ser único por registro e não depender da sequência do PostgreSQL;
      * evita que o app exponha/descubra a quantidade de registros (id sequencial
        é enumerável) — pequena melhoria de privacidade;
      * permite gerar o id antes do INSERT, simplificando a correlação entre
        bancos e a idempotência do espelhamento.
    Custo aceito: UUID ocupa mais bytes e é "aleatório" no índice; irrelevante
    para o volume de um app pessoal de finanças.
    """

    __tablename__ = "gastos"

    # Regras de integridade garantidas também no banco (defesa em profundidade):
    # mesmo que alguma camada falhe, não entra valor <= 0 nem nome vazio.
    __table_args__ = (
        CheckConstraint("valor > 0", name="valor_positivo"),
        CheckConstraint("length(trim(nome)) > 0", name="nome_nao_vazio"),
    )

    # Chave primária UUID (nativa no PostgreSQL via tipo `Uuid` do SQLAlchemy 2.x).
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Identificador único do gasto; compartilhado com o NoSQL no Double Backup.",
    )

    # Nome/descrição do gasto (ex.: "Aluguel", "Cinema"). Limite de 120 caracteres
    # para manter listagens e gráficos legíveis e evitar payloads abusivos.
    nome: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        comment="Descrição curta do gasto.",
    )

    # Dono do gasto. `ondelete="CASCADE"` remove os gastos junto com o usuário
    # (exclusão de conta) e o índice acelera TODA consulta, já que cada query é
    # filtrada por usuário antes de qualquer outro critério.
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Usuário dono do gasto (isolamento de dados).",
    )

    # Valor monetário com 2 casas decimais. `Numeric` (e não Float) porque dinheiro
    # exige precisão exata — Float acumula erro de arredondamento nas somas.
    # 12,2 permite até 9.999.999.999,99.
    valor: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Valor do gasto em reais, sempre maior que zero.",
    )

    # Data do gasto (sem hora): é a base do filtro "gastos do dia" da home e das
    # agregações mensal/anual. Indexada porque essas consultas filtram por ela.
    data: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Data em que o gasto ocorreu (base dos filtros e agregações).",
    )

    # Categoria usada pelos filtros rápidos e pelos gráficos. `values_callable`
    # garante que o banco guarde o VALOR ("lazer") e não o nome do membro
    # ("LAZER"), mantendo API e banco com o mesmo vocabulário.
    categoria: Mapped[CategoriaGasto] = mapped_column(
        SAEnum(
            CategoriaGasto,
            name="categoria_gasto",
            values_callable=lambda enum_cls: [membro.value for membro in enum_cls],
            validate_strings=True,  # entrada inválida vira erro claro, não lixo no banco
        ),
        nullable=False,
        default=CategoriaGasto.OUTROS,
        server_default=CategoriaGasto.OUTROS.value,
        index=True,  # acelera agregações/filtros por categoria
        comment="Categoria do gasto (padrão: outros).",
    )

    # Auditoria: quando o registro foi criado/alterado. `server_default=func.now()`
    # deixa o relógio do banco definir o instante (consistente entre servidores) e
    # `onupdate` atualiza automaticamente em cada UPDATE feito pelo ORM.
    # timezone=True => TIMESTAMPTZ, sempre em UTC (sem ambiguidade de fuso).
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        comment="Instante de criação (UTC).",
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
        comment="Instante da última alteração (UTC).",
    )

    def __repr__(self) -> str:
        """Representação curta para debug — não expõe o valor em logs de produção."""
        return f"<Gasto id={self.id} categoria={self.categoria.value if self.categoria else None}>"
