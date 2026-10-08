import type { Provenance } from './provenance/provenance';

const labels = {
  pl: { pending: 'Odczyt informacji o pochodzeniu…', detected: 'Wykryto C2PA', none: 'Brak C2PA', remote: 'Manifest zewnętrzny — nie pobrano', unsupported: 'Nieobsługiwany wariant C2PA', error: 'Błąd odczytu C2PA' },
  en: { pending: 'Reading provenance…', detected: 'C2PA detected', none: 'No C2PA', remote: 'External manifest — not fetched', unsupported: 'Unsupported C2PA variant', error: 'C2PA read error' },
  de: { pending: 'Herkunft wird gelesen…', detected: 'C2PA erkannt', none: 'Kein C2PA', remote: 'Externes Manifest — nicht abgerufen', unsupported: 'Nicht unterstützte C2PA-Variante', error: 'C2PA-Lesefehler' },
  es: { pending: 'Leyendo procedencia…', detected: 'C2PA detectado', none: 'Sin C2PA', remote: 'Manifiesto externo — no descargado', unsupported: 'Variante C2PA no compatible', error: 'Error al leer C2PA' },
};

/** Temporary foundation consumer: display never waits for either background path. */
export function Inspection({ provenance, language }: { provenance: Provenance | null; language: keyof typeof labels }) {
  return <p role="status">{labels[language][provenance?.status ?? 'pending']}</p>;
}
