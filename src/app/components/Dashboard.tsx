import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/supabase';
import { useTier } from '../lib/TierContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { DiagnosticResults } from './DiagnosticResults';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  AreaChart,
  Area,
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  Target, 
  Award, 
  Zap, 
  Calendar, 
  Brain, 
  TrendingDown,
  AlertCircle,
  Lock,
  Circle,
  GraduationCap,
  Sparkles,
  Crown,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  FileText
} from 'lucide-react';

interface DashboardStats {
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  averageTime: number;
  subjectStats: Record<string, { total: number; correct: number }>;
  topicStats: Record<string, { total: number; correct: number }>;
  recentResults: any[];
}

type TierType = 'euclid' | 'aristotle' | 'plato' | 'socrates';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const COURSES = [
  { id: 'all', label: 'All Courses' },
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
  { id: 'all', label: 'All Modes' },
  { id: 'diagnostic', label: 'Diagnostic Tests' },
  { id: 'practice', label: 'Practice Questions' },
];

const TIER_CONFIG = {
  euclid: {
    name: 'Euclid',
    icon: Circle,
    color: 'from-gray-400 to-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-700',
  },
  aristotle: {
    name: 'Aristotle',
    icon: GraduationCap,
    color: 'from-amber-600 to-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
  },
  plato: {
    name: 'Plato',
    icon: Sparkles,
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
  },
  socrates: {
    name: 'Socrates',
    icon: Crown,
    color: 'from-purple-600 to-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
  },
};

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentTier } = useTier();
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['all']);
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [courseFilterExpanded, setCourseFilterExpanded] = useState(true);
  const [modeFilterExpanded, setModeFilterExpanded] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const data = await apiCall('/dashboard/stats');
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  // Sample data generators
  const generateMockStats = (): DashboardStats => ({
    totalQuestions: 156,
    correctAnswers: 124,
    accuracy: 79,
    averageTime: 67,
    subjectStats: {
      'calculus1': { total: 45, correct: 38 },
      'linearalgebra': { total: 30, correct: 22 },
      'differentialequations': { total: 25, correct: 18 },
      'statistics': { total: 40, correct: 35 },
      'discretemath': { total: 16, correct: 11 },
    },
    topicStats: {
      'derivatives': { total: 35, correct: 30 },
      'integrals': { total: 28, correct: 22 },
      'matrices': { total: 30, correct: 22 },
      'probability': { total: 40, correct: 35 },
      'limits': { total: 23, correct: 15 },
    },
    recentResults: Array(15).fill(null).map((_, i) => ({
      correct: Math.random() > 0.3,
      timeTaken: Math.random() * 90 + 30,
    })),
  });

  const mockStats = stats || generateMockStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // Prepare chart data
  const subjectChartData = Object.entries(mockStats.subjectStats).map(([subject, data]) => ({
    name: subject.replace(/([A-Z])/g, ' $1').trim().toUpperCase(),
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
    total: data.total,
    correct: data.correct,
  }));

  const topicChartData = Object.entries(mockStats.topicStats).map(([topic, data]) => ({
    name: topic,
    value: data.total,
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));

  const recentPerformanceData = mockStats.recentResults
    .slice(0, 10)
    .reverse()
    .map((result, index) => ({
      question: `Q${index + 1}`,
      accuracy: result.correct ? 100 : 0,
      time: result.timeTaken || 0,
    }));

  // Skill mastery data
  const skillMasteryData = [
    { subject: 'Calculus', mastery: 84, questions: 45, velocity: 12 },
    { subject: 'Linear Algebra', mastery: 73, questions: 30, velocity: 8 },
    { subject: 'Differential Equations', mastery: 72, questions: 25, velocity: 15 },
    { subject: 'Statistics', mastery: 88, questions: 40, velocity: 10 },
    { subject: 'Discrete Math', mastery: 69, questions: 16, velocity: 6 },
  ];

  // Efficiency metrics over time
  const efficiencyData = [
    { week: 'Week 1', avgTime: 125, accuracy: 45, consistency: 60 },
    { week: 'Week 2', avgTime: 110, accuracy: 55, consistency: 65 },
    { week: 'Week 3', avgTime: 95, accuracy: 65, consistency: 70 },
    { week: 'Week 4', avgTime: 80, accuracy: 72, consistency: 75 },
    { week: 'Week 5', avgTime: 70, accuracy: 78, consistency: 80 },
    { week: 'Week 6', avgTime: 65, accuracy: 82, consistency: 85 },
    { week: 'Week 7', avgTime: 60, accuracy: 84, consistency: 87 },
  ];

  // Historical trends
  const historicalData = [
    { month: 'Jan', examReadiness: 35, improvement: 0, projectedGrade: 65 },
    { month: 'Feb', examReadiness: 48, improvement: 13, projectedGrade: 70 },
    { month: 'Mar', examReadiness: 58, improvement: 10, projectedGrade: 75 },
    { month: 'Apr', examReadiness: 68, improvement: 10, projectedGrade: 80 },
    { month: 'May', examReadiness: 77, improvement: 9, projectedGrade: 85 },
    { month: 'Jun', examReadiness: 84, improvement: 7, projectedGrade: 88 },
  ];

  // Skill radar data
  const skillRadarData = [
    { skill: 'Algebra', value: 85, benchmark: 75 },
    { skill: 'Geometry', value: 70, benchmark: 72 },
    { skill: 'Calculus', value: 84, benchmark: 78 },
    { skill: 'Statistics', value: 88, benchmark: 80 },
    { skill: 'Trigonometry', value: 75, benchmark: 70 },
    { skill: 'Logic', value: 80, benchmark: 76 },
  ];

  // Cognitive error pattern data (Plato and above)
  const errorPatternData = [
    { type: 'Conceptual', count: 12, percentage: 35 },
    { type: 'Computational', count: 15, percentage: 44 },
    { type: 'Careless', count: 7, percentage: 21 },
  ];

  // Topic risk scoring (Socrates only)
  const topicRiskData = [
    { topic: 'Derivatives', risk: 15, difficulty: 'Low', failureProbability: 8 },
    { topic: 'Integration', risk: 45, difficulty: 'Medium', failureProbability: 25 },
    { topic: 'Differential Equations', risk: 72, difficulty: 'High', failureProbability: 48 },
    { topic: 'Linear Systems', risk: 35, difficulty: 'Medium', failureProbability: 18 },
    { topic: 'Probability Theory', risk: 20, difficulty: 'Low', failureProbability: 12 },
  ];

  const renderLockedCard = (feature: string) => (
    <Card className="relative overflow-hidden opacity-60">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/50 to-gray-900/30 backdrop-blur-sm z-10 flex items-center justify-center">
        <div className="text-center text-white">
          <Lock className="w-12 h-12 mx-auto mb-2" />
          <p className="font-semibold">Upgrade to unlock</p>
          <p className="text-sm">{feature}</p>
        </div>
      </div>
      <CardHeader>
        <CardTitle className="blur-sm">Premium Feature</CardTitle>
        <CardDescription className="blur-sm">Unlock with higher tier</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 bg-gray-200 blur-sm" />
      </CardContent>
    </Card>
  );

  const tierConfig = TIER_CONFIG[currentTier];
  const TierIcon = tierConfig.icon;

  const handleCourseToggle = (courseId: string) => {
    if (courseId === 'all') {
      setSelectedCourses(['all']);
    } else {
      const newSelection = selectedCourses.filter(id => id !== 'all');
      
      if (selectedCourses.includes(courseId)) {
        const filtered = newSelection.filter(id => id !== courseId);
        setSelectedCourses(filtered.length === 0 ? ['all'] : filtered);
      } else {
        setSelectedCourses([...newSelection, courseId]);
      }
    }
  };

  const getDisplayedCourseName = () => {
    if (selectedCourses.includes('all')) {
      return 'All Courses';
    }
    if (selectedCourses.length === 1) {
      return COURSES.find(c => c.id === selectedCourses[0])?.label || 'All Courses';
    }
    return `${selectedCourses.length} Courses Selected`;
  };

  const handleModeToggle = (modeId: string) => {
    setSelectedMode(modeId);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Displaying {tierConfig.name} tier analytics - Change your tier in Subscription settings
        </p>
      </div>

      {/* Course Filter */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setCourseFilterExpanded(!courseFilterExpanded)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen size={20} />
                Course Filter
              </CardTitle>
              <CardDescription>
                View analytics for specific courses or all courses combined
              </CardDescription>
            </div>
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={courseFilterExpanded ? "Collapse filter" : "Expand filter"}
            >
              {courseFilterExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </CardHeader>
        {courseFilterExpanded && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>Currently viewing:</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg">
                  {getDisplayedCourseName()}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {COURSES.map((course) => {
                  const isSelected = selectedCourses.includes(course.id);
                  const isAllSelected = selectedCourses.includes('all');
                  
                  return (
                    <Button
                      key={course.id}
                      onClick={() => handleCourseToggle(course.id)}
                      variant={isSelected || (course.id !== 'all' && isAllSelected) ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-2 ${
                        isSelected || (course.id !== 'all' && isAllSelected)
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : ''
                      }`}
                    >
                      {(isSelected || (course.id !== 'all' && isAllSelected)) && (
                        <Check size={16} />
                      )}
                      {course.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Mode Filter */}
      <Card>
        <CardHeader className="cursor-pointer" onClick={() => setModeFilterExpanded(!modeFilterExpanded)}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target size={20} />
                Mode Filter
              </CardTitle>
              <CardDescription>
                Filter by Diagnostic Tests (10 questions) or Practice Questions (1 question)
              </CardDescription>
            </div>
            <button 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label={modeFilterExpanded ? "Collapse filter" : "Expand filter"}
            >
              {modeFilterExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </CardHeader>
        {modeFilterExpanded && (
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <span>Currently viewing:</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg">
                  {MODES.find(m => m.id === selectedMode)?.label || 'All Modes'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {MODES.map((mode) => {
                  const isSelected = selectedMode === mode.id;
                  
                  return (
                    <Button
                      key={mode.id}
                      onClick={() => handleModeToggle(mode.id)}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-2 ${
                        isSelected
                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                          : ''
                      }`}
                    >
                      {isSelected && <Check size={16} />}
                      {mode.id === 'diagnostic' && <Target size={16} />}
                      {mode.id === 'practice' && <Dumbbell size={16} />}
                      {mode.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Tier 0 - Euclid (Free) */}
      {currentTier === 'euclid' && (
        <div className="space-y-6">
          {/* Limited metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Target className="text-blue-600" size={20} />
                  Questions This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">18 / 25</div>
                <p className="text-xs text-gray-500 mt-1">7 remaining</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Award className="text-green-600" size={20} />
                  Basic Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">67%</div>
                <p className="text-xs text-gray-500 mt-1">12 / 18 correct</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Clock className="text-orange-600" size={20} />
                  Avg Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">85s</div>
                <p className="text-xs text-gray-500 mt-1">Per question</p>
              </CardContent>
            </Card>
          </div>

          {/* Basic topic performance */}
          <Card>
            <CardHeader>
              <CardTitle>Topic-Level Skill Evaluation</CardTitle>
              <CardDescription>Basic breakdown of correctness by topic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topicChartData.slice(0, 3).map((topic) => (
                  <div key={topic.name} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-medium capitalize">{topic.name}</div>
                      <div className="text-sm text-gray-600">
                        {topic.accuracy}% correct
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${topic.accuracy}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Limitation notice */}
          <Card className="bg-yellow-50 border-yellow-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle size={20} />
                Euclid Tier Limitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-yellow-900 text-sm">
                <li>• Progress history only stored for 7 days</li>
                <li>• No personalized study recommendations</li>
                <li>• No advanced analytics or mastery tracking</li>
                <li>• Limited to 25 questions per month</li>
                <li>• Preview access to analytics (locked insights below)</li>
              </ul>
            </CardContent>
          </Card>

          {/* Locked features preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderLockedCard('Skill Mastery Charts')}
            {renderLockedCard('Efficiency Metrics')}
          </div>
        </div>
      )}

      {/* Tier I - Aristotle */}
      {currentTier === 'aristotle' && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Target className="text-blue-600" size={20} />
                  Questions This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">87 / 150</div>
                <p className="text-xs text-gray-500 mt-1">63 remaining</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Award className="text-green-600" size={20} />
                  Accuracy Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{mockStats.accuracy}%</div>
                <p className="text-xs text-gray-500 mt-1">
                  {mockStats.correctAnswers} / {mockStats.totalQuestions} correct
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Clock className="text-orange-600" size={20} />
                  Time Per Question
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {mockStats.averageTime}s
                </div>
                <p className="text-xs text-gray-500 mt-1">Average response time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Brain className="text-purple-600" size={20} />
                  Skill Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">Developing</div>
                <p className="text-xs text-gray-500 mt-1">Proficiency classification</p>
              </CardContent>
            </Card>
          </div>

          {/* Strength vs Weakness Heat Map */}
          <Card>
            <CardHeader>
              <CardTitle>Strength vs. Weakness Heat Map</CardTitle>
              <CardDescription>Topic-based performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subjectChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="accuracy" fill="#f59e0b" name="Accuracy %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Concept gap identification */}
          <Card>
            <CardHeader>
              <CardTitle>Concept Gap Identification</CardTitle>
              <CardDescription>Tagged learning objectives with skill classification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(mockStats.topicStats).map(([topic, data]) => {
                  const accuracy = data.total > 0 ? (data.correct / data.total) * 100 : 0;
                  let level = 'Beginner';
                  let color = 'bg-red-500';
                  
                  if (accuracy >= 80) {
                    level = 'Proficient';
                    color = 'bg-green-500';
                  } else if (accuracy >= 60) {
                    level = 'Developing';
                    color = 'bg-yellow-500';
                  }

                  return (
                    <div key={topic} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="font-medium capitalize">{topic.replace('-', ' ')}</div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs text-white ${color}`}>
                            {level}
                          </span>
                          <span className="text-sm text-gray-600">
                            {Math.round(accuracy)}% ({data.correct}/{data.total})
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${color} transition-all duration-500`}
                          style={{ width: `${accuracy}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Monthly performance summary */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance Summary</CardTitle>
              <CardDescription>Your progress this month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={recentPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="question" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Correct (%)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Locked advanced features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderLockedCard('Adaptive Difficulty & AI Recommendations')}
            {renderLockedCard('Learning Velocity Tracking')}
          </div>
        </div>
      )}

      {/* Tier II - Plato */}
      {currentTier === 'plato' && (
        <div className="space-y-6">
          {/* Comprehensive metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Target className="text-blue-600" size={20} />
                  Total Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{mockStats.totalQuestions}</div>
                <p className="text-xs text-gray-500 mt-1">Unlimited access</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Award className="text-green-600" size={20} />
                  Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{mockStats.accuracy}%</div>
                <p className="text-xs text-gray-500 mt-1">
                  {mockStats.correctAnswers} correct answers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Zap className="text-orange-600" size={20} />
                  Learning Velocity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">+12%</div>
                <p className="text-xs text-gray-500 mt-1">Rate of improvement</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="text-purple-600" size={20} />
                  Consistency Index
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">85%</div>
                <p className="text-xs text-gray-500 mt-1">Stability under testing</p>
              </CardContent>
            </Card>
          </div>

          {/* Skill Mastery Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Skill Mastery Charts</CardTitle>
                <CardDescription>Percentage mastery per concept</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={skillMasteryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" angle={-15} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mastery" fill="#3b82f6" name="Mastery %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skill Comprehension Radar</CardTitle>
                <CardDescription>Multi-dimensional skill assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Your Performance"
                      dataKey="value"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                    <Radar
                      name="Peer Average"
                      dataKey="benchmark"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Learning Velocity & Efficiency Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Efficiency Metrics</CardTitle>
              <CardDescription>Speed, accuracy, and consistency tracking over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={efficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="avgTime" fill="#f59e0b" name="Avg Time (s)" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="accuracy"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Accuracy (%)"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="consistency"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Consistency (%)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cognitive Error Pattern Detection */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Cognitive Error Pattern Detection</CardTitle>
                <CardDescription>Conceptual vs. computational mistakes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={errorPatternData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, percentage }) => `${type}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {errorPatternData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historical Trends</CardTitle>
                <CardDescription>Exam readiness progression</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="examReadiness"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      name="Exam Readiness (%)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* AI-Generated Study Recommendations */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900 flex items-center gap-2">
                <Brain size={20} />
                AI-Generated Study Recommendations
              </CardTitle>
              <CardDescription>Based on error patterns and performance analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">📚 Focus Area: Integration Techniques</div>
                  <p className="text-sm text-blue-800">
                    Your accuracy on integration problems is 72%. Review substitution methods and integration by parts.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">⚡ Speed Training Recommended</div>
                  <p className="text-sm text-blue-800">
                    Your average time per question decreased 15% this week. Practice timed assessments to maintain momentum.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg">
                  <div className="font-semibold text-blue-900 mb-2">📈 Weekly Study Roadmap</div>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
                    <li>Monday-Tuesday: Review differential equations fundamentals</li>
                    <li>Wednesday-Thursday: Practice matrix operations</li>
                    <li>Friday: Mixed assessment to test retention</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Locked Socrates features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderLockedCard('Exam Performance Forecasting')}
            {renderLockedCard('AI-Generated Mock Exams')}
          </div>
        </div>
      )}

      {/* Tier III - Socrates */}
      {currentTier === 'socrates' && (
        <div className="space-y-6">
          {/* Elite metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Target className="text-blue-600" size={20} />
                  Total Questions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{mockStats.totalQuestions}</div>
                <p className="text-xs text-gray-500 mt-1">Elite unlimited access</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Award className="text-green-600" size={20} />
                  Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{mockStats.accuracy}%</div>
                <p className="text-xs text-green-600 mt-1">
                  +5% from last month
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <TrendingUp className="text-purple-600" size={20} />
                  Projected Grade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">88%</div>
                <p className="text-xs text-gray-500 mt-1">AI prediction</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                  <Brain className="text-orange-600" size={20} />
                  Math Maturity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">Advanced</div>
                <p className="text-xs text-gray-500 mt-1">Progression level</p>
              </CardContent>
            </Card>
          </div>

          {/* Everything from Plato */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Skill Mastery with Velocity</CardTitle>
                <CardDescription>Mastery percentage and learning velocity tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={skillMasteryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" angle={-15} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="mastery" fill="#3b82f6" name="Mastery %" />
                    <Line
                      type="monotone"
                      dataKey="velocity"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Velocity (% gain/week)"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Skill Comprehension with Benchmarks</CardTitle>
                <CardDescription>Your performance vs. peer averages</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={skillRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="skill" />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} />
                    <Radar
                      name="Your Performance"
                      dataKey="value"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.6}
                    />
                    <Radar
                      name="Peer Average"
                      dataKey="benchmark"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Exam Performance Probability Forecasting */}
          <Card className="bg-purple-50 border-purple-300">
            <CardHeader>
              <CardTitle className="text-purple-900 flex items-center gap-2">
                <TrendingUp size={20} />
                Exam Performance Probability Forecasting
              </CardTitle>
              <CardDescription>AI-powered predictive analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="examReadiness"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    name="Exam Readiness (%)"
                  />
                  <Area
                    type="monotone"
                    dataKey="projectedGrade"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.4}
                    name="Projected Grade (%)"
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">92%</div>
                  <div className="text-xs text-gray-600">Pass Probability</div>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">88%</div>
                  <div className="text-xs text-gray-600">Projected Final Grade</div>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">15 days</div>
                  <div className="text-xs text-gray-600">Until Exam Ready</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Topic Risk Scoring */}
          <Card className="bg-red-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center gap-2">
                <AlertCircle size={20} />
                Topic-Risk Scoring
              </CardTitle>
              <CardDescription>Which topics are most likely to cause failure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topicRiskData.map((topic) => (
                  <div key={topic.topic} className="bg-white p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-semibold">{topic.topic}</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs text-white ${
                          topic.difficulty === 'High' ? 'bg-red-500' :
                          topic.difficulty === 'Medium' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}>
                          {topic.difficulty} Risk
                        </span>
                        <span className="text-sm font-bold text-red-600">
                          {topic.failureProbability}% fail chance
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          topic.risk > 60 ? 'bg-red-500' :
                          topic.risk > 30 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${topic.risk}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Error Taxonomy Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Taxonomy Analysis</CardTitle>
                <CardDescription>Pattern recognition across months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={errorPatternData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ type, percentage }) => `${type}: ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {errorPatternData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> Computational errors decreased by 18% over 3 months.
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Recommendation:</strong> Focus on conceptual understanding for integration techniques.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Longitudinal Skill Evolution</CardTitle>
                <CardDescription>Mathematical maturity tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="examReadiness"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Exam Readiness"
                    />
                    <Line
                      type="monotone"
                      dataKey="improvement"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="Monthly Improvement"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-900">
                    <strong>Mathematical Maturity Level:</strong> Advanced<br/>
                    You've progressed from Beginner to Advanced in 6 months—excellent trajectory!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advanced AI Recommendations */}
          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-300">
            <CardHeader>
              <CardTitle className="text-purple-900 flex items-center gap-2">
                <Crown size={20} />
                Elite AI-Powered Learning Engine
              </CardTitle>
              <CardDescription>Personalized adaptive learning paths</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500">
                  <div className="font-semibold text-purple-900 mb-2">🎯 Custom Mock Exam Generated</div>
                  <p className="text-sm text-purple-800">
                    Based on your performance data, we've created a 20-question mock exam focusing on your weak areas: 
                    integration techniques (40%), differential equations (35%), and linear systems (25%).
                  </p>
                  <Button className="mt-3 bg-purple-600 text-white" size="sm">
                    Start Mock Exam
                  </Button>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                  <div className="font-semibold text-blue-900 mb-2">🧠 Intelligent Spacing Scheduler</div>
                  <p className="text-sm text-blue-800">
                    Next review session: Differential Equations (in 2 days). Your retention rate for this topic is 78%.
                    Optimal review timing maximizes long-term retention.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-orange-500">
                  <div className="font-semibold text-orange-900 mb-2">⚠️ Burnout Detection Alert</div>
                  <p className="text-sm text-orange-800">
                    Your accuracy dropped 7% in the last 3 days with increased time per question. 
                    Recommendation: Take a 1-day break before resuming practice.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                  <div className="font-semibold text-green-900 mb-2">📊 Concept Interdependency Map</div>
                  <p className="text-sm text-green-800">
                    Mastering "Integration by Parts" will unlock progress in "Differential Equations" and "Series Convergence". 
                    Focus here for maximum skill tree advancement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diagnostic Test Results - Adaptive Analytics */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300">
            <CardHeader>
              <CardTitle className="text-indigo-900 flex items-center gap-2">
                <FileText size={20} />
                Diagnostic Test Results - Adaptive Analytics
              </CardTitle>
              <CardDescription>
                Detailed performance analysis from Calculus I: Basic Differentiation Rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiagnosticResults />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}