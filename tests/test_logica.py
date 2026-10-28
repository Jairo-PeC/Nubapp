import sqlite3
from datetime import datetime, timedelta

import pytest

CLAVE = "demo1234"


def paciente(app):
    return app.iniciar_sesion("sofia@example.com", CLAVE)


def primer_hueco(app, n=0):
    nutri = app.listar_nutricionistas()[n]
    return nutri, nutri["huecos"][0]["id"], nutri["servicios"][0]["id"]


def test_datos_de_ejemplo(app):
    with app.db() as con:
        assert con.execute("SELECT COUNT(*) FROM especialidades").fetchone()[0] == 8
        assert con.execute("SELECT COUNT(*) FROM nutricionistas").fetchone()[0] == 8
    cubiertas = {c for n in app.listar_nutricionistas() for c in n["especialidades"]}
    assert cubiertas == {c for _, c in app.ESPECIALIDADES}


def test_huecos_son_futuros(app):
    ahora = datetime.now().isoformat()
    assert all(h["inicio"] > ahora for n in app.listar_nutricionistas() for h in n["huecos"])


def test_login(app):
    assert paciente(app)["rol"] == "paciente"
    assert app.iniciar_sesion("sofia@example.com", "incorrecta") is None
    assert app.iniciar_sesion("nadie@example.com", CLAVE) is None


def test_la_clave_no_se_guarda_en_claro(app):
    with app.db() as con:
        guardadas = [r[0] for r in con.execute("SELECT password_hash FROM usuarios")]
    assert all(CLAVE not in g for g in guardadas)


def test_registro_duplicado_y_clave_corta(app):
    _, error = app.registrar("Sofi", "sofia@example.com", "12345678", "paciente")
    assert "Ya existe" in error
    _, error = app.registrar("Ana", "ana@example.com", "corta", "paciente")
    assert "8 caracteres" in error
    _, error = app.registrar("Ana", "ana@example.com", "12345678", "admin")
    assert error


def test_sql_con_texto_del_usuario_no_se_ejecuta(app):
    assert app.iniciar_sesion("' OR 1=1 --", "x") is None


def test_no_hay_doble_reserva(app):
    _, hueco, servicio = primer_hueco(app)
    assert app.reservar(paciente(app), hueco, servicio, "uno") is None
    otro = app.iniciar_sesion("mateo@example.com", CLAVE)
    assert "ya no está disponible" in app.reservar(otro, hueco, servicio, "dos")


def test_solo_pacientes_reservan(app):
    nutri, hueco, servicio = primer_hueco(app)
    u = app.iniciar_sesion("andres.carvajal@example.com", CLAVE)
    assert app.reservar(u, hueco, servicio, "x")
    assert app.reservar(None, hueco, servicio, "x")


def test_servicio_de_otro_nutricionista_se_rechaza(app):
    a, b = app.listar_nutricionistas()[:2]
    error = app.reservar(paciente(app), a["huecos"][0]["id"], b["servicios"][0]["id"], "x")
    assert "servicio de este nutricionista" in error
    assert app.citas_de(paciente(app)) == []


def test_cancelar_libera_el_hueco_y_se_puede_reservar_de_nuevo(app):
    _, hueco, servicio = primer_hueco(app)
    p = paciente(app)
    assert app.reservar(p, hueco, servicio, "uno") is None
    cita = app.citas_de(p)[0]["id"]
    assert app.cancelar_cita(p, cita) is None
    assert "ya estaba cancelada" in app.cancelar_cita(p, cita)
    assert app.reservar(p, hueco, servicio, "dos") is None
    assert [c["estado"] for c in app.citas_de(p)] == ["cancelada", "confirmada"]


def test_no_se_cancela_la_cita_de_otro(app):
    _, hueco, servicio = primer_hueco(app)
    p = paciente(app)
    app.reservar(p, hueco, servicio, "uno")
    otro = app.iniciar_sesion("mateo@example.com", CLAVE)
    assert app.cancelar_cita(otro, app.citas_de(p)[0]["id"])


