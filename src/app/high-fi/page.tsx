"use client";

import { useMemo, useState, type ReactNode } from "react";
import screenMap from "../../../docs/design-system/screen-component-map.json";
import "./high-fi.css";
import "./predeploy-fixes.css";

type Screen = (typeof screenMap.screens)[number];
type Viewport = "desktop" | "mobile";
type Tone = "neutral" | "loading" | "error" | "restricted" | "unsupported" | "empty" | "warning" | "success";
type NavKey = "Projects" | "Tests" | "Results" | "Participants" | "Settings" | null;

const screens = screenMap.screens as Screen[];
const totalStates = screens.reduce((sum, screen) => sum + screen.states.length, 0);
const researcherNav = ["Projects", "Tests", "Results", "Participants", "Settings"] as const;
const groups = [
  { label: "Workspace & projects", ids: ["S01", "S02", "S03", "S04", "S05", "S06"] },
  { label: "Test build & publish", ids: Array.from({ length: 14 }, (_, i) => `S${String(i + 7).padStart(2, "0")}`) },
  { label: "Results & evidence", ids: Array.from({ length: 10 }, (_, i) => `S${String(i + 21).padStart(2, "0")}`) },
  { label: "Participants & settings", ids: Array.from({ length: 6 }, (_, i) => `S${String(i + 31).padStart(2, "0")}`) },
  { label: "Participant journey", ids: Array.from({ length: 12 }, (_, i) => `P${String(i + 1).padStart(2, "0")}`) },
];

const toneOverrides: Record<string, Tone> = {
  "Private/Login Required": "restricted", "Login Required": "restricted", Password: "restricted", Permission: "restricted",
  "Permission Restricted": "restricted", Restricted: "restricted", "Permission Denied": "restricted", "Redacted Fields": "restricted", "Evidence Deleted": "restricted",
  "Provider Blocked": "unsupported", Unsupported: "unsupported", "Unsupported Evidence": "unsupported", "Unsupported Provider/Transform": "unsupported",
  Incomplete: "warning", "Missing Start": "warning", "Missing Rule": "warning", "Publish Blocked": "warning", Blocked: "warning",
  "Technical-blocked Warning": "warning", "Technical Blocked": "warning", "Technical-blocked Context": "warning", Declined: "warning", Expired: "warning", Closed: "warning", "Version Changed": "warning", "Continue per config": "warning",
};

function stateKind(state: string): Tone {
  if (toneOverrides[state]) return toneOverrides[state];
  const value = state.toLowerCase();
  if (["loading", "connecting", "checking", "processing", "buffering", "validating", "accepting", "reconnect"].some((t) => value.includes(t))) return "loading";
  if (["error", "invalid", "conflict", "failed"].some((t) => value.includes(t))) return "error";
  if (["restricted", "permission denied", "redacted"].some((t) => value.includes(t))) return "restricted";
  if (["unsupported", "provider blocked"].some((t) => value.includes(t))) return "unsupported";
  if (["empty", "no data", "no clicks", "no path", "no baseline", "no eligible"].some((t) => value.includes(t))) return "empty";
  if (["warning", "low sample", "blocked", "timeout", "timed out", "give up", "missing", "incomplete", "declined", "expired", "closed"].some((t) => value.includes(t))) return "warning";
  if (["pass", "ready", "complete", "published", "connected", "valid", "success", "frame selected"].some((t) => value.includes(t))) return "success";
  return "neutral";
}

function navKeyForScreen(id: string): NavKey {
  if (!id.startsWith("S")) return null;
  const n = Number(id.slice(1));
  if (n >= 3 && n <= 6) return "Projects";
  if (n >= 7 && n <= 20) return "Tests";
  if (n >= 21 && n <= 30) return "Results";
  if (n === 31) return "Participants";
  if (n >= 32 && n <= 36) return "Settings";
  return null;
}

function Button({ children, variant = "primary", disabled = false }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  return <button type="button" className={`hfButton hfButton--${variant}`} disabled={disabled}>{children}</button>;
}

function StateNotice({ state }: { state: string }) {
  const kind = stateKind(state);
  const copy: Record<Tone, string> = {
    neutral: "Current task context and the next action remain explicit.",
    loading: "Context stays visible while duplicate actions are prevented.",
    error: "The problem stays adjacent to recovery and entered context is preserved.",
    restricted: "Access is restricted; unavailable evidence is never approximated.",
    unsupported: "This capability is unsupported for the current provider or evidence source.",
    empty: "No eligible evidence is available. No Data is not presented as zero.",
    warning: "Review is required before continuing; this is separate from a usability failure.",
    success: "Required checks for this review state are satisfied.",
  };
  return <div className={`stateNotice stateNotice--${kind}`} role={kind === "error" ? "alert" : "status"}><div><span className="stateDot" aria-hidden="true" /><strong>{state}</strong></div><p>{copy[kind]}</p></div>;
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return <div className="skeletonStack" aria-label="Loading content">{Array.from({ length: rows }, (_, i) => <span key={i} />)}</div>;
}

