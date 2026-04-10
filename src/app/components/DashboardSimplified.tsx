// ============================================================
// ANTHROPIC API KEY — pulled from env
// ============================================================
const ANTHROPIC_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFilters } from '../lib/FilterContext';
import { useTier } from '../lib/TierContext';
import { Card, CardContent, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area
} from 'recharts';
import {
  BarChart3, Lock, ChevronDown, ChevronUp, History,
  GraduationCap, Layers, CheckCircle2, Send, Sparkles, X
} from 'lucide-react';
import { InlineMath } from 'react-katex';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_RANK: Record<string, number> = { euclid: 0, aristotle: 1, plato: 2, socrates: 3 };

const PREREQUISITE_MAP: Record<string, { domain: string; topics: string[] }> = {
  "Calculus 1":    { domain: "Algebra & Trigonometry", topics: ["Unit Circle", "Rational Functions", "Trig Identities", "Limit Laws"] },
  "Calculus 2":    { domain: "Calculus 1",             topics: ["Differentiation Rules", "Fundamental Theorem", "Chain Rule", "U-Substitution"] },
  "Statistics":    { domain: "Arithmetic & Set Theory", topics: ["Combinations", "Set Notation", "Summation Properties"] },
  "Linear Algebra":{ domain: "Geometry & Systems",     topics: ["Vector Operations", "Systems of Equations", "Determinant Logic"] },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface TestResponse {
  questionText?: string;
  userAnswer?: string;
  userAnswerText?: string;
  correctAnswer?: string;
  correctAnswerText?: string;
  isCorrect?: boolean;
  rule?: string | string[];
  timeSpent?: number;
  explanation?: string;
  aiFeedback?: string;
  conceptualGap?: string;
  calculationSlip?: string;
}

interface TestSession {
  id?: string;
  timestamp: string;
  topic?: string;
  course?: string;
  setType?: string;
  results?: {
    accuracy?: number | null;
    responses?: TestResponse[];
    score?: number;
    total?: number;
    completed?: boolean;
  };
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Per-question chat state ──────────────────────────────────────────────────
interface QuestionChatState {
  thread: ChatMessage[];
  input: string;
  isThinking: boolean;
  isOpen: boolean;
}

// ─── Helper: determine if a session is truly complete ────────────────────────
// A session is complete if it has a numeric accuracy (including 0),
// OR if it has responses AND (score/total or completed flag)
function isSessionComplete(session: TestSession): boolean {
  const r = session.results;
  if (!r) return false;

  // Explicit accuracy value (including 0%)
  if (typeof r.accuracy === 'number') return true;

  // Fallback: has responses array with at least one item
  if (Array.isArray(r.responses) && r.responses.length > 0) return true;

  // Fallback: score + total present
  if (typeof r.score === 'number' && typeof r.total === 'number') return true;

  // Fallback: explicit completed flag
  if (r.completed === true) return true;

  return false;
}

// Derive accuracy from whatever data is available
function deriveAccuracy(session: TestSession): number | null {
  const r = session.results;
  if (!r) return null;

  if (typeof r.accuracy === 'number') return r.accuracy;

  if (typeof r.score === 'number' && typeof r.total === 'number' && r.total > 0) {
    return Math.round((r.score / r.total) * 100);
  }

  if (Array.isArray(r.responses) && r.responses.length > 0) {
    const correct = r.responses.filter(resp => resp.isCorrect === true).length;
    return Math.round((correct / r.responses.length) * 100);
  }

  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DashboardSimplified() {
  const { selectedMode, selectedCourse } = useFilters();
  const { currentTier } = useTier();

  const [diagnosticTests, setDiagnosticTests] = useState<TestSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Per-question chat state: keyed by chatId (`${sessionKey}-${questionIndex}`)
  const [questionChats, setQuestionChats] = useState<Record<string, QuestionChatState>>({});

  // Store context (question data) per chatId
  const chatContexts = useRef<Record<string, TestResponse>>({});

  // Refs for scroll-to-bottom per chat
  const chatEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasAccess = (required: string) =>
    (TIER_RANK[currentTier] ?? 0) >= (TIER_RANK[required] ?? 0);

  // ─── Data loading ──────────────────────────────────────────────────────────
  const loadDashboardData = useCallback(() => {
    try {
      const raw = localStorage.getItem('atlas_test_history');
      const parsed: TestSession[] = raw ? JSON.parse(raw) : [];
      setDiagnosticTests(
        [...parsed].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    } catch (e) {
      console.error('Error loading dashboard data:', e);
      setDiagnosticTests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    // Listen for any relevant events that signal new session data
    const events = ['atlas_usage_updated', 'atlas_session_complete', 'storage'];
    const handler = () => loadDashboardData();
    events.forEach(ev => window.addEventListener(ev, handler));

    // Also poll localStorage every 5s for changes from other tabs/components
    const interval = setInterval(loadDashboardData, 5000);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, handler));
      clearInterval(interval);
    };
  }, [loadDashboardData]);

  // ─── Derived course value ─────────────────────────────────────────────────
  const activeCourses = useMemo(
    () => [selectedCourse].flat().filter(Boolean) as string[],
    [selectedCourse]
  );
  const singleCourse = activeCourses[0] ?? null;

  // ─── Filtered data ────────────────────────────────────────────────────────
  const filteredData = useMemo(() => diagnosticTests.filter(test => {
    const matchesCourse = activeCourses.length === 0 || activeCourses.includes(test.course ?? '');
    let matchesMode = true;
    if (selectedMode === 'practice') matchesMode = test.setType === 'practice';
    else if (selectedMode === 'diagnostic') matchesMode = test.setType !== 'practice';
    return matchesCourse && matchesMode;
  }), [diagnosticTests, activeCourses, selectedMode]);

  // Use the fixed isSessionComplete — no more false "incomplete" labels
  const completedData = useMemo(
    () => filteredData.filter(isSessionComplete),
    [filteredData]
  );

  // ─── Stats (uses derived accuracy so even sessions without explicit accuracy field count) ──
  const stats = useMemo(() => {
    if (completedData.length === 0) return { accuracy: 0, velocity: 0, maturity: 0, trendData: [] };

    const accValues = completedData.map(t => deriveAccuracy(t) ?? 0);
    const accuracy = Math.round(accValues.reduce((s, a) => s + a, 0) / accValues.length);

    let velocity = 0;
    if (completedData.length >= 4) {
      const last3  = accValues.slice(0, 3).reduce((s, a) => s + a, 0) / 3;
      const first3 = accValues.slice(-3).reduce((s, a) => s + a, 0) / 3;
      velocity = Math.round(last3 - first3);
    }

    const trendData = [...completedData].reverse().map((t, index) => ({
      id: t.id ?? `idx-${index}`,
      date: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      accuracy: deriveAccuracy(t) ?? 0,
    }));

    return {
      accuracy,
      velocity,
      maturity: Math.min(100, Math.round(accuracy * 0.7 + completedData.length * 2)),
      trendData,
    };
  }, [completedData]);

  // ─── Mastery data ─────────────────────────────────────────────────────────
  const masteryData = useMemo(() => {
    const ruleMap: Record<string, { total: number; correct: number; time: number }> = {};

    filteredData
      .filter(t => Array.isArray(t.results?.responses))
      .forEach(test => {
        test.results!.responses!.forEach(r => {
          const rules: string[] = Array.isArray(r.rule) ? r.rule : r.rule ? [r.rule] : [];
          rules.forEach(name => {
            if (!ruleMap[name]) ruleMap[name] = { total: 0, correct: 0, time: 0 };
            ruleMap[name].total++;
            if (r.isCorrect) ruleMap[name].correct++;
            ruleMap[name].time += r.timeSpent ?? 0;
          });
        });
      });

    return Object.entries(ruleMap).map(([name, s]) => {
      const acc = Math.round((s.correct / s.total) * 100);
      return {
        name,
        accuracy: acc,
        avgTime: Math.round(s.time / s.total),
        volume: s.total,
        projectedGrade: Math.min(100, Math.round(acc * 0.95)),
        runway: Math.max(0, Math.ceil((90 - acc) / 5)),
      };
    });
  }, [filteredData]);

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderMixedText = (text?: string) => {
    if (!text) return null;
    const parts = text.split(/(\$.*?\$)/g);
    return (
      <span>
        {parts.map((p, i) =>
          p.startsWith('$') && p.endsWith('$')
            ? <InlineMath key={i} math={p.slice(1, -1)} />
            : <span key={i}>{p}</span>
        )}
      </span>
    );
  };

  // ─── Session key ──────────────────────────────────────────────────────────
  const sessionKey = (session: TestSession) => session.id ?? session.timestamp;

  // ─── Anthropic API call ───────────────────────────────────────────────────
  const callAnthropicAPI = async (messages: ChatMessage[], systemPrompt: string): Promise<string> => {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any)?.error?.message ?? `API error ${response.status}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: any) => b.type === 'text');
    return textBlock?.text ?? 'No response from AI.';
  };

  const buildSystemPrompt = (resp: TestResponse): string => {
    const rules = Array.isArray(resp.rule) ? resp.rule.join(', ') : resp.rule ?? 'the topic';
    return [
      'You are Atlas, a concise math tutor AI embedded in a student dashboard.',
      `The student just answered a question about: ${rules}.`,
      resp.questionText     ? `Question: ${resp.questionText}` : '',
      resp.correctAnswerText ? `Correct answer: ${resp.correctAnswerText}` : '',
      (resp.userAnswerText ?? resp.userAnswer)
        ? `Student answer: ${resp.userAnswerText ?? resp.userAnswer}` : '',
      resp.isCorrect !== undefined
        ? `The student was ${resp.isCorrect ? 'correct' : 'incorrect'}.` : '',
      resp.explanation ? `Explanation: ${resp.explanation}` : '',
      'Give clear, step-by-step guidance. Use LaTeX inside $...$ for math. Be encouraging but concise.',
    ].filter(Boolean).join('\n');
  };

  // ─── Per-question chat helpers ────────────────────────────────────────────
  const getChatState = (chatId: string): QuestionChatState =>
    questionChats[chatId] ?? { thread: [], input: '', isThinking: false, isOpen: false };

  const updateChat = (chatId: string, patch: Partial<QuestionChatState>) =>
    setQuestionChats(prev => ({
      ...prev,
      [chatId]: { ...getChatState(chatId), ...patch },
    }));

  const scrollToBottom = (chatId: string) => {
    setTimeout(() => chatEndRefs.current[chatId]?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // Open and initialise AI tutor for a specific question
  const handleOpenTutor = async (resp: TestResponse, chatId: string) => {
    if (!hasAccess('socrates')) return;

    // Toggle off if already open
    const current = getChatState(chatId);
    if (current.isOpen) {
      updateChat(chatId, { isOpen: false });
      return;
    }

    updateChat(chatId, { isOpen: true });

    // Already initialised — just open
    if (current.thread.length > 0) return;

    chatContexts.current[chatId] = resp;
    updateChat(chatId, { isThinking: true });

    try {
      const systemPrompt = buildSystemPrompt(resp);
      const initialUserMsg: ChatMessage = {
        role: 'user',
        content: `Please explain this problem and why ${resp.isCorrect ? 'my answer was correct' : 'I got it wrong'}.`,
      };
      const reply = await callAnthropicAPI([initialUserMsg], systemPrompt);
      updateChat(chatId, {
        thread: [initialUserMsg, { role: 'assistant', content: reply }],
        isThinking: false,
      });
      scrollToBottom(chatId);
    } catch (e: any) {
      updateChat(chatId, {
        thread: [{ role: 'assistant', content: `Error: ${e.message}` }],
        isThinking: false,
      });
    }
  };

  // Send follow-up in a specific question's chat
  const sendMessage = async (chatId: string) => {
    const state = getChatState(chatId);
    if (!state.input.trim() || state.isThinking) return;

    const msg = state.input.trim();
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const updatedThread = [...state.thread, userMsg];

    updateChat(chatId, { thread: updatedThread, input: '', isThinking: true });

    try {
      const resp = chatContexts.current[chatId];
      const systemPrompt = resp
        ? buildSystemPrompt(resp)
        : 'You are Atlas, a concise and encouraging math tutor AI.';

      const reply = await callAnthropicAPI(updatedThread, systemPrompt);
      updateChat(chatId, {
        thread: [...updatedThread, { role: 'assistant', content: reply }],
        isThinking: false,
      });
      scrollToBottom(chatId);
    } catch (e: any) {
      updateChat(chatId, {
        thread: [...updatedThread, { role: 'assistant', content: `Error: ${e.message}` }],
        isThinking: false,
      });
    }
  };

  // ─── Toggle session expansion ─────────────────────────────────────────────
  const toggleSession = (key: string) => {
    setExpandedSession(prev => (prev === key ? null : key));
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-10 text-center animate-pulse uppercase font-black text-slate-300">
      Generating Audit...
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20 text-slate-800">
      {/* Header */}
      <div className="flex justify-between items-end border-b pb-4 border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <BarChart3 className="text-indigo-600 w-8 h-8" /> Analytics
          </h1>
          <LocalBadge className="bg-indigo-600 text-white mt-2 inline-block">{currentTier} Tier</LocalBadge>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Audit Status"
          value={completedData.length === 0 ? 'No Data' : stats.accuracy >= 80 ? 'Proficient' : 'Developing'}
          color={stats.accuracy >= 80 ? 'text-emerald-600' : 'text-amber-600'}
        />
        <MetricCard label="Mean Accuracy" value={`${stats.accuracy}%`} color="text-indigo-600" />
        <MetricCard
          label="Velocity"
          value={hasAccess('plato')
            ? (completedData.length < 4 ? 'Need 4+ sessions' : `${stats.velocity > 0 ? '+' : ''}${stats.velocity}%`)
            : <Lock size={14} />}
          color="text-emerald-600"
        />
        <MetricCard
          label="Maturity"
          value={hasAccess('socrates') ? stats.maturity : <Lock size={14} />}
          color="text-indigo-400"
          dark
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="descriptive" className="space-y-6 pt-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl w-full md:w-fit">
          {['descriptive', 'inferential', 'roadmap', 'history'].map(tab => (
            <TabsTrigger key={tab} value={tab} className="rounded-lg font-bold uppercase text-[10px]">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── DESCRIPTIVE ── */}
        <TabsContent value="descriptive" className="space-y-10">
          {completedData.length === 0 ? (
            <EmptyState message="Complete a diagnostic or practice session to see your performance flow." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4 px-2">
                  Performance Flow ({completedData.length} sessions)
                </CardTitle>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trendData} margin={{ left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} unit="%" />
                      <Tooltip formatter={(val: number) => [`${val}%`, 'Accuracy']} />
                      <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" dot={{ r: 3, fill: '#6366f1' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4 px-2">Volume Analysis</CardTitle>
                <div className="h-[250px]">
                  {masteryData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs font-black uppercase">No rule-level data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={masteryData} layout="vertical" margin={{ left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 700 }} width={80} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="volume" fill="#c7d2fe" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── INFERENTIAL ── */}
        <TabsContent value="inferential" className="space-y-10">
          {!hasAccess('plato') ? <ProUpgradeOverlay tier="Plato" /> : completedData.length === 0 ? (
            <EmptyState message="Complete a session to unlock inferential analytics." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="p-6 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-indigo-600 mb-4">Mastery Runway</CardTitle>
                <div className="h-[250px]">
                  {masteryData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-300 text-xs font-black uppercase">No rule-level data yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={masteryData.slice(0, 5)} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 700 }} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="runway" fill="#818cf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <Card className="border-none shadow-xl bg-slate-900 text-white h-[250px] flex flex-col justify-center items-center text-center">
                <GraduationCap className="text-indigo-400 mb-2 opacity-40" size={40} />
                <div className="text-7xl font-black italic">
                  {Math.min(98, Math.round(stats.accuracy * 0.9 + 10))}%
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-2">Exam Grade Forecast</p>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── ROADMAP ── */}
        <TabsContent value="roadmap" className="space-y-10">
          {!hasAccess('plato') ? <ProUpgradeOverlay tier="Plato" /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <Layers size={16} className="text-red-600" />
                  <h3 className="text-sm font-black uppercase">External Foundation</h3>
                </div>
                <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                  <p className="text-[10px] font-black text-red-700 uppercase mb-3">
                    Domain: {PREREQUISITE_MAP[singleCourse ?? '']?.domain ?? 'Math'}
                  </p>
                  <div className="space-y-3">
                    {(PREREQUISITE_MAP[singleCourse ?? '']?.topics ?? ['Basic Algebra']).map((topic, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs font-bold text-red-900 bg-white p-3 rounded-xl border border-red-100">
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <h3 className="text-sm font-black uppercase">Module Progress</h3>
                </div>
                {masteryData.length === 0 ? (
                  <EmptyState message="No topic data yet. Complete a session to populate this." />
                ) : (
                  <div className="space-y-3">
                    {masteryData.slice(0, 5).map((t, i) => (
                      <div key={i} className="flex justify-between items-center p-4 rounded-xl bg-white border border-slate-100 shadow-sm">
                        <span className="text-sm font-bold">{t.name}</span>
                        <span className="text-sm font-black italic">{t.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── HISTORY ── */}
        <TabsContent value="history" className="space-y-4">
          {filteredData.length === 0 ? (
            <EmptyState message="No session history found. Start a diagnostic or practice session." />
          ) : filteredData.map(session => {
            const key = sessionKey(session);
            const isExpanded = expandedSession === key;
            const complete = isSessionComplete(session);
            const accuracy = deriveAccuracy(session);

            return (
              <Card key={key} className="overflow-hidden border-slate-100 shadow-none">
                <div
                  className="p-4 bg-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleSession(key)}
                >
                  <div className="flex items-center gap-4">
                    <History size={18} className="text-slate-300" />
                    <div>
                      <h4 className="font-bold text-sm">{session.topic}</h4>
                      <p className="text-[9px] text-slate-400 font-black uppercase">
                        {new Date(session.timestamp).toLocaleDateString()} · {session.setType}
                        {complete
                          ? accuracy !== null ? ` · ${accuracy}%` : ' · Completed'
                          : ' · Incomplete'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-xl font-black italic">
                      {accuracy !== null ? `${accuracy}%` : '—'}
                    </p>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="bg-slate-50 border-t p-6 space-y-4">
                    {!session.results?.responses ? (
                      <EmptyState message="This session was not completed — no question data available." />
                    ) : !hasAccess('plato') ? (
                      <ProUpgradeOverlay tier="Plato" />
                    ) : session.results.responses.map((resp, idx) => {
                      const chatId = `${key}-${idx}`;
                      const chatState = getChatState(chatId);
                      const userAnswerDisplay   = resp.userAnswerText   ?? resp.userAnswer   ?? '—';
                      const correctAnswerDisplay = resp.correctAnswerText ?? resp.correctAnswer ?? '—';

                      return (
                        <div key={chatId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          {/* Header row */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <LocalBadge className={resp.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}>
                              {resp.isCorrect ? 'Correct' : 'Wrong'}
                            </LocalBadge>
                            {hasAccess('socrates') ? (
                              <Button
                                variant="ghost"
                                className={`h-7 text-[10px] font-black uppercase transition-colors ${
                                  chatState.isOpen
                                    ? 'text-slate-500 hover:bg-slate-50'
                                    : 'text-indigo-600 hover:bg-indigo-50'
                                }`}
                                onClick={() => handleOpenTutor(resp, chatId)}
                              >
                                {chatState.isOpen
                                  ? <><X size={12} className="mr-1.5" /> Close Tutor</>
                                  : <><Sparkles size={12} className="mr-1.5" /> AI Tutor</>
                                }
                              </Button>
                            ) : (
                              <div className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                                <Lock size={10} /> Socrates for AI
                              </div>
                            )}
                          </div>

                          {/* Question */}
                          <div className="text-sm font-bold text-slate-700">
                            {renderMixedText(resp.questionText)}
                          </div>

                          {/* Answer comparison */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-3 rounded-xl border bg-slate-50">
                              <p className="text-[8px] font-black uppercase opacity-50 mb-1">Your Answer</p>
                              <p className="text-xs font-bold">{renderMixedText(userAnswerDisplay)}</p>
                            </div>
                            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50">
                              <p className="text-[8px] font-black uppercase opacity-50 mb-1">Correct Answer</p>
                              <p className="text-xs font-bold">{renderMixedText(correctAnswerDisplay)}</p>
                            </div>
                          </div>

                          {/* Explanation */}
                          {resp.explanation && (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[8px] font-black uppercase opacity-50 mb-1">Explanation</p>
                              <p className="text-xs text-slate-600">{renderMixedText(resp.explanation)}</p>
                            </div>
                          )}

                          {/* AI feedback from test runner */}
                          {resp.aiFeedback && (
                            <div className={`p-3 rounded-xl border text-xs font-semibold ${resp.isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                              <p className="text-[8px] font-black uppercase opacity-50 mb-1">AI Feedback</p>
                              {renderMixedText(resp.aiFeedback)}
                            </div>
                          )}

                          {/* ── Per-question AI Tutor Chat ── */}
                          {hasAccess('socrates') && chatState.isOpen && (
                            <div className="mt-2 border border-indigo-100 rounded-2xl bg-indigo-50/30 p-4 space-y-3">
                              <p className="text-[8px] font-black uppercase text-indigo-400 tracking-widest mb-2">Atlas AI Tutor</p>

                              {/* Message thread */}
                              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                {chatState.thread.length === 0 && chatState.isThinking && (
                                  <div className="text-[10px] font-black text-slate-400 uppercase animate-pulse">Thinking...</div>
                                )}
                                {chatState.thread.map((msg, mIdx) => (
                                  <div key={mIdx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                                      msg.role === 'user'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white border border-slate-200 text-slate-700 font-medium'
                                    }`}>
                                      {renderMixedText(msg.content)}
                                    </div>
                                  </div>
                                ))}
                                {chatState.thread.length > 0 && chatState.isThinking && (
                                  <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase animate-pulse">
                                      Thinking...
                                    </div>
                                  </div>
                                )}
                                <div ref={el => { chatEndRefs.current[chatId] = el; }} />
                              </div>

                              {/* Input */}
                              <div className="flex gap-2 pt-1">
                                <input
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                                  placeholder="Ask a follow-up question..."
                                  value={chatState.input}
                                  onChange={e => updateChat(chatId, { input: e.target.value })}
                                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(chatId)}
                                  disabled={chatState.isThinking}
                                />
                                <Button
                                  size="sm"
                                  className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                                  onClick={() => sendMessage(chatId)}
                                  disabled={chatState.isThinking || !chatState.input.trim()}
                                >
                                  <Send size={14} />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const MetricCard = ({ label, value, color, dark = false }: {
  label: string; value: React.ReactNode; color: string; dark?: boolean;
}) => (
  <Card className={`border-none ${dark ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 shadow-sm'}`}>
    <CardContent className="p-4 text-center">
      <p className="text-[9px] font-black uppercase text-slate-400 mb-1">{label}</p>
      <div className={`text-2xl font-black italic ${color}`}>{value}</div>
    </CardContent>
  </Card>
);

const ProUpgradeOverlay = ({ tier }: { tier: string }) => (
  <div className="py-20 text-center border-dashed border-2 rounded-2xl">
    <Lock className="mx-auto text-slate-200 mb-2" />
    <p className="text-xs font-black uppercase text-slate-400 tracking-widest">Requires {tier} Tier</p>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="py-16 text-center border-dashed border-2 border-slate-100 rounded-2xl">
    <p className="text-xs font-black uppercase text-slate-300 tracking-widest">{message}</p>
  </div>
);

const LocalBadge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${className}`}>
    {children}
  </span>
);
