export function LoadingIndicator({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-3 label text-mist">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border border-signal/20 border-t-signal motion-reduce:animate-none"
      />
      <span>{label}</span>
    </div>
  );
}
