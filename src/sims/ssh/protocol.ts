import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildSsh, type SshParams } from './engine';

/** Simulador de SSH nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const sshProtocol: ProtocolDef = {
  id: 'ssh',
  label: 'SSH',
  stateTitle: 'Estado da sessão SSH',
  rfcs: [[4251, 'arquitetura'], [4253, 'transporte'], [4252, 'autenticação'], [4254, 'conexão'], [4256, 'keyboard-interactive'], [8332, 'rsa-sha2'], [8709, 'Ed25519']],
  subs: [
    { key: 'session', label: 'Sessão e autenticação', default: 'ok' },
    { key: 'tunnel', label: 'Túneis e encaminhamento', default: 't-local' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => (sub === 'tunnel' ? 'Diagrama de sequência: SSH com túnel (canais dentro da conexão cifrada)' : 'Diagrama de sequência: sessão SSH-2 (do TCP ao encerramento)'),
  build: (P, sub) => buildSsh(P as unknown as SshParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as SshParams),
  reference,
  fundamentacao,
  setup,
};

export default sshProtocol;
