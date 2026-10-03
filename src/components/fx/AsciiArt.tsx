interface AsciiArtProps {
  art: string;
  className?: string;
  /** A faint CRT-style flicker. Off for reduced motion. */
  flicker?: boolean;
}

/** Decorative ASCII art. Hidden from screen readers. */
const AsciiArt = ({ art, className = '', flicker = false }: AsciiArtProps) => (
  <pre
    aria-hidden="true"
    className={`select-none font-mono leading-[1.1] whitespace-pre ${flicker ? 'animate-flicker motion-reduce:animate-none' : ''} ${className}`}
  >
    {art.replace(/^\n/, '')}
  </pre>
);

export default AsciiArt;
