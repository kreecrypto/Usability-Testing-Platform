"use client";

import { useMemo, useState } from "react";
import screenMap from "../../../docs/design-system/screen-component-map.json";
import "./high-fi.css";
import "./predeploy-fixes.css";

type Screen = (typeof screenMap.screens)[number];
type Viewport = "desktop" | "mobile";
type StateTone = "neutral" | "loading" | "error" | "restricted" | "unsupported" | "empty" | "warning" | "success";

type NavKey = "Projects" | "Tests" | "Results" | "Participants" | "Settings" | null;

const screens = screenMap.screens as Screen[];
const totalStates = screens.reduce((sum, screen) => sum + screen.states.length, 0);
const researcherNav = ["Projects", "Tests", "Results", "Participants", "Settings"] as const;

function stateKind(state: string): StateTone {
  const value = state.toLowerCase();
  if (["loading", "connecting", "checking", "processing", "buffering", "validating", "accepting", "reconnect"].some((token) => value.includes(token))) return "loading";
  if (["error", "invalid", "conflict", "failed"].some((token) => value.includes(token))) return "error";
  if (["restricted", "permission denied", "redacted"].some((token) => value.includes(token))) return "restricted";
  if (["unsupported", "provider blocked"].some((token) => value.includes(token))) return "unsupported";
  if (["empty", "no data", "no clicks", "no path", "no baseline", "no eligible"].some((token) => value.includes(token))) return "empty";
  if (["warning", "low sample", "blocked", "timeout", "timed out", "give up"].some((token) => value.includes(token))) return "warning";
  if (["pass", "ready", "complete", "published", "connected", "valid", "success"].some((token) => value.includes(token))) return "success";
  return "neutral";
}

function navKeyForScreen(id: string): NavKey {
  if (!id.startsWith("S")) return null;
  const number = Number(id.slice(1));
  if (number >= 3 && number <= 6) return "Projects";
  if (number >= 7 && number <= 20) return "Tests";
  if (number >= 21 && number <= 30) return "Results";
  if (number === 31) return "Participants";
  if (number >= 32 && number <= 36) return "Settings";
  return null;
}

function StateNotice({ state }: { state: string }) {
  const kind = stateKind(state);
  const copy: Record<StateTone, string> = {
    neutral: "Selected V1 state. The screen keeps the task context and next action explicit.",
    loading: "Loading keeps existing context visible and prevents duplicate actions.",
    error: "The problem is stated next to a recovery action and entered context is preserved.",
    restricted: "Permission or privacy restrictions are explicit; restricted evidence is never approximated.",
    unsupported: "Provider evidence is unavailable for this capability, so the UI does not fabricate a result.",
    empty: "No eligible content is available. No Data remains unavailable instead of becoming zero.",
    warning: "This condition needs review before continuing and stays separate from usability failure.",
    success: "Required checks are satisfied for this review state.",
  };

  return (
    <div className={`stateNotice stateNotice--${kind}`} role={kind === "error" ? "alert" : "status"}>
      <div><span className="stateDot" aria-hidden="true" /><strong>{state}</strong></div>
      <p>{copy[kind]}</p>
    </div>
  );
}

function ReviewButton({ children, disabled = false, variant = "primary" }: { children: React.ReactNode; disabled?: boolean; variant?: "primary" | "secondary" | "danger" }) {
  return <button type="button" disabled={disabled} className={`hfButton hfButton--${variant}`}>{children}</button>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metricCard"><span className="metricLabel">{label}</span><strong className="metricValue">{value}</strong><span className="metricDetail">{detail}</span></article>;
}

function EmptyState({ title }: { title: string }) {
  return <section className="emptyState"><div className="emptyIcon" aria-hidden="true">○</div><h3>{title}</h3><p>There is no eligible evidence for this state.</p><ReviewButton variant="secondary">Return to overview</ReviewButton></section>;
}

function Skeleton() {
  return <div className="skeletonStack" aria-label="Loading"><span /><span /><span /><span /></div>;
}

function Heatmap() {
  return (
    <div className="heatmapMock" aria-label="Heatmap review placeholder">
      <span style={{ left: "22%", top: "30%", width: 18, height: 18 }} />
      <span style={{ left: "52%", top: "44%", width: 28, height: 28 }} />
      <span style={{ left: "73%", top: "64%", width: 14, height: 14 }} />
      <div className="heatLegend"><span>Low</span><i /><i /><i /><i /><i /><span>High</span></div>
    </div>
  );
}

