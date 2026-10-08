import { expect, it } from 'vitest';
import { localReadContext, provenanceError } from '../../src/provenance/provenance';

it('serializes every privacy setting into the actual native Reader context', async () => {
  const settings = JSON.parse(await localReadContext.toJson());
  expect(settings.verify).toMatchObject({
    verify_after_reading: false, verify_trust: false, verify_timestamp_trust: false,
    remote_manifest_fetch: false, ocsp_fetch: false,
  });
  expect(JSON.stringify(settings)).not.toMatch(/https?:/);
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
