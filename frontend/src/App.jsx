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

const fechaLarga = (iso) =>
  new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const dia = (iso) => iso.slice(0, 10);
const hora = (iso) => iso.slice(11, 16);
const iniciales = (n) => n.replace(/^(Dra?\.)\s/, "").split(" ").map((p) => p[0]).slice(0, 2).join("");

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
  const c = COLOR[n.especialidades[0]] || "#14B8A6";
  return (
    <span className={"avatar" + (grande ? " avatar--xl" : "")} style={{ "--c": c }} aria-hidden="true">
      {iniciales(n.nombre)}
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
            <button className="btn btn--coral" type="submit">Recomiéndame</button>
          </form>
          <div className="chips" role="group" aria-label="Especialidades">
            {esps.map((e) => (
              <Chip key={e.clave} esp={e} onClick={() => ir("directorio", { filtro: e.clave })} />
            ))}
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          <span className="blob blob--a" />
          <span className="blob blob--b" />
          <span className="blob blob--c" />
          <div className="bubble bubble--me">Mi hija de 6 años casi no come 😕</div>
          <div className="bubble bubble--bot">Te recomiendo nutrición pediátrica. Mira estos perfiles.</div>
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2>Algunos de nuestros especialistas</h2>
          <button className="link" onClick={() => ir("directorio")}>Ver todos</button>
        </div>
        <div className="grid">
          {nutricionistas.slice(0, 3).map((n) => (
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
        <p className="empty">No hay nutricionistas con ese filtro. Prueba con otra especialidad o modalidad.</p>
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
          <p className="muted small">Para probar: sofia@example.com / demo1234 (paciente).</p>
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
      <h1 className="h1-sm">Hola, {usuario.nombre.split(" ")[0]}</h1>
      {aviso && <p className={"notice notice--" + aviso.tipo} role="status">{aviso.texto}</p>}
      <h2 className="h2-sm">Tus citas</h2>
      {citas.length === 0 ? (
        <div className="empty">
          {esPaciente ? "Aún no tienes citas. Cuéntanos qué necesitas y reserva la primera." : "Todavía no tienes citas reservadas."}
          {esPaciente && (
            <div><button className="btn btn--coral" onClick={() => ir("chat")}>Buscar nutricionista</button></div>
          )}
        </div>
      ) : (
        <ul className="appts">
          {citas.map((c) => (
            <li key={c.id}>
              <time>{fechaLarga(c.inicio)} · {hora(c.inicio)}</time>
              <strong>{c.servicio}</strong>
              <span className="muted">{esPaciente ? `con ${c.nutricionista}` : `paciente: ${c.paciente}`}</span>
              <span className="pill">{c.estado}</span>
            </li>
          ))}
        </ul>
      )}
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
      </main>
      <footer className="foot">Nubapp · versión 0, datos de ejemplo</footer>
    </div>
  );
}

export default withStreamlitConnection(Ui);
