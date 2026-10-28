import hashlib
import json
from contextlib import closing, contextmanager
import os
import random
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components
from google import genai
from google.genai import types
from pydantic import BaseModel

MODELO = "gemini-flash-lite-latest"  # alias: no caduca; gemini-3.8-flash daba 503 por alta demanda
DB_PATH = Path(__file__).parent / "nubapp.db"
VERSION_DB = 1  # súbelo cuando cambie el esquema de las tablas
DIST = Path(__file__).parent / "frontend" / "dist"

ESPECIALIDADES = [
    ("Pediátrico", "pediatrico"),
    ("Oncológico", "oncologico"),
    ("TCA", "tca"),
    ("Endocrino-obesidad", "endocrino"),
    ("Enfermedad renal", "renal"),
    ("Deportivo", "deportivo"),
    ("Vegetarianismo/veganismo", "vegano"),
    ("Embarazo y maternidad", "embarazo"),
]

# (nombre, titular, bio, modalidad, ciudad, idiomas, tarifa, especialidades, servicios)
NUTRICIONISTAS = [
    ("Valeria Montoya", "Alimentación infantil sin batallas en la mesa",
     "Ayudo a familias con niños selectivos, alergias y etapas de crecimiento. Trabajo con juegos y recetas fáciles.",
     "ambas", "Bogotá", "Español, Inglés", 35, [1, 8],
     [("Primera consulta pediátrica", "Valoración completa y plan para toda la familia", 50, 35),
      ("Seguimiento mensual", "Control de crecimiento y ajustes", 30, 22)]),
    ("Andrés Carvajal", "Nutrición que acompaña durante el tratamiento oncológico",
     "Cuido el estado nutricional antes, durante y después de quimioterapia o radioterapia, en coordinación con tu equipo médico.",
     "online", "Medellín", "Español", 45, [2],
     [("Valoración nutricional oncológica", "Revisión de síntomas, apetito y peso", 60, 45),
      ("Seguimiento semanal", "Ajustes ante náuseas, mucositis o pérdida de peso", 30, 28)]),
    ("Lucía Ferrer", "Una relación más tranquila con la comida",
     "Acompaño a personas con anorexia, bulimia o atracones desde un enfoque respetuoso y sin juicios, junto a su equipo de salud mental.",
     "ambas", "Madrid", "Español, Catalán", 50, [3],
     [("Primera sesión de acogida", "Conversamos sin presión y definimos objetivos", 60, 50),
      ("Sesión de seguimiento", "Trabajo en comidas, emociones y hábitos", 45, 40)]),
    ("Martín Okafor", "Diabetes, obesidad y rendimiento con datos claros",
     "Especialista en resistencia a la insulina, diabetes tipo 2 y pérdida de peso sostenible. También entreno a corredores populares.",
     "online", "Ciudad de México", "Español, Inglés", 40, [4, 6],
     [("Consulta endocrino-metabólica", "Análisis de glucosa, hábitos y objetivos", 60, 40),
      ("Plan de pérdida de peso", "Plan realista con revisiones quincenales", 45, 32)]),
    ("Camila Restrepo", "Comer bien con enfermedad renal crónica",
     "Adapto la alimentación a cada etapa de la enfermedad renal y a la diálisis: potasio, fósforo, sodio y líquidos.",
     "ambas", "Cali", "Español", 42, [5],
     [("Primera consulta renal", "Revisión de analíticas y menú adaptado", 60, 42),
      ("Control de diálisis", "Ajuste de dieta según tus resultados", 30, 26)]),
    ("Diego Salvatierra", "Nutrición para entrenar mejor y recuperarte antes",
     "Trabajo con ciclistas, runners y gente de gimnasio: carga de carbohidratos, hidratación, suplementación y composición corporal.",
     "ambas", "Barcelona", "Español, Inglés", 38, [6],
     [("Valoración deportiva", "Composición corporal y plan de entrenamiento", 60, 38),
      ("Estrategia de competición", "Plan para tu carrera o torneo", 45, 34)]),
    ("Noa Benedetti", "Dieta vegetal completa, sin carencias",
     "Planes vegetarianos y veganes para cualquier edad, con foco en B12, hierro, proteínas y recetas de cada día.",
     "online", "Buenos Aires", "Español, Italiano", 33, [7, 1],
     [("Transición a la dieta vegetal", "Plan paso a paso y lista de compra", 50, 33),
      ("Revisión de analíticas", "Hierro, B12 y vitamina D bajo control", 30, 20)]),
    ("Irene Quispe", "Acompañamiento desde la búsqueda del embarazo hasta la lactancia",
     "Nutrición en fertilidad, embarazo, diabetes gestacional y postparto. Te explico cada paso sin alarmismo.",
     "ambas", "Lima", "Español, Quechua", 36, [8, 4],
     [("Consulta preconcepcional", "Preparar el cuerpo antes del embarazo", 50, 36),
      ("Plan de embarazo y lactancia", "Seguimiento por trimestres", 45, 30)]),
]

