"use client";

import { useMemo, useState } from "react";
import screenMap from "../../../docs/design-system/screen-component-map.json";
import "./high-fi.css";

type Screen = (typeof screenMap.screens)[number];
type Viewport = "desktop" | "mobile";

const researcherNav = ["Home", "Projects", "Results", "Participants", "Settings"];
const resultsNav = ["Overview", "Tasks", "Paths", "Heatmaps", "Sessions", "Findings"];
const builderSteps = ["Prototype", "Tasks", "Rules", "Questions", "Validate", "Preview", "Publish"];

function stateKind(state: string) {
  const value = state.toLowerCase();
  if (value.includes("loading") || value.includes("connecting") || value.includes("checking") || value.includes("processing") || value.includes("buffering") || value.includes("validating") || value.includes("accepting") || value.includes("reconnect")) return "loading";
  if (value.includes("error") || value.includes("invalid") || value.includes("conflict") || value.includes("failed")) return "error";
  if (value.includes("restricted") || value.includes("permission denied") || value.includes("redacted")) return "restricted";
  if (value.includes("unsupported") || value.includes("provider blocked")) return "unsupported";
  if (value.includes("empty") || value.includes("no data") || value.includes("no clicks") || value.includes("no path") || value.includes("no baseline") || value.includes("no eligible")) return "empty";
  if (value.includes("warning") || value.includes("low sample") || value.includes("blocked") || value.includes("timeout") || value.includes("timed out") || value.includes("give up")) return "warning";
  if (value.includes("pass") || value.includes("ready") || value.includes("complete") || value.includes("published") || value.includes("connected") || value.includes("valid") || value.includes("success")) return "success";
  return "neutral";
}

