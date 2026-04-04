import React, { useState } from 'react';
import { useTier } from '../lib/TierContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Check, Sparkles, Crown, GraduationCap, Circle, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface SubscriptionTier {
  id: string;
  name: string;
  title: string;
  price: number;
  icon: React.ReactNode;
  features: string[];
  popular?: boolean;
  color: string;
  description: string;
}

const tiers: SubscriptionTier[] = [
  {
    id: 'euclid',
    name: 'Euclid',
    title: 'Tier 0',
    price: 0,
    icon: <Circle className="w-8 h-8" />,
    color: 'from-gray-400 to-gray-500',
    description: 'For students exploring math readiness through basic AI diagnostics.',
    features: [
      '2 Diagnostic Tests per month',
      '25 Practice Questions per month',
      'Mean Accuracy & Audit Status tracking',
      'Basic Performance Audit dashboard',
      'Introductory topic-level evaluation',
      '7-day progress history storage',
      'Standard equation rendering',
      'Standard processing priority',
    ],
  },
  {
    id: 'aristotle',
    name: 'Aristotle',
    title: 'Tier I',
    price: 599,
    icon: <GraduationCap className="w-8 h-8" />,
    color: 'from-amber-600 to-amber-700',
    description: 'For students building foundational clarity and identifying weak spots.',
    features: [
      'Everything in Euclid, plus:',
      '15 Diagnostic Tests per month',
      'Unlimited Practice Questions',
      'AI Study Recommendations',
      'Prerequisite Domain identification',
      'Accuracy Stability Index (High/Mid/Low)',
      'Strength vs. Weakness Heat Maps',
      'Up to 10 image uploads per month',
      'Full history storage (no 7-day limit)',
    ],
  },
  {
    id: 'plato',
    name: 'Plato',
    title: 'Tier II',
    price: 799,
    icon: <Sparkles className="w-8 h-8" />,
    popular: true,
    color: 'from-indigo-600 to-indigo-700',
    description: 'For students seeking analytical mastery and deep mastery progression.',
    features: [
      'Everything in Aristotle, plus:',
      'Unlimited Diagnostic Tests',
      'Performance Audit (Question History)',
      'Full Session Breakdown (Question-by-Question)',
      'Logic Error Analysis (Slips vs Gaps)',
      'Learning Velocity tracking (+/- Accuracy)',
      'Mastery Runway (Questions needed for 90%)',
      'Cognitive Efficiency Scatter plots',
      'Unlimited image uploads',
      'Unlimited LaTeX rendering',
    ],
  },
  {
    id: 'socrates',
    name: 'Socrates',
    title: 'Tier III',
    price: 999,
    icon: <Crown className="w-8 h-8" />,
    color: 'from-purple-600 to-purple-700',
    description: 'Elite AI tutoring and predictive preparation for serious exam performance.',
    features: [
      'Everything in Plato, plus:',
      'AI Logic Tutor (Interactive follow-up chat)',
      'Explain with AI (Question-level breakdown)',
      'Mathematical Maturity tracking',
      'Exam Performance Probability Forecasting',
      'Topic-Risk Scoring (High/Med/Low)',
      'Projected Final Grade estimation',
      'Historical Momentum statement insights',
      'Priority access to experimental AI models',
      'Dedicated support queue',
    ],
  },
];

export function SubscriptionPage() {
  const { currentTier, setCurrentTier } = useTier();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (tierId: string) => {
    setLoading(true);
    setSelectedTier(tierId);

    // Simulate subscription process
    setTimeout(() => {
      setCurrentTier(tierId as 'euclid' | 'aristotle' | 'plato' | 'socrates');
      toast.success('Subscription activated! Welcome to ' + tiers.find(t => t.id === tierId)?.name);
      setLoading(false);
      setSelectedTier(null);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center mb-2">
            <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest">
              Pricing Plans
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">
            Unlock your Potential
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
            From basic readiness to elite AI-powered performance. Choose the tier that matches your academic goals.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12 items-stretch">
          {tiers.map((tier) => {
            const isCurrent = currentTier === tier.id;
            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col border-2 transition-all duration-300 ${
                  tier.popular 
                    ? 'border-indigo-600 shadow-2xl scale-105 z-10 bg-indigo-50/50' 
                    : 'border-slate-100 hover:border-indigo-200 bg-white'
                } ${isCurrent ? 'opacity-90' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white px-4 py-1 text-[10px] font-black uppercase tracking-widest rounded-bl-lg">
                    Most Popular
                  </div>
                )}

                <CardHeader className="text-center pb-8 pt-10">
                  <div className={`mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-white mb-4 shadow-lg`}>
                    {tier.icon}
                  </div>
                  <CardTitle className="text-2xl font-black uppercase italic tracking-tight">{tier.name}</CardTitle>
                  <CardDescription className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{tier.title}</CardDescription>
                  <div className="mt-4">
                    {tier.price === 0 ? (
                      <span className="text-4xl font-black text-slate-900">FREE</span>
                    ) : (
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-sm font-bold text-slate-500 uppercase">Php</span>
                        <span className="text-4xl font-black text-slate-900">{tier.price}</span>
                        <span className="text-sm font-bold text-slate-500 uppercase">/mo</span>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <p className="text-xs font-bold text-slate-500 leading-relaxed text-center px-2">{tier.description}</p>
                  <div className="h-px bg-slate-100 w-full my-4" />
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className={`w-4 h-4 ${tier.popular ? 'text-indigo-600' : 'text-emerald-500'} flex-shrink-0 mt-0.5`} strokeWidth={3} />
                        <span className="text-xs font-bold text-slate-700 leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-6">
                  <Button
                    className={`w-full h-12 rounded-xl font-black uppercase tracking-widest transition-all ${
                      isCurrent 
                        ? 'bg-slate-200 text-slate-500 cursor-default' 
                        : `bg-gradient-to-r ${tier.color} text-white hover:scale-105 shadow-md`
                    }`}
                    onClick={() => !isCurrent && handleSubscribe(tier.id)}
                    disabled={loading || isCurrent}
                  >
                    {loading && selectedTier === tier.id 
                      ? 'Processing...' 
                      : isCurrent 
                      ? 'Current Plan' 
                      : 'Select Tier'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-4xl mx-auto border-t pt-16">
          <div className="text-center mb-10">
             <h2 className="text-2xl font-black uppercase italic tracking-tighter">Feature Support</h2>
             <p className="text-sm text-slate-400 font-bold uppercase mt-1">Frequently Asked Questions</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 pb-20">
            <div className="space-y-2">
              <h3 className="font-black text-sm uppercase text-slate-900">What is the "AI Logic Tutor"?</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Available in the Socrates tier, the AI Logic Tutor allows you to have a continuous chat about any question you get wrong, helping you debug your specific thought process.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-sm uppercase text-slate-900">What are "Logic Slips vs Gaps"?</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Plato users and above can see exactly why they missed a question—whether it was a simple calculation error (Slip) or a fundamental misunderstanding (Gap).
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-sm uppercase text-slate-900">Can I change my plan?</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Yes. Upgrading or downgrading between Euclid, Aristotle, Plato, and Socrates takes effect immediately on your next session.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-sm uppercase text-slate-900">How is Velocity calculated?</h3>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">
                Velocity tracks your improvement rate by comparing your last 3 sessions to your first 3 sessions, giving you a percentage growth metric.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}