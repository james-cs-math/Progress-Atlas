import React, { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
// @ts-ignore
const logoImage = "/Progress-Atlas/logo.png";

const AuthHeader = memo(() => (
  <CardHeader className="text-center">
    <div className="flex justify-center mb-4">
      // Inside your component
      <img 
        src={`${(import.meta as any).env.BASE_URL}logo.png`}
        alt="Progress Atlas Logo" 
        className="h-8 w-auto" // or whatever classes you have
      />
    </div>
    <CardTitle className="text-2xl">ProgressAtlas</CardTitle>
    <CardDescription>Your map to improvement.</CardDescription>
  </CardHeader>
));

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stemField, setStemField] = useState('');
  const [email, setEmail] = useState('');
  
  const navigate = useNavigate();
  const { session } = useAuth();

  useEffect(() => {
    if (session) navigate('/app');
  }, [session, navigate]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email.toLowerCase().includes('.edu')) {
      toast.error('Please use a university (.edu) email address.');
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      if (isSignUp) {
        // SIGN UP LOGIC - Use Supabase auth directly
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password: data.password as string,
          options: {
            data: {
              name: data.name,
              role: data.role,
              stem_field: data.stemField === 'other' ? data.otherField : data.stemField,
            }
          }
        });

        if (signUpError) {
          toast.error(signUpError.message);
          return;
        }

        // Create profile entry
        if (authData.user) {
          const finalStemField = data.stemField === 'other' ? data.otherField : data.stemField;
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              email: email,
              name: data.name,
              role: data.role,
              stem_field: finalStemField,
            });

          if (profileError) {
            console.error('Profile creation error:', profileError);
            // Don't throw error, user is still created in auth
          }
        }

        toast.success('Account created! Please sign in.');
        setIsSignUp(false);
      } else {
        // SIGN IN LOGIC
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: data.password as string,
        });

        if (error) {
          const { data: userExists } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (!userExists) {
            toast.error("Looks like you're new here! Please create an account.");
            setIsSignUp(true);
          } else {
            toast.error("Incorrect password!");
          }
          return;
        }

        toast.success('Signed in successfully!');
        navigate('/app');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <AuthHeader />
        <CardContent>
          <Tabs value={isSignUp ? 'signup' : 'signin'} onValueChange={(v) => setIsSignUp(v === 'signup')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            {/* Added AnimatePresence and motion.div for transition */}
            <AnimatePresence mode="wait">
              <motion.div
                key={isSignUp ? "signup" : "signin"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <form onSubmit={handleAuth} className="space-y-4">
                  {isSignUp && (
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" name="name" placeholder="Alan Turing" required />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">University Email</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="alan.turing@university.edu" 
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required minLength={6} />
                  </div>

                  {isSignUp && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="role">I am a:</Label>
                        <select id="role" name="role" className="w-full px-3 py-2 border rounded-md bg-white text-sm">
                          <option value="student">Student</option>
                          <option value="professional">Professional</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="stemField">STEM Field:</Label>
                        <select 
                          id="stemField" 
                          name="stemField" 
                          onChange={(e) => setStemField(e.target.value)}
                          className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                          required
                        >
                          <option value="">Select a field</option>
                          <option value="engineering">Engineering</option>
                          <option value="technology">Technology & Computing</option>
                          <option value="naturalSciences">Natural & Life Sciences</option>
                          <option value="finance">Finance & Management</option>
                          <option value="medicalHealth">Medical Health</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      {stemField === 'other' && (
                        <div className="space-y-2">
                          <Label htmlFor="otherField">Please specify:</Label>
                          <Input id="otherField" name="otherField" placeholder="Enter your field" required />
                        </div>
                      )}
                    </>
                  )}

                  <Button type="submit" className="w-full mt-2" disabled={loading}>
                    {loading ? (isSignUp ? 'Creating Account...' : 'Logging in...') : (isSignUp ? 'Create Account' : 'Sign In')}
                  </Button>
                </form>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}