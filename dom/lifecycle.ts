export type MountCallback = (element: Element) => void | Promise<void>;
export type UnmountCallback = () => void | Promise<void>;

interface Session {
  mounts: MountCallback[];
  unmounts: UnmountCallback[];
}

const sessions: Session[] = [];

export function hasActiveMountSession(): boolean {
  return sessions.length > 0;
}

export function beginMountSession(): void {
  sessions.push({ mounts: [], unmounts: [] });
}

export function endMountSession(root: Element): void {
  const session = sessions.at(-1);
  if (!session) throw new Error("DOM lifecycle: no active mount session");

  for (const callback of session.mounts) run(callback, root, "mount");

  if (session.unmounts.length > 0) {
    const element = root as Element & { __domUnmounts?: UnmountCallback[] };
    element.__domUnmounts ??= [];
    element.__domUnmounts.push(...session.unmounts);
  }

  sessions.pop();
}

export function mount(callback: MountCallback): void {
  const session = sessions.at(-1);
  if (!session)
    throw new Error("mount() must be called while rendering a component");
  session.mounts.push(callback);
}

export function unmount(callback: UnmountCallback): void {
  const session = sessions.at(-1);
  if (!session)
    throw new Error("unmount() must be called while rendering a component");
  session.unmounts.push(callback);
}

export function runUnmounts(element: Element): void {
  const node = element as Element & { __domUnmounts?: UnmountCallback[] };
  for (const callback of [...(node.__domUnmounts ?? [])].reverse()) {
    run(callback, undefined, "unmount");
  }
  node.__domUnmounts = undefined;
}

function run(
  callback: MountCallback | UnmountCallback,
  element: Element | undefined,
  phase: "mount" | "unmount",
): void {
  try {
    const result = element
      ? (callback as MountCallback)(element)
      : (callback as UnmountCallback)();
    if (result instanceof Promise) {
      result.catch((error) =>
        console.error(`DOM ${phase} callback failed`, error),
      );
    }
  } catch (error) {
    console.error(`DOM ${phase} callback failed`, error);
  }
}
