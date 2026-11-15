// R4 fault: the client loses its network for a while, the way a laptop does when Wi-Fi drops (TESTS.md §6, R4).
// `wifi` turns the client's Wi-Fi off and on with networksetup, which needs no root. It cuts every app on the client,
// so it runs only with --apply, on a client where nothing else needs the network.
export interface Cut {
  kind: "wifi";
  /** Cuts the network, waits `seconds`, restores it and resolves once the interface has an address again. */
  apply(seconds: number): Promise<void>;
}

export function wifiDevice(listing: string): string | null {
  const blocks = listing.split(/\n\s*\n/);
  for (const block of blocks) {
    if (/Hardware Port: (Wi-Fi|AirPort)/.test(block)) {
      const device = /Device: (\S+)/.exec(block)?.[1];
      if (device) return device;
    }
  }
  return null;
}

function run(argv: string[]): string {
  const result = Bun.spawnSync(argv, { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`${argv.join(" ")} failed: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

export function wifiCut(): Cut {
  const device = wifiDevice(run(["networksetup", "-listallhardwareports"]));
  if (!device) throw new Error("wifi cut: this Mac has no Wi-Fi interface");
  const route = run(["route", "-n", "get", "default"]);
  if (!route.includes(`interface: ${device}`)) {
    throw new Error(`wifi cut: the default route is not on Wi-Fi (${device}); turning Wi-Fi off would not cut the network`);
  }
  return {
    kind: "wifi",
    async apply(seconds) {
      run(["networksetup", "-setairportpower", device, "off"]);
      try {
        await sleep(seconds * 1000);
      } finally {
        run(["networksetup", "-setairportpower", device, "on"]);
      }
      // Back when the default route returns on the Wi-Fi interface; the clock of R4 starts there.
      const started = Date.now();
      while (Date.now() - started < 60_000) {
        const result = Bun.spawnSync(["route", "-n", "get", "default"], { stdout: "pipe", stderr: "pipe" });
        if (result.exitCode === 0 && result.stdout.toString().includes(`interface: ${device}`)) return;
        await sleep(100);
      }
      throw new Error("wifi cut: Wi-Fi did not come back within 60 s");
    },
  };
}
