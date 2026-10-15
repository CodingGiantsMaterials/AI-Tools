import { useEffect, type ReactNode } from 'react';
import { isLanguage, languages, type Language } from './i18n';
import { Icon } from './Icon';
import logo from './assets/coding-giants-small-logo.png';
import styles from './Header.module.css';

export type Theme = 'light' | 'dark';

const languageNames: Record<Language, string> = { pl: 'Polski', en: 'English', de: 'Deutsch', es: 'Español' };

export interface HeaderProps {
  /** Visually hidden page heading, normally the application name. */
  title: string;
  language: Language;
  theme: Theme;
  /** Accessible names from the application's dictionary. */
  labels: { language: string; theme: string; light: string; dark: string };
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: Theme) => void;
  /** Layout class of the `<header>` element, which the application styles. */
  className?: string | undefined;
  /** Application controls placed between the logo and the preferences. */
  children?: ReactNode;
}

/** Logo on the left, language and theme selection on the right; the application owns both values. */
export function Header({ title, language, theme, labels, onLanguageChange, onThemeChange, className, children }: HeaderProps) {
  return <header className={className}>
    <div className={styles.brand}><img src={logo} alt="Coding Giants" width="76" height="76" /><h1 className={styles.srOnly}>{title}</h1></div>
    {children}
    {/* Keyboard shortcut handlers ignore events inside data-shortcuts="off". */}
    <div className={styles.preferences} data-shortcuts="off">
      <select aria-label={labels.language} value={language} onChange={(event) => { if (isLanguage(event.target.value)) onLanguageChange(event.target.value); }}>
        {languages.map((code) => <option key={code} value={code} lang={code} label={code.toUpperCase()}>{languageNames[code]}</option>)}
      </select>
      <div className={styles.theme} role="group" aria-label={labels.theme}>
        <button aria-label={labels.light} title={labels.light} aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}><Icon name="sun" /></button>
        <button aria-label={labels.dark} title={labels.dark} aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}><Icon name="moon" /></button>
      </div>
    </div>
  </header>;
}

/** Applies the language and theme to `<html lang>` and `<html data-theme>`, which `theme.css` reads. */
export function useDocumentPreferences(language: Language, theme: Theme): void {
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
}
