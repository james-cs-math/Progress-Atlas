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
  AreaChart, Area, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, LineChart, Line, ReferenceLine,
} from 'recharts';
import {
  BarChart3, Lock, ChevronDown, ChevronUp, History,
  GraduationCap, Layers, CheckCircle2, Send, Sparkles, X,
  TrendingUp, TrendingDown, Minus, Target, Clock, Zap,
  AlertTriangle, Award, BookOpen, Brain, Map, Activity,
  MessageCircle, ChevronRight, RefreshCw,
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

const CHART_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

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
  const map: Record<string, { total: number; correct: number; time: number; recentAccuracies: number[] }> = {};
  sessions.forEach(s => {
    if (!Array.isArray(s.results?.responses)) return;
    s.results!.responses!.forEach(r => {
      const rules: string[] = Array.isArray(r.rule) ? r.rule : r.rule ? [r.rule] : [];
      rules.forEach(name => {
        if (!map[name]) map[name] = { total: 0, correct: 0, time: 0, recentAccuracies: [] };
        map[name].total++;
        if (r.isCorrect) map[name].correct++;
        map[name].time += r.timeSpent ?? 0;
        map[name].recentAccuracies.push(r.isCorrect ? 100 : 0);
      });
    });
  });
  return Object.entries(map).map(([name, s]) => {
    const accuracy = Math.round((s.correct / s.total) * 100);
    const trend = s.recentAccuracies.length >= 6
      ? Math.round(
          (s.recentAccuracies.slice(-3).reduce((a, b) => a + b, 0) / 3) -
          (s.recentAccuracies.slice(0, 3).reduce((a, b) => a + b, 0) / 3)
        )
      : 0;
    return {
      name,
      total: s.total,
      correct: s.correct,
      accuracy,
      avgTime: Math.round(s.time / s.total),
      runway: Math.max(0, Math.ceil((90 - accuracy) / 5)),
      trend,
      mastery: accuracy >= 85 ? 'mastered' : accuracy >= 70 ? 'developing' : 'struggling',
    };
  }).sort((a, b) => b.total - a.total);
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0) * ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return den === 0 ? 0 : num / den;
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
    if (!completedData.length) return {
      accuracy: 0, velocity: 0, maturity: 0, stddev: 0, consistency: 0,
      trendData: [], correct: 0, incorrect: 0, avgTime: 0,
      weeklyData: [], timeOfDayData: [], sessionLengthData: [],
      correlationScore: 0, streakDays: 0, bestStreak: 0,
      practiceCount: 0, diagnosticCount: 0,
    };

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
      questions: t.results?.responses?.length ?? 0,
    }));

    const xs = accs.map((_, i) => i);
    const correlationScore = Math.round(pearsonCorrelation(xs, [...accs].reverse()) * 100);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap: Record<string, { count: number; acc: number[] }> = {};
    days.forEach(d => { weeklyMap[d] = { count: 0, acc: [] }; });
    completedData.forEach(s => {
      const d = new Date(s.timestamp);
      const key = days[d.getDay()];
      weeklyMap[key].count++;
      weeklyMap[key].acc.push(deriveAccuracy(s) ?? 0);
    });
    const weeklyData = days.map(d => ({
      day: d,
      sessions: weeklyMap[d].count,
      avgAcc: weeklyMap[d].acc.length
        ? Math.round(weeklyMap[d].acc.reduce((a, b) => a + b, 0) / weeklyMap[d].acc.length)
        : 0,
    }));

    const practiceCount = filteredData.filter(s => s.setType === 'practice').length;
    const diagnosticCount = filteredData.filter(s => s.setType !== 'practice').length;

    let streakDays = 0;
    let bestStreak = 0;
    let cur = 0;
    const sessionDates = [...completedData]
      .map(s => new Date(s.timestamp).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    for (let i = 0; i < sessionDates.length; i++) {
      const d = new Date(sessionDates[i]);
      const prev = i === 0 ? new Date() : new Date(sessionDates[i - 1]);
      const diff = Math.round((prev.getTime() - d.getTime()) / 86400000);
      if (i === 0 || diff <= 1) { cur++; bestStreak = Math.max(bestStreak, cur); }
      else { cur = 1; }
    }
    streakDays = cur;

    return {
      accuracy, velocity, stddev, consistency, correct, incorrect, avgTime, trendData,
      weeklyData, correlationScore, streakDays, bestStreak, practiceCount, diagnosticCount,
      maturity: Math.min(100, Math.round(accuracy * 0.7 + completedData.length * 2)),
    };
  }, [completedData, allResponses, filteredData]);

  // ─── Chat helpers ─────────────────────────────────────────────────────────
  const getChatState = (chatId: string): QuestionChatState =>
    questionChats[chatId] ?? { thread: [], input: '', isThinking: false, isOpen: false };

  const updateChat = (chatId: string, patch: Partial<QuestionChatState>) =>
    setQuestionChats(prev => ({ ...prev, [chatId]: { ...getChatState(chatId), ...patch } }));

  const scrollToBottom = (chatId: string) =>
    setTimeout(() => chatEndRefs.current[chatId]?.scrollIntoView({ behavior: 'smooth' }), 80);

  const handleOpenTutor = async (resp: TestResponse, chatId: string) => {
    if (!hasAccess('socrates')) return;
    const current = getChatState(chatId);

    if (current.isOpen) {
      updateChat(chatId, { isOpen: false });
      return;
    }

    chatContexts.current[chatId] = resp;
    updateChat(chatId, { isOpen: true, isThinking: true });

    if (current.thread.length > 0) {
      updateChat(chatId, { isOpen: true, isThinking: false });
      return;
    }

    try {
      const systemPrompt = buildSystemPrompt(resp);
      const initMsg: ChatMessage = {
        role: 'user',
        content: `Please explain this problem and why I was ${resp.isCorrect ? 'correct' : 'wrong'}. Walk me through the solution step by step.`,
      };
      const reply = await callGroqAPI([initMsg], systemPrompt);
      updateChat(chatId, {
        thread: [initMsg, { role: 'assistant', content: reply }],
        isThinking: false,
        isOpen: true,
      });
      scrollToBottom(chatId);
    } catch (e: any) {
      updateChat(chatId, {
        thread: [{ role: 'assistant', content: `⚠️ ${e.message}` }],
        isThinking: false,
        isOpen: true,
      });
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
      updateChat(chatId, {
        thread: [...updatedThread, { role: 'assistant', content: reply }],
        isThinking: false,
      });
      scrollToBottom(chatId);
    } catch (e: any) {
      updateChat(chatId, {
        thread: [...updatedThread, { role: 'assistant', content: `⚠️ ${e.message}` }],
        isThinking: false,
      });
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

  // ─── Roadmap logic ─────────────────────────────────────────────────────────
  const roadmapReadiness = useMemo(() => {
    if (completedData.length === 0) return null;

    const weakTopics = ruleMap.filter(r => r.accuracy < 70);
    const developingTopics = ruleMap.filter(r => r.accuracy >= 70 && r.accuracy < 85);
    const masteredTopics = ruleMap.filter(r => r.accuracy >= 85);

    let score = stats.accuracy;
    score -= weakTopics.length * 4;
    score += stats.consistency * 0.1;
    if (stats.velocity > 0) score += Math.min(stats.velocity, 10);
    score = Math.max(0, Math.min(100, Math.round(score)));

    const level =
      score < 40  ? { label: 'Needs Foundation', color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',    icon: '🔴', advice: 'Core fundamentals need significant work. Focus exclusively on your weakest topics before attempting new material.' } :
      score < 55  ? { label: 'Early Development', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', icon: '🟠', advice: 'Some concepts are forming, but gaps remain. Drill weak topics daily with short focused sessions.' } :
      score < 70  ? { label: 'Building Momentum', color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '🟡', advice: 'Good base forming. Consistent practice on developing topics will unlock faster progress.' } :
      score < 80  ? { label: 'On Track',          color: 'text-lime-600',   bg: 'bg-lime-50',   border: 'border-lime-200',   icon: '🟢', advice: 'Solid foundation. Push developing topics above 85% and you\'ll be ready to advance.' } :
      score < 90  ? { label: 'Strong Performer',  color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200',icon: '✅', advice: 'Excellent performance. Maintain mastered topics and challenge yourself with harder problem sets.' } :
                    { label: 'Ready to Advance',   color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: '🏆', advice: 'Outstanding. You\'re ready for the next course level. Consider timed exam simulations.' };

    const actions: { priority: 'high' | 'medium' | 'low'; text: string; topic?: string }[] = [];
    weakTopics.slice(0, 3).forEach(t => actions.push({ priority: 'high', text: `Drill "${t.name}" — currently ${t.accuracy}%`, topic: t.name }));
    developingTopics.slice(0, 2).forEach(t => actions.push({ priority: 'medium', text: `Push "${t.name}" from ${t.accuracy}% → 85%+`, topic: t.name }));
    if (masteredTopics.length > 0) actions.push({ priority: 'low', text: `Maintain ${masteredTopics.length} mastered topic${masteredTopics.length > 1 ? 's' : ''} with periodic review` });
    if (stats.velocity < 0) actions.push({ priority: 'high', text: `Your accuracy is trending down (${stats.velocity}%). Review recent sessions for patterns.` });
    if (stats.consistency < 60) actions.push({ priority: 'medium', text: `High score variance (±${stats.stddev}%). Focus on reliability over peak scores.` });

    return { score, level, weakTopics, developingTopics, masteredTopics, actions };
  }, [completedData, ruleMap, stats]);

  // ─── Radar data ────────────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    return ruleMap.slice(0, 6).map(r => ({
      topic: r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name,
      accuracy: r.accuracy,
      fullMark: 100,
    }));
  }, [ruleMap]);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-10 text-center animate-pulse uppercase font-black text-slate-300 tracking-widest">
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
        <div className="text-right hidden md:block">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Streak</p>
          <p className="text-2xl font-black text-indigo-600">{stats.streakDays} <span className="text-sm text-slate-400">days</span></p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard label="Mean Accuracy" value={`${stats.accuracy}%`}
          color={stats.accuracy >= 80 ? 'text-emerald-600' : stats.accuracy >= 60 ? 'text-amber-600' : 'text-red-500'} />
        <MetricCard label="Sessions" value={completedData.length} color="text-indigo-600" />
        <MetricCard label="Questions" value={allResponses.length} color="text-slate-700" />
        <MetricCard label="Consistency"
          value={hasAccess('aristotle') ? `${stats.consistency}` : <Lock size={14} />}
          color="text-cyan-600" />
        <MetricCard label="Velocity"
          value={hasAccess('plato') ? (completedData.length < 4 ? '—' : `${stats.velocity > 0 ? '+' : ''}${stats.velocity}%`) : <Lock size={14} />}
          color={stats.velocity >= 0 ? 'text-emerald-600' : 'text-red-500'} />
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

        {/* ══════════════════════════════════════════
            DESCRIPTIVE TAB
        ══════════════════════════════════════════ */}
        <TabsContent value="descriptive" className="space-y-6">
          {completedData.length === 0 ? (
            <EmptyState message="Complete a session to see your performance analytics." />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-1">
                    Performance Flow
                  </CardTitle>
                  <p className="text-[9px] text-slate-400 mb-4">{completedData.length} sessions tracked</p>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.trendData} margin={{ left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} unit="%" />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                        <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '70%', position: 'right', fontSize: 8, fill: '#f59e0b' }} />
                        <ReferenceLine y={85} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '85%', position: 'right', fontSize: 8, fill: '#22c55e' }} />
                        <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={2.5}
                          fillOpacity={0.12} fill="#6366f1"
                          dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Answer Breakdown</CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="h-[140px] w-[140px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[{ name: 'Correct', value: stats.correct }, { name: 'Incorrect', value: stats.incorrect }]}
                            cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" strokeWidth={0}
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2 text-xs">
                      {[
                        ['Total answered', allResponses.length, ''],
                        ['Correct', stats.correct, 'text-emerald-600'],
                        ['Incorrect', stats.incorrect, 'text-red-500'],
                        ['Accuracy', `${stats.accuracy}%`, stats.accuracy >= 80 ? 'text-emerald-600' : 'text-amber-600'],
                        ['Avg time/q', `${stats.avgTime}s`, 'text-indigo-500'],
                      ].map(([label, val, cls]) => (
                        <div key={label as string} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                          <span className="text-slate-500">{label}</span>
                          <span className={`font-bold ${cls}`}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-[9px] font-black uppercase">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" />Correct</div>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" />Incorrect</div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Accuracy by Topic</CardTitle>
                  {ruleMap.length === 0
                    ? <p className="text-xs text-slate-400">No topic data yet</p>
                    : <div className="space-y-2.5">
                        {ruleMap.slice(0, 10).map(r => {
                          const col = r.accuracy >= 85 ? '#22c55e' : r.accuracy >= 70 ? '#f59e0b' : '#ef4444';
                          const trendIcon = r.trend > 5 ? '↑' : r.trend < -5 ? '↓' : '→';
                          const trendCol = r.trend > 5 ? 'text-emerald-500' : r.trend < -5 ? 'text-red-500' : 'text-slate-400';
                          return (
                            <div key={r.name} className="flex items-center gap-3 text-xs">
                              <span className="w-28 flex-shrink-0 truncate text-slate-500" title={r.name}>{r.name}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${r.accuracy}%`, background: col }} />
                              </div>
                              <span className="w-9 text-right font-bold">{r.accuracy}%</span>
                              <span className={`w-4 text-center font-black ${trendCol}`}>{trendIcon}</span>
                              <span className="w-6 text-right text-slate-400 text-[9px]">{r.total}q</span>
                            </div>
                          );
                        })}
                      </div>
                  }
                </Card>

                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Topic Radar</CardTitle>
                  {radarData.length < 3
                    ? <div className="flex items-center justify-center h-[200px] text-xs text-slate-400">Need 3+ topics for radar</div>
                    : <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={80}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="topic" tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="Accuracy" dataKey="accuracy" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
                            <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                  }
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Per-Session Scores</CardTitle>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.trendData} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9 }} axisLine={false} unit="%" />
                        <Tooltip formatter={(v: number) => [`${v}%`, 'Accuracy']} />
                        <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="3 3" />
                        <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Activity by Day of Week</CardTitle>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.weeklyData} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 9 }} axisLine={false} />
                        <YAxis tick={{ fontSize: 9 }} axisLine={false} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="sessions" name="Sessions" radius={[4, 4, 0, 0]} fill="#818cf8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-none shadow-md">
                  <CardTitle className="text-[9px] font-black uppercase text-slate-400 mb-3">Session Types</CardTitle>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Practice</span>
                      <span className="font-bold text-indigo-600">{stats.practiceCount}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Diagnostic</span>
                      <span className="font-bold text-cyan-600">{stats.diagnosticCount}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Incomplete</span>
                      <span className="font-bold text-slate-400">{filteredData.length - completedData.length}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-none shadow-md">
                  <CardTitle className="text-[9px] font-black uppercase text-slate-400 mb-3">Time Stats</CardTitle>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Avg / question</span>
                      <span className="font-bold">{stats.avgTime}s</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Slowest topic</span>
                      <span className="font-bold truncate max-w-[120px]">{ruleMap.sort((a, b) => b.avgTime - a.avgTime)[0]?.name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Fastest topic</span>
                      <span className="font-bold truncate max-w-[120px]">{ruleMap.sort((a, b) => a.avgTime - b.avgTime)[0]?.name ?? '—'}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-none shadow-md">
                  <CardTitle className="text-[9px] font-black uppercase text-slate-400 mb-3">Streak</CardTitle>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Current streak</span>
                      <span className="font-bold text-indigo-600">{stats.streakDays}d</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Best streak</span>
                      <span className="font-bold text-emerald-600">{stats.bestStreak}d</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Total days active</span>
                      <span className="font-bold">{[...completedData].map(s => new Date(s.timestamp).toDateString()).filter((v, i, a) => a.indexOf(v) === i).length}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════
            INFERENTIAL TAB
        ══════════════════════════════════════════ */}
        <TabsContent value="inferential" className="space-y-6">
          {!hasAccess('plato') ? <ProUpgradeOverlay tier="Plato" /> : completedData.length === 0 ? (
            <EmptyState message="Complete sessions to unlock inferential analytics." />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Statistical Summary</CardTitle>
                  <div className="space-y-2 text-xs">
                    {[
                      ['Mean accuracy', `${stats.accuracy}%`],
                      ['Std deviation', `±${stats.stddev}%`],
                      ['Consistency score', `${stats.consistency}/100`],
                      ['Learning correlation', completedData.length < 3 ? 'Need 3+ sessions' : `${stats.correlationScore > 0 ? '+' : ''}${stats.correlationScore}%`],
                      ['Velocity (trend)', completedData.length < 4 ? 'Need 4+ sessions' : `${stats.velocity > 0 ? '+' : ''}${stats.velocity}%`],
                      ['Avg time / question', `${stats.avgTime}s`],
                      ['Questions analysed', allResponses.length],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <span className="text-slate-500">{label}</span>
                        <span className="font-bold">{value}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="border-none shadow-xl bg-slate-900 text-white flex flex-col justify-center items-center text-center p-6">
                  <GraduationCap className="text-indigo-400 mb-2 opacity-40" size={36} />
                  <div className="text-7xl font-black italic">{examForecast}%</div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mt-2">Exam Grade Forecast</p>
                  <p className="text-[9px] text-slate-600 mt-1">{completedData.length} session{completedData.length > 1 ? 's' : ''} · ±{stats.stddev}% margin</p>
                  <div className="mt-4 grid grid-cols-3 gap-3 w-full text-center">
                    <div>
                      <p className="text-xs font-black text-slate-300">{Math.max(0, examForecast - stats.stddev)}%</p>
                      <p className="text-[8px] text-slate-600 uppercase">Low est.</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-indigo-400">{examForecast}%</p>
                      <p className="text-[8px] text-slate-600 uppercase">Mean</p>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-300">{Math.min(100, examForecast + stats.stddev)}%</p>
                      <p className="text-[8px] text-slate-600 uppercase">High est.</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            <span className="w-12 text-right text-slate-400">{r.runway} sess.</span>
                          </div>
                        ))}
                      </div>
                  }
                </Card>

                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Strengths &amp; Gaps</CardTitle>
                  {ruleMap.filter(r => r.accuracy >= 85).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase text-emerald-600 mb-2">✓ Mastered (85%+)</p>
                      {ruleMap.filter(r => r.accuracy >= 85).slice(0, 4).map(r => (
                        <div key={r.name} className="text-xs py-0.5 text-slate-500">▸ {r.name} <span className="text-emerald-600 font-bold">{r.accuracy}%</span></div>
                      ))}
                    </div>
                  )}
                  {ruleMap.filter(r => r.accuracy >= 70 && r.accuracy < 85).length > 0 && (
                    <div className="mb-3">
                      <p className="text-[9px] font-black uppercase text-amber-600 mb-2">◐ Developing (70–84%)</p>
                      {ruleMap.filter(r => r.accuracy >= 70 && r.accuracy < 85).slice(0, 4).map(r => (
                        <div key={r.name} className="text-xs py-0.5 text-slate-500">▸ {r.name} <span className="text-amber-600 font-bold">{r.accuracy}%</span></div>
                      ))}
                    </div>
                  )}
                  {ruleMap.filter(r => r.accuracy < 70).length > 0 && (
                    <div>
                      <p className="text-[9px] font-black uppercase text-red-500 mb-2">✗ Struggling (&lt;70%)</p>
                      {ruleMap.filter(r => r.accuracy < 70).slice(0, 4).map(r => (
                        <div key={r.name} className="text-xs py-0.5 text-slate-500">▸ {r.name} <span className="text-red-500 font-bold">{r.accuracy}%</span></div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                <Card className="p-4 border-none shadow-lg">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4">Avg Time per Topic (s)</CardTitle>
                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[...ruleMap].sort((a, b) => b.avgTime - a.avgTime).slice(0, 8).map(r => ({
                          name: r.name.length > 12 ? r.name.slice(0, 12) + '…' : r.name,
                          time: r.avgTime,
                        }))}
                        margin={{ bottom: 30 }}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} unit="s" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} axisLine={false} width={90} />
                        <Tooltip formatter={(v: number) => [`${v}s`, 'Avg time']} />
                        <Bar dataKey="time" radius={[0, 4, 4, 0]} fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-3">Consistency & Reliability Analysis</CardTitle>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  {[
                    { label: 'Consistency', value: `${stats.consistency}`, unit: '/100', color: stats.consistency >= 70 ? 'text-emerald-600' : 'text-amber-600' },
                    { label: 'Std Deviation', value: `±${stats.stddev}`, unit: '%', color: stats.stddev <= 15 ? 'text-emerald-600' : 'text-red-500' },
                    { label: 'Learning Rate', value: `${stats.correlationScore > 0 ? '+' : ''}${stats.correlationScore}`, unit: '%', color: stats.correlationScore >= 0 ? 'text-emerald-600' : 'text-red-500' },
                    { label:
