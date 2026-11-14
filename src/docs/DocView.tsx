import { isValidElement, type ReactNode } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, useLocation } from 'react-router-dom';
import { Mermaid } from './Mermaid';
import { slug } from './slug';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** Vai até o título e o foca, para leitores de tela (a âncora do navegador conflita com o HashRouter). */
export function goTo(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.setAttribute('tabindex', '-1');
  el?.focus({ preventScroll: true });
}

const heading = (Tag: 'h1' | 'h2' | 'h3' | 'h4', cls: string) =>
  function Heading({ children }: { children?: ReactNode }) {
    return (
      <Tag id={slug(textOf(children))} className={`scroll-mt-4 ${cls}`}>
        {children}
      </Tag>
    );
  };

function DocLink({ href = '', children }: { href?: string; children?: ReactNode }) {
  const { pathname } = useLocation();
  const cls = 'font-semibold text-accent underline';
  if (href.startsWith('#')) {
    // O roteador usa o hash para as rotas: a âncora é tratada à mão para não trocar de página.
    const id = decodeURIComponent(href.slice(1));
    return (
      <a
        href={`#${pathname}`}
        className={cls}
        onClick={(e) => {
          e.preventDefault();
          goTo(id);
        }}
      >
        {children}
      </a>
    );
  }
  const doc = /^([A-Za-z0-9-]+)\.md$/.exec(href);
  if (doc)
    return (
      <Link to={doc[1] === 'README' ? '/' : `/sim/${doc[1]}/documentacao`} className={cls}>
        {children}
      </Link>
    );
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
      <span className="sr-only"> (abre em nova aba)</span>
    </a>
  );
}

const components: Components = {
  h1: heading('h1', 'text-3xl font-bold'),
  h2: heading('h2', 'mt-10 border-b border-line pb-2 text-2xl font-bold'),
  h3: heading('h3', 'mt-8 text-xl font-bold'),
  h4: heading('h4', 'mt-6 text-lg font-bold'),
  p: ({ children }) => <p className="my-3 text-lg leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 text-lg">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-3 pl-6 text-lg">{children}</ol>,
  hr: () => <hr className="my-8 border-line" />,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-accent bg-surface2 p-3">{children}</blockquote>,
  a: DocLink,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-base">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface2">{children}</thead>,
  th: ({ children }) => (
    <th scope="col" className="border-b border-line px-3 py-2 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-line px-3 py-2 align-top">{children}</td>,
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const code = textOf(children).replace(/\n$/, '');
    if (/language-mermaid/.test(className ?? '')) {
      const sequence = /^\s*sequenceDiagram/.test(code);
      const packet = /(^|\n)\s*packet(-beta)?(\s|$)/.test(code);
      const label = sequence
        ? 'Diagrama de sequência da figura. O equivalente em texto é a tabela de etapas logo abaixo.'
        : packet
          ? 'Diagrama de campos em bits da figura. O equivalente em texto é a legenda logo abaixo, com a tabela de campos quando houver.'
          : 'Diagrama de topologia da rede da figura.';
      return <Mermaid code={code} label={label} />;
    }
    if (className || code.includes('\n')) return <pre className="my-4 overflow-x-auto rounded-xl border border-line bg-surface2 p-4 font-mono text-base">{code}</pre>;
    return <code className="rounded bg-surface2 px-1 font-mono text-[0.95em]">{children}</code>;
  },
};

/** O crédito que fecha o arquivo Markdown (útil no GitHub e na wiki) já está no rodapé do site: não se repete na página. */
export const withoutCredit = (markdown: string) => markdown.replace(/\n+---\n+\*[^*\n]+ é um projeto mantido pelo [^*\n]+\*\s*$/, '\n');

/** A linha "Legenda:" que antecede um gráfico com legenda própria serve ao GitHub e à wiki: no site, a legenda é desenhada dentro da figura (ver Mermaid.tsx). */
export const withoutChartLegend = (markdown: string) => markdown.replace(/^\*\*Legenda:\*\* [^\n]*\n\n(?=```mermaid\n[^`]*?%% legenda:)/gm, '');

export function DocView({ markdown }: { markdown: string }) {
  const siglas = /^## ((?:\d+\. )?Glossário)$/m.exec(markdown);
  return (
    <div className="min-w-0 max-w-4xl">
      {siglas && (
        <p className="mb-4 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted" role="note">
          <strong className="text-ink">Dúvida sobre uma sigla?</strong> O significado e a finalidade de cada uma estão na seção{' '}
          <button type="button" onClick={() => goTo(slug(siglas[1]))} className="font-semibold text-accent underline">
            {siglas[1]}
          </button>
          , no fim desta página.
        </p>
      )}
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {withoutChartLegend(withoutCredit(markdown))}
      </Markdown>
    </div>
  );
}
