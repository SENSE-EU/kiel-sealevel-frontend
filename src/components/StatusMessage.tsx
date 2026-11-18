import type { ReactNode } from 'react';

export function StatusMessage({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="display text-3xl font-light">{title}</h1>
      {body && (
        <p className="max-w-md text-sm leading-relaxed text-mist">{body}</p>
      )}
      {action}
    </div>
  );
}

export const actionClass =
  'mt-2 inline-flex h-11 items-center rounded-full bg-signal px-5 text-sm font-medium text-abyss transition-colors hover:bg-foam';
