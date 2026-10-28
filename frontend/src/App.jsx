import React, { useEffect, useRef, useState } from "react";
import { Streamlit, withStreamlitConnection } from "streamlit-component-lib";

// Color por especialidad: el color es la forma de reconocerlas en toda la app.
const COLOR = {
  pediatrico: "#FFB020",
  oncologico: "#B05CFF",
  tca: "#FF6B8A",
  endocrino: "#14B8A6",
  renal: "#3B82F6",
  deportivo: "#FF5A4E",
  vegano: "#84CC16",
  embarazo: "#F472B6",
};

// Fruta o verdura de cada especialidad (SVG propio, sin imágenes externas).
const FRUTA = {
  pediatrico: "fresa", oncologico: "brocoli", tca: "aguacate", endocrino: "limon",
  renal: "arandanos", deportivo: "zanahoria", vegano: "tomate", embarazo: "manzana",
};

const DIBUJOS = {
  fresa: (
    <>
      <path d="M32 58C12 44 10 26 18 20c8-6 14 0 14 0s6-6 14 0c8 6 6 24-14 38z" fill="#FF4D6D" />
      <path d="M20 18l12 6 12-6-4 10H24z" fill="#3DAE4B" />
      <g fill="#FFE08A"><circle cx="26" cy="34" r="1.6" /><circle cx="38" cy="34" r="1.6" /><circle cx="32" cy="42" r="1.6" /><circle cx="28" cy="48" r="1.4" /><circle cx="36" cy="48" r="1.4" /></g>
    </>
  ),
  brocoli: (
    <>
      <path d="M26 34h12l-2 24h-8z" fill="#A5D96A" />
      <g fill="#2FA84F"><circle cx="21" cy="26" r="13" /><circle cx="43" cy="26" r="13" /><circle cx="32" cy="17" r="13" /><circle cx="32" cy="30" r="12" /></g>
      <g fill="#52C46B"><circle cx="26" cy="14" r="4" /><circle cx="40" cy="24" r="4" /><circle cx="19" cy="28" r="3" /></g>
    </>
  ),
  aguacate: (
    <>
      <path d="M32 4C44 4 50 22 52 36c2 16-8 24-20 24S10 52 12 36C14 22 20 4 32 4z" fill="#3E8E41" />
      <path d="M32 12c9 0 13 14 14 25 1 12-6 17-14 17S17 49 18 37c1-11 5-25 14-25z" fill="#D9F27A" />
      <circle cx="32" cy="42" r="8" fill="#A06E3C" />
      <ellipse cx="29.5" cy="39.5" rx="2.5" ry="3" fill="#C99660" />
    </>
  ),
  limon: (
    <>
      <path d="M4 32c2-4 4-4 6-6 4-8 12-12 22-12s18 4 22 12c2 2 4 2 6 6-2 4-4 4-6 6-4 8-12 12-22 12S14 46 10 38c-2-2-4-2-6-6z" fill="#FFD93C" />
      <path d="M32 14c10 0 18 4 22 12-6-3-14-4-22-4s-16 1-22 4c4-8 12-12 22-12z" fill="#FFE97A" />
      <path d="M40 10c6-6 14-4 16-2-2 6-10 8-16 2z" fill="#3DAE4B" />
    </>
  ),
  arandanos: (
    <>
      <g fill="#4C6FFF"><circle cx="22" cy="40" r="15" /><circle cx="42" cy="40" r="15" /><circle cx="32" cy="22" r="15" /></g>
      <g fill="#2E49C9"><circle cx="22" cy="40" r="4.5" /><circle cx="42" cy="40" r="4.5" /><circle cx="32" cy="22" r="4.5" /></g>
      <g fill="#fff" opacity=".45"><circle cx="16" cy="34" r="2.5" /><circle cx="36" cy="34" r="2.5" /><circle cx="26" cy="16" r="2.5" /></g>
    </>
  ),
  zanahoria: (
    <g transform="rotate(32 32 32)">
      <path d="M24 20q8-8 16 0l-5 38q-3 5-6 0z" fill="#FF8A1F" />
      <g stroke="#D96B0B" strokeWidth="1.5" strokeLinecap="round"><path d="M27 28h6M31 38h6M29 47h5" /></g>
      <g fill="#3DAE4B"><ellipse cx="32" cy="10" rx="4" ry="9" /><ellipse cx="24" cy="12" rx="3.5" ry="8" transform="rotate(-25 24 12)" /><ellipse cx="40" cy="12" rx="3.5" ry="8" transform="rotate(25 40 12)" /></g>
    </g>
  ),
  tomate: (
    <>
      <circle cx="32" cy="36" r="23" fill="#FF5A4E" />
      <ellipse cx="23" cy="27" rx="5" ry="3.5" fill="#fff" opacity=".4" transform="rotate(-30 23 27)" />
      <path d="M32 14l5 7 8-3-3 8 7 3-8 3-9-4-9 4-8-3 7-3-3-8 8 3z" fill="#2FA84F" />
    </>
  ),
  manzana: (
    <>
      <path d="M32 20c-6-5-20-3-20 14 0 14 8 26 16 26 3 0 3-1 4-1s1 1 4 1c8 0 16-12 16-26 0-17-14-19-20-14z" fill="#8FD14F" />
      <ellipse cx="22" cy="32" rx="4" ry="6" fill="#fff" opacity=".35" transform="rotate(15 22 32)" />
      <path d="M32 20c0-6 2-10 5-12" stroke="#7A4B1E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M36 12c5-5 12-3 13-1-2 6-9 7-13 1z" fill="#3DAE4B" />
    </>
  ),
};

