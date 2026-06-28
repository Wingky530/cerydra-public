export function getEnv(name: string): string | undefined {
  if (typeof import.meta !== 'undefined') {
    const val = (import.meta as any).env?.[name];
    if (val) return val;
  }
  if (typeof process !== 'undefined' && process.env?.[name]) return process.env[name];
  return undefined;
}
