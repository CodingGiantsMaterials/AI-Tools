import { useEffect, useRef, useState } from 'react';
import { pickDirectory, snapshotSource, supportsDirectoryPicker, type FolderSource } from './files/folder-source';
import { imageFormat, OriginalUrls } from './images/original';
import styles from './App.module.css';
import { Inspection } from './Inspection';
import { IdentityService } from './identity/identity-service';

const messages = {
  pl: { choose: 'Wybierz folder', refresh: 'Odśwież', intro: 'Otwórz zdjęcia ze swojego urządzenia.', loading: 'Wczytywanie…', empty: 'Brak obsługiwanych zdjęć.', error: 'Nie można odczytać folderu. Wybierz go ponownie.', imageError: 'Nie można wyświetlić zdjęcia.', snapshot: 'Aby wczytać zmiany w folderze, wybierz go ponownie.', language: 'Język' },
  en: { choose: 'Choose folder', refresh: 'Refresh', intro: 'Open photos from your device.', loading: 'Loading…', empty: 'No supported photos.', error: 'Cannot read the folder. Choose it again.', imageError: 'Cannot display this photo.', snapshot: 'To load changes in the folder, choose it again.', language: 'Language' },
  de: { choose: 'Ordner wählen', refresh: 'Aktualisieren', intro: 'Fotos von deinem Gerät öffnen.', loading: 'Wird geladen…', empty: 'Keine unterstützten Fotos.', error: 'Ordner kann nicht gelesen werden. Bitte erneut wählen.', imageError: 'Foto kann nicht angezeigt werden.', snapshot: 'Wähle den Ordner erneut, um Änderungen zu laden.', language: 'Sprache' },
  es: { choose: 'Elegir carpeta', refresh: 'Actualizar', intro: 'Abre fotos de tu dispositivo.', loading: 'Cargando…', empty: 'No hay fotos compatibles.', error: 'No se puede leer la carpeta. Elígela de nuevo.', imageError: 'No se puede mostrar esta foto.', snapshot: 'Para cargar cambios en la carpeta, vuelve a elegirla.', language: 'Idioma' },
};
type Language = keyof typeof messages;
type Status = 'intro' | 'loading' | 'empty' | 'error' | 'imageError' | null;
interface Preview {
  url: string;
  name: string;
  file: File;
  source: FolderSource;
  entryId: string;
  contentId: Promise<string | null>;
  release(): void;
}

export function App() {
  const [language, setLanguage] = useState<Language>('pl');
  const [status, setStatus] = useState<Status>('intro');
  const [source, setSource] = useState<FolderSource>();
  const [preview, setPreview] = useState<Preview>();
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const folderGeneration = useRef(0);
  const revision = useRef(0);
  const current = useRef<Preview | undefined>(undefined);
  const currentSource = useRef<FolderSource | undefined>(undefined);
  const identity = useRef(new IdentityService());
  const urls = useRef(new OriginalUrls());
  const m = messages[language];

  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => () => preview?.release(), [preview]);
  useEffect(() => () => { generation.current++; identity.current.dispose(); urls.current.dispose(); }, []);

  function show(next: Preview | undefined) {
    current.current = next;
    setPreview(next);
  }

  async function load(next: FolderSource) {
    const request = ++generation.current;
    if (currentSource.current !== next) {
      folderGeneration.current++;
      currentSource.current = next;
      show(undefined);
    }
    setSource(next); setStatus('loading');
    try {
      for (const entry of await next.list()) {
        if (request !== generation.current) return;
        try {
          const file = await entry.getFile();
          const format = await imageFormat(file);
          if (request !== generation.current) return;
          if (!format) continue;
          const controller = new AbortController();
          const contentId = identity.current.hash(file, {
            folderGeneration: folderGeneration.current, entryId: entry.entryId,
            revision: revision.current + 1, requestId: request,
          }, 1, controller.signal).then(({ value }) => value, () => null);
          const previous = current.current;
          if (previous?.source === next && previous.entryId === entry.entryId) {
            const [before, after] = await Promise.all([previous.contentId, contentId]);
            if (request !== generation.current) { controller.abort(); return; }
            if (before !== null && before === after) { setStatus(null); return; }
          }
          const lease = urls.current.acquire(`${folderGeneration.current}:${entry.entryId}:${++revision.current}`, file);
          show({ url: lease.url, name: file.name, file, source: next, entryId: entry.entryId, contentId,
            release: () => { controller.abort(); lease.release(); } });
          setStatus(null);
          return;
        } catch { /* A disappearing file does not stop the folder scan. */ }
      }
      if (request === generation.current) { show(undefined); setStatus('empty'); }
    } catch {
      if (request === generation.current) setStatus('error');
    }
  }

  async function choose() {
    if (!supportsDirectoryPicker()) { input.current?.click(); return; }
    try { await load(await pickDirectory()); }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('error');
    }
  }

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
      {source?.canRefresh && <button disabled={status === 'loading'} onClick={() => void load(source)}>{m.refresh}</button>}
      <input ref={input} type="file" multiple {...{ webkitdirectory: '' }} hidden aria-label={m.choose}
        onChange={(event) => { if (event.target.files) void load(snapshotSource(Array.from(event.target.files))); event.target.value = ''; }} />
    </div>
    {source?.kind === 'snapshot' && <p>{m.snapshot}</p>}
    <p role="status">{status ? m[status] : ''}</p>
    {preview && <img className={styles.preview} src={preview.url} alt={preview.name} onError={() => setStatus('imageError')} />}
    {preview && <Inspection key={preview.url} file={preview.file} language={language} />}
  </main>;
}
