import type { Language, MessagesOf } from '@ai-tools/shared/i18n';

const en = {
  choose: 'Choose folder', change: 'Change folder', refresh: 'Refresh', language: 'Language', theme: 'Color theme', light: 'Light', dark: 'Dark', carousel: 'Carousel',
  intro: 'A closer look at your photos.', introDetail: 'Choose a folder to explore original images, their provenance and your notes. Everything stays on this device.',
  reopenFolder: (name: string) => name ? `Reopen “${name}”` : 'Reopen folder', resume: 'Resume', chooseOther: 'Choose another folder',
  loading: 'Reading your photos…', empty: 'This folder is empty.', noSupported: 'No supported images in this folder.', formats: 'JPEG, PNG, APNG and WebP',
  folderError: 'Cannot read the folder. Choose it again.', denied: 'Folder access was denied or lost. Choose it again.',
  snapshot: 'To load changes in the folder, choose it again.', unavailable: 'Some files are no longer available.', deniedFiles: 'Some files could not be accessed.',
  imageError: 'Cannot display this photo.', previous: 'Previous photo', next: 'Next photo', select: 'Select photo', enlarge: 'Enlarge photo', close: 'Close preview', preview: 'Enlarged preview', thumbnails: 'Photo thumbnails', scrollBack: 'Scroll thumbnails left', scrollNext: 'Scroll thumbnails right',
  information: 'Photo information', resolution: 'Resolution', format: 'Format', size: 'File size',
  missing: 'Not recorded', metadataError: 'Metadata could not be read.', metadataUnsupported: 'Metadata exceeds the supported limits or uses an unsupported variant.',
  reading: 'Reading…', notDetected: 'Not detected', unknown: 'Unknown',
  generator: 'Declared AI generator', declarations: 'Recorded AI / source declarations', history: 'Recorded editing steps',
  pending: 'Reading provenance…', detected: 'C2PA detected', none: 'No C2PA', remote: 'External manifest — not fetched', unsupported: 'Unsupported C2PA variant', error: 'C2PA read error',
  claimGenerator: 'Provenance declaration tool', ingredients: 'Referenced ingredients', provenanceNote: 'C2PA presence does not imply AI, and its absence does not prove a photograph is authentic. These are recorded declarations, not a verdict or a complete editing history.',
  notes: 'Notes', notePlaceholder: 'Add a note…', noteIdentity: 'Preparing local identity…', noteIdentityError: 'Notes are unavailable because the file identity could not be read.', noteLoading: 'Loading note…', noteDirty: 'Unsaved changes', noteSaving: 'Saving…', noteSaved: 'Saved', noteReadError: 'Could not load the note.', noteWriteError: 'Could not save. Your draft is kept in memory.', noteLocal: 'Notes stay in this browser profile. Clearing site data removes them.',
  copy: 'Copy metadata', copied: 'Copied', copyError: 'Could not copy. Select the text to copy it.',
};
export type Messages = MessagesOf<typeof en>;
const pl: Messages = {
  choose: 'Wybierz folder', change: 'Zmień folder', refresh: 'Odśwież', language: 'Język', theme: 'Motyw kolorystyczny', light: 'Jasny', dark: 'Ciemny', carousel: 'Karuzela',
  intro: 'Przyjrzyj się swoim zdjęciom.', introDetail: 'Wybierz folder, aby przeglądać oryginalne zdjęcia, ich pochodzenie i swoje notatki. Wszystko pozostaje na tym urządzeniu.',
  reopenFolder: (name: string) => name ? `Otwórz ponownie „${name}”` : 'Otwórz ponownie folder', resume: 'Wznów', chooseOther: 'Wybierz inny folder',
  loading: 'Wczytywanie zdjęć…', empty: 'Ten folder jest pusty.', noSupported: 'Brak obsługiwanych obrazów w tym folderze.', formats: 'JPEG, PNG, APNG i WebP',
  folderError: 'Nie można odczytać folderu. Wybierz go ponownie.', denied: 'Odmówiono dostępu do folderu lub go utracono. Wybierz go ponownie.',
  snapshot: 'Aby wczytać zmiany w folderze, wybierz go ponownie.', unavailable: 'Niektóre pliki nie są już dostępne.', deniedFiles: 'Nie uzyskano dostępu do niektórych plików.',
  imageError: 'Nie można wyświetlić zdjęcia.', previous: 'Poprzednie zdjęcie', next: 'Następne zdjęcie', select: 'Wybierz zdjęcie', enlarge: 'Powiększ zdjęcie', close: 'Zamknij podgląd', preview: 'Powiększony podgląd', thumbnails: 'Miniatury zdjęć', scrollBack: 'Przewiń miniatury w lewo', scrollNext: 'Przewiń miniatury w prawo',
  information: 'Informacje o zdjęciu', resolution: 'Rozdzielczość', format: 'Format', size: 'Rozmiar pliku',
  missing: 'Nie zapisano', metadataError: 'Nie można odczytać metadanych.', metadataUnsupported: 'Metadane przekraczają limity lub mają nieobsługiwany wariant.',
  reading: 'Odczyt…', notDetected: 'Nie wykryto', unknown: 'Nieznane',
  generator: 'Zadeklarowany generator AI', declarations: 'Zapisane deklaracje AI / pochodzenia', history: 'Zapisane etapy edycji',
  pending: 'Odczyt informacji o pochodzeniu…', detected: 'Wykryto C2PA', none: 'Brak C2PA', remote: 'Manifest zewnętrzny — nie pobrano', unsupported: 'Nieobsługiwany wariant C2PA', error: 'Błąd odczytu C2PA',
  claimGenerator: 'Narzędzie deklaracji pochodzenia', ingredients: 'Wskazane składniki', provenanceNote: 'Obecność C2PA nie oznacza AI, a brak C2PA nie potwierdza autentyczności fotografii. To zapisane deklaracje, nie werdykt ani pełna historia edycji.',
  notes: 'Notatki', notePlaceholder: 'Dodaj notatkę…', noteIdentity: 'Ustalanie lokalnej tożsamości…', noteIdentityError: 'Notatki są niedostępne, ponieważ nie udało się odczytać tożsamości pliku.', noteLoading: 'Wczytywanie notatki…', noteDirty: 'Niezapisane zmiany', noteSaving: 'Zapisywanie…', noteSaved: 'Zapisano', noteReadError: 'Nie udało się wczytać notatki.', noteWriteError: 'Nie udało się zapisać. Szkic pozostaje w pamięci.', noteLocal: 'Notatki pozostają w tym profilu przeglądarki. Usunięcie danych witryny je usuwa.',
  copy: 'Kopiuj metadane', copied: 'Skopiowano', copyError: 'Nie udało się skopiować. Zaznacz tekst, aby go skopiować.',
};
const de: Messages = {
  choose: 'Ordner wählen', change: 'Ordner wechseln', refresh: 'Aktualisieren', language: 'Sprache', theme: 'Farbschema', light: 'Hell', dark: 'Dunkel', carousel: 'Karussell',
  intro: 'Deine Fotos im Detail.', introDetail: 'Wähle einen Ordner für Originalbilder, Herkunftsangaben und deine Notizen. Alles bleibt auf diesem Gerät.',
  reopenFolder: (name: string) => name ? `„${name}“ erneut öffnen` : 'Ordner erneut öffnen', resume: 'Fortsetzen', chooseOther: 'Anderen Ordner wählen',
  loading: 'Fotos werden geladen…', empty: 'Dieser Ordner ist leer.', noSupported: 'Keine unterstützten Bilder in diesem Ordner.', formats: 'JPEG, PNG, APNG und WebP',
  folderError: 'Ordner kann nicht gelesen werden. Bitte erneut wählen.', denied: 'Ordnerzugriff verweigert oder verloren. Bitte erneut wählen.', snapshot: 'Wähle den Ordner erneut, um Änderungen zu laden.', unavailable: 'Einige Dateien sind nicht mehr verfügbar.', deniedFiles: 'Auf einige Dateien konnte nicht zugegriffen werden.',
  imageError: 'Foto kann nicht angezeigt werden.', previous: 'Vorheriges Foto', next: 'Nächstes Foto', select: 'Foto auswählen', enlarge: 'Foto vergrößern', close: 'Vorschau schließen', preview: 'Vergrößerte Vorschau', thumbnails: 'Foto-Miniaturen', scrollBack: 'Miniaturen nach links scrollen', scrollNext: 'Miniaturen nach rechts scrollen',
  information: 'Fotoinformationen', resolution: 'Auflösung', format: 'Format', size: 'Dateigröße', missing: 'Nicht gespeichert', metadataError: 'Metadaten konnten nicht gelesen werden.', metadataUnsupported: 'Metadaten überschreiten die Grenzen oder verwenden eine nicht unterstützte Variante.',
  reading: 'Wird gelesen…', notDetected: 'Nicht erkannt', unknown: 'Unbekannt',
  generator: 'Deklarierter KI-Generator', declarations: 'Gespeicherte KI- / Herkunftsangaben', history: 'Gespeicherte Bearbeitungsschritte',
  pending: 'Herkunft wird gelesen…', detected: 'C2PA erkannt', none: 'Kein C2PA', remote: 'Externes Manifest — nicht abgerufen', unsupported: 'Nicht unterstützte C2PA-Variante', error: 'C2PA-Lesefehler', claimGenerator: 'Werkzeug der Herkunftserklärung', ingredients: 'Referenzierte Bestandteile', provenanceNote: 'C2PA bedeutet nicht KI, und sein Fehlen beweist keine authentische Fotografie. Dies sind gespeicherte Angaben, kein Urteil und keine vollständige Bearbeitungshistorie.',
  notes: 'Notizen', notePlaceholder: 'Notiz hinzufügen…', noteIdentity: 'Lokale Identität wird ermittelt…', noteIdentityError: 'Notizen sind nicht verfügbar, da die Dateiidentität nicht gelesen werden konnte.', noteLoading: 'Notiz wird geladen…', noteDirty: 'Ungespeicherte Änderungen', noteSaving: 'Wird gespeichert…', noteSaved: 'Gespeichert', noteReadError: 'Notiz konnte nicht geladen werden.', noteWriteError: 'Speichern fehlgeschlagen. Der Entwurf bleibt im Arbeitsspeicher.', noteLocal: 'Notizen bleiben in diesem Browserprofil. Das Löschen der Websitedaten entfernt sie.', copy: 'Metadaten kopieren', copied: 'Kopiert', copyError: 'Kopieren fehlgeschlagen. Markiere den Text zum Kopieren.',
};
const es: Messages = {
  choose: 'Elegir carpeta', change: 'Cambiar carpeta', refresh: 'Actualizar', language: 'Idioma', theme: 'Tema de color', light: 'Claro', dark: 'Oscuro', carousel: 'Carrusel',
  intro: 'Tus fotos, más de cerca.', introDetail: 'Elige una carpeta para explorar imágenes originales, su procedencia y tus notas. Todo permanece en este dispositivo.',
  reopenFolder: (name: string) => name ? `Reabrir «${name}»` : 'Reabrir carpeta', resume: 'Reanudar', chooseOther: 'Elegir otra carpeta',
  loading: 'Leyendo fotos…', empty: 'Esta carpeta está vacía.', noSupported: 'No hay imágenes compatibles en esta carpeta.', formats: 'JPEG, PNG, APNG y WebP', folderError: 'No se puede leer la carpeta. Elígela de nuevo.', denied: 'Se denegó o perdió el acceso a la carpeta. Elígela de nuevo.', snapshot: 'Para cargar cambios en la carpeta, vuelve a elegirla.', unavailable: 'Algunos archivos ya no están disponibles.', deniedFiles: 'No se pudo acceder a algunos archivos.',
  imageError: 'No se puede mostrar esta foto.', previous: 'Foto anterior', next: 'Foto siguiente', select: 'Seleccionar foto', enlarge: 'Ampliar foto', close: 'Cerrar vista previa', preview: 'Vista ampliada', thumbnails: 'Miniaturas de fotos', scrollBack: 'Desplazar miniaturas a la izquierda', scrollNext: 'Desplazar miniaturas a la derecha', information: 'Información de la foto', resolution: 'Resolución', format: 'Formato', size: 'Tamaño del archivo', missing: 'No registrado', metadataError: 'No se pudieron leer los metadatos.', metadataUnsupported: 'Los metadatos superan los límites o usan una variante no compatible.', generator: 'Generador de IA declarado', declarations: 'Declaraciones registradas de IA / origen', history: 'Pasos de edición registrados',
  reading: 'Leyendo…', notDetected: 'No detectado', unknown: 'Desconocido',
  pending: 'Leyendo procedencia…', detected: 'C2PA detectado', none: 'Sin C2PA', remote: 'Manifiesto externo — no descargado', unsupported: 'Variante C2PA no compatible', error: 'Error al leer C2PA', claimGenerator: 'Herramienta de declaración de procedencia', ingredients: 'Componentes referenciados', provenanceNote: 'La presencia de C2PA no implica IA, y su ausencia no prueba que una fotografía sea auténtica. Son declaraciones registradas, no un veredicto ni un historial de edición completo.',
  notes: 'Notas', notePlaceholder: 'Añade una nota…', noteIdentity: 'Preparando identidad local…', noteIdentityError: 'Las notas no están disponibles porque no se pudo leer la identidad del archivo.', noteLoading: 'Cargando nota…', noteDirty: 'Cambios sin guardar', noteSaving: 'Guardando…', noteSaved: 'Guardado', noteReadError: 'No se pudo cargar la nota.', noteWriteError: 'No se pudo guardar. El borrador permanece en memoria.', noteLocal: 'Las notas permanecen en este perfil del navegador. Borrar los datos del sitio las elimina.', copy: 'Copiar metadatos', copied: 'Copiado', copyError: 'No se pudo copiar. Selecciona el texto para copiarlo.',
};
export const messages: Record<Language, Messages> = { pl, en, de, es };
