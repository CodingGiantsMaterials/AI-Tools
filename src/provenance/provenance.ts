import { Context } from '@contentauth/c2pa-utilities';
import type { Manifest } from '@contentauth/c2pa-web';

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
}

export const emptyProvenance = (status: Provenance['status']): Provenance => ({
  status, detection: status === 'none' ? 'absent' : status === 'remote' ? 'external' : 'unknown',
  completeness: 'not-read', claimGenerator: null, actions: [],
});
const text = (value: unknown): string | null => typeof value === 'string' ? value.slice(0, 2048) : null;

export function provenanceError(error: unknown): Provenance {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (message === 'C2pa(JumbfNotFound)') return emptyProvenance('none');
  if (/RemoteManifest|RemoteManifestUrl/.test(message)) return emptyProvenance('remote');
  if (/UnsupportedType|UnsupportedAlgorithm|UnknownAlgorithm|UnsupportedVersion/.test(message)) return emptyProvenance('unsupported');
  return emptyProvenance('error');
}

export function normalizeManifest(manifest: Manifest | undefined): Provenance {
  if (!manifest) return { ...emptyProvenance('error'), detection: 'present', completeness: 'partial' };
  const actions: string[] = [];
  const assertions = manifest.assertions ?? [];
  let partial = assertions.length > 128;
  for (const assertion of assertions.slice(0, 128)) {
    if (assertion.label === 'c2pa.actions' || assertion.label.startsWith('c2pa.actions.')) {
      const data = assertion.data as { actions?: { action?: unknown }[] } | undefined;
      const recordedActions = Array.isArray(data?.actions) ? data.actions : [];
      partial ||= recordedActions.length > 64;
      for (const action of recordedActions.slice(0, 64)) {
        const label = text(action.action);
        if (label) actions.push(label);
      }
    }
  }
  return { status: 'detected', detection: 'present', completeness: partial || actions.length > 64 ? 'partial' : 'complete',
    claimGenerator: text(manifest.claim_generator), actions: actions.slice(0, 64) };
}
