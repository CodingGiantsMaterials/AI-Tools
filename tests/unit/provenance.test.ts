import { expect, it } from 'vitest';
import { localReadContext, provenanceError, normalizeManifest } from '../../src/provenance/provenance';

it('serializes every privacy setting into the actual native Reader context', async () => {
  const settings = JSON.parse(await localReadContext.toJson());
  expect(settings.verify).toMatchObject({
    verify_after_reading: false, verify_trust: false, verify_timestamp_trust: false,
    remote_manifest_fetch: false, ocsp_fetch: false,
  });
  expect(JSON.stringify(settings)).not.toMatch(/https?:/);
});

it('separates claim tools and AI declarations, bounds histories and ignores resource references', () => {
  const source = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';
  expect(normalizeManifest({ claim_generator: 'Signing editor', assertions: [] }).generators).toEqual([]);
  expect(normalizeManifest({ assertions: [{ label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.edited', digitalSourceType: source, softwareAgent: 'Editing tool' }] } }] }).generators).toEqual([]);
  const result = normalizeManifest({ claim_generator: 'Signing editor',
    assertions: [{ label: 'c2pa.actions.v2', data: { actions: [{ action: 'c2pa.created', digitalSourceType: source, softwareAgent: { name: 'Declared generator' } }, null] } }],
    ingredients: [{ title: '<b>Original</b>', thumbnail: { url: 'https://example.invalid/remote' } }] });
  expect(result).toMatchObject({ claimGenerator: 'Signing editor', generators: ['Declared generator'], aiDeclarations: [source], ingredients: ['<b>Original</b>'], actions: ['c2pa.created'] });
  expect(JSON.stringify(result)).not.toContain('example.invalid');
  const long = normalizeManifest({ claim_generator: 'x'.repeat(4000), assertions: [{ label: 'c2pa.actions', data: { actions: Array.from({ length: 100 }, () => ({ action: 'edited' })) } }] });
  expect(long.claimGenerator).toHaveLength(2048); expect(long.actions).toHaveLength(64); expect(long.completeness).toBe('partial');
});

it('never maps an arbitrary SDK failure to absent C2PA', () => {
  expect(provenanceError(new Error('corrupt bytes')).status).toBe('error');
  expect(provenanceError(new Error('C2pa(UnsupportedType)')).status).toBe('unsupported');
  expect(provenanceError(new Error('C2pa(UnknownAlgorithm)')).status).toBe('unsupported');
  expect(provenanceError('C2pa(JumbfNotFound)')).toMatchObject({ status: 'none', detection: 'absent' });
  expect(provenanceError('C2pa(RemoteManifestUrl("https://example.invalid/manifest"))').status).toBe('remote');
  expect(provenanceError('C2pa(UnknownAlgorithm)').status).toBe('unsupported');
  expect(provenanceError('Unexpected C2pa(JumbfNotFound)').status).toBe('error');
});
