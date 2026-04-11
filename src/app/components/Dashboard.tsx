const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useFilters } from '../lib/FilterContext';
import { useTier } from '../lib/TierContext';
import { Card, CardContent, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import {
  BarChart3, Lock, ChevronDown, ChevronUp, History,
  GraduationCap, Layers, CheckCircle2, Send, Sparkles, X
} from 'lucide-react';
import { InlineMath } from 'react-katex';

// ─── Constants ────────────────────────────────────────────────────────────────
const TIER_RANK: Record<string, number> = { euclid: 0, aristotle: 1, plato: 2, socrates: 3 };

const PREREQUISITE_MAP: Record<string, { domain: string; topics: string[] }> = {
  'Calculus 1':     { domain: 'Algebra & Trigonometry', topics: ['Unit Circle', 'Rational Functions', 'Trig Identities', 'Limit Laws'] },
  'Calculus 2':     { domain: 'Calculus 1',             topics: ['Differentiation Rules', 'Fundamental Theorem', 'Chain Rule', 'U-Substitution'] },
  'Statistics':     { domain: 'Arithmetic & Set Theory', topics: ['Combinations', 'Set Notation', 'Summation Properties'] },
  'Linear Algebra': { domain: 'Geometry & Systems',     topics: ['Vector Operations', 'Systems of Equations', 'Determinant Logic'] },
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

interface QuestionChatState {
  thread: ChatMessage[];
  input: string;
  isThinking: boolean;
  isOpen: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isSessionComplete(session: TestSession): boolean {
  const r = session.results;
  if (!r) return false;
  if (typeof r.accuracy === 'number') return true;
  if (Array.isArray(r.responses) && r.responses.length > 0) return true;
  if (typeof r.score === 'number' && typeof r.total === 'number') return true;
  return r.completed === true;
}

function deriveAccuracy(session: TestSession): number | null {
  const r = session.results;
  if (!r) return null;
  if (typeof r.accuracy === 'number') return r.accuracy;
  if (typeof r.score === 'number' && typeof r.total === 'number' && r.total > 0)
    return Math.round((r.score / r.total) * 100);
  if (Array.isArray(r.responses) && r.responses.length > 0) {
    const correct = r.responses.filter(resp => resp.isCorrect === true).length;
    return Math.round((correct / r.responses.length) * 100);
  }
  return null;
}

function getAllResponses(sessions: TestSession[]): TestResponse[] {
  const out: TestResponse[] = [];
  sessions.forEach(s => {
    if (Array.isArray(s.results?.responses)) out.push(...s.results!.responses!);
  });
  return out;
}

function getRuleMap(sessions: TestSession[]) {
  const map: Record<string, { total: number; correct: number; time: number }> = {};
  getAllResponses(sessions).forEach(r => {
    const rules: string[] = Array.isArray(r.rule) ? r.rule : r.rule ? [r.rule] : [];
    rules.forEach(name => {
      if (!map[name]) map[name] = { total: 0, correct: 0, time: 0 };
      map[name].total++;
      if (r.isCorrect) map[name].correct++;
      map[name].time += r.timeSpent ?? 0;
    });
  });
  return Object.entries(map).map(([name, s]) => ({
    name,
    total: s.total,
    correct: s.correct,
    accuracy: Math.round((s.correct / s.total) * 100),
    avgTime: Math.round(s.time / s.total),
    runway: Math.max(0, Math.ceil((90 - Math.round((s.correct / s.total) * 100)) / 5)),
  })).sort((a, b) => b.total - a.total);
}

// ─── Groq API ─────────────────────────────────────────────────────────────────
async function callGroqAPI(messages: ChatMessage[], systemPrompt: string): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.4,
      max_tokens: 1024,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Groq API error ${response.status}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'No response from AI.';
}

function buildSystemPrompt(resp: TestResponse): string {
  const rules = Array.isArray(resp.rule) ? resp.rule.join(', ') : resp.rule ?? 'this topic';
  return [
    'You are Atlas, a concise and encouraging math tutor embedded in a student dashboard.',
    `Topic: ${rules}.`,
    resp.questionText      ? `Question: ${resp.questionText}` : '',
    (resp.correctAnswerText ?? resp.correctAnswer)
      ? `Correct answer: ${resp.correctAnswerText ?? resp.correctAnswer}` : '',
    (resp.userAnswerText ?? resp.userAnswer)
      ? `Student answered: ${resp.userAnswerText ?? resp.userAnswer}` : '',
    resp.isCorrect !== undefined
      ? `Student was ${resp.isCorrect ? 'correct' : 'incorrect'}.` : '',
    resp.explanation ? `Explanation on file: ${resp.explanation}` : '',
    'Keep responses to 2–4 short paragraphs. Use $...$ for inline LaTeX. Be step-by-step and encouraging.',
  ].filter(Boolean).join('\n');
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function DashboardSimplified() {
  const { selectedMode, selectedCourse } = useFilters();
  const { currentTier } = useTier();

  const [diagnosticTests, setDiagnosticTests] = useState<TestSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionChats, setQuestionChats] = useState<Record<string, QuestionChatState>>({});

  const chatContexts = useRef<Record<string, TestResponse>>({});
  const chatEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const hasAccess = (required: string) =>
    (TIER_RANK[currentTier] ?? 0) >= (TIER_RANK[required] ?? 0);

  // ─── Data loading ─────────────────────────────────────────────────────────
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
    const handler = () => loadDashboardData();
    window.addEventListener('atlas_usage_updated', handler);
    window.addEventListener('storage', handler);
    document.addEventListener('visibilitychange', handler);
    return () => {
      window.removeEventListener('atlas_usage_updated', handler);
      window.removeEventListener('storage', handler);
      document.removeEventListener('visibilitychange', handler);
    };
  }, [loadDashboardData]);

  // ─── Derived data ─────────────────────────────────────────────────────────
  const activeCourses = useMemo(
    () => [selectedCourse].flat().filter(Boolean) as string[],
    [selectedCourse]
  );
  const singleCourse = activeCourses[0] ?? null;

  const filteredData = useMemo(() => diagnosticTests.filter(test => {
    const matchesCourse = activeCourses.length === 0 || activeCourses.includes(test.course ?? '');
    let matchesMode = true;
    if (selectedMode === 'practice') matchesMode = test.setType === 'practice';
    else if (selectedMode === 'diagnostic') matchesMode = test.setType !== 'practice';
    return matchesCourse && matchesMode;
  }), [diagnosticTests, activeCourses, selectedMode]);

  const completedData = useMemo(() => filteredData.filter(isSessionComplete), [filteredData]);

  const ruleMap = useMemo(() => getRuleMap(completedData), [completedData]);
  const allResponses = useMemo(() => getAllResponses(completedData), [completedData]);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!completedData.length) return { accuracy: 0, velocity: 0, maturity: 0, stddev: 0, consistency: 0, trendData: [], correct: 0, incorrect: 0, avgTime: 0 };
    const accs = completedData.map(t => deriveAccuracy(t) ?? 0);
    const accuracy = Math.round(accs.reduce((s, a) => s + a, 0) / accs.length);
    const variance = accs.reduce((s, a) => s + (a - accuracy) ** 2, 0) / accs.length;
    const stddev = Math.round(Math.sqrt(variance));
    const consistency = Math.max(0, 100 - stddev * 2);
    let velocity = 0;
    if (completedData.length >= 4) {
      const last3  = accs.slice(0, 3).reduce((s, a) => s + a, 0) / 3;
      const first3 = accs.slice(-3).reduce((s, a) => s + a, 0) / 3;
      velocity = Math.round(last3 - first3);
    }
    const correct = allResponses.filter(r => r.isCorrect).length;
    const incorrect = allResponses.length - correct;
    const avgTime = allResponses.length
      ? Math.round(allResponses.reduce((s, r) => s + (r.timeSpent ?? 0), 0) / allResponses.length) : 0;
    const trendData = [...completedData].reverse().map((t, i) => ({
      id: t.id ?? `idx-${i}`,
      date: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      accuracy: deriveAccuracy(t) ?? 0,
    }));
    return { accuracy, velocity, stddev, consistency, correct, incorrect, avgTime, trendData,
      maturity: Math.min(100, Math.round(accuracy * 0.7 + completedData.length * 2)) };
  }, [completedData, allResponses]);

  // ─── Chat helpers ─────────────────────────────────────────────────────────
  const getChatState = (chatId: string): QuestionChatState =>
    questionChats[chatId] ?? { thread: [], input: '', isThinking: false, isOpen: false };

  const updateChat = (chatId: string, patch: Partial<QuestionChatState>) =>
    setQuestionChats(prev => ({ ...prev, [chatId]: { ...getChatState(chatId), ...patch } }));

  const scrollToBottom = (chatId: string) =>
    setTimeout(() => chatEndRefs.current[chatId]?.scrollIntoView({ behavior: 'smooth' }), 50);

  const handleOpenTutor = async (resp: TestResponse, chatId: string) => {
    if (!hasAccess('socrates')) return;
    const current = getChatState(chatId);
    if (current.isOpen) { updateChat(chatId, { isOpen: false }); return; }
    updateChat(chatId, { isOpen: true });
    if (current.thread.length > 0) return;
    chatContexts.current[chatId] = resp;
    updateChat(chatId, { isThinking: true });
    try {
      const systemPrompt = buildSystemPrompt(resp);
      const initMsg: ChatMessage = {
        role: 'user',
        content: `Please explain this problem and why I was ${resp.isCorrect ? 'correct' : 'wrong'}. Walk me through the solution step by step.`,
      };
      const reply = await callGroqAPI([initMsg], systemPrompt);
      updateChat(chatId, { thread: [initMsg, { role: 'assistant', content: reply }], isThinking: false });
      scrollToBottom(chatId);
    } catch (e: any) {
      updateChat(chatId, { thread: [{ role: 'assistant', content: `Error: ${e.message}` }], isThinking: false });
    }
  };

  const sendMessage = async (chatId: string) => {
    const state = getChatState(chatId);
    if (!state.input.trim() || state.isThinking) return;
    const msg = state.input.trim();
    const userMsg: ChatMessage = { role: 'user', content: msg };
    const updatedThread = [...state.thread, userMsg];
    updateChat(chatId, { thread: updatedThread, input: '', isThinking: true });
    try {
      const resp = chatContexts.current[chatId];
      const systemPrompt = resp ? buildSystemPrompt(resp) : 'You are Atlas, a concise and encouraging math tutor.';
      const reply = await callGroqAPI(updatedThread, systemPrompt);
      updateChat(chatId, { thread: [...updatedThread, { role: 'assistant', content: reply }], isThinking: false });
      scrollToBottom(chatId);
    } catch (e: any) {
      updateChat(chatId, { thread: [...updatedThread, { role: 'assistant', content: `Error: ${e.message}` }], isThinking: false });
    }
  };

  // ─── Render helpers ───────────────────────────────────────────────────────
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

  const sessionKey = (session: TestSession) => session.id ?? session.timestamp;
  const toggleSession = (key: string) => setExpandedSession(prev => prev === key ? null : key);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-10 text-center animate-pulse uppercase font-black text-slate-300">
      Generating Audit...
    </div>
  );

  const examForecast = Math.min(98, Math.round(stats.accuracy * 0.9 + 10));
  const scoreDistBins = [0, 0, 0, 0, 0];
  completedData.forEach(s => {
    const a = deriveAccuracy(s) ?? 0;
    scoreDistBins[Math.min(4, Math.floor(a / 20))]++;
  });
  const distData = ['0–20%', '21–40%', '41–60%', '61–80%', '81–100%'].map((label, i) => ({
    label, count: scoreDistBins[i],
  }));

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Mean Accuracy" value={`${stats.accuracy}%`}
          color={stats.accuracy >= 80 ? 'text-emerald-600' : stats.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'} />
        <MetricCard label="Sessions" value={completedData.length} color="text-indigo-600" />
        <MetricCard label="Questions Seen" value={allResponses.length} color="text-slate-700" />
        <MetricCard label="Velocity"
          value={hasAccess('plato') ? (completedData.length < 4 ? '—' : `${stats.velocity > 0 ? '+' : ''}${stats.velocity}%`) : <Lock size={14} />}
          color="text-emerald-600" />
        <MetricCard label="Maturity"
          value={hasAccess('socrates') ? stats.maturity : <Lock size={14} />}
          color="text-indigo-400" dark />
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
        <TabsContent value="descriptive" className="space-y-6">
          {completedData.length === 0 ? (
            <EmptyState message="Complete a session to see your performance analytics." />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend */}
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">
                    Performance Flow ({completedData.length} sessions)
                  </CardTitle>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.trendData} margin={{ left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} unit="%" />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                        <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" dot={{ r: 3, fill: '#6366f1' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Correct vs Incorrect */}
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Correct vs Incorrect</CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="h-[140px] w-[140px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={[{ name: 'Correct', value: stats.correct }, { name: 'Incorrect', value: stats.incorrect }]}
                            cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" strokeWidth={0}>
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Total answered</span><span className="font-bold">{allResponses.length}</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Correct</span><span className="font-bold text-emerald-600">{stats.correct}</span></div>
                      <div className="flex justify-between py-1 border-b border-slate-100"><span className="text-slate-500">Incorrect</span><span className="font-bold text-red-500">{stats.incorrect}</span></div>
                      <div className="flex justify-between py-1"><span className="text-slate-500">Avg time/q</span><span className="font-bold">{stats.avgTime}s</span></div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Topic accuracy bars */}
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Accuracy by Topic</CardTitle>
                {ruleMap.length === 0
                  ? <p className="text-xs text-slate-400">No topic data yet</p>
                  : <div className="space-y-2">
                      {ruleMap.slice(0, 10).map(r => {
                        const col = r.accuracy >= 80 ? '#22c55e' : r.accuracy >= 60 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={r.name} className="flex items-center gap-3 text-xs">
                            <span className="w-32 flex-shrink-0 truncate text-slate-500" title={r.name}>{r.name}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${r.accuracy}%`, background: col }} />
                            </div>
                            <span className="w-9 text-right font-bold">{r.accuracy}%</span>
                            <span className="w-7 text-right text-slate-400">{r.total}q</span>
                          </div>
                        );
                      })}
                    </div>
                }
              </Card>

              {/* Per-session bar chart */}
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Per-Session Scores</CardTitle>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.trendData} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} unit="%" />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                      <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}
                        fill="#6366f1"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── INFERENTIAL ── */}
        <TabsContent value="inferential" className="space-y-6">
          {!hasAccess('plato') ? <ProUpgradeOverlay tier="Plato" /> : completedData.length === 0 ? (
            <EmptyState message="Complete sessions to unlock inferential analytics." />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stats summary */}
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Statistical Summary</CardTitle>
                  <div className="space-y-2 text-xs">
                    {[
                      ['Mean accuracy', `${stats.accuracy}%`],
                      ['Std deviation', `±${stats.stddev}%`],
                      ['Consistency score', `${stats.consistency}/100`],
                      ['Velocity (trend)', completedData.length < 4 ? 'Need 4+ sessions' : `${stats.velocity > 0 ? '+' : ''}${stats.velocity}%`],
                      ['Avg time / question', `${stats.avgTime}s`],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between py-1.5 border-b border-slate-100">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Exam forecast */}
                <Card className="border-none shadow-xl bg-slate-900 text-white flex flex-col justify-center items-center text-center p-6">
                  <GraduationCap className="text-indigo-400 mb-2 opacity-40" size={36} />
                  <div className="text-7xl font-black italic">{examForecast}%</div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-2">Exam Grade Forecast</p>
                  <p className="text-[9px] text-slate-600 mt-1">{completedData.length} session{completedData.length > 1 ? 's' : ''} · ±{stats.stddev}% margin</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mastery runway */}
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-indigo-600 mb-4">Mastery Runway — est. sessions to 90%</CardTitle>
                  {ruleMap.filter(r => r.runway > 0).length === 0
                    ? <p className="text-xs text-slate-400">All topics near mastery — great work!</p>
                    : <div className="space-y-2">
                        {ruleMap.filter(r => r.runway > 0).slice(0, 8).map(r => (
                          <div key={r.name} className="flex items-center gap-3 text-xs">
                            <span className="w-32 flex-shrink-0 truncate text-slate-500">{r.name}</span>
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min(100, r.runway * 12)}%` }} />
                            </div>
                            <span className="w-8 text-right text-slate-400">{r.runway}s</span>
                          </div>
                        ))}
                      </div>
                  }
                </Card>

                {/* Strengths & gaps */}
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Strengths &amp; Gaps</CardTitle>
                  {ruleMap.filter(r => r.accuracy >= 80).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase text-emerald-600 mb-2">Strengths</p>
                      {ruleMap.filter(r => r.accuracy >= 80).slice(0, 4).map(r => (
                        <div key={r.name} className="text-xs py-0.5 text-slate-500">▸ {r.name} <span className="text-emerald-600 font-bold">{r.accuracy}%</span></div>
                      ))}
                    </div>
                  )}
                  {ruleMap.filter(r => r.accuracy < 70).length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-red-500 mb-2">Needs Work</p>
                      {ruleMap.filter(r => r.accuracy < 70).slice(0, 4).map(r => (
                        <div key={r.name} className="text-xs py-0.5 text-slate-500">▸ {r.name} <span className="text-red-500 font-bold">{r.accuracy}%</span></div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Score distribution */}
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Score Distribution</CardTitle>
                <div className="h-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData} margin={{ bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} />
                      <YAxis tick={{ fontSize: 9 }} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Sessions" radius={[4, 4, 0, 0]} fill="#818cf8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── ROADMAP ── */}
        <TabsContent value="roadmap" className="space-y-6">
          {!hasAccess('plato') ? <ProUpgradeOverlay tier="Plato" /> : (
            <>
              {/* Readiness */}
              {(() => {
                const readiness = stats.accuracy < 50
                  ? { label: 'Not ready', color: 'text-red-500', advice: 'Focus on fundamentals before attempting advanced topics.' }
                  : stats.accuracy < 70
                  ? { label: 'Developing', color: 'text-amber-600', advice: 'Core concepts forming. Strengthen weak topics before moving on.' }
                  : stats.accuracy < 85
                  ? { label: 'On track', color: 'text-emerald-600', advice: 'Good foundation. Push weak areas above 70% for solid readiness.' }
                  : { label: 'Ready to advance', color: 'text-indigo-600', advice: 'Strong performance. Challenge yourself with harder material or the next course.' };
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-4 border-none shadow-lg">
                      <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-3">Readiness Assessment</CardTitle>
                      <p className={`text-2xl font-black italic mb-2 ${readiness.color}`}>{readiness.label}</p>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">{readiness.advice}</p>
                      <div className="space-y-1 text-xs">
                        {[['Mean accuracy', `${stats.accuracy}%`], ['Topics tracked', ruleMap.length], ['Weak topics', ruleMap.filter(r => r.accuracy < 70).length]].map(([l, v]) => (
                          <div key={l as string} className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">{l}</span>
                            <span className="font-bold">{v}</span>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* Prerequisite check */}
                    <Card className="p-4 border-none shadow-lg">
                      <CardTitle className="text-[10px] font-black uppercase text-red-500 mb-3">
                        Prerequisite Check{singleCourse && PREREQUISITE_MAP[singleCourse] ? ` — ${PREREQUISITE_MAP[singleCourse].domain}` : ''}
                      </CardTitle>
                      {singleCourse && PREREQUISITE_MAP[singleCourse] ? (
                        <div className="space-y-1">
                          {PREREQUISITE_MAP[singleCourse].topics.map(topic => {
                            const found = ruleMap.find(r => r.name.toLowerCase().includes(topic.toLowerCase().split(' ')[0]));
                            const ok = found && found.accuracy >= 70;
                            return (
                              <div key={topic} className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-100">
                                <span className={`font-bold w-3 ${found ? (ok ? 'text-emerald-600' : 'text-red-500') : 'text-slate-300'}`}>
                                  {found ? (ok ? '✓' : '✗') : '?'}
                                </span>
                                <span className="flex-1 text-slate-600">{topic}</span>
                                {found
                                  ? <span className={`font-bold ${ok ? 'text-emerald-600' : 'text-red-500'}`}>{found.accuracy}%</span>
                                  : <span className="text-slate-300 text-[9px]">no data</span>
                                }
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Start a session for a tracked course (Calculus 1, Calculus 2, Statistics, Linear Algebra) to see prerequisite checks here.</p>
                      )}
                    </Card>
                  </div>
                );
              })()}

              {/* Next steps */}
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Personalised Next Steps</CardTitle>
                {ruleMap.length === 0
                  ? <EmptyState message="Complete a session to generate personalised recommendations." />
                  : (
                    <div className="space-y-4">
                      {ruleMap.filter(r => r.accuracy < 70).length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-red-500 mb-2">Priority focus — below 70%, drill these first</p>
                          {ruleMap.filter(r => r.accuracy < 70).slice(0, 3).map(r => (
                            <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 mb-2 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
                              <div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-slate-400">{r.accuracy}% · {r.total} questions</p></div>
                              <span className="text-slate-400">{r.runway} sessions est.</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {ruleMap.filter(r => r.accuracy >= 70 && r.accuracy < 85).length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-amber-600 mb-2">Consolidate — 70–85%, push to mastery</p>
                          {ruleMap.filter(r => r.accuracy >= 70 && r.accuracy < 85).slice(0, 3).map(r => (
                            <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 mb-2 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                              <div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-slate-400">{r.accuracy}% · {r.total} questions</p></div>
                              <span className="text-slate-400">{r.runway} sessions est.</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {ruleMap.filter(r => r.accuracy >= 85).length > 0 && (
                        <div>
                          <p className="text-[9px] font-black uppercase text-emerald-600 mb-2">Maintain — above 85%, keep fresh</p>
                          {ruleMap.filter(r => r.accuracy >= 85).slice(0, 3).map(r => (
                            <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 mb-2 text-xs">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                              <div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-slate-400">{r.accuracy}% · {r.total} questions</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
              </Card>

              {/* Full topic list */}
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">All Topics</CardTitle>
                {ruleMap.length === 0
                  ? <p className="text-xs text-slate-400">No topic data yet</p>
                  : ruleMap.map(r => {
                      const col = r.accuracy >= 85 ? 'text-emerald-600' : r.accuracy >= 70 ? 'text-amber-600' : 'text-red-500';
                      const dot = r.accuracy >= 85 ? 'bg-emerald-400' : r.accuracy >= 70 ? 'bg-amber-400' : 'bg-red-400';
                      return (
                        <div key={r.name} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 mb-2 text-xs">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                          <div className="flex-1"><p className="font-bold">{r.name}</p><p className="text-slate-400">{r.total} questions · avg {r.avgTime}s</p></div>
                          <span className={`font-black text-sm italic ${col}`}>{r.accuracy}%</span>
                        </div>
                      );
                    })
                }
              </Card>
            </>
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
                <div className="p-4 bg-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => toggleSession(key)}>
                  <div className="flex items-center gap-4">
                    <History size={18} className="text-slate-300" />
                    <div>
                      <h4 className="font-bold text-sm">{session.topic}</h4>
                      <p className="text-[9px] text-slate-400 font-black uppercase">
                        {new Date(session.timestamp).toLocaleDateString()} · {session.setType}
                        {complete ? (accuracy !== null ? ` · ${accuracy}%` : ' · Completed') : ' · Incomplete'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-xl font-black italic">{accuracy !== null ? `${accuracy}%` : '—'}</p>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="bg-slate-50 border-t p-6 space-y-4">
                    {!session.results?.responses ? (
                      <EmptyState message="This session has no question data." />
                    ) : !hasAccess('plato') ? (
                      <ProUpgradeOverlay tier="Plato" />
                    ) : session.results.responses.map((resp, idx) => {
                      const chatId = `${key}-${idx}`;
                      const chatState = getChatState(chatId);
                      const userAnswerDisplay    = resp.userAnswerText   ?? resp.userAnswer   ?? '—';
                      const correctAnswerDisplay = resp.correctAnswerText ?? resp.correctAnswer ?? '—';

                      return (
                        <div key={chatId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                          {/* Header */}
                          <div className="flex justify-between items-center border-b pb-2">
                            <LocalBadge className={resp.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}>
                              {resp.isCorrect ? 'Correct' : 'Wrong'}
                            </LocalBadge>
                            {hasAccess('socrates') ? (
                              <Button variant="ghost"
                                className={`h-7 text-[10px] font-black uppercase transition-colors ${chatState.isOpen ? 'text-slate-500 hover:bg-slate-50' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                onClick={() => handleOpenTutor(resp, chatId)}>
                                {chatState.isOpen
                                  ? <><X size={12} className="mr-1.5" /> Close Tutor</>
                                  : <><Sparkles size={12} className="mr-1.5" /> AI Tutor</>}
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

                          {/* Answers */}
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

                          {/* ── AI Tutor Chat (Groq) ── */}
                          {hasAccess('socrates') && chatState.isOpen && (
                            <div className="mt-2 border border-indigo-100 rounded-2xl bg-indigo-50/30 p-4 space-y-3">
                              <p className="text-[8px] font-black uppercase text-indigo-400 tracking-widest mb-2">Atlas AI Tutor</p>

                              <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                                {chatState.thread.length === 0 && chatState.isThinking && (
                                  <div className="text-[10px] font-black text-slate-400 uppercase animate-pulse">Thinking...</div>
                                )}
                                {chatState.thread.map((msg, mIdx) => (
                                  <div key={mIdx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
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

                              <div className="flex gap-2 pt-1">
                                <input
                                  className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
                                  placeholder="Ask a follow-up question..."
                                  value={chatState.input}
                                  onChange={e => updateChat(chatId, { input: e.target.value })}
                                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(chatId)}
                                  disabled={chatState.isThinking}
                                />
                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                                  onClick={() => sendMessage(chatId)}
                                  disabled={chatState.isThinking || !chatState.input.trim()}>
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
