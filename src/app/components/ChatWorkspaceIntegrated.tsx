import React, { useState, useMemo, useEffect } from 'react';
import { useFilters } from '../lib/FilterContext';
import { useTier } from '../lib/TierContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input'; 
import { DiagnosticTest } from './DiagnosticTest';
import { DiagnosticResults } from './DiagnosticResults';
import { PracticeQuestion } from './PracticeQuestion';
import { 
  Target, 
  Dumbbell, 
  Play, 
  Sparkles, 
  AlertCircle, 
  Lock,
  CheckCircle, 
  HelpCircle, 
  ListChecks, 
  FileText, 
  Check, 
  Zap, 
  Pencil,
  BookOpen,
} from 'lucide-react';

type ViewState = 'welcome' | 'diagnostic' | 'diagnostic-results' | 'practice';

// ─── Course metadata with emoji logos and color themes ───────────────────────
const COURSE_META: Record<string, {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  tagline: string;
}> = {
  calculus1: {
    label: 'Differential Calculus',
    emoji: '∂',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    tagline: 'Limits, derivatives, and rates of change',
  },
  calculus2: {
    label: 'Integral Calculus',
    emoji: '∫',
    color: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    tagline: 'Integration, series, and accumulation',
  },
  calculus3: {
    label: 'Multivariate Calculus',
    emoji: '∇',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    tagline: 'Partial derivatives, vectors, and multiple integrals',
  },
  linearalgebra: {
    label: 'Linear Algebra',
    emoji: '⊕',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    tagline: 'Matrices, eigenvalues, and vector spaces',
  },
  differentialequations: {
    label: 'Differential Equations',
    emoji: "y'",
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    tagline: 'ODEs, Laplace transforms, and systems',
  },
  engineeringmath: {
    label: 'Engineering Mathematics',
    emoji: 'λ',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    tagline: 'Fourier, complex analysis, and numerical methods',
  },
  discretemath: {
    label: 'Discrete Mathematics',
    emoji: '∑',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    tagline: 'Logic, graphs, combinatorics, and proofs',
  },
  statistics: {
    label: 'Statistics & Probability',
    emoji: 'μ',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    tagline: 'Distributions, hypothesis testing, and inference',
  },
};

const COURSE_KNOWLEDGE_MAP: Record<string, { placeholder: string, keywords: string[] }> = {
  calculus1: {
    placeholder: "e.g. Chain Rule, Limits, Implicit Differentiation...",
    keywords: ["limit", "deriv", "diff", "contin", "chain", "power", "slope", "tangent", "inflection", "concav", "optimi", "rates", "implicit"]
  },
  calculus2: {
    placeholder: "e.g. Integration by Parts, Taylor Series, U-Substitution...",
    keywords: ["integ", "subst", "parts", "fraction", "series", "sequence", "taylor", "maclaurin", "converge", "diverge", "improper", "area", "volume", "arc"]
  },
  calculus3: {
    placeholder: "e.g. Partial Derivatives, Vector Fields, Multiple Integrals...",
    keywords: ["multi", "partial", "vector", "gradient", "diverge", "curl", "stoke", "green", "lagrange", "integral", "surface", "line", "spherical", "cylindric"]
  },
  linearalgebra: {
    placeholder: "e.g. Matrix Inversion, Eigenvalues, Vector Spaces...",
    keywords: ["matrix", "eigen", "deter", "vector", "space", "basis", "dimen", "rank", "nullity", "transfor", "ortho", "projec", "system", "gauss", "inver"]
  },
  differentialequations: {
    placeholder: "e.g. Laplace Transforms, Bernoulli Equations, First-Order ODEs...",
    keywords: ["ode", "pde", "bernoul", "laplace", "homo", "exact", "separ", "linear", "system", "character", "equilib", "stabil", "initial"]
  },
  engineeringmath: {
    placeholder: "e.g. Fourier Series, Complex Analysis, Numerical Methods...",
    keywords: ["fourier", "complex", "z-trans", "residue", "contour", "numer", "newton", "raphson", "runge", "kutta", "finite", "diff"]
  },
  discretemath: {
    placeholder: "e.g. Set Theory, Graph Theory, Logic Gates...",
    keywords: ["set", "logic", "bool", "graph", "tree", "combin", "permut", "recur", "induc", "modul", "algo", "finite"]
  },
  statistics: {
    placeholder: "e.g. Bayes' Theorem, Normal Distribution, Hypothesis Testing...",
    keywords: ["probab", "bayes", "distribu", "normal", "binom", "standard", "devia", "varianc", "mean", "median", "hypoth", "p-value", "regres", "correla", "sampl"]
  }
};

const TIER_LIMITS = {
  euclid: { diagnostics: 2, practice: 25 },
  aristotle: { diagnostics: 15, practice: Infinity },
  plato: { diagnostics: Infinity, practice: Infinity },
  socrates: { diagnostics: Infinity, practice: Infinity }
};

function readUsageFromStorage(tier: string, mode: string) {
  try {
    const history = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');
    const now = new Date();
    const thisMonth = history.filter((s: any) => {
      const d = new Date(s.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const usedDiags = thisMonth.filter((s: any) => s.setType === 'diagnostic').length;
    const usedPractice = thisMonth.filter((s: any) => s.setType === 'practice').length;
    const limits = TIER_LIMITS[tier as keyof typeof TIER_LIMITS] || TIER_LIMITS.euclid;
    const remValue = mode === 'diagnostic'
      ? (limits.diagnostics === Infinity ? '∞' : Math.max(0, limits.diagnostics - usedDiags))
      : (limits.practice === Infinity ? '∞' : Math.max(0, limits.practice - usedPractice));
    return { rem: remValue, hasAccess: remValue === '∞' || (typeof remValue === 'number' && remValue > 0) };
  } catch {
    return { rem: 0, hasAccess: false };
  }
}

export function ChatWorkspaceIntegrated() {
  const { selectedMode, selectedCourse, selectedQuestionType } = useFilters();
  const { currentTier = 'euclid' } = useTier() || {};
  
  const [viewState, setViewState] = useState<ViewState>('welcome');
  const [specificTopic, setSpecificTopic] = useState("");
  const [showError, setShowError] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [usage, setUsage] = useState(() => readUsageFromStorage(currentTier, selectedMode));

  const activeCourseId = useMemo(() => {
    if (Array.isArray(selectedCourse)) return selectedCourse[0] || 'calculus1';
    return selectedCourse || 'calculus1';
  }, [selectedCourse]);

  // All selected courses (for multi-select display)
  const allSelectedCourses = useMemo(() => {
    if (Array.isArray(selectedCourse)) return selectedCourse;
    return selectedCourse ? [selectedCourse] : [];
  }, [selectedCourse]);

  const currentCourseData = useMemo(() => {
    return COURSE_KNOWLEDGE_MAP[activeCourseId] || {
      placeholder: "Insert a specific topic...",
      keywords: []
    };
  }, [activeCourseId]);

  const activeCourseMeta = COURSE_META[activeCourseId] || {
    label: 'Mathematics',
    emoji: '∞',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    tagline: 'Select a course to begin',
  };

  useEffect(() => {
    setUsage(readUsageFromStorage(currentTier, selectedMode));
  }, [currentTier, selectedMode]);

  useEffect(() => {
    const onUpdate = () => setUsage(readUsageFromStorage(currentTier, selectedMode));
    window.addEventListener('atlas_usage_updated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      window.removeEventListener('atlas_usage_updated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, [currentTier, selectedMode]);

  useEffect(() => {
    setSpecificTopic("");
    setIsVerified(false);
    setShowError(false);
    setHasInteracted(false);
  }, [activeCourseId]);

  useEffect(() => {
    const input = (specificTopic || "").toLowerCase().trim();
    if (input.length < 3) { setIsVerified(false); return; }
    const matchFound = (currentCourseData.keywords || []).some(kw => input.includes(kw));
    setIsVerified(matchFound);
    if (matchFound) setShowError(false);
  }, [specificTopic, currentCourseData]);

  const formatInfo = useMemo(() => {
    const infoMap: any = {
      'true-false': { 
        label: 'True/False', 
        icon: <CheckCircle className="text-emerald-500" />, 
        detail: 'Focuses on conceptual properties and common misconceptions through binary logic choices.' 
      },
      'identification': { 
        label: 'Identification', 
        icon: <HelpCircle className="text-amber-500" />, 
        detail: 'Tests your ability to recognize and name specific theorems, definitions, and mathematical structures.' 
      },
      'solution': { 
        label: 'Solution-Based', 
        icon: <FileText className="text-rose-500" />, 
        detail: 'Requires a complete, multi-step derivation of the final answer including intermediate calculation logic.' 
      },
      'multiple-choice': { 
        label: 'Multiple Choice', 
        icon: <ListChecks className="text-indigo-500" />, 
        detail: 'Standardized assessment format measuring accuracy against common distractors and edge cases.' 
      }
    };
    return infoMap[selectedQuestionType] || infoMap['multiple-choice'];
  }, [selectedQuestionType]);

  const handleStart = () => {
    setHasInteracted(true);
    if (!specificTopic.trim() || !isVerified) {
      setShowError(true);
      return;
    }
    if (!usage.hasAccess) return;

    try {
      const history = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');
      history.push({
        timestamp: new Date().toISOString(),
        setType: selectedMode === 'diagnostic' ? 'diagnostic' : 'practice',
        topic: specificTopic,
        course: activeCourseId,
      });
      localStorage.setItem('atlas_test_history', JSON.stringify(history));
      window.dispatchEvent(new Event('atlas_usage_updated'));
    } catch (e) {
      console.error('Failed to record attempt:', e);
    }

    setViewState(selectedMode === 'diagnostic' ? 'diagnostic' : 'practice');
  };

  // ── Diagnostic test (fullscreen) ──
  if (viewState === 'diagnostic') return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto">
        <DiagnosticTest
          topic={specificTopic}
          onComplete={() => setViewState('diagnostic-results')}
        />
      </div>
    </div>
  );

  // ── Diagnostic results ──
  if (viewState === 'diagnostic-results') return (
    <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => setViewState('welcome')}
            variant="outline"
            className="rounded-2xl font-black text-xs uppercase tracking-widest"
          >
            ← Back to Workspace
          </Button>
        </div>
        <DiagnosticResults />
      </div>
    </div>
  );

  // ── Practice session (fullscreen) ──
  if (viewState === 'practice') return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => setViewState('welcome')}
            variant="outline"
            className="rounded-2xl font-black text-xs uppercase tracking-widest"
          >
            ← Exit Session
          </Button>
        </div>
        <PracticeQuestion topic={specificTopic} />
      </div>
    </div>
  );

  // ── Welcome / setup screen ──
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex justify-between items-start border-b pb-6 border-slate-100">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Sparkles className="text-indigo-600 w-8 h-8" strokeWidth={2.5} />
            AI Workspace
          </h1>
        </div>
        <span className="bg-slate-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
          {currentTier} Tier
        </span>
      </div>

      {/* ── Active Course Section ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <BookOpen size={14} className="text-slate-400" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Active Course{allSelectedCourses.length > 1 ? 's' : ''}
          </h3>
        </div>

        {allSelectedCourses.length === 0 ? (
          <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center">
            <p className="text-xs font-black uppercase text-slate-300 tracking-widest">No course selected — choose one from the sidebar</p>
          </div>
        ) : allSelectedCourses.length === 1 ? (
          /* Single course — large card */
          <div className={`p-6 rounded-2xl border-2 ${activeCourseMeta.borderColor} ${activeCourseMeta.bgColor} flex items-center gap-6`}>
            <div className={`w-16 h-16 rounded-2xl bg-white border ${activeCourseMeta.borderColor} flex items-center justify-center shadow-sm shrink-0`}>
              <span className={`text-2xl font-black ${activeCourseMeta.color}`} style={{ fontFamily: 'serif' }}>
                {activeCourseMeta.emoji}
              </span>
            </div>
            <div className="min-w-0">
              <p className={`text-[10px] font-black uppercase tracking-widest ${activeCourseMeta.color} opacity-70 mb-0.5`}>
                Selected Course
              </p>
              <h2 className={`text-xl font-black tracking-tight ${activeCourseMeta.color}`}>
                {activeCourseMeta.label}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">{activeCourseMeta.tagline}</p>
            </div>
          </div>
        ) : (
          /* Multiple courses — compact grid */
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allSelectedCourses.map((courseId) => {
              const meta = COURSE_META[courseId];
              if (!meta) return null;
              const isActive = courseId === activeCourseId;
              return (
                <div
                  key={courseId}
                  className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                    isActive
                      ? `${meta.borderColor} ${meta.bgColor} shadow-md`
                      : 'border-slate-100 bg-white opacity-60'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-white border ${meta.borderColor} flex items-center justify-center shrink-0 shadow-sm`}>
                    <span className={`text-base font-black ${meta.color}`} style={{ fontFamily: 'serif' }}>
                      {meta.emoji}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[9px] font-black uppercase tracking-widest truncate ${meta.color}`}>
                      {meta.label}
                    </p>
                    {isActive && (
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Active</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Target Concept ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-slate-600">
            <Pencil size={16} className="text-indigo-500" />
            <h3 className="text-xs font-black uppercase tracking-widest">Target Concept</h3>
          </div>
          {isVerified && (
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-emerald-100">
              <Check size={12} strokeWidth={4} /> Validated
            </div>
          )}
        </div>
        <div className="relative">
          <Input 
            placeholder={currentCourseData.placeholder}
            value={specificTopic}
            onChange={(e) => { setSpecificTopic(e.target.value); setHasInteracted(true); }}
            className={`h-16 bg-white border-2 text-lg font-medium px-6 rounded-2xl transition-all ${
              (hasInteracted && !isVerified && specificTopic.length > 2) ? 'border-red-400 bg-red-50' : 
              isVerified ? 'border-emerald-500 focus:border-emerald-600' : 'border-slate-200 focus:border-indigo-600'
            }`}
          />
          {(hasInteracted && !isVerified && specificTopic.length > 2) && (
            <div className="absolute right-4 top-5 text-red-500 flex items-center gap-1">
              <AlertCircle size={20} />
              <span className="text-[10px] font-black uppercase">Unrecognized</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-100 shadow-sm bg-slate-50/50">
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Logic Engine</h4>
              {formatInfo.icon}
            </div>
            <p className="text-lg font-black text-slate-800">{formatInfo.label}</p>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">{formatInfo.detail}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-100 shadow-sm bg-slate-50/50">
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Usage Monitor</h4>
              {selectedMode === 'diagnostic' ? <Target size={18} className="text-purple-500" /> : <Dumbbell size={18} className="text-blue-500" />}
            </div>
            <p className="text-lg font-black text-slate-800 capitalize">{selectedMode}</p>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-[10px] font-black uppercase text-slate-400">Remaining</span>
              <span className={`text-xs font-black ${usage.hasAccess ? 'text-indigo-600' : 'text-red-500'}`}>
                {usage.rem}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Initiate Panel ── */}
      <Card className={`border-none shadow-2xl rounded-[2.5rem] overflow-hidden transition-all duration-500 ${
        !isVerified ? 'bg-slate-100 grayscale' : (selectedMode === 'diagnostic' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white')
      }`}>
        <CardContent className="p-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-3 max-w-md text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Zap size={14} className={isVerified ? "text-indigo-400 animate-pulse" : "text-slate-400"} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">System Armed</span>
              </div>
              <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
                Start {selectedMode}
              </h2>
              <p className="text-sm font-medium opacity-70">
                {!usage.hasAccess
                  ? "No remaining attempts this month."
                  : isVerified ? `Ready for ${specificTopic}` : "Waiting for recognized input..."}
              </p>
            </div>

            <Button 
              onClick={handleStart}
              disabled={!usage.hasAccess || !isVerified}
              className="group h-24 px-10 text-xl font-black uppercase tracking-widest bg-white text-slate-900 hover:bg-slate-100 rounded-[2rem] shadow-2xl transition-all active:scale-95 disabled:opacity-30"
            >
              {!usage.hasAccess ? (
                <><Lock size={20} className="mr-2" /> Limit Reached</>
              ) : isVerified ? (
                <>Initiate <Play size={24} className="ml-4 fill-current group-hover:translate-x-1 transition-transform" /></>
              ) : (
                <><Lock size={20} className="mr-2" /> Locked</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}