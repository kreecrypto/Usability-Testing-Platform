import assert from "node:assert/strict";
import test from "node:test";
import { Script, runInNewContext } from "node:vm";
import { GET } from "../src/app/trial/target/route.ts";

const screens = ["dashboard", "houses", "house18", "house12", "repairs", "repairDetail"];
const request = (query = "") => GET(new Request(`https://utp.example/trial/target${query}`));
function script(html: string) {
  return html.match(/<script>([\s\S]*?)<\/script>/)![1];
}
async function harness(mode = "run") {
  const html = await (await request(`?mode=${mode}`)).text();
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const messages: Record<string, any>[] = [];
  const animation: (() => void)[] = [];
  let address = "https://utp.example/trial/target?mode=run";
  class Control {
    dataset: Record<string, string>;
    attributes: Record<string, string> = {};
    constructor(id: string, screen: string) {
      this.dataset = { elementId: id, screen };
    }
    closest() { return this; }
    setAttribute(key: string, value: string) { this.attributes[key] = value; }
  }
  const nav = ["dashboard", "houses", "repairs"].map((s) => new Control(`nav-${s}`, s));
  const heading = { textContent: "", focus() {} };
  const content = { innerHTML: "" };
  const document = {
    body: { inert: false, style: { pointerEvents: "" } },
    documentElement: { scrollWidth: 390, scrollHeight: 1100 },
    title: "",
    querySelectorAll: () => nav,
    querySelector: () => heading,
    getElementById: () => content,
    addEventListener: (key: string, cb: (e: Record<string, unknown>) => void) => listeners.set(key, cb),
  };
  const window = {
    innerWidth: 390, innerHeight: 600, scrollX: 0, scrollY: 0,
    parent: { postMessage: (message: Record<string, any>, origin: string) => messages.push({ ...message, origin }) },
    addEventListener: document.addEventListener,
    scrollTo(x: number, y: number) { window.scrollX = x; window.scrollY = y; },
  };
  runInNewContext(script(html), {
    window, document, Element: Control, URL,
    location: { get href() { return address; }, origin: "https://utp.example" },
    history: { pushState(_state: unknown, _unused: unknown, url: URL) { address = url.toString(); } },
    requestAnimationFrame: (cb: () => void) => animation.push(cb),
    setTimeout: (cb: () => void) => { animation.push(cb); return 1; },
    clearTimeout: () => {},
  });
  const flush = () => { while (animation.length) animation.shift()!(); };
  const event = (key: string, extra: Record<string, unknown> = {}) => {
    let prevented = false;
    listeners.get(key)?.({ isTrusted: true, preventDefault() { prevented = true; }, ...extra });
    return prevented;
  };
  return { messages, window, document, flush, event, Control, content, setAddress: (value: string) => { address = value; } };
}

test("target route pins layout/screen, rejects unknowns without reflecting input, and denies caching/foreign frames", async () => {
  for (const query of ["?layout=old", "?screen=missing", "?mode=write", "?screen=%3Cscript%3Ebad%3C%2Fscript%3E"]) {
    const result = await request(query);
    assert.equal(result.status, 400);
    assert.doesNotMatch(await result.text(), /<script>|bad/);
  }
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.match(result.headers.get("content-security-policy")!, /frame-ancestors 'self'/);
});

