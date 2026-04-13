import React, { useState, useEffect, useCallback } from 'react';
import { useFilters } from '../lib/FilterContext';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle, XCircle, ArrowRight, Loader2, Eye, Sparkles } from 'lucide-react';
import { InlineMath, BlockMath } from 'react-katex';
import { aiService } from '../../aiService';
import { motion, AnimatePresence } from 'framer-motion';

// ─── AI Grader (Groq) ────────────────────────────────────────────────────────
const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1";

async function gradeWithAI(
  questionText: string,
  correctAnswer: string,
  studentAnswer: string,
  answerFormat: 'identification' | 'solution'
): Promise<{ isCorrect: boolean; feedback: string }> {
  const systemPrompt = `You are a strict but fair mathematics and science grader.
Your job is to determine if a student's answer is mathematically / conceptually equivalent to the correct answer.

Rules:
- Treat different but equivalent forms as CORRECT (e.g. "x^2/2 + C" == "\\frac{x^2}{2} + C", "0.5" == "1/2").
- Ignore superficial differences: extra spaces, different variable casing, extra constant of integration when expected.
- For solution-based answers: check that the KEY reasoning steps and final answer are logically sound and reach the correct conclusion. Minor computational errors can be flagged but do not make the whole answer wrong if the method is right.
- Respond ONLY with a valid JSON object — no markdown, no preamble.
- Format: {"isCorrect": true|false, "feedback": "One concise sentence explaining why."}`;

  const userPrompt = answerFormat === 'identification'
    ? `Question: ${questionText}\nCorrect Answer: ${correctAnswer}\nStudent Answer: ${studentAnswer}\n\nIs the student's answer mathematically/conceptually equivalent to the correct answer?`
    : `Question: ${questionText}\nCorrect Final Answer: ${correctAnswer}\nStudent's Full Solution:\n${studentAnswer}\n\nDoes the student's solution correctly arrive at the right answer with valid reasoning?`;

  try {
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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      isCorrect: Boolean(parsed.isCorrect),
      feedback: parsed.feedback ?? '',
    };
  } catch {
    return {
      isCorrect: studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim(),
      feedback: 'Could not reach AI grader — fell back to exact match.',
    };
  }
}

// ─── Save a single practice response to localStorage ─────────────────────────
function savePracticeResponse(
  topic: string,
  course: string,
  response: {
    questionText: string;
    answerFormat: string;
    userAnswer: string;
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
    aiFeedback: string;
    rule?: string;
  }
) {
  try {
    const history: any[] = JSON.parse(localStorage.getItem('atlas_test_history') || '[]');

    // Find an existing open practice session for this topic started today
    const todayPrefix = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const existingIdx = history.findLastIndex(
      (s: any) =>
        s.setType === 'practice' &&
        s.topic === topic &&
        s.timestamp?.startsWith(todayPrefix)
    );

    if (existingIdx >= 0) {
      // Append to existing session
      const session = history[existingIdx];
      const responses: any[] = session.results?.responses ?? [];
      responses.push(response);
      const correct = responses.filter((r: any) => r.isCorrect).length;
      history[existingIdx] = {
        ...session,
        results: {
          ...session.results,
          responses,
          accuracy: Math.round((correct / responses.length) * 100),
          completed: true,
        },
      };
    } else {
      // Start a new practice session
      history.push({
        id: `practice_${Date.now()}`,
        timestamp: new Date().toISOString(),
        setType: 'practice',
        topic,
        course,
        results: {
          completed: true,
          responses: [response],
          accuracy: response.isCorrect ? 100 : 0,
        },
      });
    }

    localStorage.setItem('atlas_test_history', JSON.stringify(history));
    window.dispatchEvent(new Event('atlas_usage_updated'));
  } catch (e) {
    console.error('Failed to save practice response:', e);
  }
}

// ─── Text Renderers ───────────────────────────────────────────────────────────
const sanitizeOption = (text: string): string => {
  const trimmed = text.trim();
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

const renderSolution = (text?: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$'))
          return <BlockMath key={i} math={part.slice(2, -2)} />;
        if (part.startsWith('$') && part.endsWith('$'))
          return <InlineMath key={i} math={part.slice(1, -1)} />;
        return <span key={i} style={{ whiteSpace: 'pre-line' }}>{part}</span>;
      })}
    </>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
