# Nubapp

**Autor:** Jairo Peña
**Enlace a la app (versión 0):** (https://nubapp-xydvqiwcxs97xbsrhfchvz.streamlit.app/)

## Qué es este proyecto

Nubapp es una app que ayuda a cualquier persona a agendar de forma fácil y ágil una cita con un nutricionista experto, elegido de un pool de profesionales según la necesidad concreta del paciente (pediátrico, oncológico, TCA, endocrino-obesidad, enfermedad renal, deportivo, vegetarianismo/veganismo, embarazo y maternidad). Hay dos tipos de usuario: **pacientes** y **nutricionistas**.

## Qué hace la app

- **Nutricionistas:** se inscriben, crean su perfil y destacan sus especialidades, servicios, modalidad (online/presencial), idiomas, tarifa orientativa y disponibilidad horaria.
- **Pacientes:** se inscriben y pueden buscar nutricionistas o usar un **chat con IA** que les hace unas pocas preguntas sobre su necesidad y les recomienda los nutricionistas más adecuados, explicando por qué.
- **Agenda:** el paciente elige un hueco libre del nutricionista recomendado y confirma la cita. Ambos pueden verla en su panel.
- **Pieza de IA:** el chat usa la API de Gemini. La IA solo orienta y recomienda perfiles; **no da diagnósticos ni planes de dieta ni consejo médico**.
- **El chat solo está disponible con sesión iniciada.** La regla se aplica en Python (`app.py`), no solo en la interfaz; así también se protege la cuota de Gemini. Sin sesión, el chat lleva a "Entrar" y conserva el mensaje escrito.

## Alcance de la versión 0

La versión 0 es **un mockup / layout de la interfaz**: pantallas navegables con datos inventados, para validar el diseño y el flujo antes de construir toda la lógica. Pantallas previstas: inicio, registro e inicio de sesión (paciente y nutricionista), chat de recomendación, listado y perfil de nutricionista, agenda/reserva de cita y panel del usuario.

Aunque la v0 sea un mockup, el objetivo final es **autenticación real** (registro y login con contraseña cifrada), así que el modelo de datos ya la contempla.

## Cómo está hecho

Stack **muy básico**, a propósito. No añadas piezas que no hagan falta.

**Restricción fundamental:** el stack base viene del template de una clase de la maestría y NO se puede cambiar: Python 3.12 + Streamlit + API de Gemini (`google-genai`), desplegado en Streamlit Community Cloud. Nada de sustituir Streamlit por otro framework, ni de añadir un backend aparte (Node, Express, FastAPI…).

- Python 3.12.
- Interfaz: Streamlit **con componentes React** para la parte visual (ver "Diseño de la interfaz"). Streamlit sigue siendo la app: `app.py` es el punto de entrada y toda la lógica (login, SQLite, Gemini, citas) vive en Python.
- Frontend React: carpeta `frontend/` (React + Vite, opcionalmente Tailwind). Se compila a `frontend/dist/` y `app.py` lo carga con `streamlit.components.v1.declare_component`. **`frontend/dist/` se sube a git**, porque Streamlit Cloud no ejecuta Node ni compila. Node.js solo se usa en local para desarrollar y compilar.
- IA: API de Gemini con el SDK `google-genai`. El modelo está en la constante `MODELO` de `app.py` (hoy `gemini-flash-lite-latest`, un alias que no caduca; `gemini-2.5-flash` ya no está disponible y `gemini-3.8-flash` daba 503 por alta demanda). Respuesta en JSON validado con pydantic; solo se aceptan ids que existan en el pool; si Gemini falla, el chat cae a una recomendación básica por palabras clave y avisa.
- Base de datos: **SQLite** (módulo `sqlite3` de la librería estándar, sin ORM). Funciona en Streamlit Cloud, pero su disco es **efímero**: se pierde al reiniciar o redesplegar. Por eso `app.py` crea las tablas y carga datos de ejemplo (seed) al arrancar si la base está vacía. Si más adelante hace falta persistencia real, se migrará a una base alojada (p. ej. Supabase), previa consulta.
- Contraseñas: nunca en texto plano; se guardan con hash (`hashlib.scrypt` o `bcrypt`).
- Archivos: `app.py` (toda la lógica en Python), `frontend/` (React; fuentes y `dist/` compilado), `requirements.txt`, `README.md`, `CLAUDE.md`, `credenciales_prueba.md` (cuentas ficticias para probar los dos roles), `.gitignore`. La base `nubapp.db` NO se sube a git.
- Cómo recomienda el chat: se le pasa a Gemini la necesidad del paciente junto con la lista de perfiles de nutricionistas (especialidades y servicios) y se le pide que devuelva los 1-3 más adecuados con una breve justificación. Solo puede recomendar nutricionistas que existan en el pool.
- Idea base: `pre setup/idea.txt`.

### Modelo de datos (SQLite)

- `usuarios`: `id`, `email` (único), `password_hash`, `nombre`, `rol` (`paciente` | `nutricionista`), `creado_en`.
- `nutricionistas`: `usuario_id` (FK → `usuarios`), `titular` (frase corta), `bio`, `modalidad` (`online` | `presencial` | `ambas`), `ciudad`, `idiomas`, `tarifa`, `foto_url`.
- `especialidades`: `id`, `nombre` (catálogo cerrado de 8): Pediátrico, Oncológico, TCA (trastorno de la conducta alimentaria), Endocrino-obesidad (incluye diabetes y pérdida de peso), Enfermedad renal, Deportivo, Vegetarianismo/veganismo, Embarazo y maternidad.
- `nutricionista_especialidad`: `nutricionista_id`, `especialidad_id` (N:M).
- `servicios`: `id`, `nutricionista_id`, `nombre`, `descripcion`, `duracion_min`, `precio`.
- `disponibilidad`: `id`, `nutricionista_id`, `inicio` (datetime), `fin`, `reservado` (0/1).
- `citas`: `id`, `paciente_id` (FK → `usuarios`), `nutricionista_id`, `servicio_id`, `disponibilidad_id` (índice único solo entre citas `confirmada`: evita la doble reserva y permite reservar de nuevo un hueco tras cancelar), `estado` (`confirmada` | `cancelada`), `motivo`, `creado_en`.

## Diseño de la interfaz

- Apariencia **moderna y sencilla**, con **colores vivos** (paleta fresca y alegre, p. ej. verde menta/lima, turquesa y un acento naranja o coral; tipografía limpia, tarjetas con bordes redondeados, mucho espacio en blanco).
- Define la paleta una sola vez en `.streamlit/config.toml` (tema) y como variables CSS en `frontend/`; no repitas colores sueltos por el código.
- **Las pantallas se construyen con componentes React** dentro de Streamlit (nivel 2), siempre que se mantenga Streamlit como app base. Los componentes reciben datos de Python por argumentos y devuelven eventos (clic en reservar, mensaje del chat, formulario enviado) con `setComponentValue`; Python decide y escribe en SQLite.
- Los componentes de Streamlit viven en un iframe: no guardes secretos ni llames a Gemini o a la base desde React. Todo eso va en Python.
- Para cualquier trabajo de interfaz usa la skill `frontend-design` y evita el aspecto genérico de Streamlit por defecto.
- Móvil primero: debe verse bien en pantallas pequeñas.
- Para ver y depurar la interfaz en un navegador real, usa el MCP `chrome-devtools`.

## Herramientas del proyecto

- Skills (en `.claude/skills/`): `grill-me` (interrogarme sobre un plan o diseño antes de construirlo; úsala cuando haya decisiones abiertas) y `frontend-design` (diseño de interfaces).
- Plugins de Claude Code: `ponytail` (escribir solo el código necesario, en línea con el stack básico) y `chrome-devtools-mcp` (controlar y depurar Chrome; requiere Node.js LTS y Chrome).

## Reglas

- La clave de la API va SIEMPRE en secretos: `st.secrets["GEMINI_API_KEY"]`, fichero `.streamlit/secrets.toml`, que está en `.gitignore`. En Streamlit Cloud se configura desde Settings → Secrets. Nunca en el código, en el README, en este archivo ni en el chat.
- Cada llamada a la API va dentro de `try/except` y muestra un mensaje claro para el usuario (cuota agotada, sin conexión, respuesta vacía). Si falla la IA, la app sigue permitiendo buscar y filtrar nutricionistas a mano.
- Textos de la interfaz en español, sencillos, pensados para alguien sin conocimientos técnicos.
- La IA nunca da consejos médicos, diagnósticos ni dietas. Si el paciente describe una urgencia o algo clínico, el chat le recomienda acudir a un profesional o a los servicios de salud, y sigue limitándose a orientar sobre qué nutricionista le conviene.
- Consultas SQL siempre parametrizadas (`?`), nunca concatenando texto del usuario.
- Cambios pequeños: uno por petición. Al terminar, explica qué has cambiado y por qué.
- Si añades una librería, añádela también a `requirements.txt` y dilo.
- No uses datos personales reales. Para probar, inventa ejemplos (nombres, correos y teléfonos ficticios).

## Cómo comprobar que funciona

- En local: `streamlit run app.py` (con `.streamlit/secrets.toml` que contenga `GEMINI_API_KEY`), o haz push y revisa la app en Streamlit Cloud.
- Pruebas automáticas de la lógica: `pip install pytest` y `python -m pytest` (carpeta `tests/`). Las marcadas `ia` llaman a Gemini y se omiten si no hay clave, red o cuota. La interfaz se prueba a mano con el MCP `chrome-devtools`.
- Si cambia el esquema de las tablas, sube `VERSION_DB` en `app.py`: al arrancar, una base con versión anterior se borra y se recrea con los datos de ejemplo.
- Casos de prueba (entrada → lo que esperamos):
  1. "Soy ciclista y quiero mejorar mi rendimiento y recuperación" → recomienda nutricionistas con especialidad Deportivo y explica por qué.
  2. "Mi hija de 6 años come muy poco y es muy selectiva" → recomienda nutricionistas Pediátrico.
  3. "Me acaban de diagnosticar diabetes tipo 2" → recomienda especialistas Endocrino-obesidad, sin dar pautas de dieta ni tratamiento.
  4. "¿Qué tiempo hará mañana?" (fuera de tema) → la app dice amablemente que solo puede ayudar a encontrar un nutricionista.
  5. Paciente elige un hueco ya ocupado → la app avisa y no permite la doble reserva.
  6. Registro con un correo ya existente → la app avisa de que ya hay una cuenta; login con contraseña incorrecta → mensaje claro, sin revelar qué dato falló.
  7. Sin sesión, abrir el chat (menú o portada) → pide iniciar sesión y no llama a Gemini.
  8. Nutricionista nuevo → no aparece en el listado hasta tener frase de presentación, una especialidad y al menos un servicio; al completarlo, aparece.
  9. Paciente cancela una cita → el hueco vuelve a estar libre y se puede reservar de nuevo.

## Qué no hacer

- No borres ni reescribas el README sin preguntar.
- No cambies el modelo ni la arquitectura sin preguntar. En particular: no saques la app de Streamlit ni añadas un servidor propio.
- Si algo que pida el proyecto choca con una limitación de Streamlit, avísame antes de cambiar el enfoque.
- No subas `node_modules/` a git.
- No hagas push ni despliegues sin que yo lo haya revisado.
- No hagas que la IA invente nutricionistas, especialidades o huecos que no estén en el pool.
- No subas a git `.streamlit/secrets.toml`, la base `*.db` ni ninguna clave.

## Pendiente de confirmar

- Pagos, recordatorios por correo y videollamada integrada: fuera de la versión 0.
