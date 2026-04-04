import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { apiCall } from '../lib/supabase';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import { 
  Send, 
  Upload, 
  Menu as MenuIcon,
  CheckCircle,
  XCircle,
  ListChecks,
  HelpCircle,
  BookOpen,
  Settings,
  Check,
  Target,
  Dumbbell
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { InlineMath, BlockMath } from 'react-katex';

type QuestionType = 'conversation' | 'true-false' | 'multiple-choice' | 'identification' | 'solution';
type ModeType = 'diagnostic' | 'practice';

interface Message {
  id: string;
  message: string;
  sender: 'user' | 'ai';
  questionType?: QuestionType;
  timestamp: string;
  course?: string;
  mode?: ModeType;
}

const QUESTION_TYPES = [
  { id: 'true-false', label: 'True or False', icon: CheckCircle },
  { id: 'multiple-choice', label: 'Multiple Choice', icon: ListChecks },
  { id: 'identification', label: 'Identification', icon: HelpCircle },
  { id: 'solution', label: 'Solution-Based', icon: XCircle },
];

const COURSES = [
  { id: 'calculus1', label: 'Differential Calculus' },
  { id: 'calculus2', label: 'Integral Calculus' },
  { id: 'calculus3', label: 'Multivariate Calculus' },
  { id: 'linearalgebra', label: 'Linear Algebra' },
  { id: 'differentialequations', label: 'Differential Equations' },
  { id: 'engineeringmath', label: 'Engineering Mathematics' },
  { id: 'discretemath', label: 'Discrete Mathematics' },
  { id: 'statistics', label: 'Statistics & Probability' },
];

const MODES = [
  { id: 'diagnostic', label: 'Diagnostic Test', icon: Target, description: '10 questions in a row' },
  { id: 'practice', label: 'Practice Questions', icon: Dumbbell, description: '1 question at a time' },
];

export function ChatWorkspace() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuestionMenu, setShowQuestionMenu] = useState(false);
  const [showCourseMenu, setShowCourseMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [selectedQuestionType, setSelectedQuestionType] = useState<QuestionType>('conversation');
  const [selectedCourse, setSelectedCourse] = useState<string>('calculus1');
  const [selectedMode, setSelectedMode] = useState<ModeType>('practice');
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversation();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    try {
      const data = await apiCall('/conversations');
      if (data.conversation?.messages) {
        setMessages(data.conversation.messages);
      } else {
        // Send welcome message
        const welcomeMessage: Message = {
          id: crypto.randomUUID(),
          message: `Welcome to ProgressAtlas! 👋

I'm your AI math tutor. I'll help you assess your understanding in mathematics through adaptive questions and personalized feedback.

**How it works:**
1. I'll ask you questions based on your selected subjects
2. Your answers help me understand your strengths and weaknesses
3. I'll adapt the difficulty and topics based on your performance
4. You can type answers, use LaTeX for math notation, or upload images of your solutions

**Question formats available:**
- Conversational problem-solving
- True or False
- Multiple Choice
- Identification
- Solution-based (with step-by-step work)

Ready to begin? Tell me which subject you'd like to start with, or I can give you an initial diagnostic question!`,
          sender: 'ai',
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      // Still show welcome message even if API fails
      const welcomeMessage: Message = {
        id: crypto.randomUUID(),
        message: `Welcome to ProgressAtlas! 👋

I'm your AI math tutor. Ready to help you improve your math skills!

Start by telling me which subject you'd like to work on.`,
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    }
  };

  const saveMessage = async (message: string, sender: 'user' | 'ai', questionType?: QuestionType, course?: string, mode?: ModeType) => {
    try {
      await apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({
          message,
          sender,
          questionType,
          course,
          mode,
        }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const generateAIResponse = (userMessage: string, questionType: QuestionType): string => {
    // This is a simplified AI response generator
    // In a real application, this would call an AI API
    
    const responses = {
      'true-false': `Great! Here's a True or False question for you:

**Statement:** The derivative of $\\sin(x)$ is $\\cos(x)$.

Please answer: True or False, and explain your reasoning.`,
      
      'multiple-choice': `Here's a multiple choice question:

**Question:** What is the integral of $\\int x^2 dx$?

A) $\\frac{x^3}{3} + C$
B) $2x + C$
C) $x^3 + C$
D) $\\frac{x^2}{2} + C$

Please select your answer and show your work.`,
      
      'identification': `Identification question:

**Identify:** What mathematical concept is being described?

"A function where every element of the range corresponds to exactly one element of the domain, and the function has an inverse."

Please provide your answer.`,
      
      'solution': `Here's a solution-based problem:

**Problem:** Find the derivative of $f(x) = 3x^2 + 2x - 5$

Please show your complete solution, step by step. You can type using LaTeX notation or upload an image of your handwritten work.`,
      
      'conversation': `I understand you said: "${userMessage}"

Based on your response, let me provide feedback and continue with an adaptive question.

Let's work on a calculus problem:

**Question:** Evaluate the limit: $\\lim_{x \\to 0} \\frac{\\sin(x)}{x}$

Show your reasoning or solution approach.`,
    };

    return responses[questionType] || responses.conversation;
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      message: input,
      sender: 'user',
      questionType: selectedQuestionType,
      timestamp: new Date().toISOString(),
      course: selectedCourse,
      mode: selectedMode,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Save user message
    await saveMessage(input, 'user', selectedQuestionType, selectedCourse, selectedMode);

    // Update diagnostic progress if in diagnostic mode
    if (selectedMode === 'diagnostic') {
      setDiagnosticProgress(prev => prev + 1);
    }

    // Simulate AI processing time
    setTimeout(async () => {
      let aiResponseMessage = generateAIResponse(input, selectedQuestionType);
      
      // Add diagnostic progress info if in diagnostic mode
      if (selectedMode === 'diagnostic' && diagnosticProgress < 9) {
        aiResponseMessage += `\n\n---\n**Diagnostic Test Progress: ${diagnosticProgress + 1}/10 questions completed**`;
      } else if (selectedMode === 'diagnostic' && diagnosticProgress === 9) {
        aiResponseMessage += `\n\n---\n**🎉 Diagnostic Test Complete! (10/10 questions)**\n\nYou've completed your diagnostic assessment. Check the Dashboard to see your detailed results and personalized recommendations.`;
        setDiagnosticProgress(0); // Reset for next test
      }

      const aiResponse: Message = {
        id: crypto.randomUUID(),
        message: aiResponseMessage,
        sender: 'ai',
        timestamp: new Date().toISOString(),
        mode: selectedMode,
      };

      setMessages((prev) => [...prev, aiResponse]);
      await saveMessage(aiResponse.message, 'ai', undefined, undefined, selectedMode);

      // Save assessment data for dashboard
      try {
        await apiCall('/assessments', {
          method: 'POST',
          body: JSON.stringify({
            subject: selectedCourse,
            topic: 'derivatives',
            questionType: selectedQuestionType,
            correct: Math.random() > 0.3, // Simulated correctness
            timeTaken: Math.random() * 120 + 30, // 30-150 seconds
            difficulty: 'medium',
            mode: selectedMode,
          }),
        });
      } catch (error) {
        console.error('Error saving assessment:', error);
      }

      setLoading(false);
      setSelectedQuestionType('conversation');
    }, 1500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`Image uploaded: ${file.name}. Processing...`);
      
      // Simulate image processing
      setTimeout(() => {
        const uploadMessage: Message = {
          id: crypto.randomUUID(),
          message: `[Uploaded solution image: ${file.name}]\n\nI've analyzed your handwritten solution. Your approach is correct! Here's my feedback:\n\n✓ Step 1: Correct application of the power rule\n✓ Step 2: Proper simplification\n️ Step 3: Minor arithmetic error - check your calculation\n\nWould you like me to explain the correct approach for step 3?`,
          sender: 'ai',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, uploadMessage]);
        saveMessage(uploadMessage.message, 'ai');
      }, 2000);
    }
  };

  const renderMessageContent = (content: string) => {
    // Simple LaTeX rendering - splits by $ delimiters
    const parts = content.split(/(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/);
    
    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        // Block math
        const latex = part.slice(2, -2);
        return (
          <div key={index} className="my-4">
            <BlockMath math={latex} />
          </div>
        );
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline math
        const latex = part.slice(1, -1);
        return <InlineMath key={index} math={latex} />;
      } else {
        // Regular text - preserve formatting
        return <span key={index} className="whitespace-pre-wrap">{part}</span>;
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Let the journey begin!</h1>
            <p className="text-sm text-gray-500">
              {COURSES.find(c => c.id === selectedCourse)?.label} • {MODES.find(m => m.id === selectedMode)?.label}
              {selectedMode === 'diagnostic' && diagnosticProgress > 0 && ` (${diagnosticProgress}/10)`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/how-to-use')}
              className="gap-2"
              title="Open How to Use guide"
            >
              <HelpCircle size={16} />
              <span className="hidden md:inline">Guide</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowModeMenu(!showModeMenu)}
              className="gap-2"
            >
              <Target size={16} />
              <span className="hidden md:inline">Mode</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCourseMenu(!showCourseMenu)}
              className="gap-2"
            >
              <BookOpen size={16} />
              <span className="hidden md:inline">Course</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuestionMenu(!showQuestionMenu)}
              className="gap-2"
            >
              <MenuIcon size={16} />
              <span className="hidden md:inline">Question Type</span>
            </Button>
          </div>
        </div>

        {/* Mode Selection Menu */}
        {showModeMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200"
          >
            <h3 className="font-medium mb-3">Select Assessment Mode:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MODES.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => {
                      setSelectedMode(mode.id as ModeType);
                      if (mode.id === 'diagnostic') {
                        setDiagnosticProgress(0);
                      }
                      setShowModeMenu(false);
                      toast.success(`Mode: ${mode.label}`);
                    }}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left
                      ${
                        selectedMode === mode.id
                          ? 'border-purple-500 bg-white shadow-sm'
                          : 'border-purple-200 hover:border-purple-400'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={24} className="text-purple-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-base font-semibold">{mode.label}</div>
                          {selectedMode === mode.id && (
                            <Check size={16} className="text-purple-600" />
                          )}
                        </div>
                        <div className="text-sm text-gray-600">{mode.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Course Toggle Menu */}
        {showCourseMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200"
          >
            <h3 className="font-medium mb-3">Select Current Course:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {COURSES.map((course) => (
                <button
                  key={course.id}
                  onClick={() => {
                    setSelectedCourse(course.id);
                    setShowCourseMenu(false);
                    toast.success(`Selected: ${course.label}`);
                  }}
                  className={`
                    p-3 rounded-lg border-2 transition-all text-left flex items-center gap-2
                    ${
                      selectedCourse === course.id
                        ? 'border-green-500 bg-white shadow-sm'
                        : 'border-green-200 hover:border-green-400'
                    }
                  `}
                >
                  {selectedCourse === course.id && (
                    <Check size={16} className="text-green-600 flex-shrink-0" />
                  )}
                  <div className="text-sm font-medium">{course.label}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Question Type Menu */}
        {showQuestionMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
          >
            <h3 className="font-medium mb-3">Select Question Format:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {QUESTION_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedQuestionType(type.id as QuestionType);
                      setShowQuestionMenu(false);
                      toast.success(`Selected: ${type.label}`);
                    }}
                    className={`
                      p-3 rounded-lg border-2 transition-all text-left
                      ${
                        selectedQuestionType === type.id
                          ? 'border-blue-500 bg-white shadow-sm'
                          : 'border-blue-200 hover:border-blue-400'
                      }
                    `}
                  >
                    <Icon size={20} className="mb-1 text-blue-600" />
                    <div className="text-sm font-medium">{type.label}</div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card
              className={`max-w-2xl ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white'
              }`}
            >
              <CardContent className="p-4">
                <div className="text-sm mb-1 opacity-70">
                  {msg.sender === 'user' ? 'You' : 'AI Tutor'}
                  {msg.questionType && msg.questionType !== 'conversation' && (
                    <span className="ml-2 text-xs">
                      ({msg.questionType.replace('-', ' ')})
                    </span>
                  )}
                </div>
                <div className="prose prose-sm max-w-none">
                  {renderMessageContent(msg.message)}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          {selectedQuestionType !== 'conversation' && (
            <div className="mb-2 text-sm text-blue-600 font-medium">
              Mode: {selectedQuestionType.replace('-', ' ').toUpperCase()}
            </div>
          )}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              title="Upload solution image"
            >
              <Upload size={20} />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type your answer... (use $ for LaTeX: $x^2$, $$\int x dx$$)"
              className="min-h-[60px] resize-none"
              disabled={loading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-auto"
            >
              <Send size={20} />
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Press Enter to send • Shift+Enter for new line • Use $ for inline math, $$ for block math
          </div>
        </div>
      </div>
    </div>
  );
}