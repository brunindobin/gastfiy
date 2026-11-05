"""Pacote raiz da aplicação GASTIFY (backend FastAPI).

Este arquivo existe para transformar o diretório `app` em um pacote Python
importável (`app.main`, `app.core.config`, etc.). Mantê-lo vazio de lógica é
proposital: a inicialização real da aplicação fica em `app/main.py`.
"""

__all__ = ["__version__"]

# Versão do pacote Python. A versão "de produto" da API vem de app/core/config.py
# (variável APP_VERSION) e é a que aparece no /docs e no endpoint raiz.
__version__ = "0.1.0"
