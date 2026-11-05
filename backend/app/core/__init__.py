"""Módulo `core`: configurações, segurança e tratamento de erros da API.

Concentra o que é transversal a todos os domínios (configuração via .env,
placeholders de JWT e exceções/handlers globais). Separar isso dos routers
evita acoplamento e mantém a Arquitetura Limpa exigida pelo projeto.
"""
