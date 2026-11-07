import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Field, Message } from '../types';
import { esc } from '../hash';
import { prepare, timeAt } from '../trace';
import { Controls } from './Controls';
import { FloatProvider, useFrame } from './frames';
import { Ladder, ZOOM_FIT, ZOOM_STEPS } from './Ladder';
import { Topology } from './Topology';
import { layoutLadder } from './ladder-layout';
import type { ParamValue, Params, ProtocolDef, ScenarioDef } from './module';
import { milestoneIndex, nextStep, stateAt, visibleLog, visibleMessages } from './playback';
import { changedControls, scenarioParams } from './scenarios';
import { usePlayer, TOPO_SLOW } from './usePlayer';
import './simnet.css';

const DEFAULT_INSPECTOR = (
  <div className="muted-txt">
    <p>
      Escolha um cenário no topo ou ajuste a configuração e clique em <b>Simular</b>. Use <b>Passo</b> para avançar mensagem por mensagem.
    </p>
    <p>Clique em uma seta do diagrama ou em uma linha da Captura para ver o conteúdo da mensagem.</p>
    <p>Passe o mouse ou toque em qualquer campo de configuração (ⓘ) para ver a explicação dele.</p>
  </div>
);

const html = (h: string) => ({ __html: h });
const isSec = (f: Field): f is { sec: string } => !Array.isArray(f);

