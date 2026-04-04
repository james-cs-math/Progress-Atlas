import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { apiCall } from '../lib/supabase';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { BookOpen, ArrowRight } from 'lucide-react';

const PROGRAMS = [
  { id: 'stem', name: 'STEM (General)' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'cs', name: 'Computer Science' },
  { id: 'architecture', name: 'Architecture' },
  { id: 'physics', name: 'Physics' },
  { id: 'math', name: 'Mathematics' },
];

const SUBJECTS = [
  { id: 'calculus1', name: 'Differential Calculus', description: 'Limits, derivatives, and integrals' },
  { id: 'calculus2', name: 'Integral Calculus', description: 'Advanced integration techniques' },
  { id: 'calculus3', name: 'Multivariate Calculus', description: 'Multivariable calculus' },
  { id: 'linear-algebra', name: 'Linear Algebra', description: 'Vectors, matrices, and transformations' },
  { id: 'diff-equations', name: 'Differential Equations', description: 'ODEs and PDEs' },
  { id: 'engineering-math', name: 'Engineering Mathematics', description: 'Applied mathematics for engineers' },
  { id: 'discrete-math', name: 'Discrete Mathematics', description: 'Logic, sets, and combinatorics' },
  { id: 'statistics', name: 'Statistics & Probability', description: 'Statistical analysis and probability theory' },
];

export function CourseSelection() {
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadExistingCourses();
  }, []);

  const loadExistingCourses = async () => {
    try {
      const data = await apiCall('/courses');
      if (data.courses) {
        setSelectedProgram(data.courses.program || '');
        setSelectedSubjects(data.courses.subjects || []);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      // Don't show error toast on initial load - just use empty defaults
    } finally {
      setLoadingData(false);
    }
  };

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSave = async () => {
    if (!selectedProgram) {
      toast.error('Please select a program');
      return;
    }

    if (selectedSubjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }

    setLoading(true);
    try {
      await apiCall('/courses', {
        method: 'POST',
        body: JSON.stringify({
          program: selectedProgram,
          subjects: selectedSubjects,
        }),
      });

      toast.success('Courses saved successfully!');
      navigate('/app/chat');
    } catch (error: any) {
      console.error('Error saving courses:', error);
      toast.error(error.message || 'Failed to save courses');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Course Selection & Onboarding</h1>
        <p className="text-gray-600">
          Select your program and subjects to begin your personalized math diagnostic journey
        </p>
      </div>

      {/* Program Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="text-blue-600" />
            Select Your Program
          </CardTitle>
          <CardDescription>
            Choose the program that best matches your academic focus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PROGRAMS.map((program) => (
              <button
                key={program.id}
                onClick={() => setSelectedProgram(program.id)}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all
                  ${
                    selectedProgram === program.id
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }
                `}
              >
                <div className="font-medium">{program.name}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subject Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Your Subjects</CardTitle>
          <CardDescription>
            Choose the math subjects you want to improve in (select multiple)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {SUBJECTS.map((subject) => (
              <div
                key={subject.id}
                className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50"
              >
                <Checkbox
                  id={subject.id}
                  checked={selectedSubjects.includes(subject.id)}
                  onCheckedChange={() => toggleSubject(subject.id)}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={subject.id}
                    className="text-base font-medium cursor-pointer"
                  >
                    {subject.name}
                  </Label>
                  <p className="text-sm text-gray-500">{subject.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={loading || !selectedProgram || selectedSubjects.length === 0}
          className="gap-2"
        >
          {loading ? 'Saving...' : 'Continue to AI Workspace'}
          <ArrowRight size={20} />
        </Button>
      </div>
    </div>
  );
}