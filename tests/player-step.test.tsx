// @vitest-environment jsdom
// O botão Passo: com `smooth` o relógio desliza até o destino em vez de saltar (palcos animados, como o do OSI).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlayer } from '../src/sim-core/ui';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});
afterEach(() => vi.useRealTimers());

describe('usePlayer.stepTo', () => {
  it('sem smooth, salta direto para a linha pedida', () => {
    const { result } = renderHook(() => usePlayer(20));
    act(() => result.current.stepTo(5));
    expect(result.current.clock).toBe(5);
  });
  it('com smooth, passa por posições intermediárias, sempre crescendo, e termina exatamente no destino', () => {
    const { result } = renderHook(() => usePlayer(20, 1, true));
    const seen: number[] = [];
    act(() => result.current.stepTo(4));
    expect(result.current.clock).toBeLessThan(4);
    for (let i = 0; i < 200 && result.current.clock < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      seen.push(result.current.clock);
    }
    expect(result.current.clock).toBe(4);
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.some((c) => c > 0 && c < 4)).toBe(true);
    expect(seen.every((c, i) => i === 0 || c >= seen[i - 1])).toBe(true);
  });
  it('um novo passo no meio do deslize recomeça dali, e Voltar ao início cancela o deslize', () => {
    const { result } = renderHook(() => usePlayer(20, 1, true));
    act(() => result.current.stepTo(4));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const meio = result.current.clock;
    expect(meio).toBeGreaterThan(0);
    act(() => result.current.stepTo(8));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.clock).toBeGreaterThan(meio);
    act(() => result.current.restart());
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.clock).toBe(0);
  });
});
