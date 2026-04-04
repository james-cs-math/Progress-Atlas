import React, { useState, useEffect, useMemo } from 'react';
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
  GraduationCap, Layers, CheckCircle2, Send, Sparkles
} from 'lucide-react';
import { InlineMath } from 'react-katex';

const TIER_RANK = { euclid: 0, aristotle: 1, plato: 2, socrates: 3 };

const PREREQUISITE_MAP: Record<string, { domain: string, topics: string[] }> = {
  "Calculus 1": { domain: "Algebra & Trigonometry", topics: ["Unit Circle", "Rational Functions", "Trig Identities", "Limit Laws"] },
  "Calculus 2": { domain: "Calculus 1", topics: ["Differentiation Rules", "Fundamental Theorem", "Chain Rule", "U-Substitution"] },
  "Statistics": { domain: "Arithmetic & Set Theory", topics: ["Combinations", "Set Notation", "Summation Properties"] },
  "Linear Algebra": { domain: "Geometry & Systems", topics: ["Vector Operations", "Systems of Equations", "Determinant Logic"] }
};

export function DashboardSimplified() {
  const { selectedMode, selectedCourse } = useFilters();
  const { currentTier } = useTier();
  const [diagnosticTests, setDiagnosticTests] = useState<any[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  const hasAccess = (required: keyof typeof TIER_RANK) =>
    TIER_RANK[currentTier as keyof typeof TIER_RANK] >= TIER_RANK[required];

  useEffect(() => {
    loadDashboardData();
    const onUpdate = () => loadDashboardData();
    window.addEventListener('atlas_usage_updated', onUpdate);
    return () => window.removeEventListener('atlas_usage_updated', onUpdate);
  }, []);

  const loadDashboardData = () => {
    try {
      const localTests = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');
      setDiagnosticTests(
        localTests.sort((a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      );
    } catch (e) {
      console.error('Error loading dashboard data:', e);
      setDiagnosticTests([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => diagnosticTests.filter(test => {
    const activeCourses = Array.isArray(selectedCourse) ? selectedCourse : [selectedCourse];
    const matchesCourse = activeCourses.length === 0 || activeCourses.includes(test.course);
    let matchesMode = true;
    if (selectedMode === 'practice') matchesMode = test.setType === 'practice';
    else if (selectedMode === 'diagnostic') matchesMode = test.setType !== 'practice';
    return matchesCourse && matchesMode;
  }), [diagnosticTests, selectedCourse, selectedMode]);

  // Only use entries that have completed results with a valid accuracy value
  const completedData = useMemo(() =>
    filteredData.filter(t => t.results?.accuracy !== undefined),
    [filteredData]
  );

  const stats = useMemo(() => {
    if (completedData.length === 0) return { accuracy: 0, velocity: 0, maturity: 0, trendData: [] };
    const accuracy = Math.round(
      completedData.reduce((s, t) => s + t.results.accuracy, 0) / completedData.length
    );
    const last3 = completedData.slice(0, 3).reduce((s, t) => s + t.results.accuracy, 0) / Math.min(completedData.length, 3);
    const first3 = completedData.slice(-3).reduce((s, t) => s + t.results.accuracy, 0) / Math.min(completedData.length, 3);
    const trendData = [...completedData].reverse().map((t, index) => ({
      id: `${t.id || index}-${t.timestamp}`,
      date: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      accuracy: t.results.accuracy,
    }));
    return {
      accuracy,
      velocity: Math.round(last3 - first3),
      maturity: Math.min(100, Math.round((accuracy * 0.7) + (completedData.length * 2))),
      trendData,
    };
  }, [completedData]);

  const masteryData = useMemo(() => {
    const ruleMap: Record<string, { total: number, correct: number, time: number }> = {};
    // Only process entries that have responses
    filteredData.filter(t => Array.isArray(t.results?.responses)).forEach(test => {
      test.results.responses.forEach((r: any) => {
        if (r.rule) r.rule.forEach((name: string) => {
          if (!ruleMap[name]) ruleMap[name] = { total: 0, correct: 0, time: 0 };
          ruleMap[name].total++;
          if (r.isCorrect) ruleMap[name].correct++;
          ruleMap[name].time += r.timeSpent || 0;
        });
      });
    });
    return Object.entries(ruleMap).map(([name, s]) => {
      const acc = Math.round((s.correct / s.total) * 100);
      return {
        name, accuracy: acc,
        avgTime: Math.round(s.time / s.total),
        volume: s.total,
        projectedGrade: Math.min(100, Math.round(acc * 0.95)),
        runway: Math.max(0, Math.ceil((90 - acc) / 5)),
      };
    });
  }, [filteredData]);

  const renderMath = (text: string) => {
    if (!text) return 'N/A';
    return (text.includes('\\') || text.includes('^') || text.includes('$'))
      ? <InlineMath math={text.replace(/\$/g, '')} />
      : text;
  };

  const renderMixedText = (text?: string) => {
    if (!text) return '';
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

  const handleExplain = async (resp: any, uniqueId: string) => {
    if (!hasAccess('socrates')) return;
    setActiveChatId(uniqueId);
    setIsAiThinking(true);
    setChatMessages([]);
    setTimeout(() => {
      const explanation = `This problem tests your understanding of ${resp.rule?.join(', ') || 'the concept'}. ${resp.correctAnswerText ? `The correct answer is ${resp.correctAnswerText}.` : ''} ${resp.conceptualGap || resp.calculationSlip || 'Review the relevant concepts and try similar problems for practice.'}`;
      setChatMessages([{ role: 'assistant', content: explanation }]);
      setIsAiThinking(false);
    }, 1000);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isAiThinking) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsAiThinking(true);
    setTimeout(() => {
      const responses = [
        "That's a great question! Let me help clarify that concept for you.",
        "I understand your confusion. This is a common stumbling block for students.",
        "Let's break this down step by step to make it clearer.",
        "Consider reviewing the fundamentals of this topic to strengthen your understanding.",
      ];
      setChatMessages(prev => [...prev, { role: 'assistant', content: responses[Math.floor(Math.random() * responses.length)] }]);
      setIsAiThinking(false);
    }, 800);
  };

  if (loading) return (
    <div className="p-10 text-center animate-pulse uppercase font-black text-slate-300">
      Generating Audit...
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20 text-slate-800">
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
          value={hasAccess('plato') ? `${stats.velocity > 0 ? '+' : ''}${stats.velocity}%` : <Lock size={14} />}
          color="text-emerald-600"
        />
        <MetricCard
          label="Maturity"
          value={hasAccess('socrates') ? stats.maturity : <Lock size={14} />}
          color="text-indigo-400"
          dark
        />
      </div>

      <Tabs defaultValue="descriptive" className="space-y-6 pt-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl w-full md:w-fit">
          <TabsTrigger value="descriptive" className="rounded-lg font-bold uppercase text-[10px]">Descriptive</TabsTrigger>
          <TabsTrigger value="inferential" className="rounded-lg font-bold uppercase text-[10px]">Inferential</TabsTrigger>
          <TabsTrigger value="roadmap" className="rounded-lg font-bold uppercase text-[10px]">Roadmap</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg font-bold uppercase text-[10px]">History</TabsTrigger>
        </TabsList>

        {/* DESCRIPTIVE */}
        <TabsContent value="descriptive" className="space-y-10">
          {completedData.length === 0 ? (
            <EmptyState message="Complete a diagnostic or practice session to see your performance flow." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="p-4 border-none shadow-lg">
                <CardTitle className="text-[10px] font-black uppercase text-slate-500 mb-4 px-2">Performance Flow</CardTitle>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trendData} margin={{ left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700 }} axisLine={false} unit="%" />
                      <Tooltip />
                      <Area type="monotone" dataKey="accuracy" stroke="#6366f1" strokeWidth={3} fillOpacity={0.1} fill="#6366f1" />
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

        {/* INFERENTIAL */}
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

        {/* ROADMAP */}
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
                    Domain: {PREREQUISITE_MAP[selectedCourse as string]?.domain || 'Math'}
                  </p>
                  <div className="space-y-3">
                    {(PREREQUISITE_MAP[selectedCourse as string]?.topics || ['Basic Algebra']).map((topic, i) => (
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

        {/* HISTORY */}
        <TabsContent value="history" className="space-y-4">
          {filteredData.length === 0 ? (
            <EmptyState message="No session history found. Start a diagnostic or practice session." />
          ) : filteredData.map((session) => (
            <Card key={session.id || session.timestamp} className="overflow-hidden border-slate-100 shadow-none">
              <div
                className="p-4 bg-white flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedSession(expandedSession === (session.id || session.timestamp) ? null : (session.id || session.timestamp))}
              >
                <div className="flex items-center gap-4">
                  <History size={18} className="text-slate-300" />
                  <div>
                    <h4 className="font-bold text-sm">{session.topic}</h4>
                    <p className="text-[9px] text-slate-400 font-black uppercase">
                      {new Date(session.timestamp).toLocaleDateString()} · {session.setType}
                      {session.results?.accuracy !== undefined ? ` · ${session.results.accuracy}%` : ' · Incomplete'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xl font-black italic">
                    {session.results?.accuracy !== undefined ? `${session.results.accuracy}%` : '—'}
                  </p>
                  {expandedSession === (session.id || session.timestamp) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedSession === (session.id || session.timestamp) && (
                <CardContent className="bg-slate-50 border-t p-6 space-y-4">
                  {!session.results?.responses ? (
                    <EmptyState message="This session was not completed — no question data available." />
                  ) : !hasAccess('plato') ? (
                    <ProUpgradeOverlay tier="Plato" />
                  ) : session.results.responses.map((resp: any, idx: number) => {
                    const chatSessionId = `${session.id}-${idx}`;
                    const isActiveChat = activeChatId === chatSessionId;
                    return (
                      <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                          <LocalBadge className={resp.isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}>
                            {resp.isCorrect ? 'Correct' : 'Wrong'}
                          </LocalBadge>
                          {hasAccess('socrates') ? (
                            <Button variant="ghost" className="h-7 text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-50" onClick={() => handleExplain(resp, chatSessionId)}>
                              <Sparkles size={12} className="mr-1.5" /> AI Tutor
                            </Button>
                          ) : (
                            <div className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                              <Lock size={10} /> Socrates for AI
                            </div>
                          )}
                        </div>

                        <div className="text-sm font-bold text-slate-700">{renderMixedText(resp.questionText)}</div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="p-3 rounded-xl border bg-slate-50">
                            <p className="text-[8px] font-black uppercase opacity-50 mb-1">Your Answer</p>
                            <p className="text-xs font-bold">{renderMixedText(resp.userAnswer || resp.userAnswerText || '—')}</p>
                          </div>
                          <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50">
                            <p className="text-[8px] font-black uppercase opacity-50 mb-1">Correct Answer</p>
                            <p className="text-xs font-bold">{renderMixedText(resp.correctAnswer || resp.correctAnswerText || '—')}</p>
                          </div>
                        </div>

                        {resp.explanation && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[8px] font-black uppercase opacity-50 mb-1">Explanation</p>
                            <p className="text-xs text-slate-600">{renderMixedText(resp.explanation)}</p>
                          </div>
                        )}

                        {resp.aiFeedback && (
                          <div className={`p-3 rounded-xl border text-xs font-semibold ${resp.isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'}`}>
                            <p className="text-[8px] font-black uppercase opacity-50 mb-1">AI Feedback</p>
                            {renderMixedText(resp.aiFeedback)}
                          </div>
                        )}

                        {hasAccess('socrates') && isActiveChat && (
                          <div className="mt-4 border-t pt-4 space-y-4">
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                              {chatMessages.map((msg, mIdx) => (
                                <div key={mIdx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[85%] p-3 rounded-xl text-xs ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 font-medium'}`}>
                                    {renderMixedText(msg.content)}
                                  </div>
                                </div>
                              ))}
                              {isAiThinking && <div className="text-[10px] font-black text-slate-400 uppercase animate-pulse">Thinking...</div>}
                            </div>
                            <div className="flex gap-2">
                              <input
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none"
                                placeholder="Ask AI..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                              />
                              <Button size="sm" className="bg-indigo-600" onClick={sendChatMessage} disabled={isAiThinking}>
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
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const MetricCard = ({ label, value, color, dark = false }: any) => (
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

const LocalBadge = ({ children, className }: any) => (
  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tight ${className}`}>
    {children}
  </span>
);