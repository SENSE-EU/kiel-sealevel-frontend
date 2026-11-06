export function LoadingIndicator({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 text-mist">
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-kelp border-t-signal motion-reduce:animate-none"
      />
      {label}
    </div>
  );
}
