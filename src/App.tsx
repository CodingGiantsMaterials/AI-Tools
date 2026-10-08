import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pickDirectory, snapshotSource, supportsDirectoryPicker } from './files/folder-source';
import { OriginalUrls } from './images/original';
import { CollectionController, type CollectionEntry } from './collection/collection-controller';
import styles from './App.module.css';
import { Inspection } from './Inspection';

const messages = {
  pl: { choose: 'Wybierz folder', refresh: 'Odśwież', intro: 'Otwórz zdjęcia ze swojego urządzenia.', loading: 'Wczytywanie…', empty: 'Brak obsługiwanych zdjęć.', error: 'Nie można odczytać folderu. Wybierz go ponownie.', imageError: 'Nie można wyświetlić zdjęcia.', snapshot: 'Aby wczytać zmiany w folderze, wybierz go ponownie.', language: 'Język' },
  en: { choose: 'Choose folder', refresh: 'Refresh', intro: 'Open photos from your device.', loading: 'Loading…', empty: 'No supported photos.', error: 'Cannot read the folder. Choose it again.', imageError: 'Cannot display this photo.', snapshot: 'To load changes in the folder, choose it again.', language: 'Language' },
  de: { choose: 'Ordner wählen', refresh: 'Aktualisieren', intro: 'Fotos von deinem Gerät öffnen.', loading: 'Wird geladen…', empty: 'Keine unterstützten Fotos.', error: 'Ordner kann nicht gelesen werden. Bitte erneut wählen.', imageError: 'Foto kann nicht angezeigt werden.', snapshot: 'Wähle den Ordner erneut, um Änderungen zu laden.', language: 'Sprache' },
  es: { choose: 'Elegir carpeta', refresh: 'Actualizar', intro: 'Abre fotos de tu dispositivo.', loading: 'Cargando…', empty: 'No hay fotos compatibles.', error: 'No se puede leer la carpeta. Elígela de nuevo.', imageError: 'No se puede mostrar esta foto.', snapshot: 'Para cargar cambios en la carpeta, vuelve a elegirla.', language: 'Idioma' },
};
type Language = keyof typeof messages;

/** Minimal consumer; the collection contract also supports the full gallery UI. */
export function App() {
  const [controller] = useState(() => new CollectionController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [language, setLanguage] = useState<Language>('pl');
  const [pickerError, setPickerError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const m = messages[language];
  const active = state.entries.find((entry) => entry.entryId === state.activeId);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => () => { void controller.dispose(); }, [controller]);

  async function choose() {
    if (!supportsDirectoryPicker()) { input.current?.click(); return; }
    try { const source = await pickDirectory(); setPickerError(false); await controller.setSource(source); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setPickerError(true);
    }
  }
  const status = pickerError || state.status === 'error' || state.status === 'access-denied' ? m.error
    : state.status === 'no-folder' ? m.intro : state.status === 'loading' ? m.loading
    : state.status === 'empty' || state.status === 'no-supported' ? m.empty : '';
  return <main className={styles.app}>
    <header className={styles.header}>
      <h1>Web Album</h1>
      <select aria-label={m.language} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        <option value="pl">Polski</option><option value="en">English</option>
        <option value="de">Deutsch</option><option value="es">Español</option>
      </select>
    </header>
    <div className={styles.controls}>
      <button onClick={() => void choose()}>{m.choose}</button>
      {state.canRefresh && <button disabled={state.scanning} onClick={() => void controller.refresh()}>{m.refresh}</button>}
      <input ref={input} type="file" multiple {...{ webkitdirectory: '' }} hidden aria-label={m.choose}
        onChange={(event) => { if (event.target.files) { setPickerError(false); void controller.setSource(snapshotSource(Array.from(event.target.files))); } event.target.value = ''; }} />
    </div>
    {state.notice === 'reselect' && <p>{m.snapshot}</p>}
    <p role="status">{status}</p>
    {active && <Preview key={active.resourceKey} entry={active} error={m.imageError} />}
    {active && <Inspection provenance={active.provenance} language={language} />}
  </main>;
}

function Preview({ entry, error }: { entry: CollectionEntry; error: string }) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  const original = useRef(entry);
  useEffect(() => {
    const urls = new OriginalUrls();
    const lease = urls.acquire(original.current.resourceKey, original.current.file);
    setUrl(lease.url);
    return () => { lease.release(); urls.dispose(); };
  }, []);
  return <>
    {failed && <p role="status">{error}</p>}
    {url && <img className={styles.preview} src={url} alt={entry.name} onError={() => setFailed(true)} />}
  </>;
}