function ErrorCard() {
  return <div className="inlineError" role="alert"><strong>Action required</strong><span>Resolve the highlighted issue and retry without losing context.</span></div>;
}

function Empty({ title = "No eligible data" }: { title?: string }) {
  return <section className="emptyState"><div className="emptyIcon" aria-hidden="true">○</div><h3>{title}</h3><p>This state intentionally shows no fabricated data.</p><Button variant="secondary">Return</Button></section>;
}

function Header({ title, state, detail }: { title: string; state?: string; detail?: string }) {
  return <div className="panelHeader"><div><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>{state ? <span className="tag">{state}</span> : null}</div>;
}

function Chips({ screen }: { screen: Screen }) {
  return <div className="componentChips" aria-label="Component families">{screen.componentFamilies.map((f) => <span key={f}>{f}</span>)}</div>;
}

function TableSkeleton({ label }: { label: string }) {
  return <div className="tableWrap" tabIndex={0} aria-label={label}><table className="specimenTable skeletonTable"><thead><tr>{[1,2,3,4].map((n) => <th scope="col" key={n}><span className="skeletonCell skeletonCell--header" aria-hidden="true" /></th>)}</tr></thead><tbody>{[1,2,3,4].map((r) => <tr key={r}>{[1,2,3,4].map((c) => <td key={c}><span className="skeletonCell" aria-hidden="true" /></td>)}</tr>)}</tbody></table></div>;
}

function MetricSkeletons({ count = 3 }: { count?: number }) {
  return <div className="metricsGrid" aria-label="Metric card layout">{Array.from({ length: count }, (_, i) => <article className="metricCard metricCard--skeleton" key={i}><span /><strong /><span /></article>)}</div>;
}

