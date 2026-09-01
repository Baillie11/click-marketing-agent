import { useEffect, useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Globe2,
  Library,
  CalendarDays,
  Inbox,
  ChartNoAxesCombined,
  Megaphone,
  Workflow,
  Settings,
  Search,
  Plus,
  Check,
  Clock3,
  AlertTriangle,
  CircleHelp,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { api } from './api';
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
  businesses: Business[];
  selected: Business | null;
  select: (b: Business) => void;
  refresh: () => Promise<void>;
};
const icons = {
  Dashboard: LayoutDashboard,
  Businesses: Building2,
  'Website & SEO': Globe2,
  Content: Library,
  Calendar: CalendarDays,
  'Approvals & Actions': Inbox,
  Analytics: ChartNoAxesCombined,
  Advertising: Megaphone,
  Automations: Workflow,
  Settings,
};
const nav = Object.entries(icons);
function Shell({ ctx }: { ctx: Ctx }) {
  const [open, setOpen] = useState(false);
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
          {nav.map(([label, Icon], i) => (
            <NavLink
              key={label}
              to={i === 0 ? '/dashboard' : `/${label.toLowerCase().replace(/ & | /g, '-')}`}
              className={i > 5 ? 'disabled' : ''}
            >
              <Icon size={19} />
              <span>{label}</span>
              {i > 5 && <small>Soon</small>}
            </NavLink>
          ))}
        </nav>
        <div className="aside-foot">
          <div className="avatar">AB</div>
          <div>
            <b>Account</b>
            <small>Workspace owner</small>
          </div>
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
            <button className="search">
              <Search size={17} /> Search
            </button>
            <span className="avatar">AB</span>
          </div>
        </header>
        <Routes>
          <Route path="/dashboard" element={<Dashboard ctx={ctx} />} />
          <Route path="/businesses" element={<Businesses ctx={ctx} />} />
          <Route path="/website-seo" element={<Seo ctx={ctx} />} />
          <Route path="/content" element={<Content ctx={ctx} />} />
          <Route path="/calendar" element={<Calendar ctx={ctx} />} />
          <Route path="/approvals-actions" element={<InboxPage ctx={ctx} />} />
          <Route path="/marketing-inbox" element={<InboxPage ctx={ctx} />} />
          <Route path="*" element={<Coming />} />
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
    >
      <div className="hero">
        <div>
          <span className="eyebrow score-title">TECHNICAL AUDIT HEALTH <ScoreTooltip /></span>
          <div className="score">
            {m.healthScore ?? '—'}
            <small>/100</small>
          </div>
          <p>{m.healthBreakdown?.label ?? 'Available after the first audit'} · Based on measurable technical checks, not Google rankings.</p>
        </div>
        <button onClick={() => (document.location.href = '/website-seo')}>
          View website report →
        </button>
      </div>
      <div className="metrics">
        <Metric icon={<Globe2 />} n={m.pages} label="Pages analysed" />
        <Metric icon={<AlertTriangle />} n={m.issues} label="SEO issues" tone="red" />
        <Metric icon={<Library />} n={m.drafts} label="Drafts to review" tone="purple" />
        <Metric icon={<Clock3 />} n={m.planned} label="Items planned" tone="gold" />
      </div>
      <div className="grid">
        <section>
          <SectionTitle title="Priority actions" link="Open Approvals & Actions" />
          <div className="empty">
            <Check />
            <h3>You’re all caught up</h3>
            <p>New recommendations will appear here after an audit or generation request.</p>
          </div>
        </section>
        <section>
          <SectionTitle title="Recent content" link="View library" />
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
const Metric = ({ icon, n, label, tone = 'blue' }: any) => (
  <div className={`metric ${tone}`}>
    <span>{icon}</span>
    <div>
      <strong>{n}</strong>
      <small>{label}</small>
    </div>
  </div>
);
function Businesses({ ctx }: { ctx: Ctx }) {
  return (
    <Page
      title="Businesses"
      sub="Manage the brands in your marketing workspace."
      action="Add business"
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
    </Page>
  );
}
function Seo({ ctx }: { ctx: Ctx }) {
  const [data, setData] = useState<any>();
  const [automation, setAutomation] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const load = async () => {
    if (!ctx.selected) return;
    const [seo, settings] = await Promise.all([
      api(`/api/businesses/${ctx.selected.id}/seo`),
      api(`/api/businesses/${ctx.selected.id}/automation`),
    ]);
    setData(seo);
    setAutomation(settings);
  };
  useEffect(() => {
    void load();
  }, [ctx.selected]);
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
      title="Website & SEO"
      sub="Understand the issues that matter, without the jargon."
      action={busy ? 'Crawling…' : 'Run website audit'}
      onAction={crawl}
    >
      <div className="seo-head">
        <div className="ring">
          {data?.healthScore ?? '—'}
          <small>/100</small>
        </div>
        <div>
          <span className="eyebrow score-title">TECHNICAL AUDIT HEALTH <ScoreTooltip /></span>
          <h2>{data?.healthBreakdown?.label ?? 'Not audited yet'}</h2>
          <p>
            {data?.issues?.length ?? 0} findings across {data?.healthBreakdown?.pagesAudited ?? 0} pages. This is not a Google ranking score.
          </p>
        </div>
      </div>
      {data?.healthBreakdown && (
        <details className="score-breakdown">
          <summary>How this score was calculated</summary>
          <p>Starts at 100. Each unique technical check receives a severity-weighted deduction. Repeated instances have diminishing impact based on the proportion of audited pages affected.</p>
          <div className="breakdown-grid">
            {data.healthBreakdown.bySeverity.filter((row: any) => row.findings > 0).map((row: any) => (
              <div key={row.severity}>
                <strong>{row.severity}</strong>
                <span>{row.findings} findings · {row.groupedChecks} unique checks</span>
                <b>−{row.pointsDeducted} points</b>
              </div>
            ))}
          </div>
          <small>{data.healthBreakdown.uniqueChecks} unique checks produced a total deduction of {data.healthBreakdown.penalty} points.</small>
        </details>
      )}
      {data?.currentCrawl && (
        <>
          <div className="audit-comparison" aria-label="Latest audit comparison">
            <div><strong>{data.comparison.current}</strong><small>Current findings</small></div>
            <div className="positive"><strong>{data.comparison.fixed}</strong><small>Fixed since last audit</small></div>
            <div><strong>{data.comparison.stillPresent}</strong><small>Still present</small></div>
            <div className={data.comparison.new ? 'negative' : ''}><strong>{data.comparison.new}</strong><small>New findings</small></div>
          </div>
          <details className="audit-history">
            <summary>View audit history ({data.history.length})</summary>
            {data.history.map((audit: any) => (
              <div key={audit.id}>
                <span>{new Date(audit.completedAt).toLocaleString()}</span>
                <span>{audit.pages} pages · {audit.issues} findings</span>
              </div>
            ))}
          </details>
        </>
      )}
      {automation && ctx.selected && (
        <AutomationPanel businessId={ctx.selected.id} value={automation} onChange={setAutomation} />
      )}
      <section>
        <SectionTitle title="SEO findings" link="" />
        {data?.issues?.length ? (
          data.issues.map((i: any) => (
            <div className="issue" key={i.id}>
              <span className={`severity ${i.severity.toLowerCase()}`}>{i.severity}</span>
              <div>
                <b>{i.title}</b>
                <p>{i.explanation}</p>
                <small>
                  {i.page?.url} · {i.status.replaceAll('_', ' ')}
                </small>
              </div>
              <button onClick={() => setSelectedIssue(i)}>Review</button>
            </div>
          ))
        ) : (
          <div className="empty">
            <Globe2 />
            <h3>No audit results yet</h3>
            <p>Run a website audit to discover pages and actionable SEO improvements.</p>
          </div>
        )}
      </section>
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

function ScoreTooltip() {
  return (
    <span className="score-tooltip" tabIndex={0} aria-label="About the technical audit health score">
      <CircleHelp size={15} />
      <span role="tooltip">An internal 0–100 measure of crawl-detectable technical health. It groups repeated checks and normalizes their impact by pages audited. It does not measure Google rankings, traffic, conversions or overall business quality.</span>
    </span>
  );
}

function AutomationPanel({ businessId, value, onChange }: any) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(value), [value]);
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
  const options: Array<[string, string, string]> = [
    ['RECOMMEND_ONLY', 'Recommend only', 'Show instructions and suggested content; never change the website.'],
    ['APPROVAL_REQUIRED', 'Require approval', 'Prepare each change and wait for a person to approve it.'],
    ['AUTO_LOW_RISK', 'Auto-fix selected issues', 'Apply only the enabled low-risk changes through a verified connector.'],
  ];
  const ruleOptions: Array<[string, string]> = [
    ['seoTitles', 'SEO titles'], ['metaDescriptions', 'Meta descriptions'],
    ['imageAltText', 'Image alternative text'], ['headings', 'Page headings'],
    ['internalLinks', 'Internal links'], ['pageCopy', 'Visible page copy'],
  ];
  return (
    <section className="automation-panel">
      <div className="automation-heading">
        <div><span className="eyebrow">CONTROLLED WEBSITE CHANGES</span><h2>How should fixes be handled?</h2></div>
        <span className={`connection-state ${connected ? 'connected' : ''}`}>
          {connected ? 'Site connected' : 'No site connection'}
        </span>
      </div>
      <div className="mode-options">
        {options.map(([mode, title, description]) => (
          <label className={draft.mode === mode ? 'selected' : ''} key={mode}>
            <input type="radio" name="automation-mode" value={mode}
              checked={draft.mode === mode}
              disabled={mode === 'AUTO_LOW_RISK' && !connected}
              onChange={() => { setSaved(false); setDraft({ ...draft, mode }); }} />
            <span><strong>{title}</strong><small>{description}</small></span>
          </label>
        ))}
      </div>
      <div className="automation-settings">
        <label>Website platform
          <select value={draft.connection?.provider ?? 'NONE'} onChange={(event) => {
            setSaved(false);
            setDraft({ ...draft, connection: { ...draft.connection, provider: event.target.value } });
          }}>
            <option value="NONE">Not selected</option><option value="WORDPRESS">WordPress</option>
            <option value="SHOPIFY">Shopify</option><option value="CUSTOM">Custom / API</option>
          </select>
        </label>
        <div className="rule-list"><strong>Allowed change types</strong>
          {ruleOptions.map(([key, label]) => (
            <label key={key}><input type="checkbox" checked={Boolean(rules[key])}
              onChange={(event) => updateRule(key, event.target.checked)} /> {label}</label>
          ))}
        </div>
      </div>
      <div className="automation-notice">
        <AlertTriangle size={18} />
        <span>Publishing is locked until a verified connector is installed. Normal website admin passwords will not be stored; supported connections will use revocable access tokens.</span>
      </div>
      <button className="automation-save" onClick={save}>{saved ? 'Settings saved' : 'Save automation settings'}</button>
    </section>
  );
}

