// A stand-in for Reaper's web interface, for tests: an ExtState store behind a fetch function. Its responses are
// escaped the way Reaper escapes them. `onRequest` runs after each request, like the bridge script's next tick.

export class FakeWebInterface {
  readonly ext = new Map<string, string>();
  readonly requests: string[] = [];
  status = 200;
  onRequest: (fake: FakeWebInterface) => void = () => {};

  get(section: string, key: string): string | undefined {
    return this.ext.get(`${section}/${key}`);
  }

  set(section: string, key: string, value: string): void {
    this.ext.set(`${section}/${key}`, value);
  }

  readonly fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    this.requests.push(url);
    if (this.status !== 200) return new Response("", { status: this.status });
    const commands = url.slice(url.indexOf("/_/") + 3).split(";");
    const lines = commands.map((command) => this.run(command)).filter((line) => line !== undefined);
    this.onRequest(this);
    return new Response(lines.map((line) => `${line}\n`).join(""));
  };

  private run(command: string): string | undefined {
    const [verb, kind, section = "", key = "", ...rest] = command.split("/");
    if (kind !== "EXTSTATE") return undefined;
    if (verb === "SET") {
      this.set(section, key, decodeURIComponent(rest.join("/")));
      return undefined;
    }
    const value = (this.get(section, key) ?? "").replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\n/g, "\\n");
    return `EXTSTATE\t${section}\t${key}\t${value}`;
  }
}
