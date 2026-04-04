import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase client with service role key for admin operations
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Create Supabase client with anon key for validating user JWTs
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-34d0da20/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/make-server-34d0da20/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role = 'student' } = body;

    if (!email || !password || !name) {
      return c.json({ error: 'Email, password, and name are required' }, 400);
    }

    // Create user with Supabase Auth
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Initialize user profile in KV store
    await kv.set(`user:${data.user.id}:profile`, {
      id: data.user.id,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    });

    return c.json({ 
      message: 'User created successfully',
      userId: data.user.id 
    });
  } catch (error) {
    console.log(`Server error during signup: ${error}`);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

// Get user profile
app.get("/make-server-34d0da20/profile", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while fetching profile: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const profile = await kv.get(`user:${user.id}:profile`);
    
    return c.json({ 
      profile: profile || { 
        id: user.id, 
        email: user.email,
        name: user.user_metadata?.name,
        role: user.user_metadata?.role || 'student'
      } 
    });
  } catch (error) {
    console.log(`Server error while fetching profile: ${error}`);
    return c.json({ error: 'Internal server error while fetching profile' }, 500);
  }
});

// Save course selection
app.post("/make-server-34d0da20/courses", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while saving courses: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { program, subjects } = body;

    await kv.set(`user:${user.id}:courses`, {
      program,
      subjects,
      updatedAt: new Date().toISOString(),
    });

    return c.json({ message: 'Courses saved successfully' });
  } catch (error) {
    console.log(`Server error while saving courses: ${error}`);
    return c.json({ error: 'Internal server error while saving courses' }, 500);
  }
});