function Fruta({ tipo, size = 64, style, className }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} style={style} aria-hidden="true" focusable="false">
      {DIBUJOS[tipo]}
    </svg>
  );
}

const fechaLarga = (iso) =>
  new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const dia = (iso) => iso.slice(0, 10);
const hora = (iso) => iso.slice(11, 16);

function enviar(tipo, datos = {}) {
  Streamlit.setComponentValue({ id: `${Date.now()}-${Math.random()}`, tipo, datos });
}

function Chip({ esp, activo, onClick }) {
  return (
    <button
      className={"chip" + (activo ? " chip--on" : "")}
      style={{ "--c": COLOR[esp.clave] }}
      onClick={onClick}
      aria-pressed={activo}
    >
      {esp.nombre}
    </button>
  );
}

function Avatar({ n, grande }) {
  const k = n.especialidades[0];
  return (
    <span className={"avatar" + (grande ? " avatar--xl" : "")} style={{ "--c": COLOR[k] || "#14B8A6" }} aria-hidden="true">
      <Fruta tipo={FRUTA[k] || "aguacate"} size={grande ? 56 : 34} />
    </span>
  );
}

function Etiquetas({ n, esps }) {
  return (
    <div className="tags">
      {n.especialidades.map((k) => (
        <span key={k} className="tag" style={{ "--c": COLOR[k] }}>
          {esps.find((e) => e.clave === k)?.nombre}
        </span>
      ))}
    </div>
  );
}

function Tarjeta({ n, esps, abrir }) {
  const proximo = n.huecos[0];
  return (
    <article className="card">
      <header className="card__head">
        <Avatar n={n} />
        <div>
          <h3>{n.nombre}</h3>
          <p className="muted">
            {n.ciudad} · {n.modalidad === "ambas" ? "online y presencial" : n.modalidad}
          </p>
        </div>
      </header>
      <p className="card__titular">{n.titular}</p>
      <Etiquetas n={n} esps={esps} />
      <footer className="card__foot">
        <div>
          <strong>desde US$ {Math.min(...n.servicios.map((s) => s.precio))}</strong>
          <p className="muted small">
            {proximo ? `Próximo hueco: ${fechaLarga(proximo.inicio)}, ${hora(proximo.inicio)}` : "Sin horarios por ahora"}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => abrir(n.id)}>
          Ver perfil
        </button>
      </footer>
    </article>
  );
}

