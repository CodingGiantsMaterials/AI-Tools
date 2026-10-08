import { Context } from '@contentauth/c2pa-utilities';

/** Passed to every native reader. No URL trust inputs. */
export const localReadContext = new Context({
  verify: {
    verifyAfterReading: false, verifyTrust: false, verifyTimestampTrust: false,
    remoteManifestFetch: false, ocspFetch: false,
  },
  trust: { verifyTrustList: false, trustAnchors: [], userAnchors: [], allowedList: [] },
  cawgTrust: { verifyTrustList: false, trustAnchors: [], userAnchors: [], allowedList: [] },
});

export interface Provenance {
  status: 'detected' | 'none' | 'remote' | 'unsupported' | 'error';
  detection: 'present' | 'absent' | 'external' | 'unknown';
  completeness: 'complete' | 'partial' | 'not-read';
  claimGenerator: string | null;
  actions: string[];
  aiDeclarations: string[];
  generators: string[];
  ingredients: string[];
}

export const emptyProvenance = (status: Provenance['status']): Provenance => ({
  status, detection: status === 'none' ? 'absent' : status === 'remote' ? 'external' : 'unknown',
  completeness: 'not-read', claimGenerator: null, actions: [], aiDeclarations: [], generators: [], ingredients: [],
});
const text = (value: unknown): string | null => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 2048) : null;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

export function provenanceError(error: unknown): Provenance {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (message === 'C2pa(JumbfNotFound)') return emptyProvenance('none');
  if (/RemoteManifest|RemoteManifestUrl/.test(message)) return emptyProvenance('remote');
  if (/UnsupportedType|UnsupportedAlgorithm|UnknownAlgorithm|UnsupportedVersion/.test(message)) return emptyProvenance('unsupported');
  return emptyProvenance('error');
}

export function normalizeManifest(manifest: unknown): Provenance {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return { ...emptyProvenance('error'), detection: 'present', completeness: 'partial' };
  const data = record(manifest);
  const actions: string[] = [];
  const aiDeclarations: string[] = [];
  const generators: string[] = [];
  const assertions = array(data.assertions);
  let partial = assertions.length > 128;
  for (const item of assertions.slice(0, 128)) {
    const assertion = record(item);
    const label = text(assertion.label);
    if (label === 'c2pa.actions' || label?.startsWith('c2pa.actions.')) {
      const recordedActions = array(record(assertion.data).actions);
      partial ||= recordedActions.length > 64;
      for (const item of recordedActions.slice(0, 64)) {
        const action = record(item);
        const label = text(action.action);
        if (label) actions.push(label);
        const source = text(action.digitalSourceType);
        if (source) aiDeclarations.push(source);
        // An editor/claim tool alone is not an AI generator. Keep only explicit declarations.
        if (label === 'c2pa.created' && source?.endsWith('/trainedAlgorithmicMedia')) {
          const agent = text(action.softwareAgent) ?? text(record(action.softwareAgent).name);
          if (agent) generators.push(agent);
        }
      }
    }
  }
  const rawIngredients = array(data.ingredients);
  const ingredients = rawIngredients.slice(0, 32).flatMap((item) => {
    const ingredient = record(item);
    const title = text(ingredient.title);
    return title ? [title] : [];
  });
  const generatorInfo = array(data.claim_generator_info).slice(0, 8).map((item) => text(record(item).name)).filter(Boolean).join(', ');
  return { status: 'detected', detection: 'present', completeness: partial || actions.length > 64 || rawIngredients.length > 32 ? 'partial' : 'complete',
    claimGenerator: text(data.claim_generator) ?? text(generatorInfo || null), actions: actions.slice(0, 64),
    aiDeclarations: [...new Set(aiDeclarations)].slice(0, 32), generators: [...new Set(generators)].slice(0, 32), ingredients };
}
