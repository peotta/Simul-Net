import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { CATEGORIES, findSim } from '../sims/registry';
import { useTheme } from '../hooks/useTheme';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1 text-base font-semibold ${isActive ? 'bg-accent text-accent-ink' : 'hover:bg-surface2'}`;

const SHORT: Record<string, string> = {
  fundamentos: 'Fundamentos',
  'camada-de-enlace': 'Enlace',
  'camada-de-rede': 'Rede',
  transporte: 'Transporte',
  'protocolos-seguros': 'Protocolos seguros',
};

export function AppLayout() {
  const { theme, toggle } = useTheme();
  const simMatch = useMatch('/sim/:id');
  const found = findSim(simMatch?.params.id);
  // Em um simulador disponível a tela vira bancada de trabalho: sem rolagem da página e sem rodapé (o crédito está no simulador).
  const workbench = found?.status === 'available' && (!!found.file || found.engine === 'nativo');
  return (
    <div className={workbench ? 'flex h-dvh flex-col overflow-hidden' : 'flex min-h-screen flex-col'}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink">
        Pular para o conteúdo
      </a>
      <header className="border-b border-line bg-surface">
        <div className={`mx-auto flex flex-wrap items-center gap-3 px-4 ${workbench ? 'max-w-none py-1' : 'max-w-7xl py-3'}`}>
          <NavLink to="/" className="mr-4 text-xl font-bold">
            Simul<span className="text-accent">-Net</span>
          </NavLink>
          <nav aria-label="Principal" className="flex flex-wrap gap-1">
            <NavLink to="/" end className={link}>
              Início
            </NavLink>
            {CATEGORIES.map((c) => (
              <NavLink key={c.id} to={`/categoria/${c.id}`} className={link}>
                {SHORT[c.id] ?? c.title}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={theme === 'dark'}
            className="ml-auto min-h-9 rounded-lg border border-line px-4 text-base font-semibold hover:bg-surface2"
          >
            Tema: {theme === 'dark' ? 'escuro' : 'claro'}
          </button>
        </div>
      </header>
      <main id="conteudo" className={workbench ? 'min-h-0 w-full flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-8'}>
        <Outlet />
      </main>
      {!workbench && (
      <footer className="border-t border-line bg-surface">
        <p className="mx-auto max-w-7xl px-4 py-4 text-center font-mono text-base text-muted">
          Simul-Net é um projeto mantido pelo <strong className="font-bold text-ink">Prof. Dr. Laerte Peotta de Melo</strong>, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa.
          Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica. Código aberto (licença MIT).
        </p>
      </footer>
      )}
    </div>
  );
}
