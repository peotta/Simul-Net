import { useEffect, useId, useState } from 'react';

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
    sequence: { useMaxWidth: false, wrap: false, noteFontSize: 15, messageFontSize: 15, actorFontSize: 16 },
  });
  const { svg } = await mermaid.render(id, code);
  return svg;
}

export function Mermaid({ code, label }: { code: string; label: string }) {
  const uid = useId().replace(/[^A-Za-z0-9]/g, '');
  const [dark, setDark] = useState(isDark);
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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
    <figure role="img" aria-label={label} className="my-4 overflow-x-auto rounded-xl border border-line bg-surface p-4">
      {svg ? <div className="mx-auto w-fit" dangerouslySetInnerHTML={{ __html: svg }} /> : <p role="status" className="text-base text-muted">Desenhando o diagrama…</p>}
    </figure>
  );
}
