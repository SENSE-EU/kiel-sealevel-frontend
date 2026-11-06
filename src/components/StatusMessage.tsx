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
      <h1 className="text-xl font-semibold">{title}</h1>
      {body && <p className="max-w-md text-mist">{body}</p>}
      {action}
    </div>
  );
}

export const actionClass =
  'inline-block rounded-full bg-signal px-5 py-2 font-medium text-abyss hover:bg-foam';
