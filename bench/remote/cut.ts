// R4 fault: a process-level drop (TESTS.md §6, R4). The client side of every path stops for a while, as if its
// network went away: the ADE's client-side helpers get SIGSTOP, and the harness neither reads nor writes the
// connection it holds open. Then SIGCONT. It touches no network interface, so other apps on the client keep working.
export interface Freeze {
  kind: "process";
  /** Stops `pids`, waits `seconds`, resumes them. A pid that is gone is skipped. */
  apply(pids: readonly number[], seconds: number): Promise<void>;
}

function signal(pid: number, sig: "SIGSTOP" | "SIGCONT"): boolean {
  try {
    process.kill(pid, sig);
    return true;
  } catch {
    return false;
  }
}

export const processFreeze: Freeze = {
  kind: "process",
  async apply(pids, seconds) {
    const stopped = pids.filter((pid) => signal(pid, "SIGSTOP"));
    try {
      await new Promise((done) => setTimeout(done, seconds * 1000));
    } finally {
      for (const pid of stopped) signal(pid, "SIGCONT");
    }
  },
};