test("all synthetic screens have identical run/preview markup and width-only geometry; route has no personal input or external resources", async () => {
  for (const screen of screens) {
    const run = await (await request(`?mode=run&screen=${screen}`)).text();
    const preview = await (await request(`?mode=preview&screen=${screen}`)).text();
    assert.equal(run.replace('const mode="run"', 'const mode="preview"'), preview);
    assert.doesNotThrow(() => new Script(script(run)));
    assert.match(run, /ข้อมูลตัวอย่างสำหรับทดสอบระบบ ไม่ใช่เว็บไซต์ Banrao จริง/);
    assert.match(run, /scrollbar-gutter:stable/);
    assert.doesNotMatch(run, /\d(?:vh|svh|dvh)|<input|<textarea|<form|<iframe|fetch\(|localStorage|sessionStorage|supabase|cloudflare/i);
    assert.doesNotMatch(run, /(?:src|href)="https?:/);
  }
  const house = await (await request("?screen=house18")).text();
  assert.match(house.split("<script>")[0], /ชำระแล้ว/);
});

test("default/preview are inert, emit nothing, and cannot navigate", async () => {
  for (const mode of ["preview"]) {
    const h = await harness(mode);
    h.flush();
    assert.equal(h.document.body.inert, true);
    assert.equal(h.document.body.style.pointerEvents, "none");
    assert.equal(h.event("click"), true);
    assert.equal(h.messages.length, 0);
  }
  assert.match(await (await request()).text(), /const mode="preview"/);
});

test("bridge captures genuine pointer document coordinates before navigation, then screen/back/resize, and stops on pagehide", async () => {
  const h = await harness();
  h.flush();
  assert.deepEqual(h.messages.map((m) => m.type), ["ready", "screen_view"]);
  assert.equal(h.messages[0].data.bridgeVersion, "first-party-web-v1");
  h.window.scrollY = 250;
  const control = new h.Control("dashboard-houses", "houses");
  h.event("click", { target: control, detail: 1, clientX: 120, clientY: 75 });
  const pointer = h.messages.at(-1)!;
  assert.equal(pointer.type, "pointer");
  assert.equal(pointer.data.screenId, "dashboard");
  assert.equal(pointer.data.documentX, 120);
  assert.equal(pointer.data.documentY, 325);
  assert.equal(pointer.data.viewportHeight, 600);
  assert.equal(pointer.data.layoutVersion, "utp-housing-v1");
  assert.equal(pointer.origin, "https://utp.example");
  assert.equal(pointer.protocol, "utp:first-party-web");
  assert.equal(pointer.version, 1);
  h.flush();
  assert.equal(h.messages.at(-1)!.data.screenId, "houses");
  assert.equal(h.messages.at(-1)!.data.previousScreenId, "dashboard");
  h.setAddress("https://utp.example/trial/target?mode=run&screen=dashboard");
  h.event("popstate"); h.flush();
  assert.equal(h.messages.at(-1)!.data.transitionReason, "back");
  h.window.innerWidth = 320;
  h.event("resize"); h.flush();
  assert.equal(h.messages.at(-1)!.data.transitionReason, "resize");
  assert.equal(h.messages.at(-1)!.data.viewportWidth, 320);
  h.window.scrollY = 80;
  h.event("scroll"); h.flush();
  assert.equal(h.messages.at(-1)!.type, "scroll");
  assert.equal(h.messages.at(-1)!.data.scrollY, 80);
  h.event("pagehide");
  const count = h.messages.length;
  h.event("click", { target: control, detail: 1, clientX: 1, clientY: 1 });
  h.event("scroll"); h.event("resize"); h.flush();
  assert.equal(h.messages.length, count);
});

test("untrusted input is ignored and keyboard action never fabricates pointer coordinates or duplicate synthetic clicks", async () => {
  const h = await harness(); h.flush();
  const control = new h.Control("nav-houses", "houses");
  const count = h.messages.length;
  h.event("click", { target: control, isTrusted: false, detail: 1, clientX: 1, clientY: 1 });
  h.event("keydown", { target: control, isTrusted: false, key: "Enter" });
  assert.equal(h.messages.length, count);
  assert.equal(h.event("keydown", { target: control, key: "Enter" }), true);
  const action = h.messages.at(-1)!;
  assert.equal(action.type, "action");
  assert.equal(action.data.key, "Enter");
  assert.equal(action.data.elementId, "nav-houses");
  assert.equal(action.data.x, undefined);
  assert.equal(action.data.documentX, undefined);
  h.flush();
  h.event("click", { target: control, detail: 0, clientX: 0, clientY: 0 });
  assert.equal(h.messages.filter((m) => m.type === "action").length, 1);
  assert.equal(h.messages.filter((m) => m.type === "pointer").length, 0);
  h.event("keydown", { target: new h.Control("nav-repairs", "repairs"), key: " " });
  assert.equal(h.messages.at(-1)!.data.key, "Space");
});
