import { mainNavigation } from "./labels";
export default function MainNavigation({ current, projectId }: { current?: string; projectId?: string }) {
  return <nav aria-label="เมนูหลัก" className="nav">{mainNavigation.map(item => <a className={`navItem${current === item.href ? " active" : ""}`} key={item.href} href={item.href} aria-current={current === item.href ? "page" : undefined}>{item.label}</a>)}{projectId ? <a className="navItem" href={`/projects/${encodeURIComponent(projectId)}/tests`}>แบบทดสอบในโปรเจกต์นี้</a> : null}</nav>;
}
