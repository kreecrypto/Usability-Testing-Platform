/**
 * Version-pinned, synthetic first-party target for browser-local Trial studies.
 * These screens never read a researcher account, real Banrao data or storage.
 */
const LAYOUT = "utp-housing-v1";
const SCREENS = ["dashboard", "houses", "house18", "house12", "repairs", "repairDetail"] as const;
type Screen = (typeof SCREENS)[number];

const labels: Record<Screen, string> = {
  dashboard: "ภาพรวมบ้านเช่า",
  houses: "บ้านทั้งหมด",
  house18: "บ้านเลขที่ 18/9",
  house12: "บ้านเลขที่ 12/4",
  repairs: "งานซ่อม",
  repairDetail: "ติดตามงานซ่อมปั๊มน้ำ",
};

function link(screen: Screen, id: string, label: string, primary = false) {
  return `<a class="button${primary ? " primary" : ""}" data-screen="${screen}" data-element-id="${id}" href="/trial/target?mode=run&amp;layout=${LAYOUT}&amp;screen=${screen}">${label}</a>`;
}

function card(title: string, body: string) {
  return `<section class="card"><h2>${title}</h2>${body}</section>`;
}

const content: Record<Screen, string> = {
  dashboard: `<p class="intro">ดูข้อมูลบ้าน ค่าเช่า และงานซ่อมในพื้นที่เดียว</p>
    <div class="grid">${card("บ้านในโครงการ", `<p class="metric">2 หลัง</p><p>บ้านเลขที่ 18/9 และ 12/4</p>${link("houses", "dashboard-houses", "ดูบ้านทั้งหมด", true)}`)}
    ${card("งานซ่อมที่ต้องติดตาม", `<p class="metric">1 รายการ</p><p>ปั๊มน้ำบ้านเลขที่ 12/4 • รอช่างเข้าตรวจ</p>${link("repairs", "dashboard-repairs", "ดูงานซ่อม", true)}`)}</div>
    ${card("ค่าเช่ารอบตุลาคม 2569", `<p>ตรวจสอบสถานะการชำระได้จากรายละเอียดบ้านแต่ละหลัง</p><dl><div><dt>บ้านเลขที่ 18/9</dt><dd>มีข้อมูลค่าเช่ารอบนี้</dd></div><div><dt>บ้านเลขที่ 12/4</dt><dd>มีข้อมูลค่าเช่ารอบนี้</dd></div></dl>`)}
    ${card("ประกาศของโครงการ", `<p>เมื่อต้องการติดตามงานซ่อม ให้เปิดรายละเอียดงานเพื่อดูสถานะและการนัดหมายล่าสุด</p><p>ข้อมูลทั้งหมดในโครงการนี้เป็นตัวอย่าง ไม่มีบริการชำระเงินหรือแจ้งซ่อมจริง</p>`)}`,
  houses: `<p class="intro">เลือกบ้านเพื่อดูสถานะค่าเช่าและข้อมูลพื้นฐาน</p>
    <div class="grid">${card("บ้านเลขที่ 18/9", `<p class="tag">มีผู้เช่า</p><p>ทาวน์เฮาส์ 2 ชั้น • 2 ห้องนอน</p><dl><div><dt>ค่าเช่ารายเดือน</dt><dd>6,500 บาท</dd></div><div><dt>รอบค่าเช่า</dt><dd>ตุลาคม 2569</dd></div></dl>${link("house18", "houses-house18", "ดูบ้านเลขที่ 18/9", true)}`)}
    ${card("บ้านเลขที่ 12/4", `<p class="tag">มีผู้เช่า</p><p>บ้านชั้นเดียว • 1 ห้องนอน</p><dl><div><dt>ค่าเช่ารายเดือน</dt><dd>4,800 บาท</dd></div><div><dt>งานซ่อมที่กำลังติดตาม</dt><dd>1 รายการ</dd></div></dl>${link("house12", "houses-house12", "ดูบ้านเลขที่ 12/4", true)}`)}</div>
    ${card("เกี่ยวกับรายการบ้าน", `<p>รายการนี้แสดงบ้านตัวอย่างทั้งหมด 2 หลัง เลือกบ้านแต่ละหลังเพื่อดูรายละเอียด ไม่ต้องกรอกชื่อหรือข้อมูลผู้เช่า</p>`)}`,
  house18: `<p class="intro">รายละเอียดบ้านและค่าเช่ารอบปัจจุบัน</p>${link("houses", "house18-houses", "กลับไปบ้านทั้งหมด")}
    <div class="grid">${card("ค่าเช่ารอบตุลาคม 2569", `<p class="tag success">ชำระแล้ว</p><dl><div><dt>ค่าเช่า</dt><dd>6,500 บาท</dd></div><div><dt>วันที่ชำระ</dt><dd>1 ตุลาคม 2569</dd></div><div><dt>ยอดค้างชำระ</dt><dd>ไม่มี</dd></div></dl><p>สถานะนี้เป็นข้อมูลตัวอย่าง ไม่ใช่หลักฐานการชำระเงินจริง</p>`)}
    ${card("ข้อมูลบ้าน", `<dl><div><dt>ประเภท</dt><dd>ทาวน์เฮาส์ 2 ชั้น</dd></div><div><dt>ห้องนอน</dt><dd>2 ห้อง</dd></div><div><dt>ห้องน้ำ</dt><dd>2 ห้อง</dd></div><div><dt>สถานะ</dt><dd>มีผู้เช่า</dd></div></dl>`)}</div>
    ${card("ประวัติค่าเช่า", `<dl><div><dt>กันยายน 2569</dt><dd>ชำระแล้ว</dd></div><div><dt>สิงหาคม 2569</dt><dd>ชำระแล้ว</dd></div></dl>`)}`,
  house12: `<p class="intro">รายละเอียดบ้านและงานที่กำลังติดตาม</p>${link("houses", "house12-houses", "กลับไปบ้านทั้งหมด")}
    <div class="grid">${card("ข้อมูลบ้าน", `<p class="tag">มีผู้เช่า</p><dl><div><dt>ประเภท</dt><dd>บ้านชั้นเดียว</dd></div><div><dt>ห้องนอน</dt><dd>1 ห้อง</dd></div><div><dt>ห้องน้ำ</dt><dd>1 ห้อง</dd></div><div><dt>ค่าเช่ารายเดือน</dt><dd>4,800 บาท</dd></div></dl>`)}
    ${card("ค่าเช่ารอบตุลาคม 2569", `<p class="tag">รอชำระ</p><dl><div><dt>กำหนดชำระ</dt><dd>5 ตุลาคม 2569</dd></div><div><dt>จำนวนเงิน</dt><dd>4,800 บาท</dd></div></dl><p>สถานะนี้ใช้ทดสอบการค้นหาข้อมูลเท่านั้น</p>`)}</div>
    ${card("งานซ่อมของบ้านหลังนี้", `<h3>ปั๊มน้ำไม่ทำงาน</h3><p>รอช่างเข้าตรวจ • นัดหมาย 6 ตุลาคม 2569</p>${link("repairs", "house12-repairs", "ไปที่งานซ่อม", true)}`)}`,
  repairs: `<p class="intro">ติดตามงานที่ยังดำเนินการไม่เสร็จ</p>
    ${card("ปั๊มน้ำไม่ทำงาน", `<p class="tag">รอช่างเข้าตรวจ</p><dl><div><dt>บ้าน</dt><dd>12/4</dd></div><div><dt>วันที่แจ้ง</dt><dd>2 ตุลาคม 2569</dd></div><div><dt>นัดหมายล่าสุด</dt><dd>6 ตุลาคม 2569 เวลา 10:00–12:00</dd></div></dl>${link("repairDetail", "repairs-repairDetail", "ดูรายละเอียดงานซ่อม", true)}`)}
    ${card("วิธีอ่านสถานะงาน", `<dl><div><dt>รอช่างเข้าตรวจ</dt><dd>รับเรื่องแล้ว กำลังรอเข้าตรวจที่บ้าน</dd></div><div><dt>กำลังซ่อม</dt><dd>เริ่มแก้ไขตามที่ตรวจพบ</dd></div><div><dt>ซ่อมเสร็จ</dt><dd>งานเสร็จและตรวจสอบแล้ว</dd></div></dl>`)}`,
  repairDetail: `<p class="intro">บ้านเลขที่ 12/4 • รายการซ่อม R-001</p>${link("repairs", "repairDetail-repairs", "กลับไปงานซ่อม")}
    ${card("ปั๊มน้ำไม่ทำงาน", `<p class="tag">รอช่างเข้าตรวจ</p><p>ปั๊มน้ำหยุดทำงานและไม่มีน้ำเข้าถังพัก</p><dl><div><dt>วันที่แจ้ง</dt><dd>2 ตุลาคม 2569</dd></div><div><dt>นัดหมาย</dt><dd>6 ตุลาคม 2569 เวลา 10:00–12:00</dd></div><div><dt>ขั้นตอนถัดไป</dt><dd>ช่างเข้าตรวจและแจ้งแนวทางซ่อม</dd></div></dl>`)}
    ${card("ความคืบหน้า", `<ol class="timeline"><li><strong>2 ตุลาคม 2569</strong><p>รับแจ้งปั๊มน้ำไม่ทำงาน</p></li><li><strong>3 ตุลาคม 2569</strong><p>ยืนยันวันเข้าตรวจ 6 ตุลาคม</p></li><li><strong>รอดำเนินการ</strong><p>ช่างเข้าตรวจที่บ้าน</p></li></ol>`)}`,
};