function ScenarioText({ def, s }: { def: ProtocolDef; s: ScenarioDef }) {
  const d = def.scenDoc[s.id];
  return (
    <>
      <div className="sc-kicker">{s.g}</div>
      <h3 className="sc-title">{s.label}</h3>
      {def.setup && <p className="sc-cmd" dangerouslySetInnerHTML={html(def.setup(s))} />}
      <h4>O que é</h4>
      <p dangerouslySetInnerHTML={html(d.concept)} />
      <h4>Neste cenário</h4>
      <div dangerouslySetInnerHTML={html(s.what)} />
      <h4>O que observar</h4>
      <ul>
        {d.observe.map((x, i) => (
          <li key={i} dangerouslySetInnerHTML={html(x)} />
        ))}
      </ul>
      <h4>{d.msgsTitle || 'Mensagens envolvidas'}</h4>
      <table className="sc-msgs">
        <thead>
          <tr>
            <th>{d.cols ? d.cols[0] : 'Mensagem'}</th>
            <th>{d.cols ? d.cols[1] : 'Função'}</th>
            <th>{d.cols ? d.cols[2] : 'Quem envia'}</th>
          </tr>
        </thead>
        <tbody>
          {d.msgs.map((m, i) => (
            <tr key={i}>
              <td dangerouslySetInnerHTML={html(m[0])} />
              <td dangerouslySetInnerHTML={html(m[1])} />
              <td className="meaning" dangerouslySetInnerHTML={html(m[2])} />
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Por que importa</h4>
      <p dangerouslySetInnerHTML={html(d.why)} />
    </>
  );
}

interface Props {
  def: ProtocolDef;
}

/**
 * Bancada de um simulador nativo: cenários, diagrama de sequência animado, painel de configuração,
 * estado, e abas Cenário, Captura, Mensagem, próprias, Experimento, Referência e Log.
 * O motor (def.build) é puro; este componente só apresenta o trace.
 */
export function Workbench({ def }: Props) {
  return (
    <FloatProvider>
      <Bench def={def} />
    </FloatProvider>
  );
}

function Bench({ def }: Props) {
  const first = def.scenarios.find((s) => s.id === def.subs[0].default)!;
  const [sub, setSub] = useState(first.sub);
  const [P, setP] = useState<Params>(() => scenarioParams(def.controls, first));
  const [activeScen, setActiveScen] = useState<string | null>(first.id);
  const [baseScen, setBaseScen] = useState<string | null>(first.id);
  const [advOpen, setAdvOpen] = useState(!!first.openAdv);
  const [tab, setTab] = useState('scen');
  const [selId, setSelId] = useState<number | null>(null);
  const [zi, setZi] = useState(ZOOM_FIT);
  const [view, setView] = useState<'seq' | 'topo'>('seq');
  // Prova de conceito: o painel de estados dentro do palco (acompanha a mensagem atual no diagrama de sequência)
  const [statesInStage, setStatesInStage] = useState(!def.stage);
  const [ovTop, setOvTop] = useState(8);
  const ovRef = useRef<HTMLElement>(null);

  // Painéis da bancada: diagrama, estados, configurações e abas (o painel de abas começa recolhido em telas baixas).
  const stageF = useFrame();
  const stateF = useFrame();
  const cfgF = useFrame();
  const tabsF = useFrame({ tabsPanel: true, collapsedInitial: typeof window !== 'undefined' && window.innerHeight < 800 });
  const tabsEl = useRef<HTMLElement | null>(null);
  const frameRef = tabsF.rootProps.ref;
  const tabsRootProps = {
    ...tabsF.rootProps,
    ref: (node: HTMLElement | null) => {
      tabsEl.current = node;
      frameRef(node);
    },
  };
  // Alça de altura do painel de abas: arrastar ou setas para cima e para baixo.
  const gripEl = useRef<HTMLDivElement>(null);
  const syncGrip = (h: number) => gripEl.current?.setAttribute('aria-valuenow', String(Math.round(h)));
  useEffect(() => {
    if (tabsEl.current) syncGrip(tabsEl.current.getBoundingClientRect().height);
  }, []);
  const setTabsHeight = (h: number) => {
    tabsF.setCollapsed(false);
    const v = Math.max(110, Math.min(h, window.innerHeight * 0.75));
    tabsEl.current?.style.setProperty('--tabs-h', v + 'px');
    syncGrip(v);
  };
  const gripDown = (e: React.PointerEvent) => {
    if (e.button > 0 || !tabsEl.current) return;
    e.preventDefault();
    const sy = e.clientY;
    const h0 = tabsEl.current.getBoundingClientRect().height;
    const mv = (ev: PointerEvent) => setTabsHeight(h0 + (sy - ev.clientY));
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const gripKey = (e: React.KeyboardEvent) => {
    const h = tabsEl.current?.getBoundingClientRect().height ?? 0;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTabsHeight(h + 30);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTabsHeight(h - 30);
    }
  };

  const built = useMemo(() => {
    const tr = def.build(P, sub);
    const endR = prepare(tr);
    return { tr, endR, layout: layoutLadder(tr, endR, def.timeLabel) };
  }, [def, P, sub]);
  const { tr, endR, layout } = built;
  const topoDef = useMemo(() => (def.topology ? def.topology(sub, tr) : null), [def, sub, tr]);
  const showTopo = !!topoDef && view === 'topo';
  // na topologia o pacote percorre vários enlaces: a animação anda mais devagar para dar tempo de acompanhar
  const player = usePlayer(endR, showTopo ? TOPO_SLOW : 1);
  const { clock } = player;

  // Um trace novo recomeça a reprodução e limpa a mensagem selecionada.
  const [seenTrace, setSeenTrace] = useState(tr);
  if (seenTrace !== tr) {
    setSeenTrace(tr);
    setSelId(null);
    player.restart();
  }

  const ladderRef = useRef<HTMLDivElement>(null);
  const lastAction = useRef<'play' | 'step'>('play');
  useEffect(() => {
    const wrap = ladderRef.current;
    if (!wrap || !wrap.clientWidth) return;
    // A escala é a do desenho (SVG), não a do painel: em "Ajustada" e nos zooms menores o desenho pode ser mais estreito que o painel.
    const k = (wrap.querySelector('svg') ?? wrap).getBoundingClientRect().width / layout.width;
    if (clock === 0) wrap.scrollTop = 0;
    else if (player.playing) {
      const target = layout.y(clock) * k - wrap.clientHeight * 0.6;
      if (target > wrap.scrollTop) wrap.scrollTop = target;
    } else if (lastAction.current === 'step') wrap.scrollTop = Math.max(0, layout.y(clock) * k - wrap.clientHeight * 0.5);
  }, [clock, player.playing, layout]);

  // O painel de estados do palco desce junto com a mensagem atual (na topologia fica no topo)
  const placeOverlay = () => {
    const ov = ovRef.current;
    const wrap = ladderRef.current;
    if (!ov) return;
    if (showTopo || !wrap) return setOvTop(8);
    const svg = wrap.querySelector('svg');
    const k = (svg ?? wrap).getBoundingClientRect().width / layout.width;
    const yy = layout.y(clock) * k - wrap.scrollTop;
    const max = Math.max(8, wrap.clientHeight - ov.offsetHeight - 8);
    setOvTop(Math.round(Math.min(max, Math.max(8, yy - ov.offsetHeight / 2))));
  };
  const placeRef = useRef(placeOverlay);
  placeRef.current = placeOverlay;
  useEffect(() => placeRef.current());
  useEffect(() => {
    const wrap = ladderRef.current;
    if (!wrap) return;
    const on = () => placeRef.current();
    wrap.addEventListener('scroll', on, { passive: true });
    return () => wrap.removeEventListener('scroll', on);
  }, [showTopo, statesInStage]);

  // Captura e Log acompanham a simulação: a rolagem desce com as linhas novas, a menos que o aluno suba para reler.
  const capRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const follow = useRef({ cap: true, log: true });
  const trackScroll = (key: 'cap' | 'log') => (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    follow.current[key] = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };
  const capCount = visibleMessages(tr, clock).length;
  const logCount = visibleLog(tr, clock).length;
  const atStart = clock === 0;
  useEffect(() => {
    const key = tab === 'cap' ? 'cap' : tab === 'log' ? 'log' : null;
    const el = key === 'cap' ? capRef.current : key === 'log' ? logRef.current : null;
    if (!key || !el) return;
    if (atStart) {
      follow.current[key] = true;
      el.scrollTop = 0;
    } else if (follow.current[key]) el.scrollTop = el.scrollHeight;
  }, [tab, capCount, logCount, atStart]);

  const scenarios = def.scenarios;
  const byId =(id: string | null) => scenarios.find((s) => s.id === id);
  const active = byId(activeScen);
  const base = !active && baseScen ? byId(baseScen) : undefined;
  const selected: Message | null = selId === null ? null : (tr.msgs[selId] ?? null);

  const applyScenario = (s: ScenarioDef) => {
    setSub(s.sub);
    setP(scenarioParams(def.controls, s));
    setActiveScen(s.id);
    setBaseScen(s.id);
    setAdvOpen(!!s.openAdv);
    setTab('scen');
  };

  const onChange = (id: string, value: ParamValue) => {
    const next = { ...P, [id]: value };
    setP(next);
    // se o aluno desfez a mudança, a configuração volta a coincidir com o cenário e ele é reativado
    const b = byId(baseScen);
    setActiveScen(b && !changedControls(def.controls, sub, next, b).length ? b.id : null);
  };

  const selectMsg = (m: Message) => {
    setSelId(m.id);
    setTab('msg');
  };

  const visTabs = (def.tabs || []).filter((t) => !t.subs || t.subs.indexOf(sub) >= 0);
  const tabList: { id: string; label: string }[] = [
    { id: 'scen', label: 'Cenário' },
    { id: 'cap', label: 'Captura' },
    { id: 'msg', label: 'Mensagem' },
    ...visTabs.map((t) => ({ id: t.id, label: t.label })),
    { id: 'exp', label: 'Experimento' },
    { id: 'ref', label: 'Referência' },
    { id: 'log', label: 'Log de eventos' },
  ];
  const tabId = tabList.some((t) => t.id === tab) ? tab : 'scen';

  const mi = milestoneIndex(tr, clock, endR);
  const colOf = (k: string) => tr.cols.find((c) => c.key === k)!;
  const playLabel = player.playing ? 'Pausar' : clock > 0 && clock < endR ? 'Continuar' : 'Simular';

  const scenGroups: { g: string; list: ScenarioDef[] }[] = [];
  scenarios
    .filter((s) => s.sub === sub)
    .forEach((s) => {
      let grp = scenGroups.find((x) => x.g === s.g);
      if (!grp) scenGroups.push((grp = { g: s.g, list: [] }));
      grp.list.push(s);
    });

  const changes = base ? changedControls(def.controls, sub, P, base) : [];
  const explainHtml = useMemo(() => def.explain(tr, P, active), [def, tr, P, active]);

  const statesBody = (
    <>
      <div className="state-title">{def.stateTitle || 'Estado da conexão'}</div>
      {tr.stateDefs.map((d) => {
        const s = stateAt(tr, d.key, clock);
        return (
          <div className="cfg-line" key={d.key}>
            {d.label}
            <span className={'spill ' + (s ? s.cls : 'closed')}>{s ? s.val : '-'}</span>
          </div>
        );
      })}
      <div className="cfg-line">
        Relógio<b>{def.timeLabel ? def.timeLabel(timeAt(tr, clock)) : timeAt(tr, clock).toFixed(1) + ' ms'}</b>
      </div>
    </>
  );

  return (
    <div className="simnet">
      <div className="app">
        <header className="topbar">
          <div className="topbar-row">
            <div className="proto-wrap">
              {def.subs.length > 1 && (
                <div className="mode-pick">
                  <span className="view-label" aria-hidden="true">
                    Simulação
                  </span>
                  <div className="optseg mode-seg" role="group" aria-label="Modo de simulação">
                    {def.subs.map((x) => (
                      <button key={x.key} type="button" className={x.key === sub ? 'active' : ''} aria-pressed={x.key === sub} onClick={() => x.key !== sub && applyScenario(byId(x.default)!)}>
                        {x.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <nav className="rfc-chips" aria-label="Especificações">
              {def.rfcs.map((r) => (
                <a key={r[0]} className="rfc-chip" href={`https://www.rfc-editor.org/rfc/rfc${r[0]}`} target="_blank" rel="noreferrer">
                  RFC {r[0]} ({r[1]})
                </a>
              ))}
            </nav>
          </div>
          <div className="scen-row" aria-label="Cenários prontos">
            {scenGroups.map((grp) => (
              <span key={grp.g} style={{ display: 'contents' }}>
                <span className="scen-group">{grp.g}</span>
                {grp.list.map((s) => (
                  <button key={s.id} type="button" className={'chip' + (activeScen === s.id ? ' active' : '')} aria-pressed={activeScen === s.id} onClick={() => applyScenario(s)}>
                    {s.label}
                  </button>
                ))}
              </span>
            ))}
          </div>
          <div className="metro">
            {tr.metro.map((x, i) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <div className={'seg' + (i <= mi ? ' done' : '')} />}
                <div className={'stop' + (i < mi ? ' done' : i === mi ? ' active' : '')}>
                  <div className="dot" />
                  <div className="stop-label">
                    <b>{x.label}</b>
                    {x.sub || ''}
                  </div>
                </div>
              </span>
            ))}
          </div>
        </header>

        <div className="workspace">
          {stageF.placeholder}
          <section {...stageF.rootProps} className={stageF.className('panel stage-panel')}>
            <div className="stage-header" {...stageF.barProps}>
              {topoDef && (
                <div className="view-pick">
                  <span className="view-label" id="view-label">
                    Ver como
                  </span>
                  <div className="optseg view-seg" role="group" aria-labelledby="view-label">
                    <button type="button" className={showTopo ? '' : 'active'} aria-pressed={!showTopo} title="Mensagens em ordem no tempo" onClick={() => setView('seq')}>
                      Diagrama de sequência
                    </button>
                    <button type="button" className={showTopo ? 'active' : ''} aria-pressed={showTopo} title="Os pacotes percorrendo a rede" onClick={() => setView('topo')}>
                      Topologia
                    </button>
                  </div>
                </div>
              )}
              <div className="play-bar" role="group" aria-label="Controle da simulação">
                <button
                  className="primary"
                  type="button"
                  onClick={() => {
                    lastAction.current = 'play';
                    if (player.playing) player.pause();
                    else player.play();
                  }}
                >
                  {playLabel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    lastAction.current = 'step';
                    player.stepTo(nextStep(tr, clock, endR));
                  }}
                >
                  Passo
                </button>
                <button type="button" onClick={player.restart}>
                  Voltar ao início
                </button>
                <label className="field speed">
                  Velocidade
                  <select value={String(player.speed)} onChange={(e) => player.setSpeed(parseFloat(e.target.value))}>
                    <option value="0.9">Lenta</option>
                    <option value="1.8">Normal</option>
                    <option value="5">Rápida</option>
                    <option value="14">Muito rápida</option>
                  </select>
                </label>
              </div>
              <h2>{showTopo ? def.topologyTitle || 'Topologia da rede' : def.stageTitle ? def.stageTitle(sub) : 'Diagrama de sequência'}</h2>
              <div className="legend-inline">
                {(def.legend || [
                  { color: 'var(--amber)', label: 'em claro' },
                  { color: 'var(--teal)', label: 'cifrado e autenticado' },
                  { color: 'var(--blue)', label: 'dados do canal' },
                  { color: 'var(--red)', label: 'falha, aviso ou recusa' },
                ]).map((l) => (
                  <span key={l.label} className="legend-item"><span className="legend-dot" style={{ background: l.color }} />{l.label}</span>
                ))}
              </div>
              <div className="zoom-bar" role="group" aria-label="Zoom do diagrama">
                <button type="button" className="fbtn" title="Diminuir o diagrama" disabled={zi === 0} onClick={() => setZi(zi - 1)}>
                  Zoom -
                </button>
                <button type="button" className="fbtn" title="Ajustar o diagrama ao painel" onClick={() => setZi(ZOOM_FIT)}>
                  {zi === ZOOM_FIT ? 'Ajustada' : `Ajustar (${Math.round(ZOOM_STEPS[zi] * 100)}%)`}
                </button>
                <button type="button" className="fbtn" title="Aumentar o diagrama" disabled={zi === ZOOM_STEPS.length - 1} onClick={() => setZi(zi + 1)}>
                  Zoom +
                </button>
              </div>
              {!def.stage && (
                <button type="button" className="fbtn" aria-pressed={statesInStage} title="Mostrar os estados do protocolo dentro do diagrama" onClick={() => setStatesInStage(!statesInStage)}>
                  Estados no diagrama
                </button>
              )}
              {stageF.buttons}
            </div>
            <div className={'stage-body' + (statesInStage ? ' with-states' : '')}>
              {def.stage ? (
                <div className="custom-stage" style={{ '--zoom': ZOOM_STEPS[zi] } as CSSProperties} dangerouslySetInnerHTML={{ __html: def.stage(tr, clock) }} />
              ) : showTopo ? (
                <Topology def={topoDef} tr={tr} zoom={ZOOM_STEPS[zi]} clock={clock} selectedId={selId} onSelect={selectMsg} />
              ) : (
                <Ladder ref={ladderRef} layout={layout} zoom={ZOOM_STEPS[zi]} clock={clock} selectedId={selId} onSelect={selectMsg} />
              )}
              {statesInStage && !def.stage && (
                <aside ref={ovRef} className="state-overlay panel" style={{ top: ovTop }} aria-label="Estados do protocolo">
                  <div className="state-overlay-title">Estados do protocolo</div>
                  <div className="state-panel" aria-live="off">
                    {statesBody}
                  </div>
                </aside>
              )}
            </div>
            {stageF.handles}
          </section>

          <aside className="side-col">
            {!statesInStage && (
              <>
            {stateF.placeholder}
            <div {...stateF.rootProps} className={stateF.className('fpanel')}>
              <div className="fbar" {...stateF.barProps}>
                <span className="ftitle">Estados do protocolo</span>
                {stateF.buttons}
              </div>
              <div className="panel state-panel" aria-live="off">
                {statesBody}
              </div>
              {stateF.handles}
            </div>
              </>
            )}

            {cfgF.placeholder}
            <section {...cfgF.rootProps} className={cfgF.className('panel cfg')}>
              <div className="fbar cfg-head" {...cfgF.barProps}>
                <button type="button" className="cfg-title" data-drag aria-expanded={!cfgF.collapsed} onClick={() => cfgF.setCollapsed(!cfgF.collapsed)}>
                  Configurações do simulador
                </button>
                {cfgF.buttons}
              </div>
              <div className="controls">
                <div className="panel inspector">
                  {selected ? (
                    <>
                      <div className="insp-kicker">
                        {(selected.phaseName as string) || 'Mensagem'}
                        {selected.enc ? ' (cifrada)' : ' (em claro)'}
                      </div>
                      <div className="insp-title">{selected.label}</div>
                      <div className="muted-txt" dangerouslySetInnerHTML={html(selected.about || '')} />
                    </>
                  ) : (
                    DEFAULT_INSPECTOR
                  )}
                </div>
                <Controls controls={def.controls} sub={sub} P={P} onChange={onChange} advOpen={advOpen} onAdvToggle={setAdvOpen} />
              </div>
              {cfgF.handles}
            </section>
          </aside>
        </div>

        {tabsF.placeholder}
        <section {...tabsRootProps} className={tabsF.className('panel tabs-panel')}>
          <div
            ref={gripEl}
            className="tabs-grip"
            role="separator"
            aria-orientation="horizontal"
            aria-valuenow={200}
            aria-valuemin={110}
            aria-valuemax={Math.round(typeof window !== 'undefined' ? window.innerHeight * 0.75 : 600)}
            tabIndex={0}
            aria-label="Ajustar a altura do painel de abas (setas para cima e para baixo)"
            onPointerDown={gripDown}
            onKeyDown={gripKey}
          />
          <div className="tab-bar" {...tabsF.barProps}>
            <div role="tablist" aria-label="Painéis de informação" style={{ display: 'contents' }}>
              {tabList.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={t.id === tabId}
                  aria-controls="simnet-tabpanel"
                  className={t.id === tabId ? 'tab-btn active' : 'tab-btn'}
                  onClick={() => {
                    setTab(t.id);
                    if (tabsF.collapsed) tabsF.setCollapsed(false);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tabsF.buttons}
          </div>
          <div className="tab-content active" role="tabpanel" id="simnet-tabpanel" aria-labelledby={`tab-${tabId}`}>
            {tabId === 'scen' && (
              <div className="tab-scroll">
                <article className="ref-body scen-body" aria-live="polite">
                  <div className="sc-main">
                    {base ? (
                      <>
                        <div className="sc-kicker">Baseado em</div>
                        <h3 className="sc-title">
                          {base.label} <span className="sc-badge">modificado</span>
                        </h3>
                        <p>
                          Você alterou a configuração. O texto do cenário descreve a configuração original, então o resultado desta simulação pode ser diferente: confira a aba <b>Experimento</b>.{' '}
                          <button type="button" className="sc-restore" onClick={() => applyScenario(base)}>
                            Restaurar o cenário
                          </button>
                        </p>
                        <h4>O que mudou</h4>
                        <ul className="sc-diff">
                          {changes.map((x) => (
                            <li key={x.id}>
                              <b>{x.label}:</b> {x.from} &rarr; {x.to}
                            </li>
                          ))}
                        </ul>
                        <details className="sc-orig">
                          <summary>Ver o texto do cenário original</summary>
                          <ScenarioText def={def} s={base} />
                        </details>
                      </>
                    ) : active ? (
                      <ScenarioText def={def} s={active} />
                    ) : (
                      <>
                        <h3>Nenhum cenário selecionado</h3>
                        <p>
                          A configuração foi alterada manualmente. Escolha um cenário à direita ou no topo para carregar a configuração pronta, ou continue explorando: a aba <b>Experimento</b> descreve cada execução.
                        </p>
                      </>
                    )}
                  </div>
                  <aside className="sc-side">
                    <h3>Tipos de cenário</h3>
                    {scenGroups.map((grp) => (
                      <div key={grp.g}>
                        <h4>{grp.g}</h4>
                        <p className="sc-gdoc" dangerouslySetInnerHTML={html(def.groupDoc[grp.g] || '')} />
                        <ul className="sc-list">
                          {grp.list.map((s) => (
                            <li key={s.id}>
                              <button type="button" className={'sc-link' + (active && active.id === s.id ? ' active' : '')} onClick={() => applyScenario(s)}>
                                {s.label}
                              </button>{' '}
                              <span dangerouslySetInnerHTML={html(def.scenDoc[s.id].short)} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </aside>
                </article>
              </div>
            )}

            {tabId === 'cap' && (
              <div className="tab-scroll" ref={capRef} onScroll={trackScroll('cap')}>
                <table>
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Tempo (s)</th>
                      <th>Origem</th>
                      <th>Destino</th>
                      <th>Protocolo</th>
                      <th>Tam.</th>
                      <th>Informação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMessages(tr, clock).length === 0 ? (
                      <tr className="placeholder-row">
                        <td colSpan={7}>Clique em Simular para começar.</td>
                      </tr>
                    ) : (
                      visibleMessages(tr, clock).map((m) => (
                        <tr
                          key={m.id}
                          className={'cap-row' + (m.lost ? ' lost' : '') + (m.id === selId ? ' selected' : '')}
                          tabIndex={0}
                          onClick={() => selectMsg(m)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              selectMsg(m);
                            }
                          }}
                        >
                          <td>{m.id + 1}</td>
                          <td>{(m.tSend / 1000).toFixed(6)}</td>
                          <td>{colOf(m.from).addr || colOf(m.from).label}</td>
                          <td>{colOf(m.to).addr || colOf(m.to).label}</td>
                          <td>{m.proto}</td>
                          <td>{m.len}</td>
                          <td>
                            <span className="dot-type" style={{ background: m.color }} />
                            {m.info || m.label}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tabId === 'msg' && (
              <>
                <h2 className="tab-inner-title">{selected ? `#${selected.id + 1} ${selected.proto}: ${selected.info || selected.label}` : 'Mensagem selecionada'}</h2>
                <div className="tab-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Valor</th>
                        <th>Significado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selected ? (
                        <tr className="placeholder-row">
                          <td colSpan={3}>Clique em uma seta do diagrama ou em uma linha da Captura.</td>
                        </tr>
                      ) : (
                        (selected.fields as Field[])
                          .concat(
                            [{ sec: 'Análise' }, ['Protegida?', selected.enc ? 'sim: cifrada e autenticada' : 'não: trafega em claro', selected.enc ? 'quem captura o tráfego vê só pacotes cifrados' : 'qualquer observador no caminho lê isto', 'expert']] as Field[],
                            selected.tags.map((t) => ['Marcação', t, 'equivalente ao "expert info" do Wireshark', 'expert'] as Field),
                          )
                          .map((f, i) =>
                            isSec(f) ? (
                              <tr className="sec-row" key={i}>
                                <td colSpan={3}>{f.sec}</td>
                              </tr>
                            ) : (
                              <tr key={i}>
                                <td>{f[0]}</td>
                                <td className={f[3] || undefined}>{f[1]}</td>
                                <td className="meaning">{f[2] || ''}</td>
                              </tr>
                            ),
                          )
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {visTabs.map(
              (t) =>
                tabId === t.id && (
                  <div className="tab-scroll" key={t.id}>
                    <article className="ref-body" dangerouslySetInnerHTML={html(t.render(tr, { c: clock, timeAt: (c) => timeAt(tr, c), P }))} />
                  </div>
                ),
            )}

            {tabId === 'exp' && (
              <div className="tab-scroll">
                <article className="ref-body" aria-live="polite">
                  <h3>{active ? 'Experimento: ' + active.label : 'Experimento personalizado'}</h3>
                  <div dangerouslySetInnerHTML={html(explainHtml)} />
                </article>
              </div>
            )}

            {tabId === 'ref' && (
              <div className="tab-scroll">
                <article className="ref-body" dangerouslySetInnerHTML={html(def.reference)} />
              </div>
            )}

            {tabId === 'log' && (
              <div className="tab-scroll" ref={logRef} onScroll={trackScroll('log')}>
                <div className="log-body">
                  {visibleLog(tr, clock).map((e, i) => (
                    <div key={i} dangerouslySetInnerHTML={html(`<span class="tag tag-${esc(e.tag)}">[${esc(e.tag.toUpperCase())}]</span> ${e.t.toFixed(1)} ms: ${esc(e.text)}`)} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {tabsF.handles}
        </section>

        <footer className="footer-credit">
          Simulador desenvolvido pelo <strong>Prof. Dr. Laerte Peotta de Melo</strong>, com apoio de IA generativa no processo de desenvolvimento, com sua estrita supervisão, revisão técnica e responsabilidade. Uso exclusivo para fins de ensino e pesquisa. Universidade de Brasília (UnB) - Departamento de Engenharia Elétrica.
        </footer>
      </div>
    </div>
  );
}
