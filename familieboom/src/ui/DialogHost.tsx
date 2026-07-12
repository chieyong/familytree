import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { useT } from './useT';

/**
 * In-app dialoog (bevestigen / tekstinvoer). Vervangt window.confirm/prompt —
 * die werken niet in de Tauri-webview (WKWebView geeft prompt null terug). Wordt
 * aangestuurd via askConfirm/askPrompt (store).
 */
export function DialogHost() {
  const dialog = useAppStore((s) => s.dialog);
  const setDialog = useAppStore((s) => s.setDialog);
  const t = useT();
  const [value, setValue] = useState('');

  useEffect(() => { setValue(dialog?.defaultValue ?? ''); }, [dialog]);

  if (!dialog) return null;

  const close = (result: string | null) => {
    dialog.resolve(result);
    setDialog(null);
  };

  return (
    <div className="dialog-overlay" onClick={() => close(null)}>
      <div className="dialog-box" onClick={(e) => e.stopPropagation()}>
        <p className="dialog-msg">{dialog.message}</p>
        {dialog.kind === 'prompt' && (
          <input
            className="dialog-input"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') close(value);
              if (e.key === 'Escape') close(null);
            }}
          />
        )}
        <div className="dialog-actions">
          <button className="dialog-cancel" onClick={() => close(null)}>{t.dialog.cancel}</button>
          <button className="dialog-ok" onClick={() => close(dialog.kind === 'prompt' ? value : '')}>
            {t.dialog.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