export function PracticeQuestion({ topic }: { topic: string }) {
  const { selectedCourse, selectedQuestionType } = useFilters();
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string>('');

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setShowResult(false);
    setSelectedAnswer('');
    setIsCorrect(null);
    setAiFeedback('');
    setCurrentQuestion(null);
    try {
      const data = await aiService.ask(selectedCourse as string, topic, selectedQuestionType, 1);
      if (data && data.length > 0) setCurrentQuestion(data[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, topic, selectedQuestionType]);

  useEffect(() => { loadQuestion(); }, [loadQuestion]);

  const handleVerify = async () => {
    if (!selectedAnswer || !currentQuestion) return;

    const fmt = currentQuestion.answerFormat;
    let correct = false;
    let feedback = '';

    if (fmt === 'multiple-choice' || fmt === 'true-false') {
      correct = selectedAnswer === currentQuestion.correctAnswer;
    } else {
      setGrading(true);
      try {
        const result = await gradeWithAI(
          currentQuestion.questionText,
          currentQuestion.correctAnswer,
          selectedAnswer,
          fmt === 'solution' ? 'solution' : 'identification'
        );
        correct = result.isCorrect;
        feedback = result.feedback;
      } catch {
        correct = false;
        feedback = 'Grading unavailable.';
      } finally {
        setGrading(false);
      }
    }

    setIsCorrect(correct);
    setAiFeedback(feedback);
    setShowResult(true);

    // ── Save to localStorage after every answered question ──
    const course = Array.isArray(selectedCourse) ? selectedCourse[0] : (selectedCourse ?? '');
    savePracticeResponse(topic, course, {
      questionText: currentQuestion.questionText,
      answerFormat: fmt,
      userAnswer: selectedAnswer,
      correctAnswer: currentQuestion.correctAnswer,
      explanation: currentQuestion.explanation ?? '',
      isCorrect: correct,
      aiFeedback: feedback,
      rule: currentQuestion.rule ?? currentQuestion.topic ?? topic,
    });
  };

  if (loading) return (
    <div className="p-20 text-center flex flex-col items-center justify-center space-y-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-slate-400 font-black text-xs uppercase tracking-[0.3em] animate-pulse">Generating Unique Question...</p>
    </div>
  );

  if (!currentQuestion) return (
    <div className="p-20 text-center"><Button onClick={loadQuestion}>Retry Connection</Button></div>
  );

  const ResultIcon = isCorrect === null ? Sparkles : isCorrect ? CheckCircle : XCircle;
  const resultLabel = isCorrect === null ? 'Solution Reviewed' : isCorrect ? 'Logically Correct' : 'Logic Discrepancy';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <AnimatePresence mode="wait">
        {!showResult ? (
          <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card className="overflow-hidden border-none shadow-2xl rounded-[2.5rem] bg-white">
              <div className="bg-indigo-600 p-12 text-center text-white text-2xl italic leading-relaxed">
                {renderText(currentQuestion.questionText)}
              </div>
              <CardContent className="p-10 space-y-6">

                {/* MULTIPLE CHOICE */}
                {currentQuestion.answerFormat === 'multiple-choice' && (
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(currentQuestion.options || {}).map(([key, value]) => (
                      <button key={key} onClick={() => setSelectedAnswer(key)}
                        className={`p-6 rounded-2xl border-2 flex items-center gap-5 text-left transition-all ${selectedAnswer === key ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-slate-100 hover:border-indigo-200'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${selectedAnswer === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{key}</div>
                        <div className="text-lg font-bold text-slate-700">{renderText(sanitizeOption(value as string))}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* TRUE / FALSE */}
                {currentQuestion.answerFormat === 'true-false' && (
                  <div className="grid grid-cols-1 gap-3">
                    {Object.entries(currentQuestion.options || { A: 'True', B: 'False' }).map(([key, value]) => (
                      <button key={key} onClick={() => setSelectedAnswer(key)}
                        className={`p-6 rounded-2xl border-2 flex items-center gap-5 text-left transition-all ${selectedAnswer === key ? 'border-indigo-600 bg-indigo-50 shadow-inner' : 'border-slate-100 hover:border-indigo-200'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${selectedAnswer === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{key}</div>
                        <div className="text-lg font-bold text-slate-700">{value as string}</div>
                      </button>
                    ))}
                  </div>
                )}

                {/* IDENTIFICATION */}
                {currentQuestion.answerFormat === 'identification' && (
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Final Answer</label>
                    <input type="text" value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)}
                      placeholder="e.g. \frac{1}{2}x^2 + C"
                      className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-xl font-bold" />
                    {selectedAnswer && (
                      <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1"><Eye size={12} /> Math Preview</p>
                        <div className="text-2xl text-indigo-900"><BlockMath math={selectedAnswer} /></div>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 flex items-center gap-1"><Sparkles size={10} /> AI-powered grading — equivalent forms (e.g. x²/2 vs ½x²) are accepted</p>
                  </div>
                )}

                {/* SOLUTION-BASED */}
                {currentQuestion.answerFormat === 'solution' && (
                  <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Step-by-Step Solution</label>
                    <textarea rows={8} value={selectedAnswer} onChange={(e) => setSelectedAnswer(e.target.value)}
                      placeholder={`Example:\nLet $f(x)=x^2$\n\n$$\n\\frac{d}{dx}x^2 = 2x\n$$\n\nFinal Answer: $2x$`}
                      className="w-full p-6 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-lg leading-relaxed" />
                    {selectedAnswer && (
                      <div className="p-8 bg-slate-900 text-slate-200 rounded-2xl border border-slate-800 shadow-inner">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase mb-4 flex items-center gap-1"><Eye size={12} /> Compiled Solution Preview</p>
                        <div className="text-lg leading-relaxed">{renderSolution(selectedAnswer)}</div>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 flex items-center gap-1"><Sparkles size={10} /> AI-powered grading — your reasoning and final answer are evaluated for correctness</p>
                  </div>
                )}

                <Button onClick={handleVerify} disabled={!selectedAnswer || grading}
                  className={`w-full h-20 text-xl font-black rounded-3xl mt-4 transition-all shadow-xl ${selectedAnswer && !grading ? 'bg-slate-900 text-white hover:scale-[1.02]' : 'bg-slate-200 text-slate-400'}`}>
                  {grading ? (
                    <span className="flex items-center justify-center gap-3"><Loader2 className="animate-spin" size={22} />AI IS GRADING YOUR ANSWER...</span>
                  ) : 'SUBMIT ANSWER'}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="p-10 rounded-[2.5rem] bg-white shadow-2xl border border-slate-100">
              <div className={`flex items-center gap-4 mb-8 p-6 rounded-3xl ${isCorrect === null ? 'bg-indigo-50 text-indigo-700' : isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <ResultIcon size={32} />
                <h3 className="text-2xl font-black uppercase italic tracking-tight">{resultLabel}</h3>
              </div>

              {aiFeedback && (
                <div className={`mb-6 p-5 rounded-2xl border text-sm font-semibold flex items-start gap-3 ${isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                  <Sparkles size={16} className="mt-0.5 shrink-0" />
                  <span>{renderText(aiFeedback)}</span>
                </div>
              )}

              <div className="space-y-6">
                {(currentQuestion.answerFormat === 'multiple-choice' || currentQuestion.answerFormat === 'true-false') && (
                  <div className="p-6 bg-slate-900 text-white rounded-2xl">
                    <p className="text-[10px] font-black uppercase text-indigo-400 mb-1 tracking-widest opacity-60">Professor's Key Answer</p>
                    <p className="text-xl font-bold">
                      {currentQuestion.answerFormat === 'multiple-choice' ? `${currentQuestion.correctAnswer}: ` : ''}
                      {currentQuestion.answerFormat === 'multiple-choice'
                        ? renderText(currentQuestion.options?.[currentQuestion.correctAnswer])
                        : (currentQuestion.correctAnswer === 'A' ? 'True' : 'False')}
                    </p>
                  </div>
                )}

                {(currentQuestion.answerFormat === 'identification' || currentQuestion.answerFormat === 'solution') && (
                  <div className={`p-6 rounded-2xl border-2 ${isCorrect === null ? 'border-slate-200 bg-slate-50' : isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                    <p className="text-[10px] font-black uppercase mb-2 tracking-widest text-slate-400">Your Answer</p>
                    <div className={`text-lg font-semibold ${isCorrect === null ? 'text-slate-700' : isCorrect ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {renderSolution(selectedAnswer)}
                    </div>
                  </div>
                )}

                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 text-slate-600 italic leading-relaxed text-lg">
                  <p className="text-xs font-black uppercase text-slate-400 mb-2 not-italic">Full Explanation:</p>
                  {renderSolution(currentQuestion.explanation)}
                </div>

                <Button onClick={loadQuestion}
                  className="w-full h-20 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl text-xl flex items-center justify-center gap-2 shadow-lg active:scale-95">
                  NEXT PRACTICE INSTANCE <ArrowRight size={24} />
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
