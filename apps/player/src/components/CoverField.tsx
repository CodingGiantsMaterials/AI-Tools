import { useEffect, useRef, useState } from 'react';
import { Icon } from '@ai-tools/shared/icon';
import { ObjectUrls } from '@ai-tools/shared/object-urls';
import type { Cover } from '../library/library-repository';
import type { Messages } from '../i18n';
import styles from './CoverField.module.css';

interface CoverFieldProps {
  cover: Cover | null;
  disabled: boolean;
  m: Messages;
  onChoose: (file: File) => void;
  onDisplayError: () => void;
}

/** A large plus until a cover exists; clicking the cover replaces it. Cancelling the picker changes nothing. */
export function CoverField({ cover, disabled, m, onChoose, onDisplayError }: CoverFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [urls] = useState(() => new ObjectUrls());
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!cover) return;
    const lease = urls.acquire(cover.imageId, cover.blob);
    setUrl(lease.url);
    return lease.release;
  }, [cover, urls]);
  return <div className={styles.field}>
    <button className={styles.cover} aria-label={cover ? m.changeCover : m.addCover} title={cover ? m.changeCover : m.addCover}
      disabled={disabled} onClick={() => input.current?.click()}>
      {cover && url ? <img src={url} alt="" draggable={false} onError={onDisplayError} /> : <Icon name="plus" />}
    </button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label={cover ? m.changeCover : m.addCover}
      onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) onChoose(file); }} />
  </div>;
}