function page(screen: Screen, mode: "run" | "preview") {
  const navigation = (Object.keys(labels) as Screen[])
    .filter((s) => ["dashboard", "houses", "repairs"].includes(s))
    .map((s) => `<a data-screen="${s}" data-element-id="nav-${s}" href="/trial/target?mode=run&amp;layout=${LAYOUT}&amp;screen=${s}">${labels[s]}</a>`).join("");
  // Only allowlisted server-authored strings enter these templates.
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${labels[screen]} — เว็บจำลอง UTP</title>
    <style>
    :root{--ah-primary:#00008f;--ah-primary-dark:#000056;--ah-primary-soft:#e2efff;--ah-canvas:#ffffff;--ah-app-bg:#f0f6ff;--ah-ink-deep:#1a1d21;--ah-ink:#434956;--ah-slate:#606776;--ah-hairline:#e5e5e5;--ah-success:#17663a;--ah-badge-success-bg:#dff8ea;--ah-radius-sm:8px;--ah-radius-lg:16px;--ah-space-8:8px;--ah-space-12:12px;--ah-space-16:16px;--ah-space-24:24px;--ah-space-32:32px;--ah-font-primary:"DB Helvethaica X","DB Helvethaica","DB Heavent","Noto Sans Thai","Leelawadee UI",Tahoma,Arial,sans-serif}
    *{box-sizing:border-box}html{background:var(--ah-app-bg);overflow-y:scroll;scrollbar-gutter:stable}body{margin:0;min-height:960px;color:var(--ah-ink-deep);font:16px/24px var(--ah-font-primary);background:var(--ah-app-bg)}
    header{padding:var(--ah-space-16);border-bottom:1px solid var(--ah-hairline);background:var(--ah-canvas)}.brand{font-size:20px;line-height:28px;color:var(--ah-primary);font-weight:700}.notice{margin:var(--ah-space-8) 0 0;color:var(--ah-slate);font-size:14px;line-height:20px}
    nav{display:flex;flex-wrap:wrap;gap:var(--ah-space-8);margin-top:var(--ah-space-12)}nav a,.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:var(--ah-space-8) var(--ah-space-12);border:1px solid var(--ah-primary);border-radius:var(--ah-radius-sm);background:var(--ah-canvas);color:var(--ah-primary);font:inherit;text-decoration:none;overflow-wrap:anywhere}nav a[aria-current=page]{background:var(--ah-primary-soft)}a:hover{background:var(--ah-primary-soft)}a:focus-visible{outline:2px solid var(--ah-primary);outline-offset:2px}.primary{background:var(--ah-primary);color:var(--ah-canvas)}.primary:hover{background:var(--ah-primary-dark)}
    main{max-width:960px;margin:0 auto;padding:var(--ah-space-24) var(--ah-space-16) var(--ah-space-32)}h1{margin:0;font-size:24px;line-height:30px}h2{margin:0 0 var(--ah-space-12);font-size:20px;line-height:28px}h3{margin:0;font-size:18px;line-height:24px}p{margin:var(--ah-space-12) 0;color:var(--ah-ink)}.intro{margin:var(--ah-space-12) 0 var(--ah-space-24);color:var(--ah-slate)}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ah-space-16)}.card{min-width:0;padding:var(--ah-space-24);border:1px solid var(--ah-hairline);border-radius:var(--ah-radius-lg);background:var(--ah-canvas);margin-top:var(--ah-space-16)}.grid .card{margin-top:var(--ah-space-16)}.metric{font-size:32px;line-height:42px;font-weight:700;color:var(--ah-primary)}.tag{display:inline-block;padding:4px var(--ah-space-8);background:var(--ah-primary-soft);border-radius:var(--ah-radius-sm);color:var(--ah-primary);font-size:14px;line-height:20px}.success{background:var(--ah-badge-success-bg);color:var(--ah-success)}dl{margin:var(--ah-space-16) 0}dl div{padding:var(--ah-space-12) 0;border-bottom:1px solid var(--ah-hairline)}dt{color:var(--ah-slate);font-size:14px;line-height:20px}dd{margin:4px 0 0;overflow-wrap:anywhere}.timeline{padding-left:var(--ah-space-24)}.timeline li{padding:var(--ah-space-8) 0}.timeline p{margin:4px 0}footer{max-width:960px;margin:0 auto;padding:var(--ah-space-32) var(--ah-space-16);border-top:1px solid var(--ah-hairline);color:var(--ah-slate);font-size:14px;line-height:20px}
    @media(max-width:600px){.grid{grid-template-columns:1fr}.card{padding:var(--ah-space-16)}main{padding-top:var(--ah-space-24)}nav a{flex:1 1 auto}}
    </style></head><body data-layout-version="${LAYOUT}"><header><div class="brand">บ้านเช่า — เว็บจำลอง UTP</div><p class="notice">ข้อมูลตัวอย่างสำหรับทดสอบระบบ ไม่ใช่เว็บไซต์ Banrao จริง</p><nav aria-label="เมนูเว็บจำลอง">${navigation}</nav></header>
    <main><h1 tabindex="-1">${labels[screen]}</h1><div id="screen-content">${content[screen]}</div></main><footer>ข้อมูลบ้าน ค่าเช่า และงานซ่อมทั้งหมดเป็นข้อมูลสังเคราะห์ ไม่มีการชำระเงินหรือจัดการบ้านจริง</footer>
    <script>
    (() => {
      const mode=${JSON.stringify(mode)},layout=${JSON.stringify(LAYOUT)},labels=${JSON.stringify(labels)},screens=${JSON.stringify(content)};
      let current=${JSON.stringify(screen)},closed=false,resizeTimer,scrollTimer,pendingScroll;
      const geometry=()=>({screenId:current,layoutVersion:layout,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight,documentWidth:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight});
      const emit=(type,data={})=>{if(mode==='run'&&!closed&&window.parent!==window)window.parent.postMessage({protocol:'utp:first-party-web',version:1,type,data:{...geometry(),...data}},location.origin)};
      const emitScroll=()=>{clearTimeout(scrollTimer);scrollTimer=undefined;if(pendingScroll){emit('scroll',pendingScroll);pendingScroll=undefined}};
      const selected=()=>document.querySelectorAll('nav a').forEach(a=>a.setAttribute('aria-current',a.dataset.screen===current?'page':'false'));
      const render=(next,reason,previous)=>{
        if(!Object.hasOwn(screens,next))return;
        emitScroll();current=next;document.querySelector('h1').textContent=labels[next];document.getElementById('screen-content').innerHTML=screens[next];document.title=labels[next]+' — เว็บจำลอง UTP';selected();window.scrollTo(0,0);
        requestAnimationFrame(()=>{emit('screen_view',{previousScreenId:previous,transitionReason:reason});document.querySelector('h1').focus({preventScroll:true})});
      };
      const navigate=next=>{if(next===current)return;const previous=current;const url=new URL(location.href);url.searchParams.set('screen',next);history.pushState(null,'',url);render(next,'navigation',previous)};
      const element=e=>e.target instanceof Element?e.target.closest('[data-element-id]'):null;
      const elementIds=new Set(['nav-dashboard','nav-houses','nav-repairs','dashboard-houses','dashboard-repairs','houses-house18','houses-house12','house18-houses','house12-houses','house12-repairs','repairs-repairDetail','repairDetail-repairs']);
      const elementId=node=>node&&elementIds.has(node.dataset.elementId)?node.dataset.elementId:'background';
      if(mode!=='run'){
        document.body.inert=true;
        document.body.style.pointerEvents='none';
        document.addEventListener('click',e=>e.preventDefault(),true);
        selected();return;
      }
      document.addEventListener('keydown',e=>{
        if(!e.isTrusted||closed||e.repeat||!['Enter',' '].includes(e.key))return;
        const control=element(e);if(!control)return;
        e.preventDefault();emit('action',{elementId:elementId(control),key:e.key===' '?'Space':'Enter'});navigate(control.dataset.screen);
      });
      document.addEventListener('click',e=>{
        if(!e.isTrusted||closed)return;
        emitScroll();const control=element(e);if(control)e.preventDefault();
        if(e.detail>0)emit('pointer',{x:e.clientX,y:e.clientY,documentX:e.clientX+window.scrollX,documentY:e.clientY+window.scrollY,scrollX:window.scrollX,scrollY:window.scrollY,elementId:elementId(control)});
        if(control)navigate(control.dataset.screen);
      });
      window.addEventListener('scroll',e=>{if(!e.isTrusted||closed)return;pendingScroll={scrollX:window.scrollX,scrollY:window.scrollY};if(!scrollTimer)scrollTimer=setTimeout(emitScroll,150)},{passive:true});
      window.addEventListener('popstate',e=>{if(!e.isTrusted||closed)return;const next=new URL(location.href).searchParams.get('screen')||'dashboard';const previous=current;render(next,'back',previous)});
      window.addEventListener('resize',e=>{if(!e.isTrusted||closed)return;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>emit('screen_view',{previousScreenId:current,transitionReason:'resize'}),150)});
      window.addEventListener('pagehide',()=>{closed=true;clearTimeout(resizeTimer);clearTimeout(scrollTimer);pendingScroll=undefined});
      selected();requestAnimationFrame(()=>{emit('ready',{bridgeVersion:'first-party-web-v1'});emit('screen_view',{transitionReason:'reload'})});
    })();
    </script></body></html>`;
}

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const screen = query.get("screen") ?? "dashboard";
  const layout = query.get("layout") ?? LAYOUT;
  const mode = query.get("mode") ?? "preview";
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  };
  if (layout !== LAYOUT || !SCREENS.includes(screen as Screen) || !["run", "preview"].includes(mode)) {
    return new Response("<!doctype html><html lang=\"th\"><meta charset=\"utf-8\"><title>ไม่รองรับเว็บจำลองรุ่นนี้</title><p>เปิดเว็บจำลองไม่ได้: หน้าหรือเวอร์ชันที่ระบุไม่รองรับ กรุณากลับไปที่แบบทดสอบ</p></html>", { status: 400, headers });
  }
  return new Response(page(screen as Screen, mode as "run" | "preview"), { headers });
}
