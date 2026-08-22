export function css(styles: Record<string, string | undefined>): string {
  return Object.entries(styles)
    .filter(([, value]) => value !== undefined)
    .map(([property, value]) => `${kebabCase(property)}:${value}`)
    .join(";");
}

function kebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}
