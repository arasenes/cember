// Test düzeneği: gerçek Supabase yerine sekmeler arası BroadcastChannel kullanan sahte Realtime.
export const SUPABASE_URL = "http://127.0.0.1:1";
export const SUPABASE_KEY = "x";
type Meta = Record<string, unknown>;

class FakeChannel {
  bc: BroadcastChannel;
  handlers: { tur: string; olay?: string; cb: (p: unknown) => void }[] = [];
  durumlar = new Map<string, Meta>();
  benKey: string;
  meta: Meta | null = null;
  constructor(public ad: string, cfg: { config?: { presence?: { key?: string } } }) {
    this.benKey = cfg.config?.presence?.key ?? Math.random().toString(36).slice(2);
    this.bc = new BroadcastChannel("fake:" + ad);
    this.bc.onmessage = (e) => this.gelen(e.data);
  }
  on(tur: string, filtre: { event?: string }, cb: (p: unknown) => void) { this.handlers.push({ tur, olay: filtre.event, cb }); return this; }
  subscribe(cb: (d: string) => void) { setTimeout(() => { cb("SUBSCRIBED"); this.bc.postMessage({ k: "hello" }); }, 5); return this; }
  async track(meta: Meta) { this.meta = meta; this.durumlar.set(this.benKey, meta); this.bc.postMessage({ k: "presence", key: this.benKey, meta }); this.sync(); }
  async untrack() { this.bc.postMessage({ k: "leave", key: this.benKey }); this.durumlar.delete(this.benKey); this.sync(); }
  presenceState() { const o: Record<string, Meta[]> = {}; for (const [k, m] of this.durumlar) o[k] = [m]; return o; }
  async send(m: { event: string; payload: unknown }) { this.bc.postMessage({ k: "bc", event: m.event, payload: m.payload }); return "ok"; }
  sync() { this.handlers.filter((h) => h.tur === "presence" && h.olay === "sync").forEach((h) => h.cb({})); }
  gelen(d: { k: string; key?: string; meta?: Meta; event?: string; payload?: unknown }) {
    if (d.k === "hello" && this.meta) this.bc.postMessage({ k: "presence", key: this.benKey, meta: this.meta });
    else if (d.k === "presence") { this.durumlar.set(d.key!, d.meta!); this.sync(); }
    else if (d.k === "leave") { this.durumlar.delete(d.key!); this.sync(); }
    else if (d.k === "bc") this.handlers.filter((h) => h.tur === "broadcast" && h.olay === d.event).forEach((h) => h.cb({ payload: d.payload }));
  }
  close() { this.bc.close(); }
}

export const supabase = {
  auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
  channel: (ad: string, cfg: never) => new FakeChannel(ad, cfg),
  removeChannel: async (ch: FakeChannel) => { ch.bc.postMessage({ k: "leave", key: ch.benKey }); ch.close(); },
  rpc: async () => ({ data: null }),
};
