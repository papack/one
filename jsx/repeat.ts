type RepeatProps = {
  n: number;
  children: unknown[];
};

export function Repeat(props: RepeatProps) {
  if (props.n <= 0) {
    return null;
  }

  return Array.from({ length: props.n }, () => props.children);
}
