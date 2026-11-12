import { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Globe2,
  Library,
  CalendarDays,
  Inbox,
  Settings,
  Plus,
  Check,
  Clock3,
  AlertTriangle,
  CircleHelp,
  Sparkles,
  MonitorSmartphone,
  Menu,
  Wand2,
  Radio,
  Loader2,
  X,
  UserRound,
  KeyRound,
  ShieldCheck,
  ContactRound,
  Pencil,
  Trash2,
} from 'lucide-react';
import { api } from './api';
import { PRODUCT_VERSION_LABEL } from '@click/shared/version';
type Business = {
  id: string;
  name: string;
  industry: string;
  websiteUrl: string;
  description: string;
  location: string;
  primaryGoal: string;
  website?: { healthScore: number | null; lastCrawledAt: string | null };
};
type Ctx = {
  user: { id: string; name: string; email: string };
  businesses: Business[];
  selected: Business | null;
  select: (b: Business) => void;
  refresh: () => Promise<void>;
  updateUser: (user: { id: string; name: string; email: string }) => void;
};
const nav = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Businesses', icon: Building2, to: '/businesses' },
  { label: 'Website', icon: Globe2, to: '/website' },
  { label: 'Content', icon: Library, to: '/content' },
  { label: 'Calendar', icon: CalendarDays, to: '/calendar' },
  { label: 'Lead Opportunities', icon: Radio, to: '/leads' },
  { label: 'Contacts', icon: ContactRound, to: '/contacts' },
  { label: 'Approvals & Actions', icon: Inbox, to: '/approvals-actions' },
  { label: 'Account Settings', icon: Settings, to: '/settings' },
];
function Shell({ ctx }: { ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const initials = ctx.user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="app">
      <aside className={open ? 'open' : ''}>
        <div className="brand">
          <span>CM</span>
          <b>
            Click
            <br />
            Marketing Agent
          </b>
        </div>
        <button className="close" onClick={() => setOpen(false)}>
          <X />
        </button>
        <nav>
          {nav.map(({ label, icon: Icon, to }) => (
            <NavLink key={label} to={to} onClick={() => setOpen(false)}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="aside-foot">
          <div className="avatar">{initials}</div>
          <div>
            <b>{ctx.user.name}</b>
            <small>{ctx.user.email}</small>
          </div>
          <span className="app-version">{PRODUCT_VERSION_LABEL}</span>
        </div>
      </aside>
      <main>
        <header>
          <button className="hamb" onClick={() => setOpen(true)}>
            <Menu />
          </button>
          <div className="business-switch">
            <small>ACTIVE BUSINESS</small>
            <select
              value={ctx.selected?.id ?? ''}
              onChange={(e) => ctx.select(ctx.businesses.find((b) => b.id === e.target.value)!)}
            >
              {ctx.businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="top-actions">
            <Link className="avatar avatar-link" to="/settings" aria-label="Open account settings">
              {initials}
            </Link>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={ctx.selected ? <Dashboard ctx={ctx} /> : <EmptyWorkspace />}
          />
          <Route path="/businesses" element={<Businesses ctx={ctx} />} />
          <Route path="/website" element={<Seo ctx={ctx} />} />
          <Route path="/website-seo" element={<Navigate to="/website" replace />} />
          <Route path="/content" element={<Content ctx={ctx} />} />
          <Route path="/calendar" element={<Calendar ctx={ctx} />} />
          <Route path="/leads" element={<LeadOpportunities ctx={ctx} />} />
          <Route path="/contacts" element={<Contacts ctx={ctx} />} />
          <Route path="/approvals-actions" element={<InboxPage ctx={ctx} />} />
          <Route path="/marketing-inbox" element={<InboxPage ctx={ctx} />} />
          <Route path="/settings" element={<AccountSettings ctx={ctx} />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
function Dashboard({ ctx }: { ctx: Ctx }) {
  const [d, setD] = useState<any>();
  useEffect(() => {
    if (ctx.selected) api(`/api/businesses/${ctx.selected.id}/dashboard`).then(setD);
  }, [ctx.selected]);
  if (!d) return <Loading />;
  const m = d.metrics;
  return (
    <Page
      title={`Good morning — let’s grow ${d.business.name}.`}
      sub="Here’s what deserves your attention today."
      action="Create content"
      onAction={() => (document.location.href = '/content')}
    >
      <div className="hero">
        <div>
          <span className="eyebrow score-title">
            TECHNICAL AUDIT HEALTH <ScoreTooltip />
          </span>
          <div className="score">
            <span>Score</span>
            {m.healthScore ?? '—'}
            <small>/100</small>
          </div>
          <p>
            {m.healthBreakdown?.label ?? 'Available after the first audit'} · Based on measurable
            technical checks, not Google rankings.
          </p>
        </div>
        <button onClick={() => (document.location.href = '/website')}>View website report →</button>
      </div>
      <div className="metrics">
        <Metric icon={<Globe2 />} n={m.pages} label="Pages analysed" />
        <Metric icon={<AlertTriangle />} n={m.issues} label="SEO issues" tone="red" to="/website" />
        <Metric
          icon={<Library />}
          n={m.drafts}
          label="Drafts to review"
          tone="purple"
          to="/content"
        />
        <Metric icon={<Clock3 />} n={m.planned} label="Items planned" tone="gold" to="/calendar" />
      </div>
      <div className="grid">
        <section>
          <SectionTitle
            title="Priority actions"
            link="Open Approvals & Actions"
            to="/approvals-actions"
          />
          <div className="empty">
            <Check />
            <h3>You’re all caught up</h3>
            <p>New recommendations will appear here after an audit or generation request.</p>
          </div>
        </section>
        <section>
          <SectionTitle title="Recent content" link="View library" to="/content" />
          {d.recentContent.length ? (
            d.recentContent.map((c: any) => (
              <div className="row" key={c.id}>
                <span className="doc">Aa</span>
                <div>
                  <b>{c.title}</b>
                  <small>
                    {c.type.replaceAll('_', ' ')} · {c.status.replaceAll('_', ' ')}
                  </small>
                </div>
              </div>
            ))
          ) : (
            <div className="empty compact">
              <Library />
              <p>No content yet. Create your first draft.</p>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
const Metric = ({ icon, n, label, tone = 'blue', to }: any) => {
  const content = (
    <>
      <span>{icon}</span>
      <div>
        <strong>{n}</strong>
        <small>{label}</small>
      </div>
      {to && (
        <span className="metric-arrow" aria-hidden="true">
          →
        </span>
      )}
    </>
  );
  return to ? (
    <Link className={`metric metric-link ${tone}`} to={to} aria-label={`View ${label}`}>
      {content}
    </Link>
  ) : (
    <div className={`metric ${tone}`}>{content}</div>
  );
};
function Businesses({ ctx }: { ctx: Ctx }) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const createBusiness = async (event: any) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const business = await api<Business>('/api/businesses', {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      await ctx.refresh();
      ctx.select(business);
      setAdding(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page
      title="Businesses"
      sub="Manage the brands in your marketing workspace."
      action="Add business"
      onAction={() => setAdding(true)}
    >
      <div className="cards">
        {ctx.businesses.map((b) => (
          <article className="business-card" key={b.id} onClick={() => ctx.select(b)}>
            <span className="logo">{b.name.slice(0, 2).toUpperCase()}</span>
            <div>
              <h3>{b.name}</h3>
              <p>{b.description}</p>
              <small>
                {b.industry} · {b.location}
              </small>
            </div>
            {ctx.selected?.id === b.id && <span className="pill">Active</span>}
          </article>
        ))}
      </div>
      {!ctx.businesses.length && (
        <div className="empty">
          <Building2 />
          <h3>Create your first business</h3>
          <p>Add the website you want Click Marketing Agent to audit and improve.</p>
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={17} />
            Add business
          </button>
        </div>
      )}
      {adding && (
        <div className="modal-backdrop" onMouseDown={() => setAdding(false)}>
          <aside
            className="review-panel business-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-business-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="review-header">
              <div>
                <span className="eyebrow">NEW WORKSPACE</span>
                <small>Business details</small>
              </div>
              <button className="icon-button" onClick={() => setAdding(false)} aria-label="Close">
                <X />
              </button>
            </div>
            <form className="review-body" onSubmit={createBusiness}>
              <h2 id="new-business-title">Add a business</h2>
              <label className="editor-field">
                Business name
                <input name="name" minLength={2} required />
              </label>
              <label className="editor-field">
                Website URL
                <input
                  name="websiteUrl"
                  type="url"
                  placeholder="https://www.example.com"
                  required
                />
              </label>
              <label className="editor-field">
                What does the business do?
                <textarea name="description" rows={3} />
              </label>
              <div className="editor-options">
                <label className="editor-field">
                  Industry
                  <input name="industry" />
                </label>
                <label className="editor-field">
                  Location
                  <input name="location" />
                </label>
              </div>
              {error && <p className="settings-message error">{error}</p>}
              <div className="review-actions embedded">
                <button type="button" className="dismiss-button" onClick={() => setAdding(false)}>
                  Cancel
                </button>
                <button className="complete-button" disabled={saving}>
                  <Check size={17} />
                  {saving ? 'Creating…' : 'Create business'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </Page>
  );
}

function EmptyWorkspace() {
  return (
    <Page
      title="Welcome to Click Marketing Agent"
      sub="Your account is ready. Add your first business to begin."
    >
      <div className="empty welcome-empty">
        <Building2 />
        <h3>Start with a business website</h3>
        <p>Each business has its own audits, content library, calendar and settings.</p>
        <Link className="primary" to="/businesses">
          <Plus size={17} />
          Add your first business
        </Link>
      </div>
    </Page>
  );
}
function Seo({ ctx }: { ctx: Ctx }) {
  const [activeTab, setActiveTab] = useState<'SEO' | 'LAYOUT' | 'CONNECTIONS'>('SEO');
  const [data, setData] = useState<any>();
  const [automation, setAutomation] = useState<any>();
  const [visualAudits, setVisualAudits] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [visualBusy, setVisualBusy] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [inspectedIssue, setInspectedIssue] = useState<any>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixingAll, setFixingAll] = useState(false);
  const [fixResultMsg, setFixResultMsg] = useState<string | null>(null);

  const connected =
    automation?.connection?.status === 'CONNECTED' && automation?.connection?.target === 'STAGING';
  const openIssues =
    data?.issues?.filter((i: any) => i.status !== 'COMPLETED' && i.status !== 'DISMISSED') ?? [];
  const fixingIssue = data?.issues?.find((i: any) => i.id === fixingId);
  const isAutoFixing = fixingAll || Boolean(fixingId);

  const handleAutoFix = async (issue: any) => {
    setFixingId(issue.id);
    setFixResultMsg(null);
    try {
      await api(`/api/seo/${issue.id}/auto-fix`, {
        method: 'POST',
        body: '{}',
      });
      setFixResultMsg(`Successfully applied fix for "${issue.title}" to staging WordPress.`);
      await load();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setFixingId(null);
    }
  };

  const handleAutoFixAll = async () => {
    if (!ctx.selected) return;
    if (
      !confirm(
        `Generate and apply automated fixes for all ${openIssues.length} open SEO findings to the verified staging copy? The live website will not be changed.`,
      )
    )
      return;
    setFixingAll(true);
    setFixResultMsg(null);
    try {
      const result = await api<any>(`/api/businesses/${ctx.selected.id}/seo/auto-fix-all`, {
        method: 'POST',
        body: '{}',
      });
      setFixResultMsg(
        `Applied fixes to staging WordPress: ${result.fixed} completed, ${result.failed} failed.`,
      );
      await load();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setFixingAll(false);
    }
  };

  const load = async () => {
    if (!ctx.selected) return;
    const [seo, settings, visuals] = await Promise.all([
      api(`/api/businesses/${ctx.selected.id}/seo`),
      api(`/api/businesses/${ctx.selected.id}/automation`),
      api<any[]>(`/api/businesses/${ctx.selected.id}/visual-audits`),
    ]);
    setData(seo);
    setAutomation(settings);
    setVisualAudits(visuals);
  };
  const visualAudit = async () => {
    if (!ctx.selected) return;
    setVisualBusy(true);
    try {
      await api(`/api/businesses/${ctx.selected.id}/visual-audits`, { method: 'POST', body: '{}' });
      await load();
    } catch (error) {
      alert((error as Error).message);
      await load();
    } finally {
      setVisualBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, [ctx.selected]);
  useEffect(() => {
    if (
      data?.issues?.length &&
      !data.issues.some((issue: any) => issue.id === inspectedIssue?.id)
    ) {
      setInspectedIssue(data.issues[0]);
    }
  }, [data, inspectedIssue?.id]);
  const crawl = async () => {
    if (!ctx.selected) return;
    setBusy(true);
    try {
      await api(`/api/businesses/${ctx.selected.id}/crawls`, { method: 'POST', body: '{}' });
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const updateIssue = async (status: 'OPEN' | 'IN_PROGRESS' | 'DISMISSED' | 'COMPLETED') => {
    if (!selectedIssue) return;
    try {
      await api(`/api/seo/${selectedIssue.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSelectedIssue((issue: any) => ({ ...issue, status }));
      await load();
    } catch (error) {
      alert((error as Error).message);
    }
  };
  return (
    <Page
      title={`${ctx.selected?.name ?? 'Business'} website`}
      sub="Audit, improve and safely test changes from one connected workspace."
      action={
        activeTab === 'SEO'
          ? busy
            ? 'Crawling website…'
            : 'Run SEO audit'
          : activeTab === 'LAYOUT'
            ? visualBusy
              ? 'Checking layouts…'
              : 'Run layout audit'
            : undefined
      }
      onAction={activeTab === 'SEO' ? crawl : activeTab === 'LAYOUT' ? visualAudit : undefined}
      actionDisabled={
        activeTab === 'SEO'
          ? busy || isAutoFixing
          : activeTab === 'LAYOUT'
            ? visualBusy || !data?.currentCrawl
            : false
      }
      actionIcon={
        busy || visualBusy ? (
          <Loader2 size={17} className="animate-spin" />
        ) : activeTab === 'LAYOUT' ? (
          <MonitorSmartphone size={17} />
        ) : undefined
      }
    >
      <div className="workspace-context" aria-label="Current location">
        <span>{ctx.selected?.name}</span>
        <b>›</b>
        <span>Website</span>
        <b>›</b>
        <strong>
          {activeTab === 'SEO'
            ? 'SEO audit'
            : activeTab === 'LAYOUT'
              ? 'Layout audit'
              : 'Connections'}
        </strong>
      </div>
      <nav className="workspace-tabs" aria-label="Website sections">
        <button className={activeTab === 'SEO' ? 'active' : ''} onClick={() => setActiveTab('SEO')}>
          <Globe2 size={17} />
          <span>SEO audit</span>
          <small>{data?.issues?.length ?? 0}</small>
        </button>
        <button
          className={activeTab === 'LAYOUT' ? 'active' : ''}
          onClick={() => setActiveTab('LAYOUT')}
        >
          <MonitorSmartphone size={17} />
          <span>Layout audit</span>
          <small>{visualAudits[0]?.result?.findings?.length ?? 0}</small>
        </button>
        <button
          className={activeTab === 'CONNECTIONS' ? 'active' : ''}
          onClick={() => setActiveTab('CONNECTIONS')}
        >
          <Radio size={17} />
          <span>Connections & fixes</span>
          <small className={connected ? 'tab-status connected' : 'tab-status'}>
            {connected ? 'Connected' : 'Setup'}
          </small>
        </button>
      </nav>
      {busy && <CrawlProgressBanner websiteUrl={ctx.selected?.websiteUrl} />}
      {isAutoFixing && (
        <AutoFixProgressBanner
          isFixAll={fixingAll}
          issue={fixingIssue}
          totalCount={openIssues.length}
          websiteUrl={automation?.connection?.baseUrl}
        />
      )}
      {activeTab === 'SEO' && (
        <>
          <div className="seo-head">
            <div className="ring">
              {data?.healthScore ?? '—'}
              <small>/100</small>
            </div>
            <div>
              <span className="eyebrow score-title">
                TECHNICAL AUDIT HEALTH <ScoreTooltip />
              </span>
              <h2>{data?.healthBreakdown?.label ?? 'Not audited yet'}</h2>
              <p>
                {data?.issues?.length ?? 0} findings across{' '}
                {data?.healthBreakdown?.pagesAudited ?? 0} pages. This is not a Google ranking
                score.
              </p>
            </div>
          </div>
          {data?.healthBreakdown && (
            <details className="score-breakdown">
              <summary>How this score was calculated</summary>
              <p>
                Starts at 100. Each unique technical check receives a severity-weighted deduction.
                Repeated instances have diminishing impact based on the proportion of audited pages
                affected.
              </p>
              <div className="breakdown-grid">
                {data.healthBreakdown.bySeverity
                  .filter((row: any) => row.findings > 0)
                  .map((row: any) => (
                    <div key={row.severity}>
                      <strong>{row.severity}</strong>
                      <span>
                        {row.findings} findings · {row.groupedChecks} unique checks
                      </span>
                      <b>−{row.pointsDeducted} points</b>
                    </div>
                  ))}
              </div>
              <small>
                {data.healthBreakdown.uniqueChecks} unique checks produced a total deduction of{' '}
                {data.healthBreakdown.penalty} points.
              </small>
            </details>
          )}
          {data?.currentCrawl && (
            <>
              <div className="audit-comparison" aria-label="Latest audit comparison">
                <div>
                  <strong>{data.comparison.current}</strong>
                  <small>Current findings</small>
                </div>
                <div className="positive">
                  <strong>{data.comparison.fixed}</strong>
                  <small>Fixed since last audit</small>
                </div>
                <div>
                  <strong>{data.comparison.stillPresent}</strong>
                  <small>Still present</small>
                </div>
                <div className={data.comparison.new ? 'negative' : ''}>
                  <strong>{data.comparison.new}</strong>
                  <small>New findings</small>
                </div>
              </div>
              <details className="audit-history">
                <summary>View audit history ({data.history.length})</summary>
                {data.history.map((audit: any) => (
                  <div key={audit.id}>
                    <span>{new Date(audit.completedAt).toLocaleString()}</span>
                    <span>
                      {audit.pages} pages · {audit.issues} findings
                    </span>
                  </div>
                ))}
              </details>
            </>
          )}
        </>
      )}
      {activeTab === 'LAYOUT' && (
        <VisualAuditPanel
          audits={visualAudits}
          busy={visualBusy}
          onRun={visualAudit}
          hasCrawl={Boolean(data?.currentCrawl)}
        />
      )}
      {activeTab === 'CONNECTIONS' && automation && ctx.selected && (
        <AutomationPanel businessId={ctx.selected.id} value={automation} onChange={setAutomation} />
      )}
      {activeTab === 'SEO' && (
        <section className="seo-findings-section">
          <div className="seo-findings-header">
            <div>
              <h3>SEO findings</h3>
              <p className="seo-findings-status">
                {connected ? (
                  <span className="auto-fix-connected-badge">
                    <Check size={13} /> Staging WordPress connected for test fixes
                  </span>
                ) : (
                  <span className="auto-fix-disconnected-badge">
                    <AlertTriangle size={13} /> Connect staging WordPress to enable test fixes
                  </span>
                )}
              </p>
            </div>
            <div className="seo-findings-actions">
              <button
                className="primary auto-fix-all-btn"
                onClick={handleAutoFixAll}
                disabled={fixingAll || !connected || openIssues.length === 0}
                title={
                  connected
                    ? `Apply all ${openIssues.length} supported fixes to staging WordPress`
                    : 'Connect staging WordPress first'
                }
              >
                <Wand2 size={15} />
                {fixingAll ? 'Fixing all findings…' : `Auto-fix All (${openIssues.length})`}
              </button>
            </div>
          </div>
          {isAutoFixing && (
            <AutoFixProgressBanner
              isFixAll={fixingAll}
              issue={fixingIssue}
              totalCount={openIssues.length}
              websiteUrl={automation?.connection?.baseUrl}
            />
          )}
          {fixResultMsg && (
            <div className="auto-fix-result-banner">
              <span>{fixResultMsg}</span>
              <button
                className="icon-button"
                onClick={() => setFixResultMsg(null)}
                aria-label="Dismiss message"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {data?.issues?.length ? (
            <div className="audit-workbench seo-workbench">
              <div className="audit-list-pane">
                <div className="pane-heading">
                  <div>
                    <span className="eyebrow">FINDINGS</span>
                    <h3>{data.issues.length} SEO issues</h3>
                  </div>
                  <small>Select an issue to inspect it</small>
                </div>
                {data.issues.map((i: any) => (
                  <div
                    className={`issue ${inspectedIssue?.id === i.id ? 'selected' : ''}`}
                    key={i.id}
                    onClick={() => setInspectedIssue(i)}
                  >
                    <span className={`severity ${i.severity.toLowerCase()}`}>{i.severity}</span>
                    <div>
                      <b>{i.title}</b>
                      <small>
                        {i.page?.url} · {i.status.replaceAll('_', ' ')}
                      </small>
                    </div>
                    <div className="issue-actions">
                      {i.status === 'COMPLETED' ? (
                        <span className="status-fixed-pill">
                          <Check size={13} /> Fixed
                        </span>
                      ) : (
                        <button
                          className="auto-fix-single-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleAutoFix(i);
                          }}
                          disabled={fixingId === i.id || fixingAll || !connected}
                          title={
                            connected
                              ? 'Generate and apply this fix to staging WordPress'
                              : 'Connect staging WordPress first'
                          }
                        >
                          <Wand2 size={13} />
                          {fixingId === i.id ? 'Fixing…' : 'Auto-fix'}
                        </button>
                      )}
                      <button
                        className="review-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedIssue(i);
                        }}
                      >
                        Full review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="audit-detail-pane">
                {inspectedIssue ? (
                  <>
                    <div className="detail-kicker">
                      <span className={`severity ${inspectedIssue.severity.toLowerCase()}`}>
                        {inspectedIssue.severity}
                      </span>
                      <span>{inspectedIssue.category}</span>
                    </div>
                    <h2>{inspectedIssue.title}</h2>
                    <a
                      className="page-link"
                      href={inspectedIssue.page?.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Globe2 size={15} />
                      {inspectedIssue.page?.url}
                    </a>
                    <div className="detail-block">
                      <span>WHY IT MATTERS</span>
                      <p>{inspectedIssue.explanation}</p>
                    </div>
                    <div className="detail-block recommendation">
                      <span>HOW TO FIX IT</span>
                      <p>{inspectedIssue.suggestedAction}</p>
                    </div>
                    <button
                      className="primary detail-review-button"
                      onClick={() => setSelectedIssue(inspectedIssue)}
                    >
                      Review instructions & suggested content
                    </button>
                    <p className="detail-footnote">
                      Review opens the exact field, current value and AI-assisted content tools.
                    </p>
                  </>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="empty">
              <Globe2 />
              <h3>No audit results yet</h3>
              <p>Run a website audit to discover pages and actionable SEO improvements.</p>
            </div>
          )}
        </section>
      )}
      {selectedIssue && (
        <SeoReview
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onStatus={updateIssue}
        />
      )}
    </Page>
  );
}

function CrawlProgressBanner({ websiteUrl }: { websiteUrl?: string | undefined }) {
  const [seconds, setSeconds] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const stages = [
    {
      label: 'Connecting to website & purging cache…',
      detail: 'Contacting server and purging WordPress/edge cache rules',
    },
    {
      label: 'Discovering internal pages & crawling links…',
      detail: 'Inspecting same-domain routes and following navigations',
    },
    {
      label: 'Extracting HTML, headings, titles & meta…',
      detail: 'Parsing H1/H2 tags, descriptions, open graph data, and alt text',
    },
    {
      label: 'Auditing SEO issues & calculating health score…',
      detail: 'Running deterministic rules and compiling recommendations',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % stages.length);
    }, 3200);
    return () => clearInterval(stageTimer);
  }, [stages.length]);

  const current = stages[stageIndex] ?? stages[0]!;

  return (
    <div className="crawl-banner" role="status" aria-live="polite">
      <div className="crawl-banner-left">
        <div className="crawl-radar">
          <div className="crawl-radar-pulse" />
          <Globe2 size={22} className="crawl-globe" />
        </div>
      </div>
      <div className="crawl-banner-main">
        <div className="crawl-banner-header">
          <div className="crawl-banner-title">
            <Radio size={15} className="crawl-radio-icon" />
            <strong>Auditing Website in Progress</strong>
            <span className="crawl-timer-badge">{seconds}s elapsed</span>
          </div>
          <span className="crawl-status-badge">Live Crawl Active</span>
        </div>
        <p className="crawl-stage-label">{current.label}</p>
        <p className="crawl-stage-detail">
          {current.detail} · Target: <code>{websiteUrl || 'Selected Website'}</code>
        </p>
        <div className="crawl-progress-track">
          <div className="crawl-progress-fill" />
        </div>
      </div>
    </div>
  );
}

function AutoFixProgressBanner({
  isFixAll,
  issue,
  totalCount,
  websiteUrl,
}: {
  isFixAll: boolean;
  issue?: any;
  totalCount?: number;
  websiteUrl?: string;
}) {
  const [seconds, setSeconds] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  const singleStages = [
    {
      label: 'Analyzing issue & generating AI SEO solution…',
      detail: 'Evaluating business profile and generating optimized replacement content',
    },
    {
      label: 'Connecting to WordPress REST API…',
      detail: 'Authenticating with Application Password & locating target page',
    },
    {
      label: 'Publishing staging metadata & content updates…',
      detail: 'Writing approved fields to the verified staging copy only',
    },
    {
      label: 'Purging server & page caches…',
      detail: 'Flushing LiteSpeed, WP Rocket and edge caches on WordPress',
    },
    {
      label: 'Verifying change & updating workflow status…',
      detail: 'Recording change logs and marking finding resolved',
    },
  ];

  const bulkStages = [
    {
      label: `Sequencing ${totalCount ?? 0} open SEO findings…`,
      detail: 'Preparing automated queue for batch resolution',
    },
    {
      label: 'Generating AI content & metadata replacements…',
      detail: 'Creating tailored titles, headings and meta descriptions for affected pages',
    },
    {
      label: 'Publishing batch updates to staging WordPress…',
      detail: 'Applying authorized changes to the verified staging copy only',
    },
    {
      label: 'Purging server & caching layers…',
      detail: 'Triggering cache clear across WordPress caching plugins',
    },
    {
      label: 'Recording audit change log & finalizing fixes…',
      detail: 'Marking completed items and updating SEO health records',
    },
  ];

  const stages = isFixAll ? bulkStages : singleStages;

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % stages.length);
    }, 2800);
    return () => clearInterval(stageTimer);
  }, [stages.length]);

  const current = stages[stageIndex] ?? stages[0]!;

  return (
    <div className="autofix-banner" role="status" aria-live="polite">
      <div className="autofix-banner-left">
        <div className="autofix-radar">
          <div className="autofix-radar-pulse" />
          <Wand2 size={22} className="autofix-icon" />
        </div>
      </div>
      <div className="autofix-banner-main">
        <div className="autofix-banner-header">
          <div className="autofix-banner-title">
            <Sparkles size={16} className="autofix-sparkle-icon" />
            <strong>
              {isFixAll
                ? `Automated Bulk Fix in Progress (${totalCount ?? 0} Findings)`
                : `Automated Fix in Progress: ${issue?.title ?? 'SEO Finding'}`}
            </strong>
            <span className="autofix-timer-badge">{seconds}s elapsed</span>
          </div>
          <span className="autofix-status-badge">
            <Wand2 size={12} /> Staging Auto-Fix Active
          </span>
        </div>
        <p className="autofix-stage-label">{current.label}</p>
        <p className="autofix-stage-detail">
          {current.detail} · Target:{' '}
          <code>{issue?.page?.url || websiteUrl || 'WordPress Site'}</code>
        </p>
        <div className="autofix-progress-track">
          <div className="autofix-progress-fill" />
        </div>
      </div>
    </div>
  );
}

function VisualAuditPanel({ audits, busy, onRun, hasCrawl }: any) {
  const latest = audits.find((audit: any) => audit.status === 'COMPLETED') ?? audits[0];
  const result = latest?.result;
  const [selectedFinding, setSelectedFinding] = useState<any>(null);
  useEffect(() => {
    setSelectedFinding(result?.findings?.[0] ?? null);
  }, [latest?.id]);
  return (
    <section className="visual-audit-panel">
      <div className="visual-audit-heading">
        <div>
          <span className="eyebrow">AI LAYOUT REVIEW</span>
          <h2>Visual consistency</h2>
          <p>
            Compares desktop and mobile screenshots across pages for inconsistent headers,
            typography, spacing, colours, buttons, forms, imagery and footers.
          </p>
        </div>
        <button className="primary" onClick={onRun} disabled={busy || !hasCrawl}>
          <MonitorSmartphone size={17} />{' '}
          {busy ? 'Capturing and comparing pages…' : result ? 'Run again' : 'Run AI layout check'}
        </button>
      </div>
      <p className="visual-audit-note">
        <CircleHelp size={15} /> Run the normal website audit first. Each layout check captures up
        to 10 discovered pages in desktop and mobile sizes and uses OpenAI API credits. It does not
        change the website.
      </p>
      {!hasCrawl && (
        <div className="visual-empty">
          Run a website audit to discover pages before checking their layout.
        </div>
      )}
      {latest?.status === 'FAILED' && (
        <div className="connector-error">The latest visual audit failed: {latest.error}</div>
      )}
      {result && (
        <>
          <div className="visual-score-row">
            <div className="visual-score">
              <strong>{result.score}</strong>
              <span>/100</span>
              <small>Visual consistency score</small>
            </div>
            <div>
              <h3>{result.summary}</h3>
              <small>
                {latest.pagesAudited} pages · desktop and mobile ·{' '}
                {new Date(latest.completedAt).toLocaleString()}
              </small>
            </div>
          </div>
          {result.consistentPatterns?.length > 0 && (
            <details className="visual-strengths">
              <summary>What is consistent ({result.consistentPatterns.length})</summary>
              <ul>
                {result.consistentPatterns.map((pattern: string) => (
                  <li key={pattern}>{pattern}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="audit-workbench visual-findings">
            <div className="audit-list-pane">
              <div className="pane-heading">
                <div>
                  <span className="eyebrow">FINDINGS</span>
                  <h3>{result.findings.length} layout issues</h3>
                </div>
                <small>Select an issue to inspect it</small>
              </div>
              {result.findings.length ? (
                result.findings.map((finding: any, index: number) => (
                  <button
                    className={`audit-list-item ${selectedFinding === finding ? 'selected' : ''}`}
                    onClick={() => setSelectedFinding(finding)}
                    key={`${finding.url}-${finding.category}-${index}`}
                  >
                    <span className={`severity ${finding.severity.toLowerCase()}`}>
                      {finding.severity}
                    </span>
                    <span>
                      <strong>{finding.title}</strong>
                      <small>
                        {finding.category.replaceAll('_', ' ')} · {finding.viewport}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <div className="visual-empty">
                  No material visual inconsistencies were identified in the captured pages.
                </div>
              )}
            </div>
            <div className="audit-detail-pane">
              {selectedFinding ? (
                <>
                  <div className="detail-kicker">
                    <span className={`severity ${selectedFinding.severity.toLowerCase()}`}>
                      {selectedFinding.severity}
                    </span>
                    <span className="visual-viewport">{selectedFinding.viewport}</span>
                  </div>
                  <h2>{selectedFinding.title}</h2>
                  <a
                    className="page-link"
                    href={selectedFinding.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Globe2 size={15} />
                    {selectedFinding.url}
                  </a>
                  <div className="detail-block">
                    <span>WHAT THE AI OBSERVED</span>
                    <p>{selectedFinding.evidence}</p>
                  </div>
                  <div className="detail-block recommendation">
                    <span>RECOMMENDED CORRECTION</span>
                    <p>{selectedFinding.recommendation}</p>
                  </div>
                  <p className="detail-footnote">
                    The layout audit is advisory and does not change the website.
                  </p>
                </>
              ) : (
                <div className="detail-placeholder">
                  <MonitorSmartphone />
                  <h3>Select a finding</h3>
                  <p>Its evidence and recommended correction will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function ScoreTooltip() {
  return (
    <span
      className="score-tooltip"
      tabIndex={0}
      aria-label="About the technical audit health score"
    >
      <CircleHelp size={15} />
      <span role="tooltip">
        An internal 0–100 measure of crawl-detectable technical health. It groups repeated checks
        and normalizes their impact by pages audited. It does not measure Google rankings, traffic,
        conversions or overall business quality.
      </span>
    </span>
  );
}

function AutomationPanel({ businessId, value, onChange }: any) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const [wpUsername, setWpUsername] = useState('');
  const [wpPassword, setWpPassword] = useState('');
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [stagingUrl, setStagingUrl] = useState(
    value.connection?.stagingBaseUrl ?? 'http://localhost/wordpress',
  );
  useEffect(() => {
    setDraft(value);
    setStagingUrl(value.connection?.stagingBaseUrl ?? 'http://localhost/wordpress');
  }, [value]);
  const connected = draft.connection?.status === 'CONNECTED';
  const rules = draft.rules ?? {};
  const updateRule = (key: string, checked: boolean) => {
    setSaved(false);
    setDraft({ ...draft, rules: { ...rules, [key]: checked } });
  };
  const save = async () => {
    try {
      const result = await api(`/api/businesses/${businessId}/automation`, {
        method: 'PUT',
        body: JSON.stringify({
          mode: draft.mode,
          rules: draft.rules,
          provider: draft.connection?.provider,
        }),
      });
      setDraft(result);
      onChange(result);
      setSaved(true);
    } catch (error) {
      alert((error as Error).message);
    }
  };
  const connectWordPress = async () => {
    setConnectionBusy(true);
    setConnectionError('');
    try {
      const connection = await api(`/api/businesses/${businessId}/connectors/wordpress/connect`, {
        method: 'POST',
        body: JSON.stringify({
          username: wpUsername,
          applicationPassword: wpPassword,
          target: 'STAGING',
          baseUrl: stagingUrl,
        }),
      });
      const next = { ...draft, connection };
      setDraft(next);
      onChange(next);
      setWpPassword('');
    } catch (error) {
      setConnectionError((error as Error).message);
    } finally {
      setConnectionBusy(false);
    }
  };
  const testWordPress = async () => {
    setConnectionBusy(true);
    setConnectionError('');
    try {
      const connection = await api(`/api/businesses/${businessId}/connectors/wordpress/test`, {
        method: 'POST',
        body: '{}',
      });
      const next = { ...draft, connection };
      setDraft(next);
      onChange(next);
    } catch (error) {
      setConnectionError((error as Error).message);
    } finally {
      setConnectionBusy(false);
    }
  };
  const disconnect = async () => {
    if (
      !confirm(
        'Disconnect this website and remove its saved access token from Click Marketing Agent?',
      )
    )
      return;
    setConnectionBusy(true);
    setConnectionError('');
    try {
      await api(`/api/businesses/${businessId}/connector`, { method: 'DELETE' });
      const connection = {
        provider: 'NONE',
        status: 'DISCONNECTED',
        username: null,
        verifiedAt: null,
      };
      const next = {
        ...draft,
        mode: draft.mode === 'AUTO_LOW_RISK' ? 'APPROVAL_REQUIRED' : draft.mode,
        connection,
      };
      setDraft(next);
      onChange(next);
      setWpUsername('');
      setWpPassword('');
    } catch (error) {
      setConnectionError((error as Error).message);
    } finally {
      setConnectionBusy(false);
    }
  };
  const options: Array<[string, string, string]> = [
    [
      'RECOMMEND_ONLY',
      'Recommend only',
      'Show instructions and suggested content; never change the website.',
    ],
    [
      'APPROVAL_REQUIRED',
      'Require approval',
      'Prepare each change and wait for a person to approve it.',
    ],
    [
      'AUTO_LOW_RISK',
      'Auto-fix selected issues',
      'Apply only the enabled low-risk changes through a verified connector.',
    ],
  ];
  const ruleOptions: Array<[string, string]> = [
    ['seoTitles', 'SEO titles'],
    ['metaDescriptions', 'Meta descriptions'],
    ['imageAltText', 'Image alternative text'],
    ['headings', 'Page headings'],
    ['internalLinks', 'Internal links'],
    ['pageCopy', 'Visible page copy'],
  ];
  return (
    <section className="automation-panel">
      <div className="automation-heading">
        <div>
          <span className="eyebrow">CONTROLLED WEBSITE CHANGES</span>
          <h2>How should fixes be handled?</h2>
        </div>
        <span className={`connection-state ${connected ? 'connected' : ''}`}>
          {connected ? 'Site connected' : 'No site connection'}
        </span>
      </div>
      <div className="mode-options">
        {options.map(([mode, title, description]) => (
          <label className={draft.mode === mode ? 'selected' : ''} key={mode}>
            <input
              type="radio"
              name="automation-mode"
              value={mode}
              checked={draft.mode === mode}
              disabled={mode === 'AUTO_LOW_RISK' && !connected}
              onChange={() => {
                setSaved(false);
                setDraft({ ...draft, mode });
              }}
            />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="automation-settings">
        <label>
          Website platform
          <select
            value={draft.connection?.provider ?? 'NONE'}
            onChange={(event) => {
              setSaved(false);
              setDraft({
                ...draft,
                connection: { ...draft.connection, provider: event.target.value },
              });
            }}
          >
            <option value="NONE">Not selected</option>
            <option value="WORDPRESS">WordPress</option>
            <option value="SHOPIFY">Shopify</option>
            <option value="CUSTOM">Custom / API</option>
          </select>
        </label>
        <div className="rule-list">
          <strong>Allowed change types</strong>
          {ruleOptions.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={Boolean(rules[key])}
                onChange={(event) => updateRule(key, event.target.checked)}
              />{' '}
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="automation-notice">
        <AlertTriangle size={18} />
        <span>
          {connected ? (
            <>
              <strong>Staging WordPress access verified.</strong> Automated changes are restricted
              to <code>{draft.connection.baseUrl}</code>. The live website remains read-only.
            </>
          ) : (
            <>
              <strong>No verified staging connection.</strong> Connect the XAMPP WordPress copy
              below. Live-site automation is disabled.
            </>
          )}
        </span>
      </div>
      {(draft.connection?.provider === 'WORDPRESS' || connected) && (
        <div className="wordpress-connect">
          <div className="connector-title">
            <div>
              <strong>WordPress staging connection</strong>
              <small>
                Uses the standard WordPress REST API and a dedicated Application Password. The live
                hostname cannot be used here.
              </small>
            </div>
            {connected && <span className="connection-state connected">Verified</span>}
          </div>
          {connected ? (
            <>
              <dl className="connection-details">
                <div>
                  <dt>WordPress user</dt>
                  <dd>{draft.connection.username}</dd>
                </div>
                <div>
                  <dt>Last verified</dt>
                  <dd>
                    {draft.connection.verifiedAt
                      ? new Date(draft.connection.verifiedAt).toLocaleString()
                      : 'Just now'}
                  </dd>
                </div>
                <div>
                  <dt>Execution target</dt>
                  <dd>Staging only</dd>
                </div>
                <div>
                  <dt>Staging URL</dt>
                  <dd>{draft.connection.baseUrl}</dd>
                </div>
              </dl>
              <div className="connector-actions">
                <button type="button" onClick={testWordPress} disabled={connectionBusy}>
                  {connectionBusy ? 'Testing…' : 'Test connection'}
                </button>
                <button
                  type="button"
                  className="danger-link"
                  onClick={disconnect}
                  disabled={connectionBusy}
                >
                  Disconnect and remove token
                </button>
              </div>
            </>
          ) : (
            <>
              <ol className="wp-setup-steps">
                <li>Sign in to your WordPress admin area in a separate browser tab.</li>
                <li>
                  Open <strong>Users → Profile</strong> (or <strong>Users → Your Profile</strong>).
                  Copy the exact value beside <strong>Username</strong>; do not use the display name
                  and preferably do not use the email address.
                </li>
                <li>
                  On the same page, find <strong>Application Passwords</strong>.
                </li>
                <li>
                  Enter <strong>Click Marketing Agent</strong> as the new application name, then
                  select <strong>Add New Application Password</strong>.
                </li>
                <li>
                  Copy the generated password immediately and paste it below. WordPress shows it
                  only once. This is not your normal sign-in password.
                </li>
              </ol>
              <div className="connector-fields">
                <label>
                  Local staging URL
                  <input
                    type="url"
                    value={stagingUrl}
                    onChange={(e) => setStagingUrl(e.target.value)}
                    placeholder="http://localhost/wordpress"
                  />
                </label>
                <label>
                  WordPress login username
                  <input
                    autoComplete="username"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="Exact Username from Users → Profile"
                  />
                </label>
                <label>
                  Application Password
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={wpPassword}
                    onChange={(e) => setWpPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  />
                </label>
              </div>
              <button
                type="button"
                className="connect-button"
                onClick={connectWordPress}
                disabled={
                  connectionBusy ||
                  !stagingUrl.trim() ||
                  !wpUsername.trim() ||
                  wpPassword.trim().length < 8
                }
              >
                {connectionBusy ? 'Verifying…' : 'Connect and verify staging WordPress'}
              </button>
            </>
          )}
          {connectionError && (
            <p className="connector-error" role="alert">
              {connectionError}
            </p>
          )}
        </div>
      )}
      <details className="connection-guide">
        <summary>
          <CircleHelp size={18} /> How will I connect my website?
        </summary>
        <div>
          <p>
            When the connector for your platform is released, the connection process will work like
            this:
          </p>
          <ol>
            <li>
              Select your website platform and choose <strong>Connect website</strong>.
            </li>
            <li>
              You will be sent to WordPress, Shopify, or the supported provider’s own secure sign-in
              page.
            </li>
            <li>
              Sign in there and approve only the permissions needed to read and update supported
              website fields.
            </li>
            <li>
              You will return here and see <strong>Site connected</strong> before any approved or
              automatic change can be published.
            </li>
            <li>
              You can disconnect the site here or revoke access from the website platform at any
              time.
            </li>
          </ol>
          <p>
            <strong>Important:</strong> do not paste your normal website administrator password into
            Click Marketing Agent. WordPress uses a separate Application Password, which is
            encrypted at rest and can be revoked without changing your normal password.
          </p>
          <p className="connection-guide-status">
            Automated execution is currently restricted to a separately configured staging website.
            The live website remains available for audits and comparisons but cannot receive
            automated writes.
          </p>
        </div>
      </details>
      <button className="automation-save" onClick={save}>
        {saved ? 'Settings saved' : 'Save automation settings'}
      </button>
    </section>
  );
}

function SeoReview({ issue, onClose, onStatus }: any) {
  const [suggestion, setSuggestion] = useState<any>(issue.suggestion);
  const [proposedValue, setProposedValue] = useState(issue.suggestion?.proposedValue ?? '');
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  const generateSuggestion = async () => {
    setGenerating(true);
    setSaved(false);
    try {
      const result = await api<any>(`/api/seo/${issue.id}/suggestion`, {
        method: 'POST',
        body: '{}',
      });
      setSuggestion(result);
      setProposedValue(result.proposedValue);
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setGenerating(false);
    }
  };
  const saveSuggestion = async () => {
    if (!suggestion) return;
    try {
      const result = await api<any>(`/api/recommendations/${suggestion.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ proposedValue }),
      });
      setSuggestion(result);
      setSaved(true);
    } catch (error) {
      alert((error as Error).message);
    }
  };
  const prepareChange = async () => {
    if (!suggestion || !proposedValue.trim()) return;
    try {
      await api(`/api/seo/${issue.id}/prepare-change`, {
        method: 'POST',
        body: JSON.stringify({
          recommendationId: suggestion.id,
          targetField: suggestion.targetField,
          proposedValue,
        }),
      });
      setPrepared(true);
    } catch (error) {
      alert((error as Error).message);
    }
  };
  const applyToWordPress = async () => {
    setApplying(true);
    try {
      if (suggestion && proposedValue.trim()) {
        await api(`/api/recommendations/${suggestion.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ proposedValue }),
        });
      }
      await api(`/api/seo/${issue.id}/auto-fix`, {
        method: 'POST',
        body: '{}',
      });
      setApplied(true);
      onStatus('COMPLETED');
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setApplying(false);
    }
  };
  const page = issue.page;
  const currentValue = (() => {
    const title = issue.title.toLowerCase();
    if (title.includes('meta description')) return page?.metaDescription || 'No meta description';
    if (title.includes('page title') || title.includes('title'))
      return page?.title || 'No page title';
    if (title.includes('h1')) {
      const headings = Array.isArray(page?.h1) ? page.h1 : [];
      return headings.length ? headings.join(' · ') : 'No H1 heading';
    }
    if (title.includes('section heading')) {
      const headings = Array.isArray(page?.h2) ? page.h2 : [];
      return headings.length ? headings.join(' · ') : 'No H2 section headings';
    }
    if (title.includes('alternative text')) {
      const images = Array.isArray(page?.images) ? page.images : [];
      const missing = images.filter((image: any) => !image.alt?.trim()).length;
      return `${missing} of ${images.length} images are missing alternative text`;
    }
    if (title.includes('copy')) return `${page?.wordCount ?? 0} words detected`;
    return 'Review the affected page using the details below.';
  })();
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <aside
        className="review-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="seo-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="review-header">
          <div>
            <span className={`severity ${issue.severity.toLowerCase()}`}>{issue.severity}</span>
            <small>{issue.category}</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close review">
            <X />
          </button>
        </div>
        <div className="review-body">
          <h2 id="seo-review-title">{issue.title}</h2>
          <a className="page-link" href={page?.url} target="_blank" rel="noreferrer">
            <Globe2 size={16} /> {page?.url}
          </a>
          <div className="review-block">
            <span className="review-label">WHAT WE FOUND</span>
            <div className="current-value">{currentValue}</div>
          </div>
          <div className="review-block">
            <span className="review-label">WHY IT MATTERS</span>
            <p>{issue.explanation}</p>
          </div>
          <div className="review-block fix-block">
            <span className="review-label">HOW TO FIX IT</span>
            <p>{issue.suggestedAction}</p>
          </div>
          <div className="suggestion-block">
            <div className="suggestion-heading">
              <div>
                <span className="review-label">SUGGESTED ACTUAL CONTENT</span>
                <h3>{suggestion?.title ?? 'Generate a ready-to-review suggestion'}</h3>
              </div>
              <button onClick={generateSuggestion} disabled={generating}>
                <Sparkles size={16} />
                {generating ? 'Generating…' : suggestion ? 'Regenerate' : 'Generate suggestion'}
              </button>
            </div>
            {suggestion ? (
              <>
                <textarea
                  value={proposedValue}
                  onChange={(event) => {
                    setProposedValue(event.target.value);
                    setSaved(false);
                  }}
                  aria-label="Proposed SEO content"
                  rows={Math.min(12, Math.max(3, proposedValue.split('\n').length + 1))}
                />
                <p>{suggestion.description}</p>
                <div className="suggestion-footer">
                  <small>Review and edit this content before applying it to the website.</small>
                  <div className="suggestion-buttons">
                    <button onClick={saveSuggestion}>{saved ? 'Saved' : 'Save suggestion'}</button>
                    <button className="prepare-button" onClick={prepareChange}>
                      {prepared ? 'Change prepared' : 'Prepare website change'}
                    </button>
                    <button
                      className="primary auto-fix-modal-btn"
                      onClick={applyToWordPress}
                      disabled={applying || applied}
                    >
                      <Wand2 size={14} />
                      {applying
                        ? 'Applying…'
                        : applied
                          ? 'Applied to WordPress'
                          : 'Apply fix to WordPress'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p>
                The suggestion will use this business profile, the affected page and its crawled
                content. If AI is not configured, a context-aware rule-based draft will be provided.
              </p>
            )}
          </div>
          <ImplementationGuide issue={issue} proposedValue={proposedValue} />
          <div className="page-facts">
            <div>
              <strong>{page?.wordCount ?? 0}</strong>
              <small>Words</small>
            </div>
            <div>
              <strong>{Array.isArray(page?.h1) ? page.h1.length : 0}</strong>
              <small>H1 headings</small>
            </div>
            <div>
              <strong>{Array.isArray(page?.h2) ? page.h2.length : 0}</strong>
              <small>H2 headings</small>
            </div>
          </div>
          <p className="review-note">
            Click Marketing Agent does not alter your live website. Make the change in your website
            or CMS, then mark this item complete and confirm it on the next audit.
          </p>
        </div>
        <div className="review-actions">
          <button className="dismiss-button" onClick={() => onStatus('DISMISSED')}>
            Dismiss
          </button>
          <button className="progress-button" onClick={() => onStatus('IN_PROGRESS')}>
            Mark in progress
          </button>
          <button className="complete-button" onClick={() => onStatus('COMPLETED')}>
            <Check size={17} /> Mark complete
          </button>
        </div>
      </aside>
    </div>
  );
}

function ImplementationGuide({ issue, proposedValue }: any) {
  const hostname = issue.page?.url ? new URL(issue.page.url).hostname : 'website';
  const platformKey = `click-marketing-agent:platform:${hostname}`;
  const seoToolKey = `click-marketing-agent:seo-tool:${hostname}`;
  const [platform, setPlatform] = useState(() => localStorage.getItem(platformKey) ?? 'UNKNOWN');
  const [seoTool, setSeoTool] = useState(() => localStorage.getItem(seoToolKey) ?? 'CLICK_SEO');
  const finding = issue.title.toLowerCase();
  const isTitle = finding.includes('title');
  const isDescription = finding.includes('meta description');
  const isHeading = finding.includes('h1') || finding.includes('section heading');
  const isAlt = finding.includes('alternative text');
  const field = isTitle
    ? 'SEO Title'
    : isDescription
      ? 'Meta Description'
      : finding.includes('h1')
        ? 'primary page heading (H1)'
        : finding.includes('section heading')
          ? 'section headings (H2)'
          : isAlt
            ? 'image Alternative Text'
            : 'page content';

  const updatePlatform = (value: string) => {
    setPlatform(value);
    localStorage.setItem(platformKey, value);
  };
  const updateSeoTool = (value: string) => {
    setSeoTool(value);
    localStorage.setItem(seoToolKey, value);
  };

  const wordpressMetadataSteps: Record<string, string[]> = {
    CLICK_SEO: [
      `In WordPress, open Pages → All Pages, find this page and choose Edit.`,
      `Scroll below the page editor to Meta Boxes → Click SEO Settings → Basic SEO.`,
      `Find the ${field} field. This is separate from the visible Elementor page content.`,
      `Replace the current value with the suggested content shown above.`,
      `Select Save or Update in the upper-right corner.`,
    ],
    YOAST: [
      `Open the page in WordPress and scroll to the Yoast SEO panel, or open Yoast from the editor sidebar.`,
      `Open Search appearance and find the SEO title or Meta description field.`,
      `Replace the relevant field with the suggested content, then select Update.`,
    ],
    RANK_MATH: [
      `Open the page in WordPress and select the Rank Math score/button in the editor.`,
      `Choose Edit Snippet and find the Title or Description field.`,
      `Paste the suggested content, close the snippet editor and select Update.`,
    ],
    AIOSEO: [
      `Open the page and locate AIOSEO Settings below the editor or in the sidebar.`,
      `Open General → Snippet Preview and find Post Title or Meta Description.`,
      `Replace the relevant field and select Update.`,
    ],
    OTHER: [
      `Open the page editor and look below the visible content or in the editor sidebar for SEO, Search appearance, Metadata or Snippet settings.`,
      `Find the ${field} field, add the suggested content and select Update or Save.`,
    ],
  };

  let steps: string[] = [];
  if (platform === 'WORDPRESS') {
    if (isTitle || isDescription)
      steps = wordpressMetadataSteps[seoTool] ?? wordpressMetadataSteps.OTHER ?? [];
    else if (isHeading || finding.includes('copy') || finding.includes('little')) {
      steps = [
        `In WordPress, open Pages → All Pages, find this page and choose Edit.`,
        `Choose Edit with Elementor if the page uses Elementor.`,
        `Select the visible ${field} or the section where it belongs. This change is made in the page body, not the SEO settings box.`,
        `Add or replace the content using the suggestion above, then select Update or Save.`,
      ];
    } else if (isAlt) {
      steps = [
        `Open the page with its normal WordPress or Elementor editor.`,
        `Select each affected image and open its Image settings.`,
        `Enter an accurate description in Alternative Text. You can also update it in Media → Library.`,
        `Leave decorative images with empty alternative text, then select Update.`,
      ];
    }
  } else if (platform === 'SHOPIFY') {
    steps =
      isTitle || isDescription
        ? [
            `In Shopify Admin, open Online Store → Pages and select this page.`,
            `Scroll to Search engine listing and choose Edit website SEO.`,
            `Find the Page title or Meta description field and add the suggested content.`,
            `Select Save.`,
          ]
        : [
            `In Shopify Admin, open Online Store → Pages and select this page.`,
            `Edit the relevant ${field} in the Content area, then select Save.`,
          ];
  } else if (platform === 'CUSTOM') {
    steps = [
      `Open the source or CMS record that produces this URL.`,
      isTitle
        ? `Update the HTML <title> value or the framework's page-metadata title.`
        : isDescription
          ? `Update the <meta name="description"> value or the framework's page-metadata description.`
          : `Update the ${field} in the rendered page content.`,
      `Publish or deploy the change, then open the public URL to confirm it is live.`,
    ];
  }

  return (
    <div className="implementation-guide">
      <div className="guide-heading">
        <div>
          <span className="review-label">WHERE AND HOW TO MAKE THIS CHANGE</span>
          <h3>Step-by-step website instructions</h3>
        </div>
        <Settings size={20} />
      </div>
      <div className="guide-selectors">
        <label>
          Website platform
          <select value={platform} onChange={(event) => updatePlatform(event.target.value)}>
            <option value="UNKNOWN">Choose platform…</option>
            <option value="WORDPRESS">WordPress</option>
            <option value="SHOPIFY">Shopify</option>
            <option value="CUSTOM">Custom / Node.js / other</option>
          </select>
        </label>
        {platform === 'WORDPRESS' && (isTitle || isDescription) && (
          <label>
            SEO settings tool
            <select value={seoTool} onChange={(event) => updateSeoTool(event.target.value)}>
              <option value="CLICK_SEO">Click SEO Settings</option>
              <option value="YOAST">Yoast SEO</option>
              <option value="RANK_MATH">Rank Math</option>
              <option value="AIOSEO">All in One SEO</option>
              <option value="OTHER">Other / not sure</option>
            </select>
          </label>
        )}
      </div>
      {platform === 'UNKNOWN' ? (
        <div className="guide-prompt">
          Choose the website platform once. Click Marketing Agent will remember it for this domain
          and show instructions for the exact field in future reviews.
        </div>
      ) : (
        <>
          <div className="location-callout">
            <strong>Change this field:</strong> {field}
            {(isTitle || isDescription) && (
              <small>This is search metadata; it may not appear in the visible page design.</small>
            )}
          </div>
          <ol>
            {steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
          {platform === 'WORDPRESS' && (
            <p className="autosave-warning">
              If WordPress shows a newer autosave notice, review or dismiss it before editing so you
              do not overwrite a more recent page version.
            </p>
          )}
          <div className="verify-steps">
            <strong>Confirm the change</strong>
            <span>
              Open the public page in a private window, then run a new audit. The new crawl should
              detect the updated {field}.
            </span>
          </div>
          {proposedValue && (
            <small className="copy-hint">
              Use the editable suggested content directly above these instructions.
            </small>
          )}
        </>
      )}
    </div>
  );
}
function Content({ ctx }: { ctx: Ctx }) {
  const [items, setItems] = useState<any[]>([]);
  const [topic, setTopic] = useState('');
  const [articleStyle, setArticleStyle] = useState('NATURAL_EDITORIAL');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [generationError, setGenerationError] = useState<{
    message: string;
    actionUrl?: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const load = async () => {
    if (!ctx.selected) return;
    const content = await api<any[]>(`/api/content?businessId=${ctx.selected.id}`);
    setItems(content);
    api<{ aiGeneration: boolean }>('/api/capabilities')
      .then((capabilities) => setAiConfigured(capabilities.aiGeneration))
      .catch(() => setAiConfigured(null));
  };
  useEffect(() => {
    void load();
  }, [ctx.selected]);
  const gen = async (kind: 'article' | 'social') => {
    if (!ctx.selected || !topic) return;
    setGenerating(true);
    setGenerationError(null);
    try {
      await api(`/api/ai/${kind}`, {
        method: 'POST',
        body: JSON.stringify({
          businessId: ctx.selected.id,
          topic,
          ...(kind === 'article' ? { style: articleStyle } : {}),
        }),
      });
      setTopic('');
      load();
    } catch (e) {
      const actionUrl = (e as Error & { actionUrl?: string }).actionUrl;
      setGenerationError({ message: (e as Error).message, ...(actionUrl ? { actionUrl } : {}) });
    } finally {
      setGenerating(false);
    }
  };
  return (
    <Page title="Content Library" sub="Create, review, approve and schedule every marketing asset.">
      <section className="content-guide">
        <div className="content-guide-heading">
          <div>
            <span className="eyebrow">HOW THIS SECTION WORKS</span>
            <h2>Your content production workspace</h2>
          </div>
          <span
            className="score-tooltip content-help"
            tabIndex={0}
            aria-label="About the Content Library"
          >
            <CircleHelp size={18} />
            <span role="tooltip">
              Items belong only to the currently selected business. Creating or approving an item
              does not publish it to a website or social network.
            </span>
          </span>
        </div>
        <div className="content-steps">
          <div>
            <b>1</b>
            <span>
              <strong>Describe the topic</strong>
              <small>
                Enter what you want the content to discuss and, where useful, its audience or
                purpose.
              </small>
            </span>
          </div>
          <div>
            <b>2</b>
            <span>
              <strong>Create a draft</strong>
              <small>
                Article creates a long-form SEO draft. Social set creates several platform-ready
                social drafts.
              </small>
            </span>
          </div>
          <div>
            <b>3</b>
            <span>
              <strong>Review and edit</strong>
              <small>
                Open an item below to edit its title and copy, then move it through the appropriate
                status.
              </small>
            </span>
          </div>
          <div>
            <b>4</b>
            <span>
              <strong>Approve and schedule</strong>
              <small>
                An approved item can be assigned a date for the calendar. Publishing is still
                completed manually.
              </small>
            </span>
          </div>
        </div>
        <details className="status-guide">
          <summary>What do the content statuses mean?</summary>
          <div>
            <strong>Idea</strong>
            <span>A topic worth developing.</span>
          </div>
          <div>
            <strong>Draft</strong>
            <span>Work in progress; not ready to use.</span>
          </div>
          <div>
            <strong>Needs review</strong>
            <span>Ready for another person to check.</span>
          </div>
          <div>
            <strong>Approved</strong>
            <span>Accepted and ready to schedule or publish manually.</span>
          </div>
          <div>
            <strong>Published</strong>
            <span>Manually marked after it has gone live.</span>
          </div>
          <div>
            <strong>Rejected</strong>
            <span>Not suitable in its current form.</span>
          </div>
        </details>
        <p className="content-publishing-note">
          <AlertTriangle size={17} /> The Content Library does not currently publish externally.
          Scheduling places an item on the in-app calendar; it does not automatically post it.
        </p>
      </section>
      {aiConfigured === false && (
        <div className="ai-setup-notice" role="status">
          <AlertTriangle size={21} />
          <div>
            <strong>AI generation needs to be connected</strong>
            <p>
              Create an OpenAI API key, add it to the server’s <code>.env</code> file as{' '}
              <code>OPENAI_API_KEY=your_key</code>, then restart <code>npm run dev</code>. Keep the
              key private—never paste it into this browser screen or commit it to Git.
            </p>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
              Open OpenAI API key settings →
            </a>
          </div>
        </div>
      )}
      <div className="composer">
        <Sparkles />
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Example: A family guide to weekend activities in Brisbane"
        />
        <button
          disabled={!topic.trim() || generating}
          onClick={() => gen('article')}
          title="Generate one long-form SEO article draft"
        >
          {generating ? 'Generating…' : 'Article'}
        </button>
        <button
          disabled={!topic.trim() || generating}
          className="secondary"
          onClick={() => gen('social')}
          title="Generate a coordinated set of social-media drafts"
        >
          {generating ? 'Please wait…' : 'Social set'}
        </button>
      </div>
      <label className="article-style-picker">
        Article writing style
        <select value={articleStyle} onChange={(event) => setArticleStyle(event.target.value)}>
          <option value="NATURAL_EDITORIAL">Natural editorial — cohesive, warm and human</option>
          <option value="NEWS_FEATURE">News-style feature — journalistic and informative</option>
          <option value="PRACTICAL_GUIDE">
            Practical guide — useful advice with restrained lists
          </option>
        </select>
        <small>
          This choice applies to Article only. News-style does not invent current events, interviews
          or statistics.
        </small>
      </label>
      <div className="generation-choices" aria-label="Content generation choices">
        <div>
          <strong>Article</strong>
          <span>
            Creates one longer, search-focused website or blog draft with a structured explanation
            and call to action.
          </span>
        </div>
        <div>
          <strong>Social set</strong>
          <span>
            Creates three shorter drafts about the same topic: one each for Facebook, LinkedIn and
            Reddit.
          </span>
        </div>
      </div>
      {generating && (
        <p className="generation-progress" role="status">
          <Sparkles size={16} /> Creating your draft with AI. A full article can take up to about a
          minute—please keep this page open.
        </p>
      )}
      {generationError && (
        <div className="generation-error" role="alert">
          <strong>Generation failed:</strong> {generationError.message}{' '}
          {generationError.actionUrl && (
            <a href={generationError.actionUrl} target="_blank" rel="noreferrer">
              Verify organisation →
            </a>
          )}
        </div>
      )}
      <section>
        <SectionTitle title={`${items.length} content items`} link="" />
        {items.map((i) => (
          <button
            className="row content-row content-item-button"
            key={i.id}
            onClick={() => setSelectedItem(i)}
          >
            <span className="doc">Aa</span>
            <div>
              <b>{i.title}</b>
              <small>
                {i.type.replaceAll('_', ' ')} · Updated {new Date(i.updatedAt).toLocaleDateString()}
              </small>
            </div>
            <span className="pill">{i.status.replaceAll('_', ' ')}</span>
            <span className="review-content-link">Open & edit →</span>
          </button>
        ))}
        {!items.length && (
          <div className="empty compact">
            <Library />
            <p>Your approved and draft content will live here.</p>
          </div>
        )}
      </section>
      {selectedItem && (
        <ContentEditor
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={async () => {
            setSelectedItem(null);
            await load();
          }}
        />
      )}
    </Page>
  );
}

function ContentEditor({ item, onClose, onSaved }: any) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [status, setStatus] = useState(item.status);
  const [scheduledAt, setScheduledAt] = useState(
    item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '',
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/content/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          body,
          status,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      await onSaved();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <aside
        className="review-panel content-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="review-header">
          <div>
            <span className="eyebrow">CONTENT ITEM</span>
            <small>{item.type.replaceAll('_', ' ')}</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close editor">
            <X />
          </button>
        </div>
        <div className="review-body">
          <h2 id="content-editor-title">Review and edit</h2>
          <label className="editor-field">
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="editor-field">
            Content
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={18} />
          </label>
          <div className="editor-options">
            <label className="editor-field">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="IDEA">Idea</option>
                <option value="DRAFT">Draft</option>
                <option value="NEEDS_REVIEW">Needs review</option>
                <option value="APPROVED">Approved</option>
                <option value="PUBLISHED">Published</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <label className="editor-field">
              Calendar date and time
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
            </label>
          </div>
          <p className="review-note">
            Approval and scheduling are internal workflow steps. They do not publish this content
            externally.
          </p>
        </div>
        <div className="review-actions">
          <button className="dismiss-button" onClick={onClose}>
            Cancel
          </button>
          <button className="complete-button" onClick={save} disabled={saving}>
            <Check size={17} /> {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </aside>
    </div>
  );
}
function Contacts({ ctx }: { ctx: Ctx }) {
  const blank = { email: '', businessName: '', contactName: '', contactNumber: '' };
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = async (query = search) => {
    if (!ctx.selected) return;
    const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : '';
    setContacts(await api<any[]>(`/api/businesses/${ctx.selected.id}/contacts${suffix}`));
  };
  useEffect(() => {
    setSearch('');
    setEditing(null);
    void load('');
  }, [ctx.selected]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const openEditor = (contact?: any) => {
    setEditing(contact ?? { id: null });
    setForm(
      contact
        ? {
            email: contact.email,
            businessName: contact.businessName,
            contactName: contact.contactName,
            contactNumber: contact.contactNumber,
          }
        : blank,
    );
    setError('');
  };
  const save = async (event: any) => {
    event.preventDefault();
    if (!ctx.selected) return;
    setSaving(true);
    setError('');
    try {
      const path = editing.id
        ? `/api/businesses/${ctx.selected.id}/contacts/${editing.id}`
        : `/api/businesses/${ctx.selected.id}/contacts`;
      await api(path, { method: editing.id ? 'PUT' : 'POST', body: JSON.stringify(form) });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (contact: any) => {
    if (!ctx.selected || !window.confirm(`Delete ${contact.contactName} from your contacts?`))
      return;
    await api(`/api/businesses/${ctx.selected.id}/contacts/${contact.id}`, { method: 'DELETE' });
    await load();
  };
  return (
    <Page
      title="Contacts"
      sub="A simple contact list for the active business."
      action="Add contact"
      onAction={() => openEditor()}
    >
      <div className="crm-toolbar">
        <ContactRound />
        <input
          aria-label="Search contacts"
          placeholder="Search by name, business, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <section className="crm-card">
        <div className="crm-table-head">
          <span>Contact</span>
          <span>Business</span>
          <span>Email</span>
          <span>Contact number</span>
          <span>Actions</span>
        </div>
        {contacts.map((contact) => (
          <div className="crm-row" key={contact.id}>
            <strong>{contact.contactName}</strong>
            <span>{contact.businessName}</span>
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <a href={`tel:${contact.contactNumber}`}>{contact.contactNumber}</a>
            <span className="crm-actions">
              <button
                aria-label={`Edit ${contact.contactName}`}
                onClick={() => openEditor(contact)}
              >
                <Pencil />
              </button>
              <button
                className="danger"
                aria-label={`Delete ${contact.contactName}`}
                onClick={() => void remove(contact)}
              >
                <Trash2 />
              </button>
            </span>
          </div>
        ))}
        {!contacts.length && (
          <div className="empty compact">
            <ContactRound />
            <h3>{search ? 'No matching contacts' : 'No contacts yet'}</h3>
            <p>
              {search ? 'Try a different search.' : 'Add your first business contact to begin.'}
            </p>
          </div>
        )}
      </section>
      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <aside
            className="review-panel business-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-editor-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="review-header">
              <div>
                <span className="eyebrow">CONTACT LIST</span>
                <small>{editing.id ? 'Edit contact' : 'New contact'}</small>
              </div>
              <button className="icon-button" onClick={() => setEditing(null)} aria-label="Close">
                <X />
              </button>
            </div>
            <form className="review-body" onSubmit={save}>
              <h2 id="contact-editor-title">{editing.id ? 'Edit contact' : 'Add contact'}</h2>
              <label className="editor-field">
                Business name
                <input
                  required
                  maxLength={150}
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                />
              </label>
              <label className="editor-field">
                Contact name
                <input
                  required
                  maxLength={150}
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
              </label>
              <label className="editor-field">
                Email address
                <input
                  required
                  type="email"
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="editor-field">
                Contact number
                <input
                  required
                  type="tel"
                  maxLength={50}
                  value={form.contactNumber}
                  onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}
                />
              </label>
              {error && <p className="settings-message error">{error}</p>}
              <div className="review-actions embedded">
                <button type="button" className="dismiss-button" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button className="complete-button" disabled={saving}>
                  <Check size={17} />
                  {saving ? 'Saving…' : 'Save contact'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </Page>
  );
}
function Calendar({ ctx }: { ctx: Ctx }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (ctx.selected) api<any[]>(`/api/calendar?businessId=${ctx.selected.id}`).then(setItems);
  }, [ctx.selected]);
  return (
    <Page title="Content Calendar" sub="A clear view of what is planned and when.">
      <section>
        {items.map((i) => (
          <div className="row" key={i.id}>
            <span className="date">
              {new Date(i.scheduledAt).getDate()}
              <small>{new Date(i.scheduledAt).toLocaleString('en', { month: 'short' })}</small>
            </span>
            <div>
              <b>{i.title}</b>
              <small>{i.type.replaceAll('_', ' ')}</small>
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="empty">
            <CalendarDays />
            <h3>Nothing scheduled yet</h3>
            <p>Schedule approved content from the Content Library.</p>
          </div>
        )}
      </section>
    </Page>
  );
}
function LeadOpportunities({ ctx }: { ctx: Ctx }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    platform: 'REDDIT',
    originalUrl: '',
    postText: '',
    communityName: '',
    authorDisplayName: '',
  });
  const [replyBody, setReplyBody] = useState('');
  const [identity, setIdentity] = useState(ctx.user.name);
  const [publication, setPublication] = useState({
    responseUrl: '',
    evidenceNote: '',
    publishedAt: new Date().toISOString().slice(0, 16),
  });
  const load = async () => {
    if (!ctx.selected) return;
    const data = await api<any[]>(`/api/businesses/${ctx.selected.id}/leads`);
    setLeads(data);
    if (selected) {
      const fresh = await api<any>(`/api/leads/${selected.id}`);
      setSelected(fresh);
      setReplyBody(fresh.reply?.currentRevision?.body ?? '');
      setIdentity(fresh.reply?.currentRevision?.postingIdentity ?? ctx.user.name);
    }
  };
  useEffect(() => {
    setSelected(null);
    void load();
  }, [ctx.selected]);
  const openLead = async (id: string) => {
    const detail = await api<any>(`/api/leads/${id}`);
    setSelected(detail);
    setReplyBody(detail.reply?.currentRevision?.body ?? '');
    setIdentity(detail.reply?.currentRevision?.postingIdentity ?? ctx.user.name);
  };
  const act = async (operation: () => Promise<any>) => {
    setBusy(true);
    try {
      const result = await operation();
      const detail = result?.lead ?? result;
      if (detail?.id && detail?.originalUrl) {
        setSelected(detail);
        setReplyBody(detail.reply?.currentRevision?.body ?? '');
      } else if (selected) await openLead(selected.id);
      await load();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const capture = async () =>
    act(async () => {
      const result = await api<any>(`/api/businesses/${ctx.selected!.id}/leads`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setAdding(false);
      setForm({
        platform: 'REDDIT',
        originalUrl: '',
        postText: '',
        communityName: '',
        authorDisplayName: '',
      });
      if (result.duplicate)
        alert('This source was already captured. The existing opportunity has been opened.');
      return api(`/api/leads/${result.lead.id}`);
    });
  const saveReply = () =>
    act(() =>
      selected.reply
        ? api(`/api/lead-replies/${selected.reply.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              body: replyBody,
              postingIdentity: identity,
              expectedVersion: selected.reply.version,
            }),
          })
        : api(`/api/leads/${selected.id}/reply`, {
            method: 'POST',
            body: JSON.stringify({ body: replyBody, postingIdentity: identity }),
          }),
    );
  const statusLabel = (lead: any) =>
    lead.reply?.publication
      ? 'Published manually'
      : (lead.reply?.contentItem?.status?.replaceAll('_', ' ') ?? lead.status);
  return (
    <Page
      title="Lead Opportunities"
      sub="Capture genuine public opportunities, prepare a reply and keep approval separate from publication."
      action="Add opportunity"
      onAction={() => setAdding(true)}
    >
      <section className="lead-safety-note">
        <ShieldCheck />
        <div>
          <strong>Human approval is required</strong>
          <p>
            Click Marketing prepares and records replies, but does not post them externally.
            Publishing remains manual until an authorised connector is explicitly enabled.
          </p>
        </div>
      </section>
      <div className="lead-workbench">
        <section className="lead-list-pane">
          <div className="lead-pane-heading">
            <span className="eyebrow">OPPORTUNITY INBOX</span>
            <h2>{leads.length} captured</h2>
          </div>
          {leads.length ? (
            leads.map((lead) => (
              <button
                key={lead.id}
                className={`lead-list-item ${selected?.id === lead.id ? 'selected' : ''}`}
                onClick={() => void openLead(lead.id)}
              >
                <span className="platform-badge">{lead.platform}</span>
                <strong>
                  {lead.postText.slice(0, 95)}
                  {lead.postText.length > 95 ? '…' : ''}
                </strong>
                <small>
                  {lead.communityName || new URL(lead.originalUrl).hostname} · {statusLabel(lead)}
                </small>
              </button>
            ))
          ) : (
            <div className="empty compact">
              <Radio />
              <h3>No opportunities yet</h3>
              <p>Add a public post URL and its text to begin.</p>
            </div>
          )}
        </section>
        <section className="lead-detail-pane">
          {!selected ? (
            <div className="detail-placeholder">
              <Radio />
              <h3>Select an opportunity</h3>
              <p>Its source, reply and complete decision history will appear here.</p>
            </div>
          ) : (
            <>
              <div className="lead-detail-header">
                <div>
                  <span className="platform-badge">{selected.platform}</span>
                  <span className="pill">{statusLabel(selected)}</span>
                </div>
                <a href={selected.originalUrl} target="_blank" rel="noreferrer">
                  Open original source ↗
                </a>
              </div>
              <div className="detail-block">
                <span>SOURCE POST</span>
                <p className="source-post">{selected.postText}</p>
                <small>
                  {selected.authorDisplayName
                    ? `Posted by ${selected.authorDisplayName}`
                    : 'Author not recorded'}
                  {selected.communityName ? ` in ${selected.communityName}` : ''}
                </small>
              </div>
              {selected.relevanceReason && (
                <div className="detail-block recommendation">
                  <span>WHY THIS MAY BE RELEVANT</span>
                  <p>{selected.relevanceReason}</p>
                </div>
              )}
              <label className="editor-field">
                Posting identity
                <input value={identity} onChange={(event) => setIdentity(event.target.value)} />
              </label>
              <label className="editor-field">
                Proposed reply
                <textarea
                  rows={10}
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Write a reply manually or ask AI to prepare a suggestion."
                />
              </label>
              <div className="lead-actions">
                <button
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api(`/api/leads/${selected.id}/reply/generate`, {
                        method: 'POST',
                        body: JSON.stringify({ postingIdentity: identity }),
                      }),
                    )
                  }
                >
                  <Sparkles size={17} /> Generate suggestion
                </button>
                <button disabled={busy || !replyBody.trim()} onClick={saveReply}>
                  Save new revision
                </button>
                {selected.reply && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        api(`/api/lead-replies/${selected.reply.id}/submit`, { method: 'POST' }),
                      )
                    }
                  >
                    Submit for review
                  </button>
                )}
              </div>
              {selected.reply?.currentRevision && (
                <div className="lead-decision-box">
                  <strong>Revision {selected.reply.currentRevision.revisionNumber}</strong>
                  <p>
                    Approval applies only to this exact text and posting identity. Editing creates a
                    new revision and invalidates approval.
                  </p>
                  <div className="lead-actions">
                    <button
                      className="complete-button"
                      disabled={busy}
                      onClick={() =>
                        act(() =>
                          api(`/api/lead-replies/${selected.reply.id}/decisions`, {
                            method: 'POST',
                            body: JSON.stringify({
                              decision: 'APPROVED',
                              revisionId: selected.reply.currentRevision.id,
                              expectedVersion: selected.reply.version,
                            }),
                          }),
                        )
                      }
                    >
                      <Check size={17} /> Approve exact revision
                    </button>
                    <button
                      className="dismiss-button"
                      disabled={busy}
                      onClick={() => {
                        const reason = prompt('Why is this reply being rejected?');
                        if (reason)
                          void act(() =>
                            api(`/api/lead-replies/${selected.reply.id}/decisions`, {
                              method: 'POST',
                              body: JSON.stringify({
                                decision: 'REJECTED',
                                revisionId: selected.reply.currentRevision.id,
                                expectedVersion: selected.reply.version,
                                reason,
                              }),
                            }),
                          );
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
              {selected.reply?.activeApproval && !selected.reply?.publication && (
                <div className="manual-publish-box">
                  <strong>
                    Approved for manual posting. Nothing has been posted by Click Marketing.
                  </strong>
                  <div className="lead-actions">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(selected.reply.currentRevision.body)
                      }
                    >
                      Copy approved reply
                    </button>
                    <a
                      className="button-link"
                      href={selected.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source
                    </a>
                  </div>
                  <label>
                    Response permalink (optional)
                    <input
                      value={publication.responseUrl}
                      onChange={(e) =>
                        setPublication({ ...publication, responseUrl: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Published at
                    <input
                      type="datetime-local"
                      value={publication.publishedAt}
                      onChange={(e) =>
                        setPublication({ ...publication, publishedAt: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Evidence note (optional)
                    <input
                      value={publication.evidenceNote}
                      onChange={(e) =>
                        setPublication({ ...publication, evidenceNote: e.target.value })
                      }
                    />
                  </label>
                  <button
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        api(`/api/lead-replies/${selected.reply.id}/manual-publication`, {
                          method: 'POST',
                          body: JSON.stringify({
                            actualText: selected.reply.currentRevision.body,
                            postingIdentity: selected.reply.currentRevision.postingIdentity,
                            publishedAt: new Date(publication.publishedAt).toISOString(),
                            responseUrl: publication.responseUrl || undefined,
                            evidenceNote: publication.evidenceNote || undefined,
                            idempotencyKey: crypto.randomUUID(),
                          }),
                        }),
                      )
                    }
                  >
                    Record manual publication
                  </button>
                </div>
              )}
              {selected.reply?.publication && (
                <div className="publication-record">
                  <Check />
                  <div>
                    <strong>
                      Published manually — reported by {selected.reply.publication.recordedBy.name}
                    </strong>
                    <p>
                      {selected.reply.publication.verificationStatus.replaceAll('_', ' ')} ·{' '}
                      {selected.reply.publication.approvalCompliance}
                    </p>
                    {selected.reply.publication.responseUrl && (
                      <a
                        href={selected.reply.publication.responseUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View recorded response ↗
                      </a>
                    )}
                  </div>
                </div>
              )}
              {selected.status !== 'CLOSED' && selected.status !== 'DISMISSED' && (
                <button
                  className="text-danger"
                  onClick={() => {
                    const reason = prompt('Why are you dismissing this opportunity?');
                    if (reason)
                      void act(() =>
                        api(`/api/leads/${selected.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({
                            status: 'DISMISSED',
                            reason,
                            expectedVersion: selected.version,
                          }),
                        }),
                      );
                  }}
                >
                  Dismiss opportunity
                </button>
              )}
              {selected.reply?.revisions?.length > 0 && (
                <details className="revision-history">
                  <summary>Revision and decision history</summary>
                  {selected.reply.revisions.map((revision: any) => (
                    <div key={revision.id}>
                      <strong>Revision {revision.revisionNumber}</strong>
                      <span>
                        {revision.aiGenerated ? 'AI-assisted' : 'Written manually'} ·{' '}
                        {revision.createdBy.name} · {new Date(revision.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
        </section>
      </div>
      {adding && (
        <div className="modal-backdrop" onMouseDown={() => setAdding(false)}>
          <aside
            className="review-panel"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="review-header">
              <h2>Add opportunity</h2>
              <button className="icon-button" onClick={() => setAdding(false)}>
                <X />
              </button>
            </div>
            <div className="review-body">
              <label className="editor-field">
                Platform
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                >
                  {[
                    'REDDIT',
                    'FACEBOOK',
                    'LINKEDIN',
                    'THREADS',
                    'INSTAGRAM',
                    'AIRTASKER',
                    'FORUM',
                    'OTHER',
                  ].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="editor-field">
                Public source URL
                <input
                  value={form.originalUrl}
                  onChange={(e) => setForm({ ...form, originalUrl: e.target.value })}
                  placeholder="https://…"
                />
              </label>
              <label className="editor-field">
                Community or group
                <input
                  value={form.communityName}
                  onChange={(e) => setForm({ ...form, communityName: e.target.value })}
                />
              </label>
              <label className="editor-field">
                Author display name
                <input
                  value={form.authorDisplayName}
                  onChange={(e) => setForm({ ...form, authorDisplayName: e.target.value })}
                />
              </label>
              <label className="editor-field">
                Exact source text
                <textarea
                  rows={10}
                  value={form.postText}
                  onChange={(e) => setForm({ ...form, postText: e.target.value })}
                />
              </label>
            </div>
            <div className="review-actions">
              <button className="dismiss-button" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button
                className="complete-button"
                disabled={busy || !form.originalUrl || form.postText.length < 10}
                onClick={capture}
              >
                Capture opportunity
              </button>
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}

function InboxPage({ ctx }: { ctx: Ctx }) {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [view, setView] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const load = () =>
    ctx.selected && api<any[]>(`/api/recommendations?businessId=${ctx.selected.id}`).then(setItems);
  useEffect(() => {
    void load();
  }, [ctx.selected]);
  const decisionItems = items.filter(
    (item) => item.source !== 'ONBOARDING' && Boolean(item.proposedValue?.trim()),
  );
  const visibleItems = decisionItems.filter((item) =>
    view === 'ACTIVE'
      ? ['OPEN', 'IN_PROGRESS', 'APPROVED'].includes(item.status)
      : ['COMPLETED', 'REJECTED', 'DISMISSED'].includes(item.status),
  );
  const sourceLabel = (source: string) =>
    source.startsWith('SEO_ISSUE:') ? 'Website & SEO' : source.replaceAll('_', ' ');
  return (
    <Page
      title="Approvals & Actions"
      sub="Only the marketing decisions and follow-ups that need your attention."
    >
      <section className="inbox-guide">
        <div className="content-guide-heading">
          <div>
            <span className="eyebrow">WHAT THIS PAGE IS FOR</span>
            <h2>What needs my decision or attention today?</h2>
          </div>
          <span
            className="score-tooltip content-help"
            tabIndex={0}
            aria-label="About Approvals and Actions"
          >
            <CircleHelp size={18} />
            <span role="tooltip">
              This queue contains prepared changes and important follow-ups—not every finding from
              the Website & SEO audit.
            </span>
          </span>
        </div>
        <p>
          Website & SEO remains the complete diagnostic report. This page contains only prepared
          changes that need approval, work already in progress, and important follow-ups from
          content, rankings or automation. Ordinary audit findings stay in the audit area.
        </p>
        <div className="inbox-steps">
          <div>
            <strong>1. Review</strong>
            <span>
              Open the recommendation and compare the current situation with the proposed change.
            </span>
          </div>
          <div>
            <strong>2. Decide</strong>
            <span>Approve it, reject it, dismiss it, or mark it in progress.</span>
          </div>
          <div>
            <strong>3. Complete</strong>
            <span>
              After the work is actually done, mark it completed so it leaves your active workload.
            </span>
          </div>
        </div>
        <details className="status-guide">
          <summary>What do the action statuses mean?</summary>
          <div>
            <strong>Open</strong>
            <span>No decision has been made.</span>
          </div>
          <div>
            <strong>In progress</strong>
            <span>Someone is working on it.</span>
          </div>
          <div>
            <strong>Approved</strong>
            <span>The proposed action has been accepted, but is not necessarily implemented.</span>
          </div>
          <div>
            <strong>Completed</strong>
            <span>The action has been carried out.</span>
          </div>
          <div>
            <strong>Rejected</strong>
            <span>The proposal was reviewed and declined.</span>
          </div>
          <div>
            <strong>Dismissed</strong>
            <span>Hidden as irrelevant, duplicate or not currently useful.</span>
          </div>
        </details>
        <p className="content-publishing-note">
          <AlertTriangle size={17} /> Approving a recommendation records your decision only. It does
          not automatically publish content or alter the live website.
        </p>
      </section>
      <section>
        <div className="action-tabs">
          <button className={view === 'ACTIVE' ? 'active' : ''} onClick={() => setView('ACTIVE')}>
            Active (
            {
              decisionItems.filter((item) =>
                ['OPEN', 'IN_PROGRESS', 'APPROVED'].includes(item.status),
              ).length
            }
            )
          </button>
          <button className={view === 'HISTORY' ? 'active' : ''} onClick={() => setView('HISTORY')}>
            History (
            {
              decisionItems.filter((item) =>
                ['COMPLETED', 'REJECTED', 'DISMISSED'].includes(item.status),
              ).length
            }
            )
          </button>
        </div>
        {visibleItems.length ? (
          visibleItems.map((i) => (
            <div className="issue" key={i.id}>
              <span className={`severity ${i.severity.toLowerCase()}`}>{i.category}</span>
              <div>
                <b>{i.title}</b>
                <p>{i.description}</p>
                <small>Source: {sourceLabel(i.source)}</small>
              </div>
              <span className="pill">{i.status.replaceAll('_', ' ')}</span>
              <button
                onClick={() =>
                  i.source.startsWith('LEAD:')
                    ? (document.location.href = '/leads')
                    : setSelectedItem(i)
                }
              >
                {i.source.startsWith('LEAD:') ? 'Open lead' : 'Review'}
              </button>
            </div>
          ))
        ) : (
          <div className="empty">
            <Inbox />
            <h3>
              {view === 'ACTIVE'
                ? 'No decisions need your attention'
                : 'No completed decisions yet'}
            </h3>
            <p>
              {view === 'ACTIVE'
                ? 'Continue working in Website & SEO or Content. Prepared changes will appear here when approval or follow-up is required.'
                : 'Completed, rejected and dismissed actions will be retained here.'}
            </p>
          </div>
        )}
      </section>
      {selectedItem && (
        <RecommendationReview
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={async () => {
            setSelectedItem(null);
            await load();
          }}
        />
      )}
    </Page>
  );
}

function RecommendationReview({ item, onClose, onSaved }: any) {
  const [status, setStatus] = useState(item.status);
  const [proposedValue, setProposedValue] = useState(item.proposedValue ?? '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/recommendations/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, proposedValue }),
      });
      await onSaved();
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <aside
        className="review-panel inbox-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-review-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="review-header">
          <div>
            <span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span>
            <small>{item.category}</small>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close recommendation">
            <X />
          </button>
        </div>
        <div className="review-body">
          <h2 id="inbox-review-title">{item.title}</h2>
          <div className="review-block">
            <span className="review-label">WHY IT IS HERE</span>
            <p>{item.description}</p>
          </div>
          {item.currentValue && (
            <div className="review-block">
              <span className="review-label">CURRENT VALUE</span>
              <div className="current-value">{item.currentValue}</div>
            </div>
          )}
          <label className="editor-field">
            Proposed change
            <textarea
              rows={8}
              value={proposedValue}
              onChange={(event) => setProposedValue(event.target.value)}
              placeholder="No proposed content has been prepared yet."
            />
          </label>
          <label className="editor-field">
            Decision or progress status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="APPROVED">Approved</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </label>
          <p className="review-note">
            Saving this status records the workflow decision only; it does not apply the change
            externally.
          </p>
        </div>
        <div className="review-actions">
          <button className="dismiss-button" onClick={onClose}>
            Cancel
          </button>
          <button className="complete-button" onClick={save} disabled={saving}>
            <Check size={17} /> {saving ? 'Saving…' : 'Save decision'}
          </button>
        </div>
      </aside>
    </div>
  );
}

function AccountSettings({ ctx }: { ctx: Ctx }) {
  const [profile, setProfile] = useState({
    name: ctx.user.name,
    email: ctx.user.email,
    currentPassword: '',
  });
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileState, setProfileState] = useState<{
    busy: boolean;
    message: string;
    error: string;
  }>({ busy: false, message: '', error: '' });
  const [passwordState, setPasswordState] = useState<{
    busy: boolean;
    message: string;
    error: string;
  }>({ busy: false, message: '', error: '' });
  const [members, setMembers] = useState<any[]>([]);
  const [memberState, setMemberState] = useState<{
    busy: boolean;
    message: string;
    error: string;
    setupUrl: string;
  }>({ busy: false, message: '', error: '', setupUrl: '' });
  const canManageUsers = members.some(
    (member) => member.userId === ctx.user.id && member.role === 'OWNER',
  );

  useEffect(() => {
    setProfile({ name: ctx.user.name, email: ctx.user.email, currentPassword: '' });
  }, [ctx.user.name, ctx.user.email]);
  const loadMembers = async () => {
    if (!ctx.selected) return setMembers([]);
    setMembers(await api<any[]>(`/api/businesses/${ctx.selected.id}/members`));
  };
  useEffect(() => {
    void loadMembers();
  }, [ctx.selected?.id]);

  const saveProfile = async (event: any) => {
    event.preventDefault();
    setProfileState({ busy: true, message: '', error: '' });
    try {
      const result = await api<{ user: Ctx['user'] }>('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify(profile),
      });
      ctx.updateUser(result.user);
      setProfile((value) => ({ ...value, currentPassword: '' }));
      setProfileState({ busy: false, message: 'Account details updated.', error: '' });
    } catch (error) {
      setProfileState({ busy: false, message: '', error: (error as Error).message });
    }
  };

  const savePassword = async (event: any) => {
    event.preventDefault();
    setPasswordState({ busy: true, message: '', error: '' });
    try {
      await api('/api/account/password', { method: 'PATCH', body: JSON.stringify(passwords) });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordState({
        busy: false,
        message: 'Password updated. Use the new password next time you sign in.',
        error: '',
      });
    } catch (error) {
      setPasswordState({ busy: false, message: '', error: (error as Error).message });
    }
  };
  const createUser = async (event: any) => {
    event.preventDefault();
    if (!ctx.selected) return;
    const form = event.currentTarget;
    setMemberState({ busy: true, message: '', error: '', setupUrl: '' });
    try {
      const result = await api<any>(`/api/businesses/${ctx.selected.id}/members`, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      form.reset();
      setMemberState({
        busy: false,
        message: result.existingAccount
          ? 'Existing user added to this business.'
          : 'User created. A secure setup email has been sent when email delivery is configured.',
        error: '',
        setupUrl: result.developmentSetupUrl ?? '',
      });
      await loadMembers();
    } catch (error) {
      setMemberState({ busy: false, message: '', error: (error as Error).message, setupUrl: '' });
    }
  };

  return (
    <Page title="Account Settings" sub="Manage how you sign in to Click Marketing Agent.">
      <div className="settings-intro">
        <ShieldCheck size={20} />
        <div>
          <strong>Your account is protected</strong>
          <p>
            Your current password is required before login details can be changed. Passwords are
            securely hashed and cannot be viewed by Click Marketing Agent.
          </p>
        </div>
      </div>
      <div className="settings-grid">
        <form className="settings-card" onSubmit={saveProfile}>
          <div className="settings-card-heading">
            <span>
              <UserRound />
            </span>
            <div>
              <h2>Profile and login email</h2>
              <p>Update the name shown in the app or the email you use to sign in.</p>
            </div>
          </div>
          <label>
            Display name
            <input
              value={profile.name}
              onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              minLength={2}
              maxLength={100}
              required
            />
          </label>
          <label>
            Login email
            <input
              type="email"
              value={profile.email}
              onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              required
            />
          </label>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={profile.currentPassword}
              onChange={(event) => setProfile({ ...profile, currentPassword: event.target.value })}
              required
            />
            <small>Required to authorise these changes.</small>
          </label>
          {profileState.error && (
            <p className="settings-message error" role="alert">
              {profileState.error}
            </p>
          )}
          {profileState.message && (
            <p className="settings-message success" role="status">
              <Check size={15} />
              {profileState.message}
            </p>
          )}
          <button className="primary settings-submit" disabled={profileState.busy}>
            {profileState.busy ? 'Saving…' : 'Save account details'}
          </button>
        </form>
        <form className="settings-card" onSubmit={savePassword}>
          <div className="settings-card-heading">
            <span>
              <KeyRound />
            </span>
            <div>
              <h2>Change password</h2>
              <p>Choose a new password that you do not use on another service.</p>
            </div>
          </div>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(event) =>
                setPasswords({ ...passwords, currentPassword: event.target.value })
              }
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              value={passwords.newPassword}
              onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })}
              minLength={10}
              maxLength={128}
              required
            />
            <small>Use at least 10 characters.</small>
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              value={passwords.confirmPassword}
              onChange={(event) =>
                setPasswords({ ...passwords, confirmPassword: event.target.value })
              }
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          {passwordState.error && (
            <p className="settings-message error" role="alert">
              {passwordState.error}
            </p>
          )}
          {passwordState.message && (
            <p className="settings-message success" role="status">
              <Check size={15} />
              {passwordState.message}
            </p>
          )}
          <button
            className="primary settings-submit"
            disabled={passwordState.busy || passwords.newPassword !== passwords.confirmPassword}
          >
            {passwordState.busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
      <section className="team-settings">
        <div className="team-settings-heading">
          <div>
            <span className="eyebrow">BUSINESS ACCESS</span>
            <h2>Users for {ctx.selected?.name ?? 'this business'}</h2>
            <p>
              Create a user or add an existing account to the active business. Only business owners
              can do this.
            </p>
          </div>
        </div>
        {!ctx.selected ? (
          <div className="empty compact">
            <UserRound />
            <p>Create a business before adding users.</p>
          </div>
        ) : (
          <div className="team-layout">
            <div className="member-list">
              {members.map((member) => (
                <div className="member-row" key={member.userId}>
                  <span className="avatar">
                    {member.user.name
                      .split(/\s+/)
                      .map((part: string) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>{member.user.name}</strong>
                    <small>{member.user.email}</small>
                  </div>
                  <span className="pill">{member.role}</span>
                </div>
              ))}
              {!members.length && (
                <div className="empty compact">
                  <UserRound />
                  <p>No users found for this business.</p>
                </div>
              )}
            </div>
            {canManageUsers ? (
              <form className="add-user-form" onSubmit={createUser}>
                <h3>Add a user</h3>
                <p>
                  A new user receives a time-limited link to set their own password. Existing
                  account holders are added without changing their password.
                </p>
                <label>
                  Name
                  <input name="name" minLength={2} maxLength={100} required />
                </label>
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Access level
                  <select name="role" defaultValue="EDITOR">
                    <option value="MANAGER">Manager</option>
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                </label>
                {memberState.error && (
                  <p className="settings-message error" role="alert">
                    {memberState.error}
                  </p>
                )}
                {memberState.message && (
                  <p className="settings-message success" role="status">
                    <Check size={15} />
                    {memberState.message}
                  </p>
                )}
                {memberState.setupUrl && (
                  <a className="development-reset-link" href={memberState.setupUrl}>
                    Open development setup link →
                  </a>
                )}
                <button className="primary settings-submit" disabled={memberState.busy}>
                  {memberState.busy ? 'Creating…' : 'Create or add user'}
                </button>
              </form>
            ) : (
              <div className="add-user-form access-note">
                <ShieldCheck />
                <h3>Owner access required</h3>
                <p>
                  You can view this business’s users, but only its owner can create or add accounts.
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </Page>
  );
}

function Page({ title, sub, action, onAction, actionDisabled, actionIcon, children }: any) {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        {action && (
          <button className="primary" onClick={onAction} disabled={actionDisabled}>
            {actionIcon ?? <Plus size={17} />}
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
const SectionTitle = ({ title, link, to }: any) => (
  <div className="section-title">
    <h2>{title}</h2>
    {link && to && <Link to={to}>{link} →</Link>}
  </div>
);
const Loading = () => <div className="loading">Loading workspace…</div>;
function Auth({ done }: { done: () => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [developmentResetUrl, setDevelopmentResetUrl] = useState('');
  const submit = async (e: any) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError('');
    setMessage('');
    setDevelopmentResetUrl('');
    try {
      if (mode === 'forgot') {
        const result = await api<{ message: string; developmentResetUrl?: string }>(
          '/api/auth/forgot-password',
          {
            method: 'POST',
            body: JSON.stringify(Object.fromEntries(f)),
          },
        );
        setMessage(result.message);
        setDevelopmentResetUrl(result.developmentResetUrl ?? '');
        return;
      }
      await api(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(f)),
      });
      done();
    } catch (x) {
      setError((x as Error).message);
    }
  };
  return (
    <div className="auth">
      <div className="auth-art">
        <img
          className="login-logo"
          src="/brand/click-marketing-agent-logo.webp"
          alt="Click Marketing Agent — Where marketing just clicks"
        />
        <h1>
          Marketing clarity,
          <br />
          <em>one action at a time.</em>
        </h1>
        <p>
          Understand your website. Create better content. Grow every business from one calm
          workspace.
        </p>
      </div>
      <form onSubmit={submit}>
        <img
          className="auth-mobile-logo"
          src="/brand/click-marketing-agent-logo.webp"
          alt="Click Marketing Agent"
        />
        <span className="eyebrow">WELCOME</span>
        <h2>
          {mode === 'login'
            ? 'Sign in to your workspace'
            : mode === 'register'
              ? 'Create your account'
              : 'Reset your password'}
        </h2>
        {mode === 'forgot' && (
          <p className="auth-explanation">
            Enter your login email and we’ll send you a secure, time-limited reset link.
          </p>
        )}
        {mode === 'register' && (
          <label>
            Name
            <input name="name" required />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        {mode !== 'forgot' && (
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={10}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        {developmentResetUrl && (
          <a className="development-reset-link" href={developmentResetUrl}>
            Open development reset link →
          </a>
        )}
        <button className="primary">
          {mode === 'login'
            ? 'Sign in'
            : mode === 'register'
              ? 'Create account'
              : 'Send reset link'}
        </button>
        {mode === 'login' && (
          <button type="button" className="auth-text-button" onClick={() => setMode('forgot')}>
            Forgot your password?
          </button>
        )}
        {mode !== 'forgot' ? (
          <p>
            {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
            <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </a>
          </p>
        ) : (
          <p>
            Remembered it? <a onClick={() => setMode('login')}>Return to sign in</a>
          </p>
        )}
      </form>
    </div>
  );
}

function ResetPassword({ done }: { done: () => void }) {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [state, setState] = useState({ busy: false, error: '', message: '' });
  const submit = async (event: any) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setState({ busy: true, error: '', message: '' });
    try {
      const result = await api<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, ...values }),
      });
      setState({ busy: false, error: '', message: result.message });
    } catch (error) {
      setState({ busy: false, error: (error as Error).message, message: '' });
    }
  };
  const returnToLogin = () => {
    window.history.replaceState({}, '', '/');
    done();
  };
  return (
    <div className="auth reset-auth">
      <div className="auth-art">
        <img
          className="login-logo"
          src="/brand/click-marketing-agent-logo.webp"
          alt="Click Marketing Agent"
        />
        <h1>
          Choose a new,
          <br />
          <em>secure password.</em>
        </h1>
        <p>This reset link can be used once and expires automatically.</p>
      </div>
      <form onSubmit={submit}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Set a new password</h2>
        {!token && (
          <p className="error">
            This reset link is incomplete. Request a new one from the sign-in screen.
          </p>
        )}
        {!state.message && (
          <>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            {state.error && <p className="error">{state.error}</p>}
            <button className="primary" disabled={!token || state.busy}>
              {state.busy ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}
        {state.message && (
          <>
            <p className="auth-success">{state.message}</p>
            <button type="button" className="primary" onClick={returnToLogin}>
              Return to sign in
            </button>
          </>
        )}
      </form>
    </div>
  );
}
export function App() {
  const [user, setUser] = useState<any>();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Business | null>(null);
  const refresh = async () => {
    const b = await api<Business[]>('/api/businesses');
    setBusinesses(b);
    const stored = localStorage.getItem('business');
    setSelected(b.find((x) => x.id === stored) ?? b[0] ?? null);
  };
  const load = () =>
    api('/api/auth/me')
      .then((u) => {
        setUser(u);
        return refresh();
      })
      .catch(() => setUser(null));
  useEffect(() => {
    load();
  }, []);
  if (window.location.pathname === '/reset-password') return <ResetPassword done={load} />;
  if (user === undefined) return <Loading />;
  if (!user) return <Auth done={load} />;
  const select = (b: Business) => {
    setSelected(b);
    localStorage.setItem('business', b.id);
  };
  return <Shell ctx={{ user, businesses, selected, select, refresh, updateUser: setUser }} />;
}
