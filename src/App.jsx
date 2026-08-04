import { useState, useEffect, useMemo, useCallback } from 'react';
import BuildStep from './components/BuildStep.jsx';
import HarmonyStep from './components/HarmonyStep.jsx';
import ContrastStep from './components/ContrastStep.jsx';
import RolesStep from './components/RolesStep.jsx';
import ExportStep from './components/ExportStep.jsx';
import Insights from './components/Insights.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import {
  IconPalette, IconSparkle, IconEye, IconTag, IconDownload,
  IconSun, IconMoon, IconSettings,
} from './components/Icons.jsx';

import { normalizeHex } from './lib/color.js';
import { inferRoles } from './lib/roles.js';
import { findIssues, healthScore, scoreBand } from './lib/harmony.js';
import { decodeShare, savePalette, copyText } from './lib/exporters.js';
import { loadSettings } from './lib/brief.js';

const STEPS = [
  { id: 'build', label: 'Build palette', Icon: IconPalette },
  { id: 'harmony', label: 'Analyse harmony', Icon: IconSparkle },
  { id: 'contrast', label: 'Test contrast', Icon: IconEye },
  { id: 'roles', label: 'Assign roles', Icon: IconTag },
  { id: 'export', label: 'Use it', Icon: IconDownload },
];

/**
 * The palette the app opens with.
 *
 * Chosen by running candidates through this tool's own engine rather than by
 * eye: full role coverage, no harmony flags, health 100, and ten pairings that
 * pass AA for body text. The hero holds white text at 4.9:1, so the Statement
 * layout — which puts the hero behind a headline as a flat field — works
 * immediately rather than needing a fix first.
 *
 * A default that fails its own checks is a bad first impression for a tool
 * whose entire job is catching that.
 *
 * The olive went through two revisions for reasons the engine caught and the
 * eye would not have: a sage green at #6E8B7E fell below the neutral
 * threshold and was being classified as a third light neutral rather than an
 * accent, and a truer green was flagged as a hue orphan against the warm
 * colours. Pulling it towards olive keeps the contrast without the palette
 * reading as two unrelated halves.
 */
const DEFAULT_PALETTE = [
  '#FAF7F2', // page
  '#E7DFD1', // card surface
  '#B4543C', // hero — terracotta
  '#55693F', // accent — olive
  '#DFAE55', // accent — ochre
  '#1A1815', // ink
];

export default function App() {
  const [colors, setColors] = useState(DEFAULT_PALETTE);
  const [manualRoles, setManualRoles] = useState({});
  const [locked, setLocked] = useState([]);
  const [name, setName] = useState('Untitled palette');
  const [step, setStep] = useState('build');
  const [theme, setTheme] = useState('light');
  const [vibeId, setVibeId] = useState('modernist');
  const [cvd, setCvd] = useState('normal');
  const [settings, setSettings] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [addedCounts, setAddedCounts] = useState({});

  /* Step components unmount when you navigate away, so anything expensive to
     re-create — an uploaded logo, a chosen photograph — has to live here or
     it is lost every time you go back to change a colour. That was the whole
     point of the tool: change a colour, look at the logo again. */
  const [logoState, setLogoState] = useState({
    markId: 'arc',
    upload: null,
    mapping: {},
    fg: null,
    secondary: null,
    bg: null,
    largeSize: 240,
    grouped: true,
  });

  const [imageState, setImageState] = useState({
    on: false,
    images: [],
    selected: null,
    treatment: 'duotone',
    strength: 1,
    source: null,
    shadow: null,
    highlight: null,
    useHighlight: true,
    layout: 'split',
    hardEdge: false,
  });

  /* Roles are derived, not stored, so a colour change can never leave an
     orphaned role behind. Manual choices are layered on top. */
  const roles = useMemo(() => inferRoles(colors, manualRoles), [colors, manualRoles]);

  const { score } = useMemo(() => healthScore(colors), [colors]);
  const band = scoreBand(score);
  const issues = useMemo(() => findIssues(colors), [colors]);
  const flaggedIndices = useMemo(
    () => [...new Set(issues.filter((i) => i.index !== null).map((i) => i.index))],
    [issues]
  );

  /* ------------------------------------------------------------- effects */

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#p=')) return;
    const decoded = decodeShare(hash.slice(3));
    if (decoded?.colors?.length) {
      setColors(decoded.colors);
      setManualRoles(decoded.roles);
      if (decoded.name) setName(decoded.name);
      showToast('Palette loaded from link');
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message) => setToast(message), []);

  /* ------------------------------------------------------------- actions */

  const addColors = useCallback((hexes) => {
    const clean = (Array.isArray(hexes) ? hexes : [hexes]).map(normalizeHex).filter(Boolean);
    if (!clean.length) return;
    setColors((prev) => {
      const next = [...prev];
      for (const hex of clean) if (!next.includes(hex)) next.push(hex);
      return next;
    });
  }, []);

  /* Per-session counter, shown next to each suggestion group. It only tells
     you how much of the palette came from suggestions rather than from you. */
  const addFromSuggestion = useCallback((hex, kind = 'harmony') => {
    addColors([hex]);
    setAddedCounts((prev) => ({ ...prev, [kind]: (prev[kind] || 0) + 1 }));
  }, [addColors]);

  /* State updates are computed from the current value rather than inside an
     updater callback, because updaters must stay pure — StrictMode runs them
     twice, and a setState nested inside one fires twice with it. */
  const changeColor = useCallback((index, next) => {
    if (!next || colors.includes(next)) return;
    const previous = colors[index];
    setColors(colors.map((hex, i) => (i === index ? next : hex)));
    setManualRoles((roleMap) => {
      if (!roleMap[previous]) return roleMap;
      const { [previous]: role, ...rest } = roleMap;
      return { ...rest, [next]: role };
    });
    setLocked((list) => list.map((h) => (h === previous ? next : h)));
  }, [colors]);

  const removeAt = useCallback((index) => {
    const removed = colors[index];
    setColors(colors.filter((_, i) => i !== index));
    setManualRoles(({ [removed]: _drop, ...rest }) => rest);
    setLocked((list) => list.filter((h) => h !== removed));
  }, [colors]);

  const reorder = useCallback((from, to) => {
    setColors((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const toggleLock = useCallback((hex) => {
    setLocked((prev) => (prev.includes(hex) ? prev.filter((h) => h !== hex) : [...prev, hex]));
  }, []);

  const setRole = useCallback((hex, role) => {
    setManualRoles((prev) => ({ ...prev, [hex]: role }));
  }, []);

  const applyFix = useCallback((index, fix) => {
    changeColor(index, fix);
    showToast('Applied');
  }, [changeColor, showToast]);

  const copyHex = useCallback(async (hex) => {
    const ok = await copyText(hex);
    showToast(ok ? `${hex} copied` : 'Could not reach the clipboard');
  }, [showToast]);

  const savePresent = useCallback(() => {
    savePalette({
      id: `p-${Date.now()}`,
      name,
      colors,
      roles: manualRoles,
      savedAt: new Date().toISOString(),
    });
    showToast('Saved to this browser');
  }, [name, colors, manualRoles, showToast]);

  const loadPalette = useCallback((entry) => {
    setColors(entry.colors);
    setManualRoles(entry.roles || {});
    setName(entry.name || 'Untitled palette');
    setStep('build');
    showToast('Palette opened');
  }, [showToast]);

  /* -------------------------------------------------------------- render */

  const stepProps = { colors, roles, onGoTo: setStep };

  return (
    <div className="app">
      <header className="header">
        <h1 className="header-brand">Palletio</h1>

        <div className="header-strip" aria-hidden="true">
          {colors.slice(0, 12).map((hex, i) => (
            <span key={`${hex}-${i}`} className="header-chip" style={{ background: hex }} />
          ))}
        </div>

        <input
          className="header-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Palette name"
        />

        <span className="header-spacer" />

        <div className="health">
          <span className="health-label">Health</span>
          <div className="health-meter">
            <span className="health-fill" data-tone={band.tone} style={{ width: `${score}%` }} />
          </div>
          <span className="health-value">{score}</span>
        </div>

        <div className="header-actions">
          <button
            className="btn-icon"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
            title="A palette that only works on one background is not finished"
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>
          <button className="btn-icon" onClick={() => setSettingsOpen(true)} aria-label="Settings">
            <IconSettings />
          </button>
        </div>
      </header>

      <div className="body">
        <nav className="rail" aria-label="Workflow">
          <p className="rail-heading">Workflow</p>
          <ul className="rail-list">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  className="rail-item"
                  aria-current={step === s.id}
                  onClick={() => setStep(s.id)}
                >
                  <s.Icon />
                  <span className="grow">{s.label}</span>
                  {s.id === 'harmony' && issues.length > 0 && step !== 'harmony' && (
                    <span className="rail-flag" title={`${issues.length} issues`} />
                  )}
                  <span className="rail-index mono">{i + 1}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="rail-footer">
            <button className="rail-item" onClick={savePresent}>
              <span className="grow">Save palette</span>
            </button>
            <button
              className="rail-item"
              onClick={() => {
                setColors([]);
                setManualRoles({});
                setLocked([]);
                setName('Untitled palette');
                setStep('build');
              }}
            >
              <span className="grow">Start over</span>
            </button>
          </div>
        </nav>

        <main className="canvas">
          <div className="canvas-inner">
            {step === 'build' && (
              <BuildStep
                {...stepProps}
                locked={locked}
                flaggedIndices={flaggedIndices}
                settings={settings}
                onAdd={addColors}
                onChange={changeColor}
                onRemove={removeAt}
                onReorder={reorder}
                onToggleLock={toggleLock}
                onRoleChange={setRole}
                onCopy={copyHex}
                onToast={showToast}
              />
            )}

            {step === 'harmony' && (
              <HarmonyStep
                {...stepProps}
                locked={locked}
                onApplyFix={applyFix}
                onRemoveAt={removeAt}
              />
            )}

            {step === 'contrast' && <ContrastStep {...stepProps} />}

            {step === 'roles' && <RolesStep {...stepProps} onRoleChange={setRole} />}

            {step === 'export' && (
              <ExportStep
                colors={colors}
                roles={roles}
                name={name}
                vibeId={vibeId}
                onVibeChange={setVibeId}
                cvd={cvd}
                onCvdChange={setCvd}
                onToast={showToast}
                onSave={savePresent}
                settings={settings}
                logoState={logoState}
                onLogoState={setLogoState}
                imageState={imageState}
                onImageState={setImageState}
              />
            )}
          </div>
        </main>

        <Insights
          colors={colors}
          step={step}
          onAdd={addFromSuggestion}
          onGoTo={setStep}
          addedCounts={addedCounts}
        />
      </div>

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSettings}
          onClose={() => setSettingsOpen(false)}
          onLoadPalette={loadPalette}
          onToast={showToast}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
