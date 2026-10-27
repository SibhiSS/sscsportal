interface ScrambleTextProps {
  text: string;
  className?: string;
  duration?: number;
  delay?: number;
}

/** Plain heading text. The old hex-scramble effect was dropped with the redesign; the props are kept so callers don't change. */
const ScrambleText = ({ text, className = '' }: ScrambleTextProps) => <span className={className}>{text}</span>;

export default ScrambleText;
