import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cómo funciona · Bitácora",
};

export default function HowPage() {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">La idea</p>
      <h1 className="mt-2 font-heading text-4xl tracking-tight md:text-5xl">
        El backlog sigue en el repo. El tablero solo lo mira.
      </h1>
      <div className="mt-8 space-y-5 text-base leading-relaxed text-foreground/90">
        <p>
          Bitácora es un servidor local. Arranca en tu máquina, lee las carpetas que le indiques y
          enseña las tareas que ya tienes escritas en markdown. No sustituye a BACKLOG.md: ese
          archivo sigue siendo la fuente.
        </p>
        <h2 className="pt-4 font-heading text-3xl tracking-tight">¿Se actualiza solo?</h2>
        <p>
          Sí, mientras Bitácora esté en marcha en el mismo ordenador donde editas. Vigila la
          carpeta del proyecto. En cuanto guardas BACKLOG.md, ROADMAP.md o KNOWN_ISSUES.md, el
          tablero vuelve a leer el archivo y mueve las tarjetas. No hace falta recargar ni pulsar
          un botón de sync.
        </p>
        <p>
          También al revés: si marcas una tarea en el tablero, Bitácora cambia el checkbox de esa
          línea. Si creas una tarea desde aquí, la escribe en BACKLOG.md. El editor y la web
          miran el mismo archivo.
        </p>
        <p>
          Lo que no hace es enterarse de un cambio en otro ordenador hasta que ese cambio llega al
          disco de esta máquina. Un <span className="font-mono text-sm">git pull</span> sí lo
          dispara, porque el archivo cambia aquí.
        </p>
        <h2 className="pt-4 font-heading text-3xl tracking-tight">¿Y GitHub?</h2>
        <p>
          Se puede conectar un repositorio por proyecto. Bitácora pide las issues abiertas a la
          API y las pone en una columna aparte. Un repo público funciona sin token. Uno privado,
          o muchos refrescos, necesitan un token con permiso de lectura. El token se queda en{" "}
          <span className="font-mono text-sm">data/github-token</span>, que no se sube a git.
        </p>
        <p>
          Esa conexión no convierte el backlog en issues, ni hace commit cuando marcas una tarea.
          El markdown y las issues son dos fuentes distintas. Subir el BACKLOG sigue siendo un
          commit tuyo, cuando tú quieras.
        </p>
        <h2 className="pt-4 font-heading text-3xl tracking-tight">Qué archivos entiende</h2>
        <p>
          En la raíz del proyecto, y también dentro de <span className="font-mono text-sm">docs/</span>:
          BACKLOG.md, ROADMAP.md, KNOWN_ISSUES.md, TASKS.md, TODO.md e ISSUES.md. Una sección
          llamada Pendiente, En curso o Hecho coloca la tarea en esa columna. Un{" "}
          <span className="font-mono text-sm">[x]</span> la da por cerrada.
        </p>
        <p>
          Si tus notas viven en otro sitio, un <span className="font-mono text-sm">bitacora.json</span> en
          la raíz puede listar más archivos y, si quieres, el repo de GitHub:
        </p>
      </div>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-card p-4 font-mono text-xs leading-relaxed ring-1 ring-foreground/10">
        {`{
  "files": [".artifacts/plans/DATA-002.md"],
  "github": "tu-usuario/juguitoReader"
}`}
      </pre>
      <div className="mt-8 space-y-5 text-base leading-relaxed">
        <h2 className="font-heading text-3xl tracking-tight">Qué no es</h2>
        <p>
          No es un gestor que se lleve las tareas a una base de datos propia, ni un sustituto de
          GitHub Projects. Si apagas el servidor, el tablero desaparece y los markdown se quedan
          exactamente donde estaban.
        </p>
        <p>
          Tampoco lo expongas a internet. Quien pueda abrir esta web puede leer las carpetas que
          hayas registrado y escribir en sus backlog.
        </p>
      </div>
    </article>
  );
}
