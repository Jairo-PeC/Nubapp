import tomllib
from pathlib import Path

import pytest

RAIZ = Path(__file__).parent.parent


@pytest.fixture
def app(tmp_path):
    """Carga la lógica de app.py (todo lo anterior a la interfaz) con una base temporal.

    app.py dibuja la interfaz al importarse, por eso solo se ejecuta la parte de datos y acciones.
    """
    fuente = (RAIZ / "app.py").read_text(encoding="utf-8").split("# ---------- interfaz ----------")[0]
    ns = {"__file__": str(RAIZ / "app.py")}
    exec(compile(fuente, "app.py", "exec"), ns)
    ns["DB_PATH"] = tmp_path / "test.db"
    ruta = RAIZ / ".streamlit" / "secrets.toml"
    ns["st"].secrets = tomllib.loads(ruta.read_text()) if ruta.exists() else {}
    ns["iniciar_db"]()
    return type("App", (), ns)
