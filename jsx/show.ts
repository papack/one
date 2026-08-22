type ShowProps = {
  when: boolean;
  children: unknown[];
};

export function Show(props: ShowProps) {
  return props.when ? props.children : null;
}
