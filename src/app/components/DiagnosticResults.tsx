import React, { useState, useEffect } from 'react';
import { useTier } from '../lib/TierContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { InlineMath, BlockMath } from 'react-katex';
import { 
  Target, Award, CheckCircle, XCircle, 
  BookOpen, Brain, Lock, RefreshCw, ListChecks, 
  ChevronDown, ChevronUp, Clock, Sparkles
} from 'lucide-react';

const TIER_RANK = { euclid: 0, aristotle: 1, plato: 2, socrates: 3 };

// ─── Text Renderer ────────────────────────────────────────────────────────────
// Coerce option values that are pure math fragments into a single inline math block
const sanitizeOption = (text: string): string => {
  const trimmed = text.trim();
  // If it contains newlines and looks like broken LaTeX, collapse into one $...$ block
  if (trimmed.includes('\n') && !trimmed.startsWith('$')) {
    const joined = trimmed.split('\n').map(l => l.trim()).filter(Boolean).join(' ');
    return `$${joined}$`;
  }
  return trimmed;
};

const renderText = (text?: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$'))
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        if (part.startsWith('$') && part.endsWith('$'))
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export function DiagnosticResults() {
  const { currentTier } = useTier();
  const [diagnosticTests, setDiagnosticTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    loadDiagnosticResults();
    // Re-load when a new diagnostic is saved
    const onUpdate = () => loadDiagnosticResults();
    window.addEventListener('atlas_usage_updated', onUpdate);
    return () => window.removeEventListener('atlas_usage_updated', onUpdate);
  }, []);

  const loadDiagnosticResults = () => {
    try {
      const all = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');
      // Only show completed diagnostics (not practice, not incomplete placeholders)
      const completed = all.filter((s: any) => s.setType === 'diagnostic' && s.results?.completed === true);
      setDiagnosticTests(
        completed.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      );
    } catch {
      setDiagnosticTests([]);
    } finally {
      setLoading(false);
    }
  };

  const hasAccess = (required: keyof typeof TIER_RANK) =>
    TIER_RANK[currentTier as keyof typeof TIER_RANK] >= TIER_RANK[required];

  // Build topic accuracy map for recommendations
  const topicAccuracy: Record<string, { total: number; correct: number }> = {};
  diagnosticTests.forEach(test => {
    if (!topicAccuracy[test.topic]) topicAccuracy[test.topic] = { total: 0, correct: 0 };
    topicAccuracy[test.topic].total += test.results.totalQuestions;
    topicAccuracy[test.topic].correct += test.results.correctCount;
  });

  const recommendations = Object.entries(topicAccuracy)
    .map(([name, stats]) => ({ name, accuracy: Math.round((stats.correct / stats.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy);

  if (loading) return (
    <div className="p-20 text-center">
      <Clock className="animate-spin mx-auto text-indigo-600 mb-4" size={40} />
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Neural Records...</p>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 pb-20">

      {/* Dashboard Header */}
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase italic">Performance Archive</h2>
          <p className="text-sm text-slate-500 font-medium">Diagnostic history and logical weak-points</p>
        </div>
        <Badge className="bg-indigo-600 text-white px-6 py-2 rounded-full text-sm font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
          {currentTier} TIER
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AI INSIGHTS */}
        <Card className="rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center gap-2 font-black text-indigo-900 uppercase tracking-tight text-sm">
            <Brain size={18} className="text-indigo-600" /> AI Insights & Recommendations
          </div>
          <CardContent className="p-6">
            {recommendations.length > 0 ? (
              <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-1">Priority Focus</p>
                <p className="text-lg font-bold text-indigo-900">{recommendations[0].name}</p>
                <p className="text-sm text-indigo-700 mt-2 leading-relaxed">
                  Your current mastery is <span className="font-black">{recommendations[0].accuracy}%</span>. Re-running a diagnostic for this topic is recommended to stabilize logic.
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 italic text-sm">Complete a diagnostic to generate insights.</div>
            )}
          </CardContent>
        </Card>

        {/* TIER REQUISITES */}
        <Card className={`rounded-[2rem] border-none shadow-xl overflow-hidden ${!hasAccess('aristotle') ? 'opacity-50' : 'bg-white'}`}>
          <div className="p-6 border-b border-slate-50 flex items-center gap-2 font-black text-emerald-900 uppercase tracking-tight text-sm">
            <BookOpen size={18} className="text-emerald-600" /> Mastery Prerequisites
            {!hasAccess('aristotle') && <Lock size={14} className="ml-auto text-slate-400" />}
          </div>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-bold text-emerald-800 flex items-center gap-3">
                <CheckCircle size={14} /> Function Composition Logic
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-bold text-emerald-800 flex items-center gap-3">
                <CheckCircle size={14} /> Complex Polynomial Decomposition
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SESSION HISTORY */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter px-2">Diagnostic Timeline</h3>

        {diagnosticTests.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
            <Target className="mx-auto text-slate-300 mb-4" size={48} />
            <p className="text-slate-400 italic font-medium">No completed diagnostics yet.</p>
            <p className="text-slate-300 text-sm mt-1">Complete a diagnostic session to see your results here.</p>
          </div>
        ) : diagnosticTests.map((test) => (
          <div key={test.id} className="rounded-[2rem] bg-white border border-slate-100 shadow-lg overflow-hidden transition-all">

            {/* Header Row */}
            <div
              className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedSession(expandedSession === test.id ? null : test.id)}
            >
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${test.results.accuracy >= 80 ? 'bg-emerald-100 text-emerald-600' : test.results.accuracy >= 50 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                  <Target size={28} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{test.topic}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(test.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {' · '}{test.results.correctCount}/{test.results.totalQuestions} Correct
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className={`text-2xl font-black ${test.results.accuracy >= 80 ? 'text-emerald-600' : test.results.accuracy >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {test.results.accuracy}%
                  </p>
                  <p className="text-[10px] uppercase font-black text-slate-300 tracking-[0.2em]">Accuracy</p>
                </div>
                {expandedSession === test.id
                  ? <ChevronUp size={24} className="text-slate-300" />
                  : <ChevronDown size={24} className="text-slate-300" />}
              </div>
            </div>

            {/* Expanded Question Breakdown — Plato+ only */}
            {expandedSession === test.id && (
              <div className="p-6 bg-slate-50/50 border-t border-slate-100 space-y-4">

                {!hasAccess('plato') ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <Lock size={32} className="text-slate-300" />
                    <p className="font-black uppercase text-sm tracking-widest">Plato Tier Required</p>
                    <p className="text-xs text-center max-w-xs">Upgrade to Plato to view the full question-by-question breakdown of your diagnostic sessions.</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Bar */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="bg-white p-4 rounded-2xl border border-slate-100 text-center">
                        <p className="text-2xl font-black text-slate-900">{test.results.totalQuestions}</p>
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Questions</p>
                      </div>
                      <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                        <p className="text-2xl font-black text-emerald-600">{test.results.correctCount}</p>
                        <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Correct</p>
                      </div>
                      <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 text-center">
                        <p className="text-2xl font-black text-rose-600">{test.results.totalQuestions - test.results.correctCount}</p>
                        <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest">Incorrect</p>
                      </div>
                    </div>

                    {/* Per-Question Cards */}
                    <div className="grid grid-cols-1 gap-4">
                      {(test.results.responses || []).map((resp: any, idx: number) => (
                        <Card key={idx} className="rounded-3xl border-none shadow-md overflow-hidden bg-white">
                          <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                            <Badge className={`rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest border-none ${resp.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {resp.isCorrect ? <><CheckCircle size={10} className="inline mr-1" />Logic Valid</> : <><XCircle size={10} className="inline mr-1" />Logic Discrepancy</>}
                            </Badge>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Question {idx + 1}</span>
                          </div>

                          <CardContent className="p-8 space-y-6">
                            {/* Question Text */}
                            <div className="text-xl font-bold text-slate-800 leading-relaxed">
                              {renderText(resp.questionText)}
                            </div>

                            {/* Answer Comparison */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className={`p-5 rounded-2xl border-2 ${resp.isCorrect ? 'border-emerald-100 bg-emerald-50/30' : 'border-rose-100 bg-rose-50/30'}`}>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Your Submission</p>
                                <div className="text-lg font-bold text-slate-700">
                                  {resp.answerFormat === 'multiple-choice'
                                    ? <>{resp.userAnswer}: {renderText(resp.options?.[resp.userAnswer])}</>
                                    : resp.answerFormat === 'true-false'
                                    ? (resp.userAnswer === 'A' ? 'True' : 'False')
                                    : renderText(resp.userAnswer)}
                                </div>
                              </div>

                              <div className="p-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50/30">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Correct Answer</p>
                                <div className="text-lg font-bold text-indigo-900">
                                  {resp.answerFormat === 'multiple-choice'
                                    ? <>{resp.correctAnswer}: {renderText(resp.options?.[resp.correctAnswer])}</>
                                    : resp.answerFormat === 'true-false'
                                    ? (resp.correctAnswer === 'A' ? 'True' : 'False')
                                    : renderText(resp.correctAnswer)}
                                </div>
                              </div>
                            </div>

                            {/* AI Feedback for identification/solution */}
                            {resp.aiFeedback && (
                              <div className={`p-4 rounded-2xl border text-sm font-semibold flex items-start gap-3 ${resp.isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                                <Sparkles size={14} className="mt-0.5 shrink-0" />
                                <span>{renderText(resp.aiFeedback)}</span>
                              </div>
                            )}

                            {/* Explanation */}
                            <div className="p-6 bg-slate-100/50 rounded-2xl border border-slate-200/50 italic text-slate-600 leading-relaxed">
                              <p className="text-[10px] font-black uppercase text-slate-400 not-italic mb-2 tracking-widest flex items-center gap-1">
                                <Brain size={12} /> Step-by-Step Rationale
                              </p>
                              {renderText(resp.explanation)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Tier-locked Actions */}
                    <div className="flex gap-3 pt-4">
                      <Button variant="outline" disabled={!hasAccess('plato')} className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border-indigo-100 bg-white shadow-sm flex-1">
                        <RefreshCw size={14} className="mr-2" /> Mutate Parameters
                        {!hasAccess('plato') && <Lock size={12} className="ml-2" />}
                      </Button>
                      <Button variant="outline" disabled={!hasAccess('socrates')} className="h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border-purple-100 bg-white shadow-sm flex-1">
                        <ListChecks size={14} className="mr-2" /> Logic Breakdown
                        {!hasAccess('socrates') && <Lock size={12} className="ml-2" />}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}