def test_nutricionista_nuevo_aparece_al_completar_el_perfil(app):
    antes = len(app.listar_nutricionistas())
    u, _ = app.registrar("Nora Prueba", "nora@example.com", "12345678", "nutricionista")
    assert len(app.listar_nutricionistas()) == antes
    assert app.guardar_perfil(u, {"titular": "", "especialidades": []})
    perfil = {"titular": "Nutrición vegetal", "bio": "x", "modalidad": "online", "ciudad": "Lima",
              "idiomas": "Español", "tarifa": 30, "especialidades": ["vegano", "no_existe"]}
    assert app.guardar_perfil(u, perfil) is None
    assert len(app.listar_nutricionistas()) == antes  # aún sin servicios
    assert app.agregar_servicio(u, {"nombre": "Consulta", "duracion_min": 45, "precio": 30}) is None
    assert len(app.listar_nutricionistas()) == antes + 1
    assert app.obtener_perfil(u)["especialidades"] == ["vegano"]


def test_servicio_y_horario_se_validan(app):
    u = app.iniciar_sesion("andres.carvajal@example.com", CLAVE)
    assert app.agregar_servicio(u, {"nombre": "", "duracion_min": 45, "precio": 10})
    assert app.agregar_servicio(u, {"nombre": "x", "duracion_min": "abc", "precio": 10})
    assert app.agregar_servicio(u, {"nombre": "x", "duracion_min": 5, "precio": 10})
    fecha = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")  # fuera del rango de los datos de ejemplo
    assert app.agregar_hueco(u, fecha, "10:30") is None
    assert "Ya tienes" in app.agregar_hueco(u, fecha, "10:00")
    assert "futuras" in app.agregar_hueco(u, "2020-01-01", "10:00")
    assert "válidas" in app.agregar_hueco(u, "no-es-fecha", "10:00")
    p = paciente(app)
    assert app.agregar_hueco(p, fecha, "11:00")


def test_quitar_hueco_con_historial_da_mensaje(app):
    nutri, hueco, servicio = primer_hueco(app)
    p = paciente(app)
    app.reservar(p, hueco, servicio, "uno")
    app.cancelar_cita(p, app.citas_de(p)[0]["id"])
    nutri_u = {"id": nutri["id"], "rol": "nutricionista"}
    assert "historial" in app.borrar_hueco(nutri_u, hueco)


def test_recomendar_demo_y_fuera_de_tema(app):
    deportivos = {n["id"] for n in app.listar_nutricionistas() if "deportivo" in n["especialidades"]}
    assert set(app.recomendar_demo("Soy ciclista")["ids"]) <= deportivos
    assert app.recomendar_demo("¿Qué tiempo hará mañana?")["ids"] == []


def test_si_gemini_falla_el_chat_usa_el_respaldo_y_avisa(app):
    app.st.secrets = {}  # sin clave
    respuesta, aviso = app.responder_chat([], "Soy ciclista")
    assert respuesta["ids"] and "no está disponible" in aviso


def test_base_con_esquema_anterior_se_recrea(app):
    app.DB_PATH.unlink()
    con = sqlite3.connect(app.DB_PATH)  # base "vieja": sin versión de esquema
    con.execute("CREATE TABLE usuarios (id INTEGER)")
    con.commit()
    con.close()
    app.iniciar_db()
    with app.db() as c:
        assert c.execute("SELECT COUNT(*) FROM nutricionistas").fetchone()[0] == 8


@pytest.mark.ia
@pytest.mark.parametrize("texto, especialidad", [
    ("Soy ciclista y quiero mejorar mi rendimiento y recuperación", "deportivo"),
    ("Mi hija de 6 años come muy poco y es muy selectiva", "pediatrico"),
    ("Me acaban de diagnosticar diabetes tipo 2", "endocrino"),
])
def test_gemini_recomienda_la_especialidad_correcta(app, texto, especialidad):
    try:
        r = app.recomendar_gemini([], texto)
    except Exception as e:  # sin clave, sin red o 503: no es un fallo del código
        pytest.skip(f"Gemini no disponible: {type(e).__name__}")
    por_id = {n["id"]: n for n in app.listar_nutricionistas()}
    assert r["ids"] and all(i in por_id for i in r["ids"])
    assert any(especialidad in por_id[i]["especialidades"] for i in r["ids"])


@pytest.mark.ia
def test_gemini_rechaza_fuera_de_tema(app):
    try:
        r = app.recomendar_gemini([], "¿Qué tiempo hará mañana?")
    except Exception as e:
        pytest.skip(f"Gemini no disponible: {type(e).__name__}")
    assert r["ids"] == []
