"""Camada de serviços (regras de negócio) do GASTIFY.

Por que existe uma camada separada:
  * O router só traduz HTTP -> schema -> serviço. Se a regra ficasse no router,
    ela não poderia ser reaproveitada (ex.: por um job de importação) nem
    testada sem subir HTTP.
  * O serviço é o único lugar que conhece transação (`commit`/`rollback`).
    Assim o router nunca decide quando confirmar dados.

Arquivos previstos:
    gastos.py     -> criar/listar/atualizar/remover + filtros por data/categoria.
    agregacoes.py -> somas mensais/anuais e por categoria (dashboard).
    backup.py     -> orquestração do Double Backup (enfileira o espelho NoSQL).

Nenhum serviço é implementado na Fase 1: a fundação entrega app, banco, modelo e
schemas. A pasta é criada agora para que a Fase 3 não precise reorganizar nada.
"""
