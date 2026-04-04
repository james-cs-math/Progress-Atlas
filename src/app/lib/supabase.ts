import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey);

export const API_BASE_URL = `${supabaseUrl}/functions/v1/make-server-34d0da20`;

// Helper function for unauthenticated API calls (like signup)
export async function publicApiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Public API call failed for ${endpoint}: ${response.status} ${response.statusText}`, errorText);
      
      let errorMessage = 'Unknown error';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        errorMessage = errorText || `${response.status} ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    console.error(`Error in publicApiCall to ${endpoint}:`, error);
    throw error;
  }
}

// Helper function to make authenticated API calls
export async function apiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      console.error('No valid session found for API call');
      throw new Error('Not authenticated. Please sign in again.');
    }

    console.log('Making API call to:', endpoint);
    console.log('Token length:', session.access_token.length);
    console.log('Token preview:', session.access_token.substring(0, 20) + '...');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API call failed for ${endpoint}: ${response.status} ${response.statusText}`, errorText);
      
      let errorMessage = 'Unknown error';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        errorMessage = errorText || `${response.status} ${response.statusText}`;
      }
      
      // If it's an auth error, provide a more helpful message
      if (response.status === 401) {
        throw new Error('Session expired. Please sign in again.');
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    console.error(`Error in apiCall to ${endpoint}:`, error);
    throw error;
  }
}