function StateNotice({ state }: { state: string }) {
  const kind = stateKind(state);
  const copy: Record<string, string> = {
    loading: "We’re updating this view. Existing context stays visible while the operation completes.",
    error: "This state needs attention. The next recovery action is kept close to the problem.",
    restricted: "Access is limited by role or privacy policy. Restricted content is not approximated.",
    unsupported: "The provider cannot safely produce this evidence. Unsupported data is not fabricated.",
    empty: "There is no eligible content for this state. Unknown values remain unavailable instead of becoming zero.",
    warning: "Review this condition before continuing. Operational warnings stay separate from usability failure.",
    success: "This state is ready. The next action can continue without bypassing required gates.",
    neutral: "This is the selected V1 state for the current screen.",
  };

  return (
    <div className={`stateNotice stateNotice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <div>
        <span className="stateDot" aria-hidden="true" />
        <strong>{state}</strong>
      </div>
      <p>{copy[kind]}</p>
    </div>
  );
}

function Button({ children, variant = "primary", disabled = false }: { children: React.ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean }) {
  return <button className={`hfButton hfButton--${variant}`} type="button" disabled={disabled}>{children}</button>;
}

function Field({ label, value, error, placeholder }: { label: string; value?: string; error?: string; placeholder?: string }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <input className={error ? "fieldControl fieldControl--error" : "fieldControl"} defaultValue={value} placeholder={placeholder} aria-invalid={Boolean(error)} />
      {error ? <span className="fieldMessage fieldMessage--error">{error}</span> : <span className="fieldMessage">Optional unless marked required.</span>}
    </label>
  );
}

function SelectField({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span className="fieldLabel">{label}</span>
      <select className="fieldControl" defaultValue={value}>
        <option>{value}</option>
        <option>Alternative</option>
      </select>
    </label>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return (
    <article className="metricCard">
      <span className="metricLabel">{label}</span>
      <strong className={tone ? `metricValue metricValue--${tone}` : "metricValue"}>{value}</strong>
      <span className="metricDetail">{detail}</span>
    </article>
  );
}

function DataTable({ rows = 4 }: { rows?: number }) {
  return (
    <div className="tableWrap" tabIndex={0} aria-label="Scrollable results table">
      <table className="dataTable">
        <thead><tr><th>Item</th><th>Status</th><th>Sessions</th><th>Last updated</th></tr></thead>
        <tbody>
          {Array.from({ length: rows }, (_, index) => (
            <tr key={index}><td>Prototype task {index + 1}</td><td><span className="tag">{index % 2 ? "Published" : "Draft"}</span></td><td>{18 + index}</td><td>Today, 10:{20 + index}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Skeleton() {
  return <div className="skeletonStack" aria-label="Loading"><span /><span /><span /><span /></div>;
}

function EmptyState({ title = "Nothing here yet", copy = "When eligible data is available, it will appear here with its context." }: { title?: string; copy?: string }) {
  return <div className="emptyState"><div className="emptyIcon" aria-hidden="true">○</div><h3>{title}</h3><p>{copy}</p><Button variant="secondary">Return to overview</Button></div>;
}

function PrototypeMock() {
  return (
    <div className="prototypeMock" aria-label="Prototype preview placeholder">
      <div className="prototypeChrome"><span /><span /><span /></div>
      <div className="prototypeBody">
        <div className="prototypeSidebar" />
        <div className="prototypeContent"><span className="prototypeLine prototypeLine--wide" /><span className="prototypeLine" /><div className="prototypeCards"><span /><span /></div></div>
      </div>
    </div>
  );
}

function HeatmapMock() {
  const dots = [[18,24,14],[42,38,22],[63,30,12],[71,62,26],[38,70,18],[82,46,10]];
  return <div className="heatmapMock" aria-label="Heatmap preview with textual legend">{dots.map(([x,y,size], i) => <span key={i} style={{ left: `${x}%`, top: `${y}%`, width: size, height: size }} />)}<div className="heatLegend"><span>Low</span><i /><i /><i /><i /><i /><span>High</span></div></div>;
}

function PathMock() {
  return <div className="pathMock" aria-label="Ordered path preview"><div className="pathNode pathNode--active">Start</div><div className="pathEdge" /><div className="pathNode">Browse</div><div className="pathEdge pathEdge--detour" /><div className="pathNode pathNode--warning">Detour</div><div className="pathEdge" /><div className="pathNode pathNode--success">Success</div></div>;
}

function FunnelMock() {
  return <div className="funnelMock" aria-label="Funnel preview"><div style={{ width: "100%" }}>24 Started <b>100%</b></div><div style={{ width: "84%" }}>22 Eligible <b>92%</b></div><div style={{ width: "66%" }}>17 Successful <b>77%</b></div></div>;
}

function TimelineMock() {
  const events = ["Task started", "Frame viewed", "Pointer interaction", "Question answered", "Task success"];
  return <ol className="timelineMock">{events.map((event, i) => <li key={event}><span className="timelineDot" /><div><strong>{event}</strong><small>00:{String(i * 12 + 2).padStart(2,"0")}</small></div></li>)}</ol>;
}

function BuilderStepNav({ active = 2 }: { active?: number }) {
  return <ol className="builderSteps" aria-label="Test builder steps">{builderSteps.map((step, i) => <li className={i === active ? "isCurrent" : i < active ? "isDone" : ""} key={step}><span>{i + 1}</span><b>{step}</b></li>)}</ol>;
}

function ResultsTabs({ active = "Overview" }: { active?: string }) {
  return <nav className="tabBar" aria-label="Results sections">{resultsNav.map((item) => <button type="button" className={item === active ? "tabItem isActive" : "tabItem"} key={item}>{item}</button>)}</nav>;
}

function ResearcherShell({ children, screen }: { children: React.ReactNode; screen: Screen }) {
  return (
    <div className="appFrame">
      <aside className="appSidebar">
        <div className="axaMark" aria-label="UT Platform">UT<span>•</span></div>
        <nav aria-label="Primary navigation">
          {researcherNav.map((item, i) => <a key={item} href="#" className={i === 1 ? "sideNavItem isActive" : "sideNavItem"}><span aria-hidden="true" className="navGlyph">{["⌂","▣","⌁","◎","⚙"][i]}</span>{item}</a>)}
        </nav>
        <div className="sidebarMeta"><span className="avatar">KR</span><div><strong>Research workspace</strong><small>UX Researcher</small></div></div>
      </aside>
      <div className="appMain">
        <header className="appTopbar"><div><span className="crumb">Projects / Checkout study</span><strong>{screen.name}</strong></div><div className="topActions"><Button variant="secondary">Preview</Button><Button>Save changes</Button></div></header>
        <main className="screenCanvas">{children}</main>
      </div>
    </div>
  );
}

function ParticipantShell({ children, task = 1 }: { children: React.ReactNode; task?: number }) {
  return (
    <div className="participantFrame">
      <header className="participantHeader"><div className="participantBrand">UT Study</div><div className="participantProgress"><span>Task {task} of 3</span><div><i style={{ width: `${task * 33}%` }} /></div></div></header>
      <main className="participantMain">{children}</main>
      <footer className="participantFooter">Your responses are used only for this usability study.</footer>
    </div>
  );
}

function FormScreen({ title, description, state }: { title: string; description: string; state: string }) {
  const error = stateKind(state) === "error" || state.toLowerCase().includes("validation");
  const loading = stateKind(state) === "loading";
  return <><PageIntro title={title} description={description} /><StateNotice state={state} />{loading ? <Skeleton /> : <section className="panel formPanel"><Field label="Name" value="Checkout prototype" error={error ? "Review this value before continuing." : undefined} /><Field label="Description" placeholder="Add context for your team" /><div className="formActions"><Button variant="secondary">Cancel</Button><Button disabled={error}>Continue</Button></div></section>}</>;
}

function PageIntro({ title, description, eyebrow }: { title: string; description: string; eyebrow?: string }) {
  return <div className="pageIntro"><div><span className="eyebrow">{eyebrow ?? "Usability test"}</span><h1>{title}</h1><p>{description}</p></div><span className="versionPill">Draft v3</span></div>;
}

function ScreenContent({ screen, state }: { screen: Screen; state: string }) {
  const id = screen.id;
  const kind = stateKind(state);
  const loading = kind === "loading";
  const empty = kind === "empty";

  if (id === "S01") return <div className="authLayout"><section className="authBrandPanel"><div className="axaMark axaMark--large">UT<span>•</span></div><h1>Evidence, not guesswork.</h1><p>Build a usability test, observe behavior, turn friction into a finding, then retest.</p></section><section className="authCard"><span className="eyebrow">Welcome back</span><h2>Sign in to your workspace</h2><StateNotice state={state} />{loading ? <Skeleton /> : <><Field label="Work email" value="researcher@company.com" error={kind === "error" ? "We couldn’t sign you in with this account." : undefined} /><Field label="Password" value="••••••••" /><Button>Sign in</Button><Button variant="ghost">Use single sign-on</Button></>}</section></div>;
  if (id === "S02" || id === "S05" || id === "S08") return <FormScreen title={screen.name} description="Keep setup concise and preserve entered values when validation or network operations fail." state={state} />;

  if (["S03","S06"].includes(id)) return <><PageIntro title={screen.name} description="Recent studies, active findings, and the fastest next research action in one place." /><StateNotice state={state} />{loading ? <Skeleton /> : empty ? <EmptyState /> : <><div className="metricsGrid"><MetricCard label="Active tests" value="6" detail="2 published · 4 draft" /><MetricCard label="Eligible sessions" value="128" detail="Last 30 days" /><MetricCard label="Open findings" value="14" detail="3 high severity" /><MetricCard label="Completion" value="77%" detail="17 successful / 22 eligible" tone="success" /></div><section className="panel"><div className="panelHeader"><div><h2>Recent studies</h2><p>Published version context stays attached to results.</p></div><Button>Create test</Button></div><DataTable /></section></>};

  if (["S04","S07","S21","S26","S31","S34"].includes(id)) return <><PageIntro title={screen.name} description="Search, filter and inspect records without losing role, version or privacy context." /><StateNotice state={state} />{loading ? <Skeleton /> : empty ? <EmptyState title="No matching records" copy="Clear filters or create the first eligible record for this workspace." /> : <section className="panel"><div className="toolbar"><Field label="Search" placeholder="Search by name" /><SelectField label="Status" value="All statuses" /><Button variant="secondary">Clear</Button></div><DataTable rows={6} /></section>};

  if (id === "S09") return <><PageIntro title="Build checkout usability test" description="Configure the prototype, tasks, success logic, feedback and publish readiness." /><StateNotice state={state} /><div className="builderLayout"><BuilderStepNav active={2} /><section className="panel builderEditor"><div className="panelHeader"><div><span className="eyebrow">Task 1</span><h2>Find a delivery option</h2></div><span className="tag">Draft</span></div><Field label="Scenario" value="You want the order delivered tomorrow. Find the option you would choose." /><SelectField label="Start frame" value="Checkout / Delivery" /><div className="formActions"><Button variant="secondary">Back</Button><Button>Save task</Button></div></section><aside className="validationPanel"><h3>Validation</h3><ul><li className="checkOk">Prototype connected</li><li className="checkOk">Start point selected</li><li className="checkWarn">Success rule needs review</li></ul></aside></div>};

  if (["S10","S11","S12","S13","S14","S15","S16","S17","S19"].includes(id)) {
    const active = Math.min(6, Math.max(0, Number(id.slice(1)) - 10));
    return <><PageIntro title={screen.name} description="Each builder stage keeps validation, provider capability and publish gates explicit." /><StateNotice state={state} /><div className="builderLayout builderLayout--wide"><BuilderStepNav active={active} /><section className="panel builderEditor">{loading ? <Skeleton /> : <BuilderSpecific id={id} state={state} />}</section></div></>;
  }

  if (id === "S18") return <><PageIntro title="Preview participant experience" description="Preview is clearly separated from production results and can simulate terminal outcomes for researcher QA." /><StateNotice state={state} /><div className="previewBanner">Preview mode · events are not included in study results <Button variant="ghost">Exit preview</Button></div><PrototypeMock /></>;

  if (id === "S20") return <><PageIntro title="Study published" description="Share one stable participant link while preserving the exact published version and configuration." /><StateNotice state={state} /><section className="panel sharePanel"><span className="statusIcon">✓</span><h2>Checkout study · v3 is live</h2><p>Participant access passed preflight. New sessions use this immutable version.</p><div className="shareUrl"><code>https://ut.example/t/ck-v3-x7p4</code><Button>Copy link</Button></div><div className="formActions"><Button variant="secondary">Close test</Button><Button>View results</Button></div></section>};

  if (["S22","S23"].includes(id)) return <><PageIntro title={screen.name} description="Metrics preserve denominator, sample size, published version and operational context." eyebrow="Results · Published v3" /><StateNotice state={state} /><ResultsTabs active={id === "S22" ? "Overview" : "Tasks"} />{loading ? <Skeleton /> : empty ? <EmptyState title="No eligible metric yet" /> : <><div className="metricsGrid"><MetricCard label="Completion" value="77%" detail="17 / 22 eligible" tone="success" /><MetricCard label="Median time" value="42s" detail="Successful tasks only" /><MetricCard label="SEQ" value="5.8" detail="n=17 · 1 difficult → 7 easy" /><MetricCard label="Technical blocked" value="2" detail="Excluded from usability denominator" /></div><div className="analyticsGrid"><section className="panel"><h2>Completion funnel</h2><FunnelMock /></section><section className="panel"><h2>Task outcomes</h2><DataTable rows={3} /></section></div></>};

  if (id === "S24") return <><PageIntro title="Path analysis" description="Compare expected and actual navigation from ordered canonical evidence." eyebrow="Results · Published v3" /><StateNotice state={state} /><ResultsTabs active="Paths" />{empty ? <EmptyState title="No path evidence" /> : <section className="panel"><div className="panelHeader"><h2>Task 1 · Delivery option</h2><span className="tag">22 eligible</span></div><PathMock /><div className="legendText"><b>Expected:</b> Checkout → Delivery → Confirm · <b>Actual:</b> 7 sessions detoured through Help.</div></section>};

  if (id === "S25") return <><PageIntro title="Heatmap" description="Clicks are normalized to the canonical frame. Unsupported transforms never render misleading clusters." eyebrow="Results · Published v3" /><StateNotice state={state} /><ResultsTabs active="Heatmaps" />{empty ? <EmptyState title="No usable click coordinates" /> : kind === "unsupported" ? <EmptyState title="Heatmap unavailable for this provider" copy="Coordinate transform evidence is unsupported, so no overlay is shown." /> : <section className="panel"><div className="toolbar"><SelectField label="Task" value="Task 1" /><SelectField label="Frame" value="Delivery" /><span className="sampleBadge">83 clicks · 22 eligible sessions</span></div><HeatmapMock /></section>};

  if (id === "S27") return <><PageIntro title="Session detail" description="Chronological evidence remains explicit about redaction, deletion and technical-blocked outcomes." eyebrow="Results · Published v3" /><StateNotice state={state} /><ResultsTabs active="Sessions" /><div className="analyticsGrid"><section className="panel"><h2>Session timeline</h2><TimelineMock /></section><aside className="panel evidencePanel"><h2>Session context</h2><dl><div><dt>Outcome</dt><dd><span className="tag">success_direct</span></dd></div><div><dt>Participant</dt><dd>anon_8F21</dd></div><div><dt>Duration</dt><dd>00:48</dd></div><div><dt>Version</dt><dd>Published v3</dd></div></dl></aside></div>};

  if (["S28","S29"].includes(id)) return <><PageIntro title={screen.name} description="Findings combine researcher interpretation with versioned evidence and an explicit severity model." eyebrow="Findings" /><StateNotice state={state} />{id === "S28" ? <div className="findingGrid">{["Checkout option is hard to scan","Participants miss delivery date","Help detour increases task time"].map((title,i)=><article className="findingCard" key={title}><div><span className={`severity severity--${["high","medium","low"][i]}`}>{["High","Medium","Low"][i]}</span><span className="tag">Open</span></div><h2>{title}</h2><p>Evidence from Task {i+1} · Published v3 · {5+i} linked sessions</p><Button variant="ghost">Open finding</Button></article>)}</div> : <section className="panel formPanel"><SelectField label="Severity" value="High" /><Field label="Finding title" value="Checkout option is hard to scan" /><label className="field"><span className="fieldLabel">Observation</span><textarea className="fieldControl fieldTextarea" defaultValue="Participants scan the delivery rows twice before choosing tomorrow delivery." /></label><div className="evidenceStrip"><strong>3 evidence links</strong><span>Session 8F21 · Heatmap Delivery · Path detour</span></div><div className="formActions"><Button variant="secondary">Cancel</Button><Button>Save finding</Button></div></section>};

  if (id === "S30") return <><PageIntro title="Retest comparison" description="Compare cohorts descriptively without inventing significance." eyebrow="Findings · Retest" /><StateNotice state={state} />{empty ? <EmptyState title="No baseline available" /> : <section className="comparisonGrid"><div className="compareColumn"><span className="eyebrow">Baseline · v3</span><MetricCard label="Completion" value="77%" detail="17 / 22 eligible" /><MetricCard label="Median time" value="42s" detail="n=17 successes" /></div><div className="deltaColumn"><strong>+11 pp</strong><span>Completion</span><strong>−9s</strong><span>Median time</span></div><div className="compareColumn"><span className="eyebrow">Retest · v4</span><MetricCard label="Completion" value="88%" detail="22 / 25 eligible" tone="success" /><MetricCard label="Median time" value="33s" detail="n=22 successes" /></div></section>};

  if (["S32","S33","S35","S36"].includes(id)) return <><PageIntro title={screen.name} description="Workspace configuration keeps authorization, retention and integration state visible." eyebrow="Settings" /><StateNotice state={state} />{loading ? <Skeleton /> : <section className="panel formPanel"><SelectField label="Workspace policy" value={id === "S36" ? "90 days" : "Default"} /><Field label="Configuration name" value={id === "S35" ? "Figma integration" : "Research workspace"} error={state.toLowerCase().includes("validation") ? "Review this setting before saving." : undefined} /><div className="formActions"><Button variant="secondary">Cancel</Button><Button variant={id === "S32" ? "danger" : "primary"}>{id === "S32" ? "Confirm deletion" : "Save changes"}</Button></div></section>};

  return <><PageIntro title={screen.name} description="High-fidelity state mapped from the V1 screen inventory." /><StateNotice state={state} /><section className="panel"><h2>Component composition</h2><p>This screen uses: {screen.componentFamilies.join(", ")}.</p></section></>;
}

function BuilderSpecific({ id, state }: { id: string; state: string }) {
  const kind = stateKind(state);
  if (id === "S10") return <><div className="panelHeader"><div><span className="eyebrow">Prototype source</span><h2>Connect a Figma prototype</h2></div><span className="tag">Required</span></div><Field label="Figma prototype URL" value="https://figma.com/proto/checkout-v3" error={kind === "error" ? "Enter a valid prototype URL or reconnect Figma." : undefined} /><div className="formActions"><Button variant="secondary">Back</Button><Button>Check access</Button></div></>;
  if (id === "S11") return <><h2>Participant access preflight</h2><div className="checklist"><div className="checkOk"><b>Anonymous access</b><span>Prototype opens without workspace login</span></div><div className={kind === "error" ? "checkError" : "checkOk"}><b>Provider availability</b><span>{kind === "error" ? "Figma could not be reached" : "Provider responded successfully"}</span></div><div className="checkOk"><b>Start frame</b><span>Ready to select</span></div></div><div className="formActions"><Button variant="secondary">Reconnect</Button><Button disabled={kind === "error"}>Select start point</Button></div></>;
  if (id === "S12") return <><div className="panelHeader"><h2>Select participant start point</h2><span className="tag">Canonical frame</span></div><PrototypeMock /><div className="selectionRow"><span><b>Checkout / Delivery</b><small>frame_0192</small></span><Button>Use this frame</Button></div></>;
  if (id === "S13") return <><h2>Task scenario</h2><Field label="Task title" value="Choose tomorrow delivery" /><label className="field"><span className="fieldLabel">Scenario shown to participant</span><textarea className="fieldControl fieldTextarea" defaultValue="You want the order delivered tomorrow. Find the option you would choose." /></label><p className="privacyHint">Expected path and success target remain researcher-only.</p><div className="formActions"><Button variant="secondary">Add task</Button><Button>Save task</Button></div></>;
  if (id === "S14") return <><h2>Success and terminal rules</h2><div className="ruleRows"><div><span className="ruleType ruleType--success">Success</span><SelectField label="Frame" value="Order confirmed" /></div><div><span className="ruleType ruleType--failure">Failure</span><SelectField label="Frame" value="Wrong delivery" /></div><div><span className="ruleType">Timeout</span><Field label="Seconds" value="120" /></div></div><div className="formActions"><Button>Save rules</Button></div></>;
  if (id === "S15") return <><h2>Post-task feedback</h2><fieldset className="seqFieldset"><legend>How easy or difficult was this task?</legend><div>{[1,2,3,4,5,6,7].map(n=><label key={n}><input type="radio" name="seq" /><span>{n}</span></label>)}</div><small>1 Difficult · 7 Easy</small></fieldset><label className="field"><span className="fieldLabel">Open feedback</span><textarea className="fieldControl fieldTextarea" placeholder="What made this task difficult?" /></label><div className="formActions"><Button>Save feedback</Button></div></>;
  if (id === "S16") return <><h2>Build validation</h2><div className="checklist"><div className="checkOk"><b>Prototype</b><span>Connected and accessible</span></div><div className="checkOk"><b>3 tasks</b><span>Each task has a start point</span></div><div className={kind === "warning" || kind === "error" ? "checkError" : "checkOk"}><b>Terminal rules</b><span>{kind === "warning" || kind === "error" ? "Task 2 requires a success frame" : "No conflicts detected"}</span></div></div><div className="formActions"><Button variant="secondary">Back to issue</Button><Button disabled={kind === "warning" || kind === "error"}>Preview draft</Button></div></>;
  if (id === "S17") return <><h2>Preview setup</h2><p>Preview uses the current draft and never writes into production Results.</p><div className="previewCard"><span className="statusIcon">▶</span><div><b>Participant preview</b><small>Desktop · anonymous access</small></div><Button disabled={kind === "error" || kind === "unsupported"}>Start preview</Button></div></>;
  if (id === "S19") return <><h2>Publish checklist</h2><div className="checklist"><div className="checkOk"><b>Participant access</b><span>Pass</span></div><div className={state.includes("Version Changed") ? "checkError" : "checkOk"}><b>Figma version</b><span>{state.includes("Version Changed") ? "Prototype changed — revalidate" : "Pinned to version key fig_v_219"}</span></div><div className="checkOk"><b>Consent</b><span>Consent v1 attached</span></div><div className="checkOk"><b>Rules</b><span>Frozen for publish</span></div></div><div className="formActions"><Button variant="secondary">Back to build</Button><Button disabled={kind === "error" || kind === "warning"}>Publish version</Button></div></>;
  return <p>Builder state for {id}</p>;
}

function ParticipantContent({ screen, state }: { screen: Screen; state: string }) {
  const id = screen.id;
  const kind = stateKind(state);
  const loading = kind === "loading";
  if (id === "P01") return <ParticipantShell>{loading ? <Skeleton /> : <section className="participantCard centerCard"><span className="statusIcon">✓</span><h1>Study is ready</h1><p>Your session will begin after you review consent.</p><Button>Continue</Button></section>}</ParticipantShell>;
  if (id === "P02") return <ParticipantShell><section className="participantCard"><span className="eyebrow">Before you begin</span><h1>Consent to participate</h1><p>We’ll record interaction events needed for this usability study. You can stop at any time.</p><div className="consentBox"><label><input type="checkbox" /> <span>I understand and agree to participate.</span></label></div><StateNotice state={state} /><div className="formActions"><Button variant="secondary">Decline</Button><Button disabled={state === "Declined"}>Agree and start</Button></div></section></ParticipantShell>;
  if (id === "P03") return <ParticipantShell task={state.includes("Multi") ? 2 : 1}><section className="participantCard"><span className="eyebrow">Task {state.includes("Multi") ? 2 : 1}</span><h1>Choose a delivery option</h1><p className="scenarioText">You want the order delivered tomorrow. Find the option you would choose.</p><p className="helperText">There are no right or wrong answers. Complete the task as you naturally would.</p><Button>Start task</Button></section></ParticipantShell>;
  if (id === "P04") return <ParticipantShell><div className="runnerTop"><div><span className="eyebrow">Current task</span><strong>Choose a delivery option</strong></div><Button variant="ghost">Give up</Button></div>{loading ? <Skeleton /> : <PrototypeMock />}</ParticipantShell>;
  if (id === "P05") return <ParticipantShell><section className="participantCard centerCard"><h1>Stop this task?</h1><p>If you stop, we’ll record that you gave up on this task. Your previous interactions stay in the study.</p><div className="formActions"><Button variant="secondary">Keep trying</Button><Button variant="danger">Stop task</Button></div></section></ParticipantShell>;
  if (id === "P06") return <ParticipantShell><section className="participantCard"><span className="eyebrow">Quick feedback</span><h1>How did that task feel?</h1><fieldset className="seqFieldset"><legend>1 = Difficult · 7 = Easy</legend><div>{[1,2,3,4,5,6,7].map(n=><label key={n}><input type="radio" name="participant-seq" /><span>{n}</span></label>)}</div></fieldset><label className="field"><span className="fieldLabel">Anything else? (optional)</span><textarea className="fieldControl fieldTextarea" placeholder="Tell us what stood out" /></label><StateNotice state={state} /><Button>Continue</Button></section></ParticipantShell>;
  if (id === "P07") return <ParticipantShell task={2}>{loading ? <Skeleton /> : <section className="participantCard centerCard"><span className="statusIcon">✓</span><h1>Task saved</h1><p>Next, you’ll see a new scenario before the timer starts.</p><Button>See next task</Button></section>}</ParticipantShell>;
  if (id === "P08") return <ParticipantShell task={3}><section className="participantCard centerCard"><span className="statusIcon">✓</span><h1>Thanks — you’re done</h1><p>Your feedback has been recorded for this study.</p><div className="referenceBox"><small>Reference</small><code>UT-8F21</code></div></section></ParticipantShell>;
  if (id === "P09") return <ParticipantShell><section className="participantCard centerCard"><span className="statusIcon statusIcon--muted">!</span><h1>This study isn’t available</h1><StateNotice state={state} /><p>Check the link or contact the researcher who invited you.</p></section></ParticipantShell>;
  if (id === "P10") return <ParticipantShell><section className="participantCard centerCard"><span className="statusIcon statusIcon--info">i</span><h1>We can’t open the prototype</h1><StateNotice state={state} /><p>This is a technical access issue, not a failed task.</p><Button variant="secondary">Try again</Button></section></ParticipantShell>;
  if (id === "P11") return <ParticipantShell><section className="participantCard centerCard"><span className="statusIcon statusIcon--warning">◷</span><h1>Time is up</h1><StateNotice state={state} /><p>Your task ended once. Continue to feedback based on this study’s configuration.</p><Button>Continue</Button></section></ParticipantShell>;
  return <ParticipantShell><section className="participantCard centerCard">{loading ? <Skeleton /> : <><span className="statusIcon statusIcon--info">↻</span><h1>Reconnect to your session</h1><StateNotice state={state} /><p>We’ll restore the same study version and active task when recovery succeeds.</p><Button>Try reconnecting</Button></>}</section></ParticipantShell>;
}

export default function HighFiReview() {
  const screens = screenMap.screens as Screen[];
  const [selectedId, setSelectedId] = useState<string>(screens[0].id);
  const [selectedState, setSelectedState] = useState<string>(screens[0].states[0]);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const screen = useMemo(() => screens.find((item) => item.id === selectedId) ?? screens[0], [screens, selectedId]);
  const state = screen.states.includes(selectedState) ? selectedState : screen.states[0];

  function onScreenChange(id: string) {
    const next = screens.find((item) => item.id === id) ?? screens[0];
    setSelectedId(next.id);
    setSelectedState(next.states[0]);
  }

  return (
    <main className="reviewPage">
      <header className="reviewHeader">
        <div><span className="eyebrow">Task 14 · High-fi review</span><h1>48 screens · 170 states</h1><p>AXA Collab-Distrib baseline · responsive desktop/mobile review · no production-data claim</p></div>
        <div className="coverageBadge"><strong>{screens.length}</strong><span>Screens</span><strong>{screens.reduce((sum, item) => sum + item.states.length, 0)}</strong><span>States</span></div>
      </header>

      <section className="reviewControls" aria-label="High fidelity review controls">
        <label><span>Screen</span><select value={selectedId} onChange={(event) => onScreenChange(event.target.value)}>{screens.map((item) => <option key={item.id} value={item.id}>{item.id} — {item.name}</option>)}</select></label>
        <label><span>State</span><select value={state} onChange={(event) => setSelectedState(event.target.value)}>{screen.states.map((item) => <option key={item}>{item}</option>)}</select></label>
        <div className="viewportToggle" aria-label="Viewport">
          <button type="button" className={viewport === "desktop" ? "isActive" : ""} onClick={() => setViewport("desktop")}>Desktop</button>
          <button type="button" className={viewport === "mobile" ? "isActive" : ""} onClick={() => setViewport("mobile")}>Mobile</button>
        </div>
        <div className="componentSummary"><span>Components</span><strong>{screen.componentFamilies.slice(0,4).join(" · ")}</strong></div>
      </section>

      <section className={`reviewStage reviewStage--${viewport}`} aria-live="polite">
        <div className="deviceFrame" key={`${screen.id}-${state}-${viewport}`}>
          {screen.id.startsWith("P") ? <ParticipantContent screen={screen} state={state} /> : <ResearcherShell screen={screen}><ScreenContent screen={screen} state={state} /></ResearcherShell>}
        </div>
      </section>
    </main>
  );
}
