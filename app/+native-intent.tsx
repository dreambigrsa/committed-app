export function redirectSystemPath({
  path,
  initial: _initial,
}: { path: string; initial: boolean }) {
  return path || '/';
}