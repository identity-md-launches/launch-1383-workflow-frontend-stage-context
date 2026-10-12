import type { Step } from '../hooks';
import { useAppConfig } from '../hooks';

export function Steps({ steps, error }: { steps: Step[]; error: string | null }) {
  const cfg = useAppConfig();
  if (steps.length === 0 && !error) return null;
  const mark: Record<Step['state'], string> = { idle: '○', pending: '…', mining: '⏳', done: '✓', error: '✕', skipped: '–' };
  return (
    <div aria-live="polite">
      {steps.length > 0 && (
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="state" aria-hidden="true">{mark[s.state]}</span>
              <span>
                <strong>{s.label}</strong> — {s.state}{s.detail ? `, ${s.detail}` : ''}
                {s.hash && <> · <a className="mono" href={`${cfg.explorer}/tx/${s.hash}`} target="_blank" rel="noreferrer">tx {s.hash.slice(0, 10)}…</a></>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </div>
  );
}