function SeoReview({ issue, onClose, onStatus }: any) {
  const [suggestion, setSuggestion] = useState<any>(issue.suggestion);
  const [proposedValue, setProposedValue] = useState(issue.suggestion?.proposedValue ?? '');
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prepared, setPrepared] = useState(false);
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
  const [generationError, setGenerationError] = useState<{ message: string; actionUrl?: string } | null>(null);
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
          <div><span className="eyebrow">HOW THIS SECTION WORKS</span><h2>Your content production workspace</h2></div>
          <span className="score-tooltip content-help" tabIndex={0} aria-label="About the Content Library">
            <CircleHelp size={18} /><span role="tooltip">Items belong only to the currently selected business. Creating or approving an item does not publish it to a website or social network.</span>
          </span>
        </div>
        <div className="content-steps">
          <div><b>1</b><span><strong>Describe the topic</strong><small>Enter what you want the content to discuss and, where useful, its audience or purpose.</small></span></div>
          <div><b>2</b><span><strong>Create a draft</strong><small>Article creates a long-form SEO draft. Social set creates several platform-ready social drafts.</small></span></div>
          <div><b>3</b><span><strong>Review and edit</strong><small>Open an item below to edit its title and copy, then move it through the appropriate status.</small></span></div>
          <div><b>4</b><span><strong>Approve and schedule</strong><small>An approved item can be assigned a date for the calendar. Publishing is still completed manually.</small></span></div>
        </div>
        <details className="status-guide">
          <summary>What do the content statuses mean?</summary>
          <div><strong>Idea</strong><span>A topic worth developing.</span></div>
          <div><strong>Draft</strong><span>Work in progress; not ready to use.</span></div>
          <div><strong>Needs review</strong><span>Ready for another person to check.</span></div>
          <div><strong>Approved</strong><span>Accepted and ready to schedule or publish manually.</span></div>
          <div><strong>Published</strong><span>Manually marked after it has gone live.</span></div>
          <div><strong>Rejected</strong><span>Not suitable in its current form.</span></div>
        </details>
        <p className="content-publishing-note"><AlertTriangle size={17} /> The Content Library does not currently publish externally. Scheduling places an item on the in-app calendar; it does not automatically post it.</p>
      </section>
      {aiConfigured === false && (
        <div className="ai-setup-notice" role="status">
          <AlertTriangle size={21} />
          <div>
            <strong>AI generation needs to be connected</strong>
            <p>Create an OpenAI API key, add it to the server’s <code>.env</code> file as <code>OPENAI_API_KEY=your_key</code>, then restart <code>npm run dev</code>. Keep the key private—never paste it into this browser screen or commit it to Git.</p>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Open OpenAI API key settings →</a>
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
        <button disabled={!topic.trim() || generating} onClick={() => gen('article')} title="Generate one long-form SEO article draft">{generating ? 'Generating…' : 'Article'}</button>
        <button disabled={!topic.trim() || generating} className="secondary" onClick={() => gen('social')} title="Generate a coordinated set of social-media drafts">
          {generating ? 'Please wait…' : 'Social set'}
        </button>
      </div>
      <label className="article-style-picker">
        Article writing style
        <select value={articleStyle} onChange={(event) => setArticleStyle(event.target.value)}>
          <option value="NATURAL_EDITORIAL">Natural editorial — cohesive, warm and human</option>
          <option value="NEWS_FEATURE">News-style feature — journalistic and informative</option>
          <option value="PRACTICAL_GUIDE">Practical guide — useful advice with restrained lists</option>
        </select>
        <small>This choice applies to Article only. News-style does not invent current events, interviews or statistics.</small>
      </label>
      <div className="generation-choices" aria-label="Content generation choices">
        <div><strong>Article</strong><span>Creates one longer, search-focused website or blog draft with a structured explanation and call to action.</span></div>
        <div><strong>Social set</strong><span>Creates three shorter drafts about the same topic: one each for Facebook, LinkedIn and Reddit.</span></div>
      </div>
      {generating && <p className="generation-progress" role="status"><Sparkles size={16} /> Creating your draft with AI. A full article can take up to about a minute—please keep this page open.</p>}
      {generationError && <div className="generation-error" role="alert"><strong>Generation failed:</strong> {generationError.message} {generationError.actionUrl && <a href={generationError.actionUrl} target="_blank" rel="noreferrer">Verify organisation →</a>}</div>}
      <section>
        <SectionTitle title={`${items.length} content items`} link="" />
        {items.map((i) => (
          <button className="row content-row content-item-button" key={i.id} onClick={() => setSelectedItem(i)}>
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
      {selectedItem && <ContentEditor item={selectedItem} onClose={() => setSelectedItem(null)} onSaved={async () => { setSelectedItem(null); await load(); }} />}
    </Page>
  );
}

function ContentEditor({ item, onClose, onSaved }: any) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const [status, setStatus] = useState(item.status);
  const [scheduledAt, setScheduledAt] = useState(item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/content/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, body, status, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null }),
      });
      await onSaved();
    } catch (error) {
      alert((error as Error).message);
    } finally { setSaving(false); }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <aside className="review-panel content-editor" role="dialog" aria-modal="true" aria-labelledby="content-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="review-header"><div><span className="eyebrow">CONTENT ITEM</span><small>{item.type.replaceAll('_', ' ')}</small></div><button className="icon-button" onClick={onClose} aria-label="Close editor"><X /></button></div>
        <div className="review-body">
          <h2 id="content-editor-title">Review and edit</h2>
          <label className="editor-field">Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="editor-field">Content<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={18} /></label>
          <div className="editor-options">
            <label className="editor-field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="IDEA">Idea</option><option value="DRAFT">Draft</option><option value="NEEDS_REVIEW">Needs review</option><option value="APPROVED">Approved</option><option value="PUBLISHED">Published</option><option value="REJECTED">Rejected</option></select></label>
            <label className="editor-field">Calendar date and time<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
          </div>
          <p className="review-note">Approval and scheduling are internal workflow steps. They do not publish this content externally.</p>
        </div>
        <div className="review-actions"><button className="dismiss-button" onClick={onClose}>Cancel</button><button className="complete-button" onClick={save} disabled={saving}><Check size={17} /> {saving ? 'Saving…' : 'Save changes'}</button></div>
      </aside>
    </div>
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
function InboxPage({ ctx }: { ctx: Ctx }) {
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [view, setView] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const load = () => ctx.selected && api<any[]>(`/api/recommendations?businessId=${ctx.selected.id}`).then(setItems);
  useEffect(() => {
    void load();
  }, [ctx.selected]);
  const decisionItems = items.filter((item) => item.source !== 'ONBOARDING' && Boolean(item.proposedValue?.trim()));
  const visibleItems = decisionItems.filter((item) =>
    view === 'ACTIVE'
      ? ['OPEN', 'IN_PROGRESS', 'APPROVED'].includes(item.status)
      : ['COMPLETED', 'REJECTED', 'DISMISSED'].includes(item.status),
  );
  const sourceLabel = (source: string) => source.startsWith('SEO_ISSUE:') ? 'Website & SEO' : source.replaceAll('_', ' ');
  return (
    <Page
      title="Approvals & Actions"
      sub="Only the marketing decisions and follow-ups that need your attention."
    >
      <section className="inbox-guide">
        <div className="content-guide-heading">
          <div><span className="eyebrow">WHAT THIS PAGE IS FOR</span><h2>What needs my decision or attention today?</h2></div>
          <span className="score-tooltip content-help" tabIndex={0} aria-label="About Approvals and Actions"><CircleHelp size={18} /><span role="tooltip">This queue contains prepared changes and important follow-ups—not every finding from the Website & SEO audit.</span></span>
        </div>
        <p>Website & SEO remains the complete diagnostic report. This page contains only prepared changes that need approval, work already in progress, and important follow-ups from content, rankings or automation. Ordinary audit findings stay in the audit area.</p>
        <div className="inbox-steps">
          <div><strong>1. Review</strong><span>Open the recommendation and compare the current situation with the proposed change.</span></div>
          <div><strong>2. Decide</strong><span>Approve it, reject it, dismiss it, or mark it in progress.</span></div>
          <div><strong>3. Complete</strong><span>After the work is actually done, mark it completed so it leaves your active workload.</span></div>
        </div>
        <details className="status-guide"><summary>What do the action statuses mean?</summary><div><strong>Open</strong><span>No decision has been made.</span></div><div><strong>In progress</strong><span>Someone is working on it.</span></div><div><strong>Approved</strong><span>The proposed action has been accepted, but is not necessarily implemented.</span></div><div><strong>Completed</strong><span>The action has been carried out.</span></div><div><strong>Rejected</strong><span>The proposal was reviewed and declined.</span></div><div><strong>Dismissed</strong><span>Hidden as irrelevant, duplicate or not currently useful.</span></div></details>
        <p className="content-publishing-note"><AlertTriangle size={17} /> Approving a recommendation records your decision only. It does not automatically publish content or alter the live website.</p>
      </section>
      <section>
        <div className="action-tabs">
          <button className={view === 'ACTIVE' ? 'active' : ''} onClick={() => setView('ACTIVE')}>Active ({decisionItems.filter((item) => ['OPEN', 'IN_PROGRESS', 'APPROVED'].includes(item.status)).length})</button>
          <button className={view === 'HISTORY' ? 'active' : ''} onClick={() => setView('HISTORY')}>History ({decisionItems.filter((item) => ['COMPLETED', 'REJECTED', 'DISMISSED'].includes(item.status)).length})</button>
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
              <button onClick={() => setSelectedItem(i)}>Review</button>
            </div>
          ))
        ) : (
          <div className="empty">
            <Inbox />
            <h3>{view === 'ACTIVE' ? 'No decisions need your attention' : 'No completed decisions yet'}</h3>
            <p>{view === 'ACTIVE' ? 'Continue working in Website & SEO or Content. Prepared changes will appear here when approval or follow-up is required.' : 'Completed, rejected and dismissed actions will be retained here.'}</p>
          </div>
        )}
      </section>
      {selectedItem && <RecommendationReview item={selectedItem} onClose={() => setSelectedItem(null)} onSaved={async () => { setSelectedItem(null); await load(); }} />}
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
      await api(`/api/recommendations/${item.id}`, { method: 'PATCH', body: JSON.stringify({ status, proposedValue }) });
      await onSaved();
    } catch (error) { alert((error as Error).message); } finally { setSaving(false); }
  };
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <aside className="review-panel inbox-review" role="dialog" aria-modal="true" aria-labelledby="inbox-review-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="review-header"><div><span className={`severity ${item.severity.toLowerCase()}`}>{item.severity}</span><small>{item.category}</small></div><button className="icon-button" onClick={onClose} aria-label="Close recommendation"><X /></button></div>
        <div className="review-body">
          <h2 id="inbox-review-title">{item.title}</h2>
          <div className="review-block"><span className="review-label">WHY IT IS HERE</span><p>{item.description}</p></div>
          {item.currentValue && <div className="review-block"><span className="review-label">CURRENT VALUE</span><div className="current-value">{item.currentValue}</div></div>}
          <label className="editor-field">Proposed change<textarea rows={8} value={proposedValue} onChange={(event) => setProposedValue(event.target.value)} placeholder="No proposed content has been prepared yet." /></label>
          <label className="editor-field">Decision or progress status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="APPROVED">Approved</option><option value="COMPLETED">Completed</option><option value="REJECTED">Rejected</option><option value="DISMISSED">Dismissed</option></select></label>
          <p className="review-note">Saving this status records the workflow decision only; it does not apply the change externally.</p>
        </div>
        <div className="review-actions"><button className="dismiss-button" onClick={onClose}>Cancel</button><button className="complete-button" onClick={save} disabled={saving}><Check size={17} /> {saving ? 'Saving…' : 'Save decision'}</button></div>
      </aside>
    </div>
  );
}
function Page({ title, sub, action, onAction, children }: any) {
  return (
    <div className="page">
      <div className="page-title">
        <div>
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        {action && (
          <button className="primary" onClick={onAction}>
            <Plus size={17} />
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
const SectionTitle = ({ title, link }: any) => (
  <div className="section-title">
    <h2>{title}</h2>
    {link && <a>{link} →</a>}
  </div>
);
const Loading = () => <div className="loading">Loading workspace…</div>;
const Coming = () => (
  <Page title="Coming soon" sub="This module is reserved for a later milestone.">
    <div className="empty">
      <Clock3 />
      <h3>Architecture ready, feature intentionally deferred</h3>
    </div>
  </Page>
);
function Auth({ done }: { done: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const submit = async (e: any) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
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
        <div className="brand light">
          <span>CM</span>
          <b>Click Marketing Agent</b>
        </div>
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
        <span className="eyebrow">WELCOME</span>
        <h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}</h2>
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
        <label>
          Password
          <input name="password" type="password" minLength={10} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <p>
          {mode === 'login' ? 'New here?' : 'Already registered?'}{' '}
          <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </a>
        </p>
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
  if (user === undefined) return <Loading />;
  if (!user) return <Auth done={load} />;
  const select = (b: Business) => {
    setSelected(b);
    localStorage.setItem('business', b.id);
  };
  return <Shell ctx={{ businesses, selected, select, refresh }} />;
}