function Inicio({ args, ir, enviarChat }) {
  const [texto, setTexto] = useState("");
  const { especialidades: esps, nutricionistas } = args;
  const lanzar = (e) => {
    e.preventDefault();
    if (texto.trim()) enviarChat(texto.trim());
  };
  return (
    <>
      <section className="hero">
        <div className="hero__text">
          <h1>Encuentra al nutricionista que sabe de lo tuyo</h1>
          <p className="lead">
            Cuéntanos qué necesitas y te recomendamos a los especialistas adecuados. Reserva tu cita en un minuto.
          </p>
          <form className="ask" onSubmit={lanzar}>
            <label htmlFor="ask" className="sr">¿Qué necesitas?</label>
            <input
              id="ask"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej. soy ciclista y quiero recuperarme mejor"
              maxLength={500}
            />
            <button className="btn btn--coral" type="submit">
              {args.usuario ? "Recomiéndame" : "Inicia sesión para chatear"}
            </button>
          </form>
          <div className="chips" role="group" aria-label="Especialidades">
            {esps.map((e) => (
              <Chip key={e.clave} esp={e} onClick={() => ir("directorio", { filtro: e.clave })} />
            ))}
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <span className="plate" />
          <Fruta tipo="aguacate" size={150} className="fx fx--a" />
          <Fruta tipo="tomate" size={110} className="fx fx--b" />
          <Fruta tipo="zanahoria" size={120} className="fx fx--c" />
          <Fruta tipo="limon" size={90} className="fx fx--d" />
          <Fruta tipo="brocoli" size={100} className="fx fx--e" />
          <Fruta tipo="fresa" size={70} className="fx fx--f" />
          <div className="bubble bubble--me">Mi hija de 6 años casi no come</div>
          <div className="bubble bubble--bot">Te recomiendo nutrición pediátrica. Mira estos perfiles.</div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Algunos de nuestros especialistas</h2>
          <button className="link" onClick={() => ir("directorio")}>Ver todos</button>
        </div>
        <div className="grid">
          {nutricionistas.slice(0, 4).map((n) => (
            <Tarjeta key={n.id} n={n} esps={esps} abrir={(id) => ir("perfil", { nutri_id: id })} />
          ))}
        </div>
      </section>
    </>
  );
}