// Get user courses
app.get("/make-server-34d0da20/courses", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.split(' ')[1];
    
    console.log('Courses endpoint - Auth header received:', authHeader?.substring(0, 30) + '...');
    console.log('Courses endpoint - Token extracted:', accessToken?.substring(0, 20) + '...');
    
    if (!accessToken) {
      return c.json({ code: 401, message: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while fetching courses: ${error?.message}`);
      console.log('Full error details:', JSON.stringify(error));
      return c.json({ code: 401, message: 'Invalid JWT' }, 401);
    }

    const courses = await kv.get(`user:${user.id}:courses`);
    
    return c.json({ courses: courses || null });
  } catch (error) {
    console.log(`Server error while fetching courses: ${error}`);
    return c.json({ error: 'Internal server error while fetching courses' }, 500);
  }
});

// Save conversation message
app.post("/make-server-34d0da20/conversations", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while saving conversation: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { message, sender, questionType, assessment } = body;

    // Get existing conversation or create new one
    const conversationKey = `user:${user.id}:conversation`;
    const existingConversation = await kv.get(conversationKey) || { messages: [] };
    
    const newMessage = {
      id: crypto.randomUUID(),
      message,
      sender,
      questionType,
      assessment,
      timestamp: new Date().toISOString(),
    };

    existingConversation.messages.push(newMessage);
    await kv.set(conversationKey, existingConversation);

    return c.json({ message: 'Message saved successfully', messageId: newMessage.id });
  } catch (error) {
    console.log(`Server error while saving conversation: ${error}`);
    return c.json({ error: 'Internal server error while saving conversation' }, 500);
  }
});

// Get conversation history
app.get("/make-server-34d0da20/conversations", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while fetching conversation: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const conversation = await kv.get(`user:${user.id}:conversation`);
    
    return c.json({ conversation: conversation || { messages: [] } });
  } catch (error) {
    console.log(`Server error while fetching conversation: ${error}`);
    return c.json({ error: 'Internal server error while fetching conversation' }, 500);
  }
});

// Save assessment result
app.post("/make-server-34d0da20/assessments", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while saving assessment: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { subject, topic, questionType, correct, timeTaken, difficulty } = body;

    // Get existing assessments or create new array
    const assessmentsKey = `user:${user.id}:assessments`;
    const existingAssessments = await kv.get(assessmentsKey) || { results: [] };
    
    const newAssessment = {
      id: crypto.randomUUID(),
      subject,
      topic,
      questionType,
      correct,
      timeTaken,
      difficulty,
      timestamp: new Date().toISOString(),
    };

    existingAssessments.results.push(newAssessment);
    await kv.set(assessmentsKey, existingAssessments);

    return c.json({ message: 'Assessment saved successfully', assessmentId: newAssessment.id });
  } catch (error) {
    console.log(`Server error while saving assessment: ${error}`);
    return c.json({ error: 'Internal server error while saving assessment' }, 500);
  }
});

// Get assessment data for dashboard
app.get("/make-server-34d0da20/assessments", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while fetching assessments: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const assessments = await kv.get(`user:${user.id}:assessments`);
    
    return c.json({ assessments: assessments || { results: [] } });
  } catch (error) {
    console.log(`Server error while fetching assessments: ${error}`);
    return c.json({ error: 'Internal server error while fetching assessments' }, 500);
  }
});

// Get dashboard statistics
app.get("/make-server-34d0da20/dashboard/stats", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while fetching dashboard stats: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const assessments = await kv.get(`user:${user.id}:assessments`) || { results: [] };
    const diagnosticTests = await kv.get(`user:${user.id}:diagnostic-tests`) || { tests: [] };
    const results = assessments.results || [];
    const tests = diagnosticTests.tests || [];

    // Calculate statistics
    const totalQuestions = results.length;
    const correctAnswers = results.filter((r: any) => r.correct).length;
    const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
    
    // Calculate average time
    const totalTime = results.reduce((sum: number, r: any) => sum + (r.timeTaken || 0), 0);
    const averageTime = totalQuestions > 0 ? totalTime / totalQuestions : 0;

    // Group by subject
    const subjectStats: any = {};
    results.forEach((r: any) => {
      if (!subjectStats[r.subject]) {
        subjectStats[r.subject] = { total: 0, correct: 0 };
      }
      subjectStats[r.subject].total++;
      if (r.correct) subjectStats[r.subject].correct++;
    });

    // Group by topic
    const topicStats: any = {};
    results.forEach((r: any) => {
      if (!topicStats[r.topic]) {
        topicStats[r.topic] = { total: 0, correct: 0 };
      }
      topicStats[r.topic].total++;
      if (r.correct) topicStats[r.topic].correct++;
    });

    return c.json({
      stats: {
        totalQuestions,
        correctAnswers,
        accuracy: Math.round(accuracy * 10) / 10,
        averageTime: Math.round(averageTime * 10) / 10,
        subjectStats,
        topicStats,
        recentResults: results.slice(-10).reverse(),
        diagnosticTests: tests,
      }
    });
  } catch (error) {
    console.log(`Server error while fetching dashboard stats: ${error}`);
    return c.json({ error: 'Internal server error while fetching dashboard stats' }, 500);
  }
});

// Save diagnostic test results
app.post("/make-server-34d0da20/diagnostic/save", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while saving diagnostic test: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { course, topic, setType, results } = body;

    // Get existing diagnostic tests or create new array
    const diagnosticKey = `user:${user.id}:diagnostic-tests`;
    const existingTests = await kv.get(diagnosticKey) || { tests: [] };
    
    const newTest = {
      id: crypto.randomUUID(),
      course,
      topic,
      setType,
      results,
      timestamp: new Date().toISOString(),
    };

    existingTests.tests.push(newTest);
    await kv.set(diagnosticKey, existingTests);

    // Also save individual responses as assessments for overall stats
    const assessmentsKey = `user:${user.id}:assessments`;
    const existingAssessments = await kv.get(assessmentsKey) || { results: [] };
    
    results.responses.forEach((response: any) => {
      const assessment = {
        id: crypto.randomUUID(),
        subject: course,
        topic: topic,
        questionType: 'multiple-choice',
        correct: response.isCorrect,
        timeTaken: response.timeSpent,
        difficulty: setType,
        questionId: response.questionId,
        mode: 'diagnostic',
        timestamp: new Date().toISOString(),
      };
      existingAssessments.results.push(assessment);
    });
    
    await kv.set(assessmentsKey, existingAssessments);

    return c.json({ message: 'Diagnostic test saved successfully', testId: newTest.id });
  } catch (error) {
    console.log(`Server error while saving diagnostic test: ${error}`);
    return c.json({ error: 'Internal server error while saving diagnostic test' }, 500);
  }
});

// Get diagnostic test results
app.get("/make-server-34d0da20/diagnostic/results", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No authorization token provided' }, 401);
    }

    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.log(`Authorization error while fetching diagnostic results: ${error?.message}`);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const diagnosticTests = await kv.get(`user:${user.id}:diagnostic-tests`);
    
    return c.json({ diagnosticTests: diagnosticTests || { tests: [] } });
  } catch (error) {
    console.log(`Server error while fetching diagnostic results: ${error}`);
    return c.json({ error: 'Internal server error while fetching diagnostic results' }, 500);
  }
});

Deno.serve(app.fetch);