function Shell({ screen, children }: { screen: Screen; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const active = navKeyForScreen(screen.id);
  return <div className="appFrame">
    <button type="button" className={open ? "navBackdrop isOpen" : "navBackdrop"} aria-label="Close navigation" onClick={() => setOpen(false)} />
    <aside className={open ? "appSidebar appSidebar--open" : "appSidebar"} aria-label="Application navigation">
      <div className="sidebarBrandRow"><div className="axaMark" aria-label="UT Platform">UT<span>•</span></div><button type="button" className="mobileNavClose" aria-label="Close menu" onClick={() => setOpen(false)}>×</button></div>
      <nav id="review-primary-nav" aria-label="Primary navigation">{researcherNav.map((item) => <a key={item} href="#review-stage" className={active === item ? "sideNavItem isActive" : "sideNavItem"} aria-current={active === item ? "page" : undefined} onClick={() => setOpen(false)}>{item}</a>)}</nav>
    </aside>
    <div className="appMain"><header className="appTopbar"><div><span className="crumb">Usability Testing Platform / V1</span><h1>{screen.name}</h1></div><div className="topActions"><button type="button" className="mobileNavToggle" aria-controls="review-primary-nav" aria-expanded={open} onClick={() => setOpen(true)}>Menu</button><Button variant="secondary">Preview</Button></div></header><main className="screenCanvas">{children}</main></div>
  </div>;
}

function FilterBar() {
  return <div className="filterBar"><label className="field filterSearch"><span className="fieldLabel">Search</span><input className="fieldControl" placeholder="Search" /></label><div className="filterChips" aria-label="Filters"><button type="button" className="filterChip isActive">All</button><button type="button" className="filterChip">Filter</button></div></div>;
}

function Lifecycle({ current = "Build" }: { current?: string }) {
  const steps = ["Build", "Preview", "Validate", "Publish", "Share", "Results"];
  return <div className="lifecycleRail" aria-label="Test lifecycle">{steps.map((step, i) => <span key={step} className={`lifecycleStep ${step === current ? "isCurrent" : ""} ${i > 3 ? "isLocked" : ""}`.trim()} aria-current={step === current ? "step" : undefined} aria-disabled={i > 3 ? "true" : undefined}>{step}{step === current ? " · Current" : i > 3 ? " · Locked" : ""}</span>)}</div>;
}

function FormSpec({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  const choice = screen.id === "S08";
  return <section className="panel formPanel formPanel--wide"><Header title={screen.name} state={state} detail="Form anatomy follows the canonical screen contract." />{kind === "loading" ? <Skeleton /> : <>{choice ? <fieldset className="choiceGrid"><legend>Choose one option</legend>{[1,2,3].map((n) => <label key={n}><input type="radio" name={`${screen.id}-choice`} /><span><strong>Option {n}</strong><small>Review-only choice treatment</small></span></label>)}</fieldset> : <label className="field"><span className="fieldLabel">Primary field</span><input className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} aria-describedby={kind === "error" ? `${screen.id}-error` : undefined} />{kind === "error" ? <span id={`${screen.id}-error`} className="fieldMessage fieldMessage--error">Check this field before continuing.</span> : null}</label>}{screen.componentFamilies.includes("Textarea") ? <label className="field"><span className="fieldLabel">Supporting details</span><textarea className="fieldControl fieldTextarea" /></label> : null}<div className="formActions"><Button variant="secondary">Back</Button><Button disabled={["error","restricted","unsupported"].includes(kind)}>Continue</Button></div></>}</section>;
}

function DashboardSpec({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  return <div className="dashboardStack"><MetricSkeletons count={4} /><section className="panel operationalPanel"><Header title={screen.name} state={state} detail="Operational content stays skeleton-only until display-safe runtime data exists." />{kind === "loading" ? <Skeleton rows={6} /> : kind === "empty" ? <Empty /> : <TableSkeleton label={`${screen.name} evidence layout`} />}</section></div>;
}

function ListingSpec({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  return <section className="panel operationalPanel"><Header title={screen.name} state={state} detail="Shared compact filter and enterprise-table geometry." /><FilterBar />{kind === "loading" ? <Skeleton rows={7} /> : kind === "empty" ? <Empty /> : <>{kind === "error" ? <ErrorCard /> : null}<TableSkeleton label={`${screen.name} table layout`} /></>}</section>;
}

function BuildWorkspace({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle /><div className="builderWorkspace"><section className="panel"><Header title="Test flow" state="Draft" detail="Selection stays visible while editing." /><div className="builderStepList">{["Welcome & consent","Prototype","Task","Post-task feedback"].map((label,i) => <button type="button" key={label} className={i === 2 ? "builderStep isCurrent" : "builderStep"} aria-current={i === 2 ? "step" : undefined}><strong>{label}</strong><small>{i === 2 ? "Editing" : "Configured"}</small></button>)}</div></section><section className="panel formPanel formPanel--wide"><Header title="Selected task" state={state} detail="Required configuration and validation remain adjacent." />{kind === "loading" ? <Skeleton /> : <><label className="field"><span className="fieldLabel">Task instruction</span><textarea className="fieldControl fieldTextarea" /></label><div className="screenContractGrid"><div className="screenContractCard"><strong>Prototype</strong><span>Connection and start point are reviewed here.</span></div><div className="screenContractCard"><strong>Success criteria</strong><span>Terminal rules are reviewed before publishing.</span></div></div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Preview draft</Button><Button disabled={["error","restricted","unsupported"].includes(kind)}>Review validation</Button></div></>}</section></div></>;
}

function ImportSpec({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle /><section className="panel formPanel formPanel--wide"><Header title="Figma Connect / Import" state={state} detail="Prototype access remains separate from task configuration." /><label className="field"><span className="fieldLabel">Prototype URL</span><input className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} placeholder="https://www.figma.com/..." />{kind === "error" ? <span className="fieldMessage fieldMessage--error">Enter a supported URL or resolve provider access.</span> : null}</label><div className="integrationRow"><div><strong>Figma</strong><span>{kind === "loading" ? "Checking access…" : kind === "success" ? "Connected" : "Connection required"}</span></div><Button disabled={kind === "loading" || kind === "restricted"}>Check access</Button></div></section></>;
}

function ValidationSpec({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle current={screen.id === "S19" ? "Publish" : "Validate"} /><section className="panel validationPanel"><Header title={screen.name} state={state} detail="Validation outcomes are explicit and recoverable." /><div className="checklist">{["Required configuration","Prototype access","Success/failure rules"].map((label,i) => <div key={label} className={kind === "success" ? "checkOk" : i === 0 && ["warning","error"].includes(kind) ? "checkError" : "checkWarn"}><strong>{label}</strong><span>{kind === "success" ? "Pass" : i === 0 ? "Needs attention" : "Review"}</span></div>)}</div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Back to edit</Button><Button disabled={kind !== "success"}>Continue</Button></div></section></>;
}

function PrototypeSpec({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle current={screen.id === "S18" ? "Preview" : "Build"} /><section className="panel"><Header title={screen.name} state={state} detail="Provider conditions stay separate from usability outcomes." />{kind === "loading" ? <Skeleton rows={6} /> : <><div className="prototypeMock" aria-label="Prototype review surface"><div className="prototypeChrome"><span /><span /><span /></div><div className="prototypeBody"><div className="prototypeSidebar" /><div className="prototypeContent"><span className="prototypeLine prototypeLine--wide" /><span className="prototypeLine" /><div className="prototypeCards"><span /><span /></div></div></div></div>{["warning","unsupported","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Back</Button><Button disabled={["unsupported","error"].includes(kind)}>Continue</Button></div></>}</section></>;
}

function TaskEditor({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle /><div className="builderWorkspace"><section className="panel"><Header title="Tasks" state={state} detail="Order and selection stay visible." /><div className="builderStepList">{[1,2,3].map((n) => <button type="button" key={n} className={n === 2 ? "builderStep isCurrent" : "builderStep"}><strong>Task {n}</strong><small>{n === 2 ? "Selected" : "Configured"}</small></button>)}</div><div className="reorderActions"><Button variant="secondary">Move up</Button><Button variant="secondary">Move down</Button></div></section><section className="panel formPanel formPanel--wide"><Header title="Task editor" detail="Instruction and validation share one edit context." /><label className="field"><span className="fieldLabel">Task instruction</span><textarea className={kind === "error" ? "fieldControl fieldTextarea fieldControl--error" : "fieldControl fieldTextarea"} aria-invalid={kind === "error"} /></label>{kind === "error" ? <span className="fieldMessage fieldMessage--error">Add a valid task instruction.</span> : null}<div className="formActions"><Button variant="secondary">Cancel</Button><Button disabled={kind === "error"}>Save task</Button></div></section></div></>;
}

function RuleSpec({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle /><section className="panel formPanel formPanel--wide"><Header title="Success / Failure Rules" state={state} detail="Success, failure and timeout rules remain distinct." /><div className="ruleRows"><div><span className="ruleType ruleType--success">Success</span><select className="fieldControl" aria-label="Success rule"><option>Choose rule</option></select></div><div><span className="ruleType ruleType--failure">Failure</span><select className="fieldControl" aria-label="Failure rule"><option>Choose rule</option></select></div><div><span className="ruleType">Timeout</span><input className="fieldControl" type="number" aria-label="Timeout value" /></div></div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Back</Button><Button disabled={kind === "error"}>Save rules</Button></div></section></>;
}

function QuestionSpec({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle /><section className="panel formPanel formPanel--wide"><Header title="Question Editor" state={state} detail="SEQ and open feedback are separate question types." /><fieldset className="seqFieldset"><legend>SEQ response</legend><div>{[1,2,3,4,5,6,7].map((n) => <label key={n}><input type="radio" name="seq" /><span>{n}</span></label>)}</div><small>Seven-point response control</small></fieldset><label className="field"><span className="fieldLabel">Open feedback</span><textarea className="fieldControl fieldTextarea" /></label>{kind === "error" ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Back</Button><Button>Save question</Button></div></section></>;
}

function PreviewSetup({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle current="Preview" /><section className="panel validationPanel"><div className="previewBanner"><span>Preview mode</span><strong>{kind === "success" ? "Ready" : "Review required"}</strong></div><Header title="Preview Setup" state={state} detail="Draft validity and provider access are checked before preview." /><div className="checklist"><div className={kind === "success" ? "checkOk" : "checkWarn"}><strong>Draft validation</strong><span>{kind === "success" ? "Ready" : "Needs review"}</span></div><div className={kind === "unsupported" ? "checkError" : "checkOk"}><strong>Prototype access</strong><span>{kind === "unsupported" ? "Provider blocked" : "Available"}</span></div></div>{["warning","unsupported","error"].includes(kind) ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Back to build</Button><Button disabled={kind !== "success"}>Enter preview</Button></div></section></>;
}

function ShareSpec({ state }: { state: string }) {
  const kind = stateKind(state);
  return <><Lifecycle current="Publish" /><section className="panel sharePanel"><div className={kind === "success" ? "statusIcon" : "statusIcon statusIcon--muted"} aria-hidden="true">{kind === "success" ? "✓" : "i"}</div><h2>Share / Published</h2><p>Published-link layout is shown without fabricating a live study URL.</p><div className="shareUrl"><span className="skeletonCell" aria-hidden="true" /><Button variant="secondary">Copy link</Button></div><div className="formActions"><Button variant="secondary">Back to build</Button><Button disabled={["warning","error"].includes(kind)}>Republish</Button></div></section></>;
}

function ResultsOverview({ state }: { state: string }) {
  const kind = stateKind(state);
  if (kind === "empty") return <Empty title="No eligible results" />;
  return <div className="dashboardStack"><MetricSkeletons /><div className="analyticsGrid"><section className="panel"><Header title="Results Overview" state={state} detail="Metrics stay skeleton-only in this review artifact." /><div className="funnelSkeleton"><span /><span /><span /></div></section><section className="panel"><Header title="Evidence status" detail="Technical conditions remain distinct from usability outcomes." /><Skeleton rows={5} /></section></div>{["warning","error"].includes(kind) ? <ErrorCard /> : null}</div>;
}

function TaskDetail({ state }: { state: string }) {
  const kind = stateKind(state);
  if (kind === "empty") return <Empty title="No eligible sessions" />;
  return <div className="dashboardStack"><MetricSkeletons />{kind === "warning" ? <StateNotice state={state} /> : null}<section className="panel operationalPanel"><Header title="Task Detail" state={state} detail="Eligible-session evidence uses the enterprise table layout." /><TableSkeleton label="Task detail evidence table" /></section></div>;
}

function PathSpec({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel"><Header title="Path Analysis" state={state} detail="Expected and actual paths stay visually separate." />{kind === "empty" || kind === "unsupported" ? <Empty title="No eligible path evidence" /> : <div className="pathMock"><span className="pathNode pathNode--active">Start</span><span aria-hidden="true">→</span><span className="pathNode">Step</span><span aria-hidden="true">→</span><span className="pathNode">End</span></div>}</section>;
}

function HeatmapSpec({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel"><Header title="Heatmap" state={state} detail="Unsupported and no-data handling remain explicit." />{kind === "empty" || kind === "unsupported" ? <Empty title="No eligible click evidence" /> : <div className="heatmapMock" aria-label="Heatmap layout"><span style={{ left: "22%", top: "30%", width: 18, height: 18 }} /><span style={{ left: "52%", top: "44%", width: 28, height: 28 }} /><span style={{ left: "73%", top: "64%", width: 14, height: 14 }} /><div className="heatLegend"><span>Low</span><i /><i /><i /><i /><i /><span>High</span></div></div>}</section>;
}

function SessionDetail({ state }: { state: string }) {
  const kind = stateKind(state);
  return <div className="detailSplit"><section className="panel"><Header title="Session timeline" state={state} detail="Evidence chronology stays readable while restrictions remain explicit." /><div className="timelineList">{[1,2,3,4].map((n) => <div key={n}><span aria-hidden="true" /><div><strong>Event</strong><small>{kind === "restricted" ? "Restricted evidence" : "Session evidence"}</small></div></div>)}</div></section><aside className="panel"><Header title="Evidence" /><Skeleton /></aside></div>;
}

function FindingsList({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel operationalPanel"><Header title="Findings List" state={state} detail="Finding cards preserve severity and evidence relationships." /><div className="filterBar"><div className="filterChips"><button type="button" className="filterChip isActive">All</button><button type="button" className="filterChip">Filter</button></div></div>{kind === "empty" ? <Empty title="No findings" /> : <div className="findingGrid findingGrid--skeleton">{[1,2,3].map((n) => <article className="findingCard" key={n}><span className="severity">Severity</span><span className="skeletonCell skeletonCell--title" /><span className="skeletonCell" /><span className="skeletonCell" /></article>)}</div>}</section>;
}

function FindingEditor({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel formPanel formPanel--wide"><Header title="Finding Detail / Editor" state={state} detail="Finding fields and evidence are reviewed together." /><label className="field"><span className="fieldLabel">Finding title</span><input className="fieldControl" /></label><fieldset className="choiceGrid choiceGrid--compact"><legend>Severity</legend>{["Low","Medium","High"].map((v) => <label key={v}><input type="radio" name="severity" /><span><strong>{v}</strong></span></label>)}</fieldset><label className="field"><span className="fieldLabel">Evidence-backed detail</span><textarea className="fieldControl fieldTextarea" /></label><div className="evidenceCard"><strong>Evidence</strong><span>{kind === "restricted" ? "Evidence unavailable or deleted" : "Attach eligible evidence"}</span></div><div className="formActions"><Button variant="secondary">Cancel</Button><Button disabled={kind === "restricted"}>Save finding</Button></div></section>;
}

function Retest({ state }: { state: string }) {
  const kind = stateKind(state);
  if (kind === "empty") return <Empty title="No eligible baseline" />;
  return <section className="comparisonGrid comparisonGrid--skeleton" aria-label="Retest comparison"><div className="compareColumn"><span className="eyebrow">Baseline</span><MetricSkeletons count={2} /></div><div className="deltaColumn"><span className="skeletonCell" /><span className="skeletonCell" /></div><div className="compareColumn"><span className="eyebrow">Retest</span><MetricSkeletons count={2} /></div></section>;
}

function DeleteData({ state }: { state: string }) {
  const kind = stateKind(state);
  return <div className="modalStage"><section className="deleteModal" role="dialog" aria-modal="true" aria-label="Delete Data confirmation"><Header title="Delete Data" state={state} detail="Review deletion scope before confirming." /><div className="deletionScope"><strong>Deletion scope</strong><span>Selected workspace or study data</span><span>Evidence and derived records</span></div>{kind === "loading" ? <Skeleton /> : kind === "error" ? <ErrorCard /> : <p className="destructiveCopy">This action is destructive. Keep scope and consequences visible before confirmation.</p>}<div className="formActions"><Button variant="secondary">Cancel</Button><Button variant="danger" disabled={kind === "loading"}>Delete data</Button></div></section></div>;
}

function MembersRoles({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel operationalPanel"><Header title="Members & Roles" state={state} detail="Role changes and restricted states remain explicit." />{kind === "restricted" ? <Empty title="Permission required" /> : <><TableSkeleton label="Members and roles table" /><div className="roleEditor"><label className="field"><span className="fieldLabel">Role</span><select className="fieldControl"><option>Role</option></select></label><div className="formActions"><Button variant="secondary">Cancel</Button><Button>Save role</Button></div></div></>}</section>;
}

function Integration({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel"><Header title="Integrations / Figma" state={state} detail="Integration state is explicit and recoverable." /><div className="integrationCard"><div><strong>Figma</strong><span>{kind === "success" ? "Connected" : kind === "loading" ? "Connecting…" : "Disconnected"}</span></div><Button disabled={kind === "loading"}>{kind === "success" ? "Manage" : "Connect"}</Button></div>{kind === "error" ? <ErrorCard /> : null}</section>;
}

function Retention({ state }: { state: string }) {
  const kind = stateKind(state);
  return <section className="panel formPanel formPanel--wide"><Header title="Privacy & Retention" state={state} detail="Retention uses explicit numeric and select controls." /><label className="field"><span className="fieldLabel">Retention period</span><input type="number" className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} /></label><label className="field"><span className="fieldLabel">Retention unit</span><select className="fieldControl"><option>Days</option></select></label>{kind === "error" ? <ErrorCard /> : null}<div className="formActions"><Button variant="secondary">Cancel</Button><Button disabled={kind === "restricted" || kind === "error"}>Save</Button></div></section>;
}

function ResearcherSpecimen({ screen, state }: { screen: Screen; state: string }) {
  switch (screen.id) {
    case "S01": return <section className="panel entryPanel"><Header title="App Entry" state={state} detail="Researcher login entry points remain deferred." /><div className="entryAction"><div><strong>Continue to the usability-testing workspace</strong><p>No deferred login controls are exposed here.</p></div><Button>Continue</Button></div>{stateKind(state) === "error" ? <ErrorCard /> : null}</section>;
    case "S02": case "S05": case "S08": case "S33": return <FormSpec screen={screen} state={state} />;
    case "S03": case "S06": return <DashboardSpec screen={screen} state={state} />;
    case "S04": case "S07": case "S21": case "S26": case "S31": return <ListingSpec screen={screen} state={state} />;
    case "S09": return <BuildWorkspace state={state} />;
    case "S10": return <ImportSpec state={state} />;
    case "S11": case "S16": case "S19": return <ValidationSpec screen={screen} state={state} />;
    case "S12": case "S18": return <PrototypeSpec screen={screen} state={state} />;
    case "S13": return <TaskEditor state={state} />;
    case "S14": return <RuleSpec state={state} />;
    case "S15": return <QuestionSpec state={state} />;
    case "S17": return <PreviewSetup state={state} />;
    case "S20": return <ShareSpec state={state} />;
    case "S22": return <ResultsOverview state={state} />;
    case "S23": return <TaskDetail state={state} />;
    case "S24": return <PathSpec state={state} />;
    case "S25": return <HeatmapSpec state={state} />;
    case "S27": return <SessionDetail state={state} />;
    case "S28": return <FindingsList state={state} />;
    case "S29": return <FindingEditor state={state} />;
    case "S30": return <Retest state={state} />;
    case "S32": return <DeleteData state={state} />;
    case "S34": return <MembersRoles state={state} />;
    case "S35": return <Integration state={state} />;
    case "S36": return <Retention state={state} />;
    default: return <FormSpec screen={screen} state={state} />;
  }
}

function ScreenContent({ screen, state }: { screen: Screen; state: string }) {
  return <Shell screen={screen}><StateNotice state={state} /><ResearcherSpecimen screen={screen} state={state} /></Shell>;
}

function ParticipantProgress({ screen }: { screen: Screen }) {
  const index = Math.max(1, Number(screen.id.slice(1)) || 1);
  const value = Math.min(100, Math.round((index / 12) * 100));
  return <div className="participantProgress"><span>Study progress</span><div role="progressbar" aria-label="Study progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{ width: `${value}%` }} /></div></div>;
}

function ParticipantActions({ primary = "Continue", secondary = "Back", disabled = false, danger = false }: { primary?: string; secondary?: string; disabled?: boolean; danger?: boolean }) {
  return <div className="formActions participantActions"><Button variant="secondary">{secondary}</Button><Button variant={danger ? "danger" : "primary"} disabled={disabled}>{primary}</Button></div>;
}

function ParticipantSpecimen({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  switch (screen.id) {
    case "P01": return <section className="participantCard centerCard"><span className="eyebrow">Access check</span><h1>Preparing your study</h1><p>We check the study link and required access before the session starts.</p><StateNotice state={state} />{kind === "loading" ? <Skeleton /> : <ParticipantActions primary="Continue" secondary="Exit" />}</section>;
    case "P02": return <section className="participantCard centerCard"><span className="eyebrow">Consent</span><h1>Before you begin</h1><p>Interaction tracking starts only after consent.</p><label className="consentBox"><input type="checkbox" /><span>I agree to participate in this usability study.</span></label><StateNotice state={state} /><ParticipantActions primary="Agree and start" secondary="Decline" disabled={kind === "loading"} /></section>;
    case "P03": return <section className="participantCard centerCard"><span className="eyebrow">Task</span><h1>Read the task before starting</h1><div className="scenarioCard"><strong>Task instructions</strong><span>Instructions are shown without revealing expected paths or success targets.</span></div><StateNotice state={state} /><ParticipantActions primary="Start task" /></section>;
    case "P04": return <section className="participantRunner"><div className="runnerTaskBar"><strong>Task in progress</strong><Button variant="secondary">Give up</Button></div><div className="participantPrototype" aria-label="Prototype canvas"><Skeleton rows={6} /></div><StateNotice state={state} /></section>;
    case "P05": return <div className="modalStage participantModalStage"><section className="deleteModal" role="dialog" aria-modal="true" aria-label="Give up confirmation"><h1>Give up this task?</h1><p>Your session can continue, but this task will be recorded as given up.</p><StateNotice state={state} /><ParticipantActions primary="Give up task" secondary="Keep trying" danger /></section></div>;
    case "P06": return <section className="participantCard centerCard"><span className="eyebrow">Post-task feedback</span><h1>How easy or difficult was this task?</h1><fieldset className="seqFieldset"><legend>Task ease</legend><div>{[1,2,3,4,5,6,7].map((n) => <label key={n}><input type="radio" name="participant-seq" /><span>{n}</span></label>)}</div></fieldset><label className="field"><span className="fieldLabel">Optional feedback</span><textarea className="fieldControl fieldTextarea" /></label><StateNotice state={state} /><ParticipantActions /></section>;
    case "P07": return <section className="participantCard centerCard"><span className="eyebrow">Next task</span><h1>Ready for the next task?</h1><p>Your previous response is saved before the next task begins.</p><StateNotice state={state} />{kind === "loading" ? <Skeleton /> : <ParticipantActions primary="Next task" secondary="Exit" />}</section>;
    case "P08": return <section className="participantCard centerCard completionCard"><div className="statusIcon" aria-hidden="true">✓</div><h1>Study complete</h1><p>Thank you for completing the session.</p><div className="referenceCode"><span>Reference code</span><span className="skeletonCell" aria-hidden="true" /></div></section>;
    case "P09": return <section className="participantCard centerCard unavailableCard"><div className="statusIcon statusIcon--muted" aria-hidden="true">!</div><h1>This study link is unavailable</h1><StateNotice state={state} /><p>Use a valid active study link or contact the study owner.</p></section>;
    case "P10": return <section className="participantCard centerCard"><div className="statusIcon statusIcon--warning" aria-hidden="true">!</div><h1>We can’t continue this step</h1><p>This is a technical or access condition, not a usability failure.</p><StateNotice state={state} /><ParticipantActions primary="Try again" secondary="Exit" disabled={kind === "restricted" && state === "Permission"} /></section>;
    case "P11": return <section className="participantCard centerCard"><div className="statusIcon statusIcon--warning" aria-hidden="true">!</div><h1>Time limit reached</h1><StateNotice state={state} /><p>The next action follows the study configuration.</p><ParticipantActions primary="Continue" secondary="Exit" /></section>;
    case "P12": return <section className="participantCard centerCard"><span className="eyebrow">Recovery</span><h1>{kind === "success" ? "Session restored" : "Reconnect to continue"}</h1><p>Your completed progress is preserved when recovery succeeds.</p><StateNotice state={state} />{kind === "loading" ? <Skeleton /> : <ParticipantActions primary={kind === "success" ? "Resume study" : "Reconnect"} secondary="Exit" disabled={kind === "error"} />}</section>;
    default: return <section className="participantCard centerCard"><h1>{screen.name}</h1><StateNotice state={state} /><ParticipantActions /></section>;
  }
}

function ParticipantContent({ screen, state }: { screen: Screen; state: string }) {
  return <div className="participantFrame"><header className="participantHeader"><div className="participantBrand">UT Study</div><ParticipantProgress screen={screen} /></header><main className="participantMain"><ParticipantSpecimen screen={screen} state={state} /></main><footer className="participantFooter">Anonymous session · behavioral tracking starts only after consent.</footer></div>;
}

export default function HighFiReview() {
  const [selectedId, setSelectedId] = useState(screens[0]?.id ?? "S01");
  const selectedScreen = useMemo(() => screens.find((screen) => screen.id === selectedId) ?? screens[0], [selectedId]);
  const [selectedState, setSelectedState] = useState(selectedScreen.states[0]);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const selectedIndex = screens.findIndex((screen) => screen.id === selectedScreen.id);

  function chooseScreen(id: string) {
    const next = screens.find((screen) => screen.id === id) ?? screens[0];
    setSelectedId(next.id);
    setSelectedState(next.states[0]);
  }

  function stepScreen(offset: number) {
    chooseScreen(screens[(selectedIndex + offset + screens.length) % screens.length].id);
  }

  return <main className="reviewPage">
    <header className="reviewHeader"><div><span className="eyebrow">Task 14 · High-fidelity QA</span><h1>48-screen / 170-state review</h1><p>Desktop and Mobile specimens use the Task 13 design-system baseline. This route is a review artifact with a no production-data claim.</p></div><div className="coverageBadge" aria-label="Coverage"><strong>{screens.length}</strong><span>screens</span><strong>{totalStates}</strong><span>states</span></div></header>
    <section className="reviewControls" aria-label="Review controls">
      <label><span>Screen</span><select value={selectedScreen.id} onChange={(e) => chooseScreen(e.target.value)}>{groups.map((group) => <optgroup key={group.label} label={group.label}>{group.ids.map((id) => { const screen = screens.find((item) => item.id === id); return screen ? <option key={screen.id} value={screen.id}>{screen.id} · {screen.name}</option> : null; })}</optgroup>)}</select></label>
      <label><span>State</span><select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>{selectedScreen.states.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
      <div className="viewportToggle" role="group" aria-label="Viewport"><button type="button" className={viewport === "desktop" ? "isActive" : ""} aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Desktop</button><button type="button" className={viewport === "mobile" ? "isActive" : ""} aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>Mobile</button></div>
      <div className="reviewStepper"><button type="button" onClick={() => stepScreen(-1)} aria-label="Previous screen">←</button><span>{selectedIndex + 1} / {screens.length}</span><button type="button" onClick={() => stepScreen(1)} aria-label="Next screen">→</button></div>
      <div className="componentSummary"><span>Component families</span><Chips screen={selectedScreen} /></div>
    </section>
    <section id="review-stage" className={viewport === "mobile" ? "reviewStage reviewStage--mobile" : "reviewStage"} aria-label={`${selectedScreen.id} ${selectedScreen.name} ${selectedState} ${viewport}`}><div className="deviceFrame">{selectedScreen.id.startsWith("P") ? <ParticipantContent screen={selectedScreen} state={selectedState} /> : <ScreenContent screen={selectedScreen} state={selectedState} />}</div></section>
  </main>;
}
