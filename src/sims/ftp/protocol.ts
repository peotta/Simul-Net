import type { ProtocolDef } from '../../sim-core/ui';
import { controls } from './content/controls';
import { fundamentacao } from './content/fundamentacao';
import { explain, setup } from './content/explain';
import { reference } from './content/reference';
import { groupDoc, scenDoc, scenarios, stageTitles } from './content/scenarios';
import { tabs } from './content/tabs';
import { buildFtp, type FtpParams } from './engine';

/** Simulador de FTP, FTPS e SFTP nativo: motor TypeScript puro e apresentação pela bancada genérica. */
export const ftpProtocol: ProtocolDef = {
  id: 'ftp',
  label: 'FTP, FTPS e SFTP',
  stateTitle: 'Estado da transferência',
  rfcs: [[959, 'FTP'], [4217, 'FTP sobre TLS'], [2428, 'EPSV e EPRT'], [2228, 'Extensões de segurança']],
  subs: [
    { key: 'ftp', label: 'FTP', default: 'f-pasv' },
    { key: 'ftps', label: 'FTPS', default: 's-exp' },
    { key: 'sftp', label: 'SFTP', default: 'p-get' },
    { key: 'cmp', label: 'Comparação', default: 'k-get' },
  ],
  controls,
  scenarios,
  groupDoc,
  scenDoc,
  tabs,
  stageTitle: (sub) => stageTitles[sub],
  build: (P, sub) => buildFtp(P as unknown as FtpParams, sub),
  explain: (tr, P) => explain(tr, P as unknown as FtpParams),
  reference,
  fundamentacao,
  setup,
};

export default ftpProtocol;