function Chat({ args, ir, enviarChat }) {
  const [texto, setTexto] = useState("");
  const fin = useRef(null);
  const { chat, nutricionistas, especialidades: esps } = args;
  useEffect(() => { fin.current?.scrollIntoView({ block: "nearest" }); }, [chat.length]);
  const lanzar = (e) => {
    e.preventDefault();
    if (!texto.trim()) return;
    enviarChat(texto.trim());
    setTexto("");
  };
  return (
    <section className="section chat">
      <h1 className="h1-sm">Cuéntame qué necesitas</h1>
      <p className="muted">Nubi te orienta hacia el especialista adecuado. No da diagnósticos ni dietas.</p>
      {args.aviso && <p className={"notice notice--" + args.aviso.tipo} role="status">{args.aviso.texto}</p>}
      <div className="chat__log" role="log" aria-live="polite">
        {chat.length === 0 && (
          <div className="bubble bubble--bot">
            Hola, soy Nubi. Dime qué te preocupa o qué quieres lograr y te recomiendo nutricionistas.
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i}>
            <div className={"bubble " + (m.rol === "paciente" ? "bubble--me" : "bubble--bot")}>
              {m.texto || m.mensaje}
            </div>
            {m.ids?.length > 0 && (
              <div className="grid grid--chat">
                {m.ids.map((id) => {
                  const n = nutricionistas.find((x) => x.id === id);
                  return n && <Tarjeta key={id} n={n} esps={esps} abrir={(x) => ir("perfil", { nutri_id: x })} />;
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={fin} />
      </div>
      <form className="ask" onSubmit={lanzar}>
        <label htmlFor="msg" className="sr">Tu mensaje</label>
        <input id="msg" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe aquí…" maxLength={500} />
        <button className="btn btn--coral" type="submit">Enviar</button>
      </form>
    </section>
  );
}

function Directorio({ args, ir, filtroInicial }) {
  const { especialidades: esps, nutricionistas } = args;
  const [filtro, setFiltro] = useState(filtroInicial || null);
  const [modo, setModo] = useState("todas");
  const lista = nutricionistas.filter(
    (n) => (!filtro || n.especialidades.includes(filtro)) && (modo === "todas" || n.modalidad === modo || n.modalidad === "ambas")
  );
  return (
    <section className="section">
      <h1 className="h1-sm">Nutricionistas</h1>
      <div className="chips" role="group" aria-label="Filtrar por especialidad">
        <button className={"chip chip--all" + (!filtro ? " chip--on" : "")} style={{ "--c": "#10263B" }} onClick={() => setFiltro(null)}>
          Todas
        </button>
        {esps.map((e) => (
          <Chip key={e.clave} esp={e} activo={filtro === e.clave} onClick={() => setFiltro(filtro === e.clave ? null : e.clave)} />
        ))}
      </div>
      <div className="seg" role="group" aria-label="Modalidad">
        {["todas", "online", "presencial"].map((m) => (
          <button key={m} className={modo === m ? "on" : ""} onClick={() => setModo(m)}>
            {m === "todas" ? "Cualquier modalidad" : m === "online" ? "Online" : "Presencial"}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="empty"><Fruta tipo="limon" size={56} />No hay nutricionistas con ese filtro. Prueba con otra especialidad o modalidad.</p>
      ) : (
        <div className="grid">
          {lista.map((n) => (
            <Tarjeta key={n.id} n={n} esps={esps} abrir={(id) => ir("perfil", { nutri_id: id })} />
          ))}
        </div>
      )}
    </section>
  );
}

function Perfil({ args, ir }) {
  const { nutricionistas, nutri_id, usuario, especialidades: esps, aviso } = args;
  const n = nutricionistas.find((x) => x.id === nutri_id);
  const [servicio, setServicio] = useState(n?.servicios[0]?.id);
  const [diaSel, setDiaSel] = useState(null);
  const [hueco, setHueco] = useState(null);
  const [motivo, setMotivo] = useState("");
  if (!n) return <section className="section"><p className="empty">No encontramos ese perfil.</p></section>;
  const dias = [...new Set(n.huecos.map((h) => dia(h.inicio)))];
  const diaActivo = diaSel || dias[0];
  const delDia = n.huecos.filter((h) => dia(h.inicio) === diaActivo);
  const esPaciente = usuario?.rol === "paciente";
  const reservar = () => enviar("reservar", { hueco_id: hueco, servicio_id: servicio, motivo });
  return (
    <section className="section profile">
      <button className="link" onClick={() => ir("directorio")}>Volver al listado</button>
      <div className="profile__grid">
        <div>
          <header className="profile__head">
            <Avatar n={n} grande />
            <div>
              <h1 className="h1-sm">{n.nombre}</h1>
              <p className="muted">{n.ciudad} · {n.idiomas}</p>
            </div>
          </header>
          <p className="lead">{n.titular}</p>
          <Etiquetas n={n} esps={esps} />
          <p className="bio">{n.bio}</p>
          <h2 className="h2-sm">Servicios</h2>
          <div className="services">
            {n.servicios.map((s) => (
              <label key={s.id} className={"service" + (servicio === s.id ? " service--on" : "")}>
                <input type="radio" name="serv" checked={servicio === s.id} onChange={() => setServicio(s.id)} />
                <span>
                  <strong>{s.nombre}</strong>
                  <span className="muted small">{s.descripcion} · {s.duracion_min} min</span>
                </span>
                <b>US$ {s.precio}</b>
              </label>
            ))}
          </div>
        </div>

        <aside className="book">
          <h2 className="h2-sm">Reserva tu cita</h2>
          {dias.length === 0 ? (
            <p className="empty">Este especialista no tiene horarios libres por ahora.</p>
          ) : (
            <>
              <div className="days" role="group" aria-label="Día">
                {dias.map((d) => (
                  <button key={d} className={d === diaActivo ? "on" : ""} onClick={() => { setDiaSel(d); setHueco(null); }}>
                    {new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric" }).format(new Date(d + "T12:00"))}
                  </button>
                ))}
              </div>
              <div className="slots" role="group" aria-label="Hora">
                {delDia.map((h) => (
                  <button key={h.id} className={hueco === h.id ? "on" : ""} onClick={() => setHueco(h.id)}>
                    {hora(h.inicio)}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Cuéntale brevemente el motivo</span>
                <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />
              </label>
              {aviso && <p className={"notice notice--" + aviso.tipo} role="alert">{aviso.texto}</p>}
              {esPaciente ? (
                <button className="btn btn--coral btn--full" disabled={!hueco || !servicio} onClick={reservar}>
                  Confirmar cita
                </button>
              ) : (
                <button className="btn btn--coral btn--full" onClick={() => ir("entrar")}>
                  Inicia sesión como paciente para reservar
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function Entrar({ args }) {
  const [modo, setModo] = useState("entrar");
  const [f, setF] = useState({ nombre: "", email: "", clave: "", rol: "paciente" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const enviarForm = (e) => {
    e.preventDefault();
    modo === "entrar" ? enviar("entrar", { email: f.email, clave: f.clave }) : enviar("registrar", f);
  };
  return (
    <section className="section auth">
      <div className="seg seg--wide" role="tablist">
        <button className={modo === "entrar" ? "on" : ""} onClick={() => setModo("entrar")}>Entrar</button>
        <button className={modo === "registro" ? "on" : ""} onClick={() => setModo("registro")}>Crear cuenta</button>
      </div>
      <form className="auth__form" onSubmit={enviarForm}>
        {modo === "registro" && (
          <>
            <div className="seg seg--wide" role="group" aria-label="Soy">
              <button type="button" className={f.rol === "paciente" ? "on" : ""} onClick={() => setF({ ...f, rol: "paciente" })}>Soy paciente</button>
              <button type="button" className={f.rol === "nutricionista" ? "on" : ""} onClick={() => setF({ ...f, rol: "nutricionista" })}>Soy nutricionista</button>
            </div>
            <label className="field"><span>Nombre</span><input value={f.nombre} onChange={set("nombre")} required /></label>
          </>
        )}
        <label className="field"><span>Correo</span><input type="email" value={f.email} onChange={set("email")} required /></label>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" value={f.clave} onChange={set("clave")} required minLength={modo === "registro" ? 8 : undefined} />
        </label>
        {args.aviso && <p className={"notice notice--" + args.aviso.tipo} role="alert">{args.aviso.texto}</p>}
        <button className="btn btn--coral btn--full" type="submit">{modo === "entrar" ? "Entrar" : "Crear cuenta"}</button>
        {modo === "entrar" && (
          <p className="muted small">Para probar: sofia@example.com (paciente) o andres.carvajal@example.com (nutricionista), con la contraseña demo1234.</p>
        )}
      </form>
    </section>
  );
}

function Panel({ args, ir }) {
  const { usuario, citas, aviso } = args;
  if (!usuario) return <section className="section"><p className="empty">Inicia sesión para ver tu panel.</p></section>;
  const esPaciente = usuario.rol === "paciente";
  return (
    <section className="section">
      <div className="section__head">
        <h1 className="h1-sm">Hola, {usuario.nombre.split(" ")[0]}</h1>
        {!esPaciente && <button className="btn btn--ghost" onClick={() => ir("perfil_editar")}>Editar mi perfil y horarios</button>}
      </div>
      {aviso && <p className={"notice notice--" + aviso.tipo} role="status">{aviso.texto}</p>}
      <h2 className="h2-sm">Tus citas</h2>
      {citas.length === 0 ? (
        <div className="empty">
          <Fruta tipo="manzana" size={56} />
          {esPaciente ? "Aún no tienes citas. Cuéntanos qué necesitas y reserva la primera." : "Todavía no tienes citas reservadas."}
          {esPaciente && (
            <div><button className="btn btn--coral" onClick={() => ir("chat")}>Buscar nutricionista</button></div>
          )}
        </div>
      ) : (
        <ul className="appts">
          {citas.map((c) => (
            <li key={c.id} className={c.estado === "cancelada" ? "appt--off" : ""}>
              <time>{fechaLarga(c.inicio)} · {hora(c.inicio)}</time>
              <strong>{c.servicio}</strong>
              <span className="muted">{esPaciente ? `con ${c.nutricionista}` : `paciente: ${c.paciente}`}</span>
              <span className="appt__end">
                <span className="pill">{c.estado}</span>
                {c.estado === "confirmada" && (
                  <button className="link" onClick={() => enviar("cancelar", { cita_id: c.id })}>Cancelar</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PerfilEditar({ args, ir }) {
  const { perfil, especialidades: esps, aviso } = args;
  const [f, setF] = useState({ ...perfil });
  const [serv, setServ] = useState({ nombre: "", descripcion: "", duracion_min: 45, precio: 30 });
  const [h, setH] = useState({ fecha: "", hora: "10:00" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggle = (c) =>
    setF({ ...f, especialidades: f.especialidades.includes(c) ? f.especialidades.filter((x) => x !== c) : [...f.especialidades, c] });
  const hoy = new Date().toISOString().slice(0, 10);
  const horas = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);
  return (
    <section className="section editor">
      <button className="link" onClick={() => ir("panel")}>Volver al panel</button>
      <h1 className="h1-sm">Tu perfil profesional</h1>
      <p className="muted">Aparecerás en el listado cuando tengas una frase de presentación, una especialidad y al menos un servicio.</p>
      {aviso && <p className={"notice notice--" + aviso.tipo} role="status">{aviso.texto}</p>}

      <form className="editor__box" onSubmit={(e) => { e.preventDefault(); enviar("guardar_perfil", f); }}>
        <h2 className="h2-sm">Presentación</h2>
        <label className="field"><span>Frase que te define</span><input value={f.titular} onChange={set("titular")} maxLength={120} required /></label>
        <label className="field"><span>Sobre ti</span><textarea rows={4} value={f.bio} onChange={set("bio")} maxLength={600} /></label>
        <div className="editor__row">
          <label className="field"><span>Ciudad</span><input value={f.ciudad} onChange={set("ciudad")} maxLength={60} /></label>
          <label className="field"><span>Idiomas</span><input value={f.idiomas} onChange={set("idiomas")} maxLength={60} /></label>
          <label className="field">
            <span>Modalidad</span>
            <select value={f.modalidad} onChange={set("modalidad")}>
              <option value="online">Online</option><option value="presencial">Presencial</option><option value="ambas">Online y presencial</option>
            </select>
          </label>
          <label className="field"><span>Tarifa desde (US$)</span><input type="number" min="0" value={f.tarifa} onChange={set("tarifa")} /></label>
        </div>
        <p className="field-label">Tus especialidades</p>
        <div className="chips" role="group" aria-label="Especialidades">
          {esps.map((e) => <Chip key={e.clave} esp={e} activo={f.especialidades.includes(e.clave)} onClick={() => toggle(e.clave)} />)}
        </div>
        <button className="btn btn--coral" type="submit">Guardar perfil</button>
      </form>

      <div className="editor__box">
        <h2 className="h2-sm">Servicios</h2>
        {perfil.servicios.length === 0 && <p className="muted">Aún no tienes servicios. Añade el primero.</p>}
        <ul className="rows">
          {perfil.servicios.map((s) => (
            <li key={s.id}>
              <span><strong>{s.nombre}</strong> <span className="muted small">{s.duracion_min} min · US$ {s.precio}</span></span>
              <button className="link" onClick={() => enviar("del_servicio", { id: s.id })}>Quitar</button>
            </li>
          ))}
        </ul>
        <form className="editor__row" onSubmit={(e) => { e.preventDefault(); enviar("add_servicio", serv); setServ({ ...serv, nombre: "", descripcion: "" }); }}>
          <label className="field"><span>Nombre</span><input value={serv.nombre} onChange={(e) => setServ({ ...serv, nombre: e.target.value })} maxLength={80} required /></label>
          <label className="field"><span>Descripción</span><input value={serv.descripcion} onChange={(e) => setServ({ ...serv, descripcion: e.target.value })} maxLength={160} /></label>
          <label className="field"><span>Minutos</span><input type="number" min="10" max="180" value={serv.duracion_min} onChange={(e) => setServ({ ...serv, duracion_min: e.target.value })} /></label>
          <label className="field"><span>Precio (US$)</span><input type="number" min="0" value={serv.precio} onChange={(e) => setServ({ ...serv, precio: e.target.value })} /></label>
          <button className="btn btn--ghost" type="submit">Añadir servicio</button>
        </form>
      </div>

      <div className="editor__box">
        <h2 className="h2-sm">Horarios disponibles</h2>
        {perfil.huecos.length === 0 && <p className="muted">No tienes horarios futuros. Añade algunos para que te puedan reservar.</p>}
        <ul className="rows rows--wrap">
          {perfil.huecos.map((x) => (
            <li key={x.id} className={x.reservado ? "appt--off" : ""}>
              <span>{fechaLarga(x.inicio)} · {hora(x.inicio)}{x.reservado ? " (reservado)" : ""}</span>
              {!x.reservado && <button className="link" onClick={() => enviar("del_hueco", { id: x.id })}>Quitar</button>}
            </li>
          ))}
        </ul>
        <form className="editor__row" onSubmit={(e) => { e.preventDefault(); enviar("add_hueco", h); }}>
          <label className="field"><span>Día</span><input type="date" min={hoy} value={h.fecha} onChange={(e) => setH({ ...h, fecha: e.target.value })} required /></label>
          <label className="field">
            <span>Hora</span>
            <select value={h.hora} onChange={(e) => setH({ ...h, hora: e.target.value })}>{horas.map((x) => <option key={x}>{x}</option>)}</select>
          </label>
          <button className="btn btn--ghost" type="submit">Añadir horario</button>
        </form>
      </div>
    </section>
  );
}

function Ui({ args }) {
  const [filtroInicial, setFiltroInicial] = useState(null);
  const raiz = useRef(null);
  const { pantalla, usuario } = args;

  useEffect(() => {
    Streamlit.setFrameHeight(Math.max(document.documentElement.scrollHeight, 700));
    const ro = new ResizeObserver(() => Streamlit.setFrameHeight(Math.max(document.documentElement.scrollHeight, 700)));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);

  const ir = (p, extra = {}) => {
    if (extra.filtro !== undefined) setFiltroInicial(extra.filtro);
    enviar("ir", { pantalla: p, nutri_id: extra.nutri_id });
  };
  const enviarChat = (texto) => enviar("chat", { texto });

  const nav = [
    ["inicio", "Inicio"],
    ["directorio", "Nutricionistas"],
    ["chat", "Chat"],
  ];
  return (
    <div className="app" ref={raiz}>
      <header className="top">
        <button className="logo" onClick={() => ir("inicio")} aria-label="Nubapp, ir al inicio">
          <span className="logo__dot" aria-hidden="true" />nubapp
        </button>
        <nav aria-label="Principal">
          {nav.map(([p, t]) => (
            <button key={p} className={pantalla === p ? "on" : ""} onClick={() => ir(p)}>{t}</button>
          ))}
        </nav>
        {usuario ? (
          <div className="top__user">
            <button className="btn btn--ghost" onClick={() => ir("panel")}>Mi panel</button>
            <button className="link" onClick={() => enviar("salir")}>Salir</button>
          </div>
        ) : (
          <button className="btn btn--ink" onClick={() => ir("entrar")}>Entrar</button>
        )}
      </header>
      <main>
        {pantalla === "inicio" && <Inicio args={args} ir={ir} enviarChat={enviarChat} />}
        {pantalla === "chat" && <Chat args={args} ir={ir} enviarChat={enviarChat} />}
        {pantalla === "directorio" && <Directorio args={args} ir={ir} filtroInicial={filtroInicial} />}
        {pantalla === "perfil" && <Perfil args={args} ir={ir} />}
        {pantalla === "entrar" && <Entrar args={args} />}
        {pantalla === "panel" && <Panel args={args} ir={ir} />}
        {pantalla === "perfil_editar" && args.perfil && <PerfilEditar args={args} ir={ir} />}
      </main>
      <div className="deco deco--l" aria-hidden="true">
        <Fruta tipo="tomate" size={96} /><Fruta tipo="brocoli" size={80} /><Fruta tipo="limon" size={88} /><Fruta tipo="fresa" size={72} />
      </div>
      <div className="deco deco--r" aria-hidden="true">
        <Fruta tipo="zanahoria" size={92} /><Fruta tipo="arandanos" size={76} /><Fruta tipo="aguacate" size={96} /><Fruta tipo="manzana" size={80} />
      </div>
      <footer className="foot">Nubapp · versión 0, datos de ejemplo</footer>
    </div>
  );
}

export default withStreamlitConnection(Ui);