PACIENTES_DEMO = [("Sofía Ramírez", "sofia@example.com"), ("Mateo Gómez", "mateo@example.com")]
CLAVE_DEMO = "demo1234"


# ---------- base de datos ----------

@contextmanager
def db():
    """Conexión que confirma al salir del bloque y siempre se cierra."""
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        with con:
            yield con
    finally:
        con.close()


def hash_clave(clave, sal=None):
    sal = sal or secrets.token_bytes(16)
    h = hashlib.scrypt(clave.encode(), salt=sal, n=2**14, r=8, p=1)
    return sal.hex() + ":" + h.hex()


def clave_ok(clave, guardada):
    sal, h = guardada.split(":")
    return secrets.compare_digest(hash_clave(clave, bytes.fromhex(sal)), guardada)


def crear_tablas(con):
    con.executescript("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
        nombre TEXT NOT NULL, rol TEXT NOT NULL CHECK (rol IN ('paciente','nutricionista')),
        creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS nutricionistas (
        usuario_id INTEGER PRIMARY KEY REFERENCES usuarios(id), titular TEXT, bio TEXT,
        modalidad TEXT CHECK (modalidad IN ('online','presencial','ambas')),
        ciudad TEXT, idiomas TEXT, tarifa INTEGER, foto_url TEXT);
    CREATE TABLE IF NOT EXISTS especialidades (
        id INTEGER PRIMARY KEY, nombre TEXT UNIQUE NOT NULL, clave TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS nutricionista_especialidad (
        nutricionista_id INTEGER REFERENCES nutricionistas(usuario_id),
        especialidad_id INTEGER REFERENCES especialidades(id),
        PRIMARY KEY (nutricionista_id, especialidad_id));
    CREATE TABLE IF NOT EXISTS servicios (
        id INTEGER PRIMARY KEY, nutricionista_id INTEGER REFERENCES nutricionistas(usuario_id),
        nombre TEXT NOT NULL, descripcion TEXT, duracion_min INTEGER, precio INTEGER);
    CREATE TABLE IF NOT EXISTS disponibilidad (
        id INTEGER PRIMARY KEY, nutricionista_id INTEGER REFERENCES nutricionistas(usuario_id),
        inicio TEXT NOT NULL, fin TEXT NOT NULL, reservado INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS citas (
        id INTEGER PRIMARY KEY, paciente_id INTEGER REFERENCES usuarios(id),
        nutricionista_id INTEGER REFERENCES nutricionistas(usuario_id),
        servicio_id INTEGER REFERENCES servicios(id),
        disponibilidad_id INTEGER REFERENCES disponibilidad(id),
        estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada','cancelada')),
        motivo TEXT, creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    -- único solo entre citas confirmadas: una cita cancelada libera el hueco para reservarlo de nuevo
    CREATE UNIQUE INDEX IF NOT EXISTS cita_activa ON citas(disponibilidad_id) WHERE estado = 'confirmada';
    """)


def cargar_ejemplos(con):
    """Datos inventados. Se ejecuta solo si la base está vacía; los huecos son relativos a hoy."""
    if con.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0]:
        return
    con.executemany("INSERT INTO especialidades (nombre, clave) VALUES (?, ?)", ESPECIALIDADES)
    clave = hash_clave(CLAVE_DEMO)
    for nombre, email in PACIENTES_DEMO:
        con.execute("INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (?,?,?,'paciente')",
                    (email, clave, nombre))
    rnd = random.Random(7)
    hoy = datetime.now().replace(minute=0, second=0, microsecond=0)
    for nombre, titular, bio, modalidad, ciudad, idiomas, tarifa, specs, servicios in NUTRICIONISTAS:
        email = nombre.lower().replace(" ", ".").replace("é", "e").replace("í", "i").replace("á", "a") + "@example.com"
        uid = con.execute("INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (?,?,?,'nutricionista')",
                          (email, clave, nombre)).lastrowid
        con.execute("INSERT INTO nutricionistas VALUES (?,?,?,?,?,?,?,NULL)",
                    (uid, titular, bio, modalidad, ciudad, idiomas, tarifa))
        con.executemany("INSERT INTO nutricionista_especialidad VALUES (?,?)", [(uid, s) for s in specs])
        con.executemany("INSERT INTO servicios (nutricionista_id, nombre, descripcion, duracion_min, precio) VALUES (?,?,?,?,?)",
                        [(uid, *s) for s in servicios])
        for dia in range(1, 15):
            fecha = hoy + timedelta(days=dia)
            if fecha.weekday() > 4:
                continue
            for hora in rnd.sample([9, 10, 11, 12, 15, 16, 17, 18], 4):
                ini = fecha.replace(hour=hora)
                con.execute("INSERT INTO disponibilidad (nutricionista_id, inicio, fin, reservado) VALUES (?,?,?,?)",
                            (uid, ini.isoformat(), (ini + timedelta(hours=1)).isoformat(), int(rnd.random() < 0.2)))


def iniciar_db():
    if DB_PATH.exists():
        with closing(sqlite3.connect(DB_PATH)) as con:
            vieja = con.execute("PRAGMA user_version").fetchone()[0] < VERSION_DB
        if vieja:  # base creada con un esquema anterior: solo tiene datos de ejemplo, se recrea
            DB_PATH.unlink()
    with db() as con:
        con.execute(f"PRAGMA user_version = {VERSION_DB}")
        crear_tablas(con)
        cargar_ejemplos(con)


def listar_nutricionistas():
    with db() as con:
        filas = con.execute("""
            SELECT u.id, u.nombre, n.titular, n.bio, n.modalidad, n.ciudad, n.idiomas, n.tarifa
            FROM nutricionistas n JOIN usuarios u ON u.id = n.usuario_id
            WHERE n.titular <> '' AND EXISTS (SELECT 1 FROM nutricionista_especialidad WHERE nutricionista_id = n.usuario_id)
              AND EXISTS (SELECT 1 FROM servicios WHERE nutricionista_id = n.usuario_id)
            ORDER BY u.nombre""").fetchall()
        salida = []
        for f in filas:
            d = dict(f)
            d["especialidades"] = [r["clave"] for r in con.execute(
                """SELECT e.clave FROM nutricionista_especialidad ne
                   JOIN especialidades e ON e.id = ne.especialidad_id WHERE ne.nutricionista_id = ?""", (f["id"],))]
            d["servicios"] = [dict(r) for r in con.execute(
                "SELECT id, nombre, descripcion, duracion_min, precio FROM servicios WHERE nutricionista_id = ?", (f["id"],))]
            d["huecos"] = [dict(r) for r in con.execute(
                """SELECT id, inicio FROM disponibilidad
                   WHERE nutricionista_id = ? AND reservado = 0 AND inicio > ? ORDER BY inicio""",
                (f["id"], datetime.now().isoformat()))]
            salida.append(d)
        return salida


def citas_de(usuario):
    if not usuario:
        return []
    campo = "c.paciente_id" if usuario["rol"] == "paciente" else "c.nutricionista_id"
    with db() as con:
        return [dict(r) for r in con.execute(f"""
            SELECT c.id, c.estado, c.motivo, d.inicio, s.nombre AS servicio, s.precio,
                   un.nombre AS nutricionista, up.nombre AS paciente
            FROM citas c JOIN disponibilidad d ON d.id = c.disponibilidad_id
            JOIN servicios s ON s.id = c.servicio_id
            JOIN usuarios un ON un.id = c.nutricionista_id
            JOIN usuarios up ON up.id = c.paciente_id
            WHERE {campo} = ? ORDER BY d.inicio""", (usuario["id"],))]


# ---------- acciones ----------

def iniciar_sesion(email, clave):
    with db() as con:
        u = con.execute("SELECT * FROM usuarios WHERE email = ?", (email.strip().lower(),)).fetchone()
    if u and clave_ok(clave, u["password_hash"]):
        return {"id": u["id"], "nombre": u["nombre"], "rol": u["rol"], "email": u["email"]}
    return None


def registrar(nombre, email, clave, rol):
    if rol not in ("paciente", "nutricionista"):
        return None, "Elige si eres paciente o nutricionista."
    if len(clave) < 8 or "@" not in email or not nombre.strip():
        return None, "Revisa los datos: la contraseña necesita al menos 8 caracteres."
    try:
        with db() as con:
            uid = con.execute("INSERT INTO usuarios (email, password_hash, nombre, rol) VALUES (?,?,?,?)",
                              (email.strip().lower(), hash_clave(clave), nombre.strip(), rol)).lastrowid
            if rol == "nutricionista":  # perfil vacío: no se lista hasta que lo complete
                con.execute("INSERT INTO nutricionistas (usuario_id, titular, bio, modalidad, ciudad, idiomas, tarifa) "
                            "VALUES (?, '', '', 'online', '', '', 0)", (uid,))
    except sqlite3.IntegrityError:
        return None, "Ya existe una cuenta con ese correo."
    return iniciar_sesion(email, clave), None


def reservar(usuario, hueco_id, servicio_id, motivo):
    if not usuario or usuario["rol"] != "paciente":
        return "Inicia sesión como paciente para reservar."
    try:
        with db() as con:
            h = con.execute("SELECT nutricionista_id, reservado FROM disponibilidad WHERE id = ?", (hueco_id,)).fetchone()
            if not h or h["reservado"]:
                return "Ese horario ya no está disponible. Elige otro."
            if not con.execute("SELECT 1 FROM servicios WHERE id = ? AND nutricionista_id = ?",
                               (servicio_id, h["nutricionista_id"])).fetchone():
                return "Elige un servicio de este nutricionista."
            con.execute("UPDATE disponibilidad SET reservado = 1 WHERE id = ?", (hueco_id,))
            con.execute("""INSERT INTO citas (paciente_id, nutricionista_id, servicio_id, disponibilidad_id, motivo)
                           VALUES (?,?,?,?,?)""", (usuario["id"], h["nutricionista_id"], servicio_id, hueco_id, motivo[:300]))
    except sqlite3.Error:
        return "No pudimos guardar la cita. Inténtalo de nuevo."
    return None


def cancelar_cita(usuario, cita_id):
    if not usuario:
        return "Inicia sesión para cancelar."
    campo = "paciente_id" if usuario["rol"] == "paciente" else "nutricionista_id"
    with db() as con:
        c = con.execute(f"SELECT disponibilidad_id FROM citas WHERE id = ? AND {campo} = ? AND estado = 'confirmada'",
                        (cita_id, usuario["id"])).fetchone()
        if not c:
            return "No encontramos esa cita o ya estaba cancelada."
        con.execute("UPDATE citas SET estado = 'cancelada' WHERE id = ?", (cita_id,))
        con.execute("UPDATE disponibilidad SET reservado = 0 WHERE id = ?", (c["disponibilidad_id"],))
    return None


# ---------- perfil del nutricionista ----------

def obtener_perfil(usuario):
    if not usuario or usuario["rol"] != "nutricionista":
        return None
    with db() as con:
        n = dict(con.execute("SELECT titular, bio, modalidad, ciudad, idiomas, tarifa FROM nutricionistas WHERE usuario_id = ?",
                             (usuario["id"],)).fetchone())
        n["especialidades"] = [r["clave"] for r in con.execute(
            """SELECT e.clave FROM nutricionista_especialidad ne JOIN especialidades e ON e.id = ne.especialidad_id
               WHERE ne.nutricionista_id = ?""", (usuario["id"],))]
        n["servicios"] = [dict(r) for r in con.execute(
            "SELECT id, nombre, descripcion, duracion_min, precio FROM servicios WHERE nutricionista_id = ?", (usuario["id"],))]
        n["huecos"] = [dict(r) for r in con.execute(
            "SELECT id, inicio, reservado FROM disponibilidad WHERE nutricionista_id = ? AND inicio > ? ORDER BY inicio",
            (usuario["id"], datetime.now().isoformat()))]
        return n


def guardar_perfil(usuario, d):
    if not usuario or usuario["rol"] != "nutricionista":
        return "Solo los nutricionistas pueden editar un perfil."
    claves = [c for c in d.get("especialidades", []) if c in {k for _, k in ESPECIALIDADES}]
    titular, modalidad = str(d.get("titular", "")).strip()[:120], d.get("modalidad")
    try:
        tarifa = int(d.get("tarifa", 0))
    except (TypeError, ValueError):
        tarifa = -1
    if not titular or not claves or modalidad not in ("online", "presencial", "ambas") or tarifa < 0:
        return "Completa la frase de presentación, elige al menos una especialidad y revisa la tarifa."
    with db() as con:
        con.execute("UPDATE nutricionistas SET titular=?, bio=?, modalidad=?, ciudad=?, idiomas=?, tarifa=? WHERE usuario_id=?",
                    (titular, str(d.get("bio", ""))[:600], modalidad, str(d.get("ciudad", ""))[:60],
                     str(d.get("idiomas", ""))[:60], tarifa, usuario["id"]))
        con.execute("DELETE FROM nutricionista_especialidad WHERE nutricionista_id = ?", (usuario["id"],))
        con.executemany("INSERT INTO nutricionista_especialidad SELECT ?, id FROM especialidades WHERE clave = ?",
                        [(usuario["id"], c) for c in claves])
    return None


def agregar_servicio(usuario, d):
    try:
        duracion, precio = int(d.get("duracion_min")), int(d.get("precio"))
    except (TypeError, ValueError):
        return "La duración y el precio deben ser números."
    nombre = str(d.get("nombre", "")).strip()[:80]
    if usuario["rol"] != "nutricionista" or not nombre or not (10 <= duracion <= 180) or precio < 0:
        return "Revisa el servicio: nombre, duración (10 a 180 min) y precio."
    with db() as con:
        con.execute("INSERT INTO servicios (nutricionista_id, nombre, descripcion, duracion_min, precio) VALUES (?,?,?,?,?)",
                    (usuario["id"], nombre, str(d.get("descripcion", ""))[:160], duracion, precio))
    return None


def borrar_servicio(usuario, servicio_id):
    try:
        with db() as con:
            con.execute("DELETE FROM servicios WHERE id = ? AND nutricionista_id = ?", (servicio_id, usuario["id"]))
    except sqlite3.IntegrityError:
        return "Ese servicio ya tiene citas y no se puede borrar."
    return None


def agregar_hueco(usuario, fecha, hora):
    try:
        ini = datetime.fromisoformat(f"{fecha}T{hora}").replace(minute=0, second=0, microsecond=0)
    except ValueError:
        return "Elige una fecha y una hora válidas."
    if usuario["rol"] != "nutricionista" or ini <= datetime.now():
        return "Elige una fecha y una hora futuras."
    with db() as con:
        if con.execute("SELECT 1 FROM disponibilidad WHERE nutricionista_id = ? AND inicio = ?",
                       (usuario["id"], ini.isoformat())).fetchone():
            return "Ya tienes ese horario."
        con.execute("INSERT INTO disponibilidad (nutricionista_id, inicio, fin) VALUES (?,?,?)",
                    (usuario["id"], ini.isoformat(), (ini + timedelta(hours=1)).isoformat()))
    return None


def borrar_hueco(usuario, hueco_id):
    try:
        with db() as con:
            con.execute("DELETE FROM disponibilidad WHERE id = ? AND nutricionista_id = ? AND reservado = 0",
                        (hueco_id, usuario["id"]))
    except sqlite3.IntegrityError:  # una cita cancelada conserva su historial y apunta a este horario
        return "Ese horario tiene una cita en el historial y no se puede quitar."
    return None


# ---------- chat con IA ----------

SISTEMA = """Eres Nubi, el asistente de Nubapp. Tu único trabajo es orientar a una persona hacia los nutricionistas de la lista que mejor se ajustan a su necesidad.
Reglas:
- Solo puedes recomendar nutricionistas de la lista, usando su id exacto. Nunca inventes personas, especialidades ni horarios.
- No des diagnósticos, dietas, cantidades de comida, suplementos ni consejo médico. Si piden eso, explica amablemente que eso lo verá el especialista en consulta.
- Si describen una urgencia o un síntoma grave, recomiéndales acudir a un profesional de la salud o a urgencias, y aun así orienta sobre qué nutricionista podría acompañarles después.
- Si el mensaje no tiene que ver con nutrición ni con encontrar un nutricionista, dilo con amabilidad, devuelve ids vacío y explica que solo ayudas a encontrar un nutricionista.
- Si falta información clave, haz UNA pregunta corta y devuelve ids vacío. Si ya puedes orientar, devuelve de 1 a 3 ids y explica en 2-3 frases por qué encajan.
- Si nombras a un nutricionista en el mensaje, su id DEBE estar en ids; y todo id de ids debe estar justificado en el mensaje.
- Si el tema es un diagnóstico o una condición de salud, igualmente recomienda de 1 a 3 especialistas adecuados, sin dar pautas.
- Responde en español, con frases sencillas y cercanas."""


class Respuesta(BaseModel):
    mensaje: str
    ids: list[int]


def recomendar_gemini(chat, texto):
    nutris = listar_nutricionistas()
    nombres = {c: n for n, c in ESPECIALIDADES}
    pool = [{"id": n["id"], "nombre": n["nombre"], "titular": n["titular"], "ciudad": n["ciudad"], "modalidad": n["modalidad"],
             "especialidades": [nombres[c] for c in n["especialidades"]], "servicios": [s["nombre"] for s in n["servicios"]]}
            for n in nutris]
    historial = [types.Content(role="user" if m["rol"] == "paciente" else "model",
                               parts=[types.Part(text=m.get("texto") or m.get("mensaje", ""))]) for m in chat[-10:]]
    historial.append(types.Content(role="user", parts=[types.Part(text=texto)]))
    cliente = genai.Client(api_key=st.secrets["GEMINI_API_KEY"])
    r = cliente.models.generate_content(
        model=MODELO, contents=historial,
        config=types.GenerateContentConfig(
            system_instruction=SISTEMA + "\n\nLista de nutricionistas (JSON):\n" + json.dumps(pool, ensure_ascii=False),
            response_mime_type="application/json", response_schema=Respuesta, temperature=0.3))
    datos = Respuesta.model_validate_json(r.text)
    validos = {n["id"] for n in nutris}
    return {"mensaje": datos.mensaje.strip(), "ids": [i for i in dict.fromkeys(datos.ids) if i in validos][:3]}


def responder_chat(chat, texto):
    """Gemini; si falla (cuota, red, respuesta inválida), recomendación básica por palabras clave."""
    try:
        return recomendar_gemini(chat, texto), None
    except Exception:
        aviso = "El asistente no está disponible ahora mismo. Te mostramos una recomendación básica; también puedes buscar en el listado."
        return recomendar_demo(texto), aviso


# Respaldo sin IA: palabras clave → especialidad.
PALABRAS = {
    "pediatrico": ["hijo", "hija", "niño", "niña", "bebé", "infantil", "selectivo"],
    "oncologico": ["cáncer", "cancer", "quimio", "oncolog", "tumor"],
    "tca": ["anorexia", "bulimia", "atracón", "atracon", "trastorno", "comida emocional"],
    "endocrino": ["diabetes", "peso", "obesidad", "adelgazar", "insulina", "colesterol"],
    "renal": ["riñón", "rinon", "renal", "diálisis", "dialisis"],
    "deportivo": ["ciclis", "corr", "gimnasio", "entren", "rendimiento", "maratón", "musculo", "músculo"],
    "vegano": ["vegano", "vegetarian", "vegetal"],
    "embarazo": ["embaraz", "lactancia", "fertilidad", "postparto", "gestacional"],
}


def recomendar_demo(texto):
    t = texto.lower()
    claves = [c for c, ps in PALABRAS.items() if any(p in t for p in ps)]
    if not claves:
        return {"mensaje": "Por ahora solo puedo ayudarte a encontrar un nutricionista. Cuéntame qué necesitas: por ejemplo, un objetivo deportivo, una condición de salud o una etapa de la vida.",
                "ids": []}
    ids = [n["id"] for n in listar_nutricionistas() if set(n["especialidades"]) & set(claves)][:3]
    return {"mensaje": "Por lo que cuentas, estos especialistas pueden ayudarte. Elige uno para ver su perfil y sus horarios.",
            "ids": ids, "claves": claves}


# ---------- interfaz ----------

if os.environ.get("NUBAPP_DEV"):
    interfaz = components.declare_component("nubapp_ui", url="http://localhost:5173")
else:
    interfaz = components.declare_component("nubapp_ui", path=str(DIST))

st.set_page_config(page_title="Nubapp", page_icon="🥑", layout="wide", initial_sidebar_state="collapsed")
st.markdown("""<style>
#MainMenu, header, footer {visibility: hidden;}
.block-container {padding: 0 !important; max-width: 100% !important;}
iframe {border: 0;}
</style>""", unsafe_allow_html=True)

iniciar_db()
s = st.session_state
s.setdefault("pantalla", "inicio")
s.setdefault("nutri_id", None)
s.setdefault("usuario", None)
s.setdefault("chat", [])
s.setdefault("aviso", None)
s.setdefault("ultimo_evento", None)
s.setdefault("pendiente_chat", "")

evento = interfaz(
    pantalla=s.pantalla,
    especialidades=[{"nombre": n, "clave": c} for n, c in ESPECIALIDADES],
    nutricionistas=listar_nutricionistas(),
    nutri_id=s.nutri_id,
    usuario=s.usuario,
    citas=citas_de(s.usuario),
    perfil=obtener_perfil(s.usuario),
    chat=s.chat,
    aviso=s.aviso,
    key="nubapp_ui",
    default=None,
)


def error_a_aviso(error, ok=None):
    s.aviso = {"tipo": "error", "texto": error} if error else ({"tipo": "ok", "texto": ok} if ok else None)


def procesar_chat(texto):
    respuesta, aviso = responder_chat(s.chat, texto)
    s.chat += [{"rol": "paciente", "texto": texto}, {"rol": "nubi", **respuesta}]
    s.pantalla = "chat"
    if aviso:
        s.aviso = {"tipo": "info", "texto": aviso}


def exigir_sesion_para_chat(texto=""):
    s.pendiente_chat, s.pantalla = texto, "entrar"
    s.aviso = {"tipo": "info", "texto": "Inicia sesión o crea una cuenta para usar el chat."}


def iniciar(u):
    s.usuario, s.pantalla = u, "panel"
    if s.pendiente_chat and u:
        texto, s.pendiente_chat = s.pendiente_chat, ""
        procesar_chat(texto)
    elif u["rol"] == "nutricionista" and not obtener_perfil(u)["titular"]:
        s.pantalla = "perfil_editar"
        s.aviso = {"tipo": "info", "texto": "Completa tu perfil para aparecer en el listado de nutricionistas."}


if evento and evento.get("id") != s.ultimo_evento:
    s.ultimo_evento = evento["id"]
    tipo, datos = evento.get("tipo"), evento.get("datos", {})
    u = s.usuario
    s.aviso = None
    if tipo == "ir":
        pantalla = datos.get("pantalla", "inicio")
        if pantalla == "chat" and not u:
            exigir_sesion_para_chat()
        elif pantalla == "perfil_editar" and (not u or u["rol"] != "nutricionista"):
            s.pantalla = "inicio"
        else:
            s.pantalla = pantalla
            s.nutri_id = datos.get("nutri_id", s.nutri_id)
    elif tipo == "chat":
        texto = str(datos.get("texto", "")).strip()[:500]
        if not u:
            exigir_sesion_para_chat(texto)
        elif texto:
            procesar_chat(texto)
    elif tipo == "entrar":
        usuario = iniciar_sesion(datos.get("email", ""), datos.get("clave", ""))
        if usuario:
            iniciar(usuario)
        else:
            s.aviso = {"tipo": "error", "texto": "Correo o contraseña incorrectos."}
    elif tipo == "registrar":
        usuario, error = registrar(datos.get("nombre", ""), datos.get("email", ""), datos.get("clave", ""), datos.get("rol", ""))
        if usuario:
            iniciar(usuario)
        else:
            error_a_aviso(error)
    elif tipo == "salir":
        s.usuario, s.pantalla, s.chat, s.pendiente_chat = None, "inicio", [], ""
    elif tipo == "reservar":
        error = reservar(u, datos.get("hueco_id"), datos.get("servicio_id"), str(datos.get("motivo", "")))
        error_a_aviso(error, "Tu cita está confirmada.")
        if not error:
            s.pantalla = "panel"
    elif tipo == "cancelar":
        error_a_aviso(cancelar_cita(u, datos.get("cita_id")), "Cita cancelada.")
    elif u and u["rol"] == "nutricionista":
        if tipo == "guardar_perfil":
            error_a_aviso(guardar_perfil(u, datos), "Perfil guardado.")
        elif tipo == "add_servicio":
            error_a_aviso(agregar_servicio(u, datos), "Servicio añadido.")
        elif tipo == "del_servicio":
            error_a_aviso(borrar_servicio(u, datos.get("id")))
        elif tipo == "add_hueco":
            error_a_aviso(agregar_hueco(u, str(datos.get("fecha", "")), str(datos.get("hora", ""))), "Horario añadido.")
        elif tipo == "del_hueco":
            error_a_aviso(borrar_hueco(u, datos.get("id")))
    st.rerun()
