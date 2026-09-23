import {
  FIRST_PARTY_BRIDGE_VERSION,
  INTERNAL_VALIDATION_TARGET_PATH,
} from "../../lib/builder/test-target-import.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function html(origin: string): string {
  const safeOrigin = JSON.stringify(origin);
  const bridgeVersion = JSON.stringify(FIRST_PARTY_BRIDGE_VERSION);
  return `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>UTP Internal Validation Target</title>
  <style>
    body{font-family:Arial,sans-serif;margin:0;background:#f6f8fb;color:#151b26}
    main{max-width:720px;margin:48px auto;padding:24px}
    .card{background:white;border:1px solid #dfe3ea;border-radius:16px;padding:28px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
    .eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#667085}
    h1{font-size:30px;margin:8px 0 10px}
    p{line-height:1.55;color:#475467}
    .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
    button{min-height:44px;border-radius:9px;padding:0 16px;border:1px solid #cfd5df;background:white;font-weight:700;cursor:pointer}
    button.primary{background:#155eef;color:white;border-color:#155eef}
    button.danger{color:#b42318}
    #state{margin-top:22px;padding:14px;background:#f8fafc;border-radius:10px}
  </style>
</head>
<body>
<main>
  <section class="card">
    <div class="eyebrow">Production First-party Target</div>
    <h1>Internal Validation Flow</h1>
    <p>หน้านี้เป็น owned production target สำหรับพิสูจน์ Flow Proven โดยส่งเฉพาะ approved bridge signals กลับไปยัง UTP Participant Runner</p>
    <div class="actions">
      <button id="review" class="primary">ไปหน้า Review</button>
      <button id="complete" class="primary">ยืนยันเสร็จสิ้น</button>
      <button id="cancel" class="danger">ยกเลิก Flow</button>
    </div>
    <div id="state" role="status">สถานะ: Start</div>
  </section>
</main>
<script>
(() => {
  const parentOrigin = ${safeOrigin};
  const bridgeVersion = ${bridgeVersion};
  let screenId = "internal-validation:start";

  function send(type, data) {
    if (!window.opener || window.opener.closed) return;
    window.opener.postMessage({
      protocol: "utp:first-party-web",
      version: 1,
      type,
      data
    }, parentOrigin);
  }

  function view(nextScreen, route) {
    const previous = screenId;
    screenId = nextScreen;
    document.getElementById("state").textContent = "สถานะ: " + nextScreen;
    send("screen_view", {
      screenId: nextScreen,
      previousScreenId: previous,
      url: location.origin + route,
      route
    });
  }

  function pointer(event, elementId) {
    send("pointer", {
      screenId,
      x: event.clientX,
      y: event.clientY,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      elementId
    });
  }

  send("ready", { bridgeVersion });
  send("screen_view", {
    screenId,
    url: location.href,
    route: "/internal-validation-target/start"
  });

  document.getElementById("review").addEventListener("click", (event) => {
    pointer(event, "review");
    view("internal-validation:review", "/internal-validation-target/review");
  });

  document.getElementById("complete").addEventListener("click", (event) => {
    pointer(event, "complete");
    view("internal-validation:complete", "/internal-validation-target/complete");
    send("completion_signal", { signalId: "internal-validation-complete", screenId });
  });

  document.getElementById("cancel").addEventListener("click", (event) => {
    pointer(event, "cancel");
    send("completion_signal", { signalId: "internal-validation-cancel", screenId });
  });

  let scrolling = false;
  window.addEventListener("scroll", () => {
    if (scrolling) return;
    scrolling = true;
    window.setTimeout(() => {
      send("scroll", {
        screenId,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight
      });
      scrolling = false;
    }, 150);
  }, { passive: true });
})();
</script>
</body>
</html>`;
}

export async function GET(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  return new Response(html(origin), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-utp-first-party-bridge": FIRST_PARTY_BRIDGE_VERSION,
      "x-utp-target-path": INTERNAL_VALIDATION_TARGET_PATH,
    },
  });
}
