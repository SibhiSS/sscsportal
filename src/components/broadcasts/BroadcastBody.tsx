/** Plain text with line breaks kept and web links made clickable. Nothing else is interpreted. */
export default function BroadcastBody({ text, className = '' }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  const parts = text.split(/(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'])/g);
  return (
    <div className={`bc-body ${className}`}>
      {parts.map((p, i) => (i % 2 === 1
        ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p.replace(/^https?:\/\//, '')}</a>
        : p))}
    </div>
  );
}
