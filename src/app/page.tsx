const modules = [
  {
    title: "Test Builder",
    description: "Import a prototype, define tasks, and configure success rules.",
  },
  {
    title: "Participant Runner",
    description: "Run focused usability sessions with minimal test UI interference.",
  },
  {
    title: "Tracking Engine",
    description: "Capture deterministic session, task, navigation, and interaction events.",
  },
  {
    title: "Analytics",
    description: "Measure completion, time, misclicks, paths, heatmaps, and drop-off.",
  },
  {
    title: "Findings & Retest",
    description: "Turn evidence into UX findings and compare results after design changes.",
  },
];

const reviewLinks = [
  { label: "Product UI", href: "/high-fi" },
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">UT Platform</div>
        <nav className="nav" aria-label="Primary navigation">
          <a className="navItem active" href="#overview" aria-current="page">Overview</a>
          {reviewLinks.map((item) => (
            <a className="navItem" href={item.href} key={item.href}>{item.label}</a>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Usability Testing & UX QA</p>
            <h1>Prototype → Evidence → Better UX</h1>
          </div>
          <a className="primaryButton" href="/high-fi">Open product UI</a>
        </header>

        <section id="overview" className="heroCard">
          <div>
            <span className="status">V1 Foundation</span>
            <h2>Build the core usability-testing loop first.</h2>
            <p>
              The first release focuses on Figma prototype testing, participant sessions,
              behavior tracking, analytics, findings, and retest comparison.
            </p>
          </div>
          <div className="metricGrid" aria-label="V1 status summary">
            <div className="metric"><strong>5</strong><span>Core modules</span></div>
            <div className="metric"><strong>48</strong><span>Canonical screens</span></div>
            <div className="metric"><strong>170</strong><span>QA states</span></div>
          </div>
        </section>

        <section id="modules" className="section">
          <div className="sectionHeading">
            <div>
              <p className="eyebrow">V1 Product Loop</p>
              <h2>Core modules</h2>
            </div>
          </div>

          <div className="cardGrid">
            {modules.map((module, index) => (
              <article className="moduleCard" key={module.title}>
                <span className="moduleIndex">0{index + 1}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