function RetestComparison() {
  return (
    <section className="comparisonGrid" aria-label="Retest comparison">
      <div className="compareColumn"><span className="eyebrow">Baseline · v3</span><MetricCard label="Completion" value="77%" detail="17 / 22 eligible" /><MetricCard label="Median time" value="42s" detail="n=17 successes" /></div>
      <div className="deltaColumn"><strong>+11 pp</strong><span>Completion</span><strong>−9s</strong><span>Median time</span></div>
      <div className="compareColumn"><span className="eyebrow">Retest · v4</span><MetricCard label="Completion" value="88%" detail="22 / 25 eligible" /><MetricCard label="Median time" value="33s" detail="n=22 successes" /></div>
    </section>
  );
}

function ResearcherShell({ screen, children }: { screen: Screen; children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const activeNav = navKeyForScreen(screen.id);

  return (
    <div className="appFrame">
      <aside className={mobileNavOpen ? "appSidebar appSidebar--open" : "appSidebar"}>
        <div className="axaMark" aria-label="UT Platform">UT<span>•</span></div>
        <button
          type="button"
          className="mobileNavToggle"
          aria-controls="review-primary-nav"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          {mobileNavOpen ? "Close menu" : "Menu"}
        </button>
        <nav id="review-primary-nav" aria-label="Primary navigation">
          {researcherNav.map((item) => (
            <a
              key={item}
              href="#review-stage"
              className={activeNav === item ? "sideNavItem isActive" : "sideNavItem"}
              aria-current={activeNav === item ? "page" : undefined}
              onClick={() => setMobileNavOpen(false)}
            >
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <div className="appMain">
        <header className="appTopbar"><div><span className="crumb">Usability Testing Platform / V1</span><strong>{screen.id} · {screen.name}</strong></div><ReviewButton variant="secondary">Preview</ReviewButton></header>
        <main className="screenCanvas">{children}</main>
      </div>
    </div>
  );
}

function BuildLifecycle() {
  return (
    <div className="lifecycleRail" aria-label="Test lifecycle">
      <span className="lifecycleStep isCurrent">Build · Current</span>
      <span className="lifecycleStep">Preview</span>
      <span className="lifecycleStep">Validate</span>
      <span className="lifecycleStep">Publish</span>
      <span className="lifecycleStep isLocked" aria-disabled="true">Share · Locked</span>
      <span className="lifecycleStep isLocked" aria-disabled="true">Results · Locked</span>
    </div>
  );
}

function BuildWorkspaceSpecimen({ kind }: { kind: StateTone }) {
  const blocked = kind === "error" || kind === "restricted" || kind === "unsupported";
  return (
    <>
      <BuildLifecycle />
      <div className="builderWorkspace">
        <section className="panel" aria-label="Test flow">
          <div className="panelHeader"><div><h2>Test flow</h2><p>Selected step stays visible while editing.</p></div><span className="tag">Draft</span></div>
          <div className="builderStepList">
            <button type="button" className="builderStep"><strong>Welcome & consent</strong><small>Configured</small></button>
            <button type="button" className="builderStep"><strong>Prototype</strong><small>Connection required</small></button>
            <button type="button" className="builderStep isCurrent" aria-current="step"><strong>Task 1 · Checkout</strong><small>Editing · scenario and success rules</small></button>
            <button type="button" className="builderStep"><strong>Post-task feedback</strong><small>SEQ + open response</small></button>
          </div>
        </section>
        <section className="panel formPanel" aria-label="Selected task editor">
          <div className="panelHeader"><div><h2>Task 1 · Checkout</h2><p>Editing · required configuration remains visible.</p></div><span className="tag">Selected</span></div>
          <label className="field"><span className="fieldLabel">Scenario</span><textarea className="fieldControl fieldTextarea" defaultValue="Find the canvas bag and place an order." /></label>
          <div className="screenContractGrid">
            <div className="screenContractCard"><strong>Prototype</strong><span>Connect and select a start point before publish.</span></div>
            <div className="screenContractCard"><strong>Success criteria</strong><span>Define terminal success/failure rules before publish.</span></div>
          </div>
          <div className="formActions"><ReviewButton variant="secondary">Preview draft</ReviewButton><ReviewButton disabled={blocked}>Review validation</ReviewButton></div>
          <p className="hint">Share and Results stay locked until a version passes validation and is published.</p>
        </section>
      </div>
    </>
  );
}

function ComponentDrivenSpecimen({ screen, state, kind }: { screen: Screen; state: string; kind: StateTone }) {
  const families = new Set<string>(screen.componentFamilies);
  const showSearch = families.has("SearchField");
  const showTextInput = families.has("TextInput");
  const showTextarea = families.has("Textarea");
  const showTable = families.has("Table") || families.has("TableOrCardList");
  const showMetrics = families.has("MetricCard");
  const showValidation = families.has("ValidationSummary") || families.has("ValidationChecklist") || families.has("PublishChecklist");
  const showPrototype = families.has("PrototypeCanvas") || families.has("PrototypeFramePicker");
  const showChoices = families.has("ChoiceCard") || families.has("RadioGroup") || families.has("SEQScale");
  const disabled = kind === "error" || kind === "restricted" || kind === "unsupported";

  return (
    <section className="panel formPanel">
      <div className="panelHeader"><div><h2>{screen.name}</h2><p>{screen.componentFamilies.join(" · ")}</p></div><span className="tag">{state}</span></div>

      {showSearch ? <label className="field"><span className="fieldLabel">Search</span><input className="fieldControl" placeholder={`Search ${screen.name.toLowerCase()}`} /></label> : null}
      {showTextInput ? <label className="field"><span className="fieldLabel">Primary field</span><input className={kind === "error" ? "fieldControl fieldControl--error" : "fieldControl"} aria-invalid={kind === "error"} placeholder={`${screen.name} input`} /></label> : null}
      {showTextarea ? <label className="field"><span className="fieldLabel">Supporting details</span><textarea className="fieldControl fieldTextarea" placeholder={`Add ${screen.name.toLowerCase()} details`} /></label> : null}

      {showChoices ? (
        <fieldset className="seqFieldset"><legend>Review choice state</legend><div className="seqScale">{[1, 2, 3].map((value) => <label key={value}><input type="radio" name={`choice-${screen.id}`} value={value} /><span>{value}</span></label>)}</div></fieldset>
      ) : null}

      {showValidation ? (
        <div className="screenContractGrid" aria-label="Validation summary">
          <div className="screenContractCard"><strong>Required configuration</strong><span>Represent pass, warning and blocked outcomes without hiding context.</span></div>
          <div className="screenContractCard"><strong>Recovery path</strong><span>Keep the corrective action adjacent to the affected state.</span></div>
        </div>
      ) : null}

      {showPrototype ? <div className="prototypeReviewSurface" aria-label="Prototype review surface">Prototype / frame review surface</div> : null}

      {showMetrics ? <div className="metricsGrid"><MetricCard label="Eligible sessions" value="—" detail="Review-state placeholder" /><MetricCard label="Completion" value="—" detail="Unavailable until evidence exists" /><MetricCard label="Median time" value="—" detail="Successful eligible sessions only" /></div> : null}

      {showTable ? (
        <div className="tableWrap" tabIndex={0} aria-label={`${screen.name} table review`}>
          <table className="specimenTable"><thead><tr><th scope="col">Item</th><th scope="col">State</th><th scope="col">Evidence</th></tr></thead><tbody><tr><td>Review row</td><td>{state}</td><td>Source-backed placeholder</td></tr></tbody></table>
        </div>
      ) : null}

      {!showSearch && !showTextInput && !showTextarea && !showTable && !showMetrics && !showValidation && !showPrototype && !showChoices ? (
        <div className="screenContractGrid" aria-label="Component contract">
          {screen.componentFamilies.map((family) => <div className="screenContractCard" key={family}><strong>{family}</strong><span>Required by the canonical screen-component map.</span></div>)}
        </div>
      ) : null}

      <div className="formActions"><ReviewButton variant="secondary">Back</ReviewButton><ReviewButton disabled={disabled}>Continue review</ReviewButton></div>
    </section>
  );
}

function ScreenContent({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  if (kind === "loading") return <ResearcherShell screen={screen}><StateNotice state={state} /><Skeleton /></ResearcherShell>;
  if (kind === "empty") return <ResearcherShell screen={screen}><StateNotice state={state} /><EmptyState title={`No eligible data for ${screen.name}`} /></ResearcherShell>;

  return (
    <ResearcherShell screen={screen}>
      <div className="pageIntro"><div><span className="eyebrow">Researcher · {screen.id}</span><h1>{screen.name}</h1><p>High-fidelity review mapped to the canonical screen inventory and selected state.</p></div><span className="versionPill">Draft v3</span></div>
      <StateNotice state={state} />
      {screen.id === "S09" ? <BuildWorkspaceSpecimen kind={kind} /> : null}
      {screen.id === "S25" ? <section className="panel"><h2>Heatmap</h2><p>Canonical-coordinate review surface with explicit unsupported/no-data handling.</p><Heatmap /></section> : null}
      {screen.id === "S30" ? <RetestComparison /> : null}
      {screen.id !== "S09" && screen.id !== "S25" && screen.id !== "S30" ? <ComponentDrivenSpecimen screen={screen} state={state} kind={kind} /> : null}
    </ResearcherShell>
  );
}

function ParticipantContent({ screen, state }: { screen: Screen; state: string }) {
  const kind = stateKind(state);
  const blocked = screen.id === "P10" || kind === "restricted" || kind === "unsupported" || kind === "error";
  return (
    <div className="participantFrame">
      <header className="participantHeader"><div className="participantBrand">UT Study</div><div className="participantProgress"><span>{screen.id} · Participant</span><div><i style={{ width: "66%" }} /></div></div></header>
      <main className="participantMain">
        <section className="participantCard centerCard">
          <span className="eyebrow">{screen.name}</span>
          <h1>{blocked ? "We can’t continue this step" : screen.name}</h1>
          <p>{blocked ? "This is handled as a technical/access condition, not a usability failure." : "Minimal participant UI keeps task instructions clear without revealing expected paths or success targets."}</p>
          <StateNotice state={state} />
          {kind === "loading" ? <Skeleton /> : <div className="formActions"><ReviewButton variant="secondary">Back</ReviewButton><ReviewButton disabled={blocked}>{screen.id === "P02" ? "Agree and start" : "Continue"}</ReviewButton></div>}
        </section>
      </main>
      <footer className="participantFooter">Anonymous session · behavioral tracking starts only after consent.</footer>
    </div>
  );
}

export default function HighFiReview() {
  const [selectedId, setSelectedId] = useState<string>(screens[0]?.id ?? "S01");
  const selectedScreen = useMemo(() => screens.find((screen) => screen.id === selectedId) ?? screens[0], [selectedId]);
  const [selectedState, setSelectedState] = useState<string>(selectedScreen.states[0]);
  const [viewport, setViewport] = useState<Viewport>("desktop");

  function chooseScreen(id: string) {
    const next = screens.find((screen) => screen.id === id) ?? screens[0];
    setSelectedId(next.id);
    setSelectedState(next.states[0]);
  }

  return (
    <main className="reviewPage">
      <header className="reviewHeader">
        <div><span className="eyebrow">Task 14 · High-fidelity QA</span><h1>48-screen / 170-state review</h1><p>Desktop and Mobile specimens use the Task 13 design-system baseline. This route is a review artifact with a no production-data claim.</p></div>
        <div className="coverageBadge" aria-label="Coverage"><strong>{screens.length}</strong><span>screens</span><strong>{totalStates}</strong><span>states</span></div>
      </header>

      <section className="reviewControls" aria-label="Review controls">
        <label><span>Screen</span><select value={selectedScreen.id} onChange={(event) => chooseScreen(event.target.value)}>{screens.map((screen) => <option key={screen.id} value={screen.id}>{screen.id} · {screen.name}</option>)}</select></label>
        <label><span>State</span><select value={selectedState} onChange={(event) => setSelectedState(event.target.value)}>{selectedScreen.states.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
        <div className="viewportToggle" role="group" aria-label="Viewport"><button type="button" className={viewport === "desktop" ? "isActive" : ""} onClick={() => setViewport("desktop")}>Desktop</button><button type="button" className={viewport === "mobile" ? "isActive" : ""} onClick={() => setViewport("mobile")}>Mobile</button></div>
        <div className="componentSummary"><span>Component families</span><strong title={selectedScreen.componentFamilies.join(", ")}>{selectedScreen.componentFamilies.join(" · ")}</strong></div>
      </section>

      <section id="review-stage" className={viewport === "mobile" ? "reviewStage reviewStage--mobile" : "reviewStage"} aria-label={`${selectedScreen.id} ${selectedScreen.name} ${selectedState} ${viewport}`}>
        <div className="deviceFrame">{selectedScreen.id.startsWith("P") ? <ParticipantContent screen={selectedScreen} state={selectedState} /> : <ScreenContent screen={selectedScreen} state={selectedState} />}</div>
      </section>
    </main>
  );
}
