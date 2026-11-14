import { useEffect, useId, useRef, useState } from 'react';

// Contêiner do diagrama de bits: largura total, com o desenho centralizado.
const SVG_FULL = 'mx-auto w-full [&>svg]:mx-auto [&>svg]:block';

const btn = 'rounded-lg border border-line bg-surface px-3 py-1.5 text-base font-semibold hover:bg-surface2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

// Janela com o diagrama em tela cheia, com zoom (nativo <dialog>: Esc fecha, foco preso, sem servidor).
function Ampliado({ svg, label, full, onClose }: { svg: string; label: string; full: boolean; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const fit = () => {
    const el = area.current?.querySelector('svg');
    if (!el || !area.current) return;
    const w = el.getBoundingClientRect().width / zoom;
    if (w > 0) setZoom(Math.max(0.25, Math.min(4, (area.current.clientWidth - 32) / w)));
  };

  useEffect(() => {
    dlg.current?.showModal();
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <dialog ref={dlg} onClose={onClose} aria-label={label} className="m-0 h-screen max-h-none w-screen max-w-none bg-bg p-0 text-ink backdrop:bg-black/60">
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface p-3">
          <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(0.25, z / 1.25))} aria-label="Diminuir o zoom">
            -
          </button>
          <span className="min-w-14 text-center text-base" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(4, z * 1.25))} aria-label="Aumentar o zoom">
            +
          </button>
          <button type="button" className={btn} onClick={() => setZoom(1)}>
            100%
          </button>
          <button type="button" className={btn} onClick={fit}>
            Ajustar à largura
          </button>
          <button type="button" className={`${btn} ml-auto`} onClick={() => dlg.current?.close()}>
            Fechar
          </button>
        </div>
        <div ref={area} className="flex-1 overflow-auto p-4">
          <div style={{ zoom }} className={full ? SVG_FULL : 'mx-auto w-fit'} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
    </dialog>
  );
}

// Acima desta altura (px), o diagrama é "longo": a barra de rolagem horizontal também aparece no topo.
const TALL = 600;

const isPacket = (code: string) => /(^|\n)\s*packet(-beta)?(\s|$)/.test(code);

const isDark = () => document.documentElement.classList.contains('dark');

// O Mermaid guarda a configuração em um estado global: os diagramas são desenhados um de cada vez.
let queue: Promise<unknown> = Promise.resolve();

async function draw(id: string, code: string, dark: boolean): Promise<string> {
  const { default: mermaid } = await import('mermaid');
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    // Cores padrão do Mermaid, as mesmas que o GitHub mostra no Markdown (tema claro ou escuro).
    theme: dark ? 'dark' : 'default',
    fontFamily: 'inherit',
    // Tamanho natural do diagrama: o texto mantém o tamanho legível e, se o desenho for mais largo que a página, o contêiner rola na horizontal.
    flowchart: { useMaxWidth: false },
    // Diagrama de bits: ocupa a largura disponível (até o tamanho natural) e encolhe se a janela for estreita, sem barra de rolagem.
    packet: { useMaxWidth: true, bitWidth: 28 },
    state: { useMaxWidth: false },
    sequence: { useMaxWidth: false, wrap: false, noteFontSize: 15, messageFontSize: 15, actorFontSize: 16 },
  });
  const { svg } = await mermaid.render(id, code);
  return fixXyChart(svg, code);
}

// O gráfico de linhas (xychart) sai com width="100%", que o contêiner ajustado ao conteúdo reduz a 300 px: fixa o tamanho natural (o do viewBox).
function fixXyChart(svg: string, code: string): string {
  if (!/xychart(-beta)?\s/.test(code)) return svg;
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) return svg;
  return svg.replace(/^(<svg[^>]*?) width="100%"/, `$1 width="${vb[1]}" height="${vb[2]}"`).replace(/^(<svg[^>]*?) style="max-width:[^"]*;?"/, '$1');
}

export function Mermaid({ code, label }: { code: string; label: string }) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const [dark, setDark] = useState(isDark);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const body = useRef<HTMLElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(0); // largura total do desenho, quando é preciso a barra no topo (0 = sem barra)

  // Mede o desenho: só diagramas altos e mais largos que a página ganham a barra superior.
  useEffect(() => {
    const el = body.current;
    if (!el || !svg) return;
    const measure = () => setSpan(el.scrollHeight > TALL && el.scrollWidth > el.clientWidth + 1 ? el.scrollWidth : 0);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [svg]);

  // As duas barras andam juntas.
  const sync = (from: HTMLElement | null, to: HTMLElement | null) => {
    if (from && to && to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
  };

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = `mmd-${uid}-${dark ? 'd' : 'l'}`;
    queue = queue.then(async () => {
      if (cancelled) return;
      try {
        const out = await draw(id, code, dark);
        if (!cancelled) {
          setSvg(out);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code, dark, uid]);

  if (failed)
    return (
      <div className="my-4 rounded-xl border border-line bg-surface p-4">
        <p role="alert" className="font-semibold text-danger">
          Não foi possível desenhar o diagrama. O código dele segue abaixo.
        </p>
        <pre className="mt-2 overflow-x-auto font-mono text-base">{code}</pre>
      </div>
    );
  return (
    <div className="my-4 rounded-xl border border-line bg-surface">
      {span > 0 && (
        <div ref={top} aria-hidden="true" onScroll={() => sync(top.current, body.current)} className="overflow-x-auto border-b border-line">
          <div style={{ width: span, height: 1 }} />
        </div>
      )}
      {svg && (
        <div className="flex justify-end border-b border-line px-3 py-2">
          <button type="button" className={btn} onClick={() => setOpen(true)}>
            Ampliar diagrama
          </button>
        </div>
      )}
      {open && svg && <Ampliado svg={svg} label={label} full={isPacket(code)} onClose={() => setOpen(false)} />}
      <figure ref={body} role="img" aria-label={label} onScroll={() => sync(body.current, top.current)} className="m-0 overflow-x-auto p-4">
        {svg ? <div className={isPacket(code) ? SVG_FULL : 'mx-auto w-fit'} dangerouslySetInnerHTML={{ __html: svg }} /> : <p role="status" className="text-base text-muted">Desenhando o diagrama…</p>}
      </figure>
    </div>
  );
}
