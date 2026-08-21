export function SubtitleStrip({
  children,
  caret = true,
}: {
  children: React.ReactNode;
  caret?: boolean;
}) {
  return (
    <span className="subtitle-strip">
      <span className="text-text">{children}</span>
      {caret && <span className="caret" aria-hidden />}
    </span>
  );
}
