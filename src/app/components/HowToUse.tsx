import React from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { 
  BookOpen, 
  MessageSquare, 
  BarChart3, 
  CheckCircle, 
  Upload,
  Target,
  TrendingUp,
  Clock,
  ArrowRight
} from 'lucide-react';

export function HowToUse() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-4xl font-bold text-gray-900">How to Use ProgressAtlas</h1>
        <p className="text-lg text-gray-600">
          Your complete guide to mastering math with AI-powered diagnostics
        </p>
      </div>

      {/* Get Started Button */}
      <div className="flex justify-center">
        <Button 
          size="lg" 
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
          onClick={() => navigate('/app/chat')}
        >
          Get Started with AI Workspace
          <ArrowRight className="ml-2" size={20} />
        </Button>
      </div>

      {/* Overview */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Your Learning Journey!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-gray-700">
          <p>
            ProgressAtlas is an AI-powered diagnostic platform designed to assess, adapt, and 
            accelerate your understanding of math-heavy courses like Calculus, Linear Algebra, 
            and Engineering Mathematics.
          </p>
          <p className="font-medium text-blue-900">
            Our adaptive system measures your ability, comprehension, and efficiency—then provides 
            personalized questions to target your weaknesses and build on your strengths.
          </p>
        </CardContent>
      </Card>

      {/* Step-by-Step Guide */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Getting Started</h2>

        {/* Step 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                1
              </div>
              <BookOpen className="text-blue-600" />
              Course Toggle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              Select your current course from the Course Toggle menu in the AI Workspace. 
              Questions will be specifically tailored to the active course you've selected.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
              <li>Available courses: Differential Calculus, Integral Calculus, Multivariate Calculus, Linear Algebra, Differential Equations, Engineering Mathematics, Discrete Mathematics, and Statistics & Probability</li>
              <li>Switch between courses at any time to focus on different subjects</li>
              <li>Each course has its own conversation thread and progress tracking</li>
              <li>The AI adapts questions based on the selected course's curriculum</li>
            </ul>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded mt-3">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Click the "Course" button in the workspace header to toggle between courses.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 2 - Mode Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                2
              </div>
              <Target className="text-purple-600" />
              Mode Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              Choose between two assessment modes based on your learning goals:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="text-purple-600" size={20} />
                  <div className="font-semibold text-purple-900">Diagnostic Test</div>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  10 consecutive questions designed to assess your understanding of a topic.
                </p>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>Complete assessment of your current skill level</li>
                  <li>Tracks progress through all 10 questions</li>
                  <li>Comprehensive feedback at the end</li>
                  <li>Best for: Preparing for exams or measuring improvement</li>
                </ul>
              </div>

              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={20} />
                  <div className="font-semibold text-green-900">Practice Questions</div>
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  One question at a time with immediate feedback and guidance.
                </p>
                <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                  <li>Focused learning on specific concepts</li>
                  <li>Immediate AI feedback after each answer</li>
                  <li>Flexible and conversational approach</li>
                  <li>Best for: Daily practice or exploring new topics</li>
                </ul>
              </div>
            </div>

            <div className="bg-purple-50 border-l-4 border-purple-500 p-3 rounded mt-3">
              <p className="text-sm text-purple-800">
                <strong>Tip:</strong> Click the "Mode" button to switch between Diagnostic Tests and Practice Questions. 
                Your tier determines how many diagnostic tests you can take per month!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
                3
              </div>
              <MessageSquare className="text-green-600" />
              AI Chat Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              The heart of ProgressAtlas—engage in adaptive conversations with our AI tutor 
              through various question formats.
            </p>
            
            <div className="space-y-3">
              <div className="font-medium text-gray-900">📝 Question Formats Available:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-sm mb-1">✓ True or False</div>
                  <div className="text-xs text-gray-600">
                    Quick comprehension checks on key concepts
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-sm mb-1">✓ Multiple Choice</div>
                  <div className="text-xs text-gray-600">
                    Test your understanding with guided options
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-sm mb-1">✓ Identification</div>
                  <div className="text-xs text-gray-600">
                    Recognize and name mathematical concepts
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-sm mb-1">✓ Solution-Based</div>
                  <div className="text-xs text-gray-600">
                    Show complete step-by-step problem solving
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-gray-900">💡 Input Methods:</div>
              <ul className="list-disc list-inside space-y-1 ml-4 text-gray-700">
                <li>
                  <strong>Text Input:</strong> Type your answers naturally
                </li>
                <li>
                  <strong>LaTeX Support:</strong> Use <code className="bg-gray-100 px-1 rounded">$x^2$</code> for 
                  inline math or <code className="bg-gray-100 px-1 rounded">$$\int x dx$$</code> for block equations
                </li>
                <li>
                  <strong>Image Upload:</strong> <Upload className="inline" size={16} /> Scan or upload 
                  screenshots of handwritten solutions
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="font-medium text-blue-900 mb-1">🤖 Adaptive Learning</div>
              <p className="text-sm text-blue-800">
                The AI adapts in real-time! If you're struggling, it provides easier questions and 
                more detailed explanations. If you're excelling, it challenges you with harder problems.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step 4 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                4
              </div>
              <BarChart3 className="text-orange-600" />
              Progress Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              Track your improvement over time with comprehensive analytics and visualizations, including 
              mode-specific performance tracking.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Target className="text-blue-600" size={20} />
                  Skill Mastery Charts
                </div>
                <p className="text-sm text-gray-600">
                  Visual breakdown of your comprehension levels across different math topics
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="text-orange-600" size={20} />
                  Efficiency Metrics
                </div>
                <p className="text-sm text-gray-600">
                  Track your speed and accuracy to identify areas for improvement
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <TrendingUp className="text-green-600" size={20} />
                  Historical Trends
                </div>
                <p className="text-sm text-gray-600">
                  See your progress over time and celebrate your improvements
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle className="text-purple-600" size={20} />
                  Personalized Recommendations
                </div>
                <p className="text-sm text-gray-600">
                  Get AI-generated suggestions on what to study next
                </p>
              </div>
            </div>

            <div className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded mt-4">
              <p className="text-sm text-orange-800">
                <strong>Mode Filtering:</strong> Use the Mode filter in the Dashboard to view separate analytics 
                for Diagnostic Tests vs. Practice Questions, helping you understand how you perform in 
                different assessment contexts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LaTeX Quick Reference */}
      <Card>
        <CardHeader>
          <CardTitle>📐 LaTeX Quick Reference</CardTitle>
          <CardDescription>
            Common mathematical notation for typing in the chat. 
            <a 
              href="https://en.wikibooks.org/wiki/LaTeX/Mathematics" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline ml-2"
            >
              View Complete LaTeX Guide →
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">Fractions & Exponents:</div>
              <code className="block bg-gray-100 p-2 rounded">$\frac{'{a}{b}'}$ → a/b</code>
              <code className="block bg-gray-100 p-2 rounded">$x^2$ → x²</code>
              <code className="block bg-gray-100 p-2 rounded">$x_{'n'}$ → xₙ</code>
            </div>
            
            <div className="space-y-1">
              <div className="font-medium">Calculus:</div>
              <code className="block bg-gray-100 p-2 rounded">$\int x dx$ → ∫ x dx</code>
              <code className="block bg-gray-100 p-2 rounded">$\frac{'{d}{dx}'}$ → d/dx</code>
              <code className="block bg-gray-100 p-2 rounded">$\lim_{'{x \\\\to 0}'}$ → lim(x→0)</code>
            </div>
            
            <div className="space-y-1">
              <div className="font-medium">Greek Letters:</div>
              <code className="block bg-gray-100 p-2 rounded">$\alpha, \beta, \theta$ → α, β, θ</code>
              <code className="block bg-gray-100 p-2 rounded">$\pi, \lambda, \sigma$ → π, λ, σ</code>
            </div>
            
            <div className="space-y-1">
              <div className="font-medium">Special Functions:</div>
              <code className="block bg-gray-100 p-2 rounded">$\sin(x), \cos(x)$ → sin(x), cos(x)</code>
              <code className="block bg-gray-100 p-2 rounded">$\sqrt{'{x}'}$ → √x</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            If you encounter any issues or have questions about using ProgressAtlas, 
            the AI tutor in the Chat Workspace can help guide you. Just ask!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}