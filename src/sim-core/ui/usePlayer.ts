import { useCallback, useEffect, useRef, useState } from 'react';

/** Preferência do sistema por movimento reduzido (falso onde matchMedia não existe, como em testes). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Fator de velocidade da topologia, em relação ao diagrama de sequência. */
export const TOPO_SLOW = 0.4;

export interface Player {
  clock: number;
  playing: boolean;
  speed: number;
  setSpeed: (s: number) => void;
  /** Inicia, ou recomeça se já terminou. Com movimento reduzido, salta para o fim. */
  play: () => void;
  pause: () => void;
  restart: () => void;
  /** Avança até a posição indicada e pausa. */
  stepTo: (row: number) => void;
}

/**
 * Relógio da simulação, em linhas do trace. `endR` é a linha final; a troca de trace deve usar `key` no chamador.
 * Com `smooth`, o Passo desliza o relógio até o destino (em vez de saltar), para que um palco animado flua entre as etapas.
 */
export function usePlayer(endR: number, factor = 1, smooth = false): Player {
  const [clock, setClock] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.8);
  const clockRef = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed * factor;
  const tweenRef = useRef(0);
  const cancelTween = useCallback(() => {
    if (tweenRef.current) cancelAnimationFrame(tweenRef.current);
    tweenRef.current = 0;
  }, []);
  useEffect(() => cancelTween, [cancelTween]);

  const set = useCallback((c: number) => {
    clockRef.current = c;
    setClock(c);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let id = 0;
    let last = performance.now();
    const frame = (ts: number) => {
      const dt = Math.min(100, ts - last);
      last = ts;
      const next = Math.min(endR, clockRef.current + (dt / 1000) * speedRef.current);
      set(next);
      if (next >= endR) setPlaying(false);
      else id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, [playing, endR, set]);

  const restart = useCallback(() => {
    cancelTween();
    setPlaying(false);
    set(0);
  }, [set, cancelTween]);

  const play = useCallback(() => {
    cancelTween();
    if (clockRef.current >= endR) set(0);
    if (prefersReducedMotion()) {
      set(endR);
      setPlaying(false);
    } else setPlaying(true);
  }, [endR, set, cancelTween]);

  const pause = useCallback(() => {
    cancelTween();
    setPlaying(false);
  }, [cancelTween]);
  const stepTo = useCallback(
    (row: number) => {
      cancelTween();
      setPlaying(false);
      const from = clockRef.current;
      const dist = Math.abs(row - from);
      if (!smooth || prefersReducedMotion() || dist < 1e-6) {
        set(row);
        return;
      }
      // duração proporcional ao trecho e à velocidade escolhida; curva linear, porque o palco já suaviza cada trecho
      const ms = Math.min(1600, (380 + 260 * Math.sqrt(dist)) * (1.8 / Math.max(0.3, speedRef.current / factor)));
      const t0 = performance.now();
      const frame = (ts: number) => {
        const f = Math.min(1, (ts - t0) / ms);
        set(f >= 1 ? row : from + (row - from) * f);
        tweenRef.current = f >= 1 ? 0 : requestAnimationFrame(frame);
      };
      tweenRef.current = requestAnimationFrame(frame);
    },
    [set, smooth, cancelTween, factor],
  );

  return { clock, playing, speed, setSpeed, play, pause, restart, stepTo };
}
