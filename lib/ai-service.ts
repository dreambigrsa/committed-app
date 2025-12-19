/**
 * AI Service for Committed AI
 * Handles AI responses using OpenAI API or fallback responses
 */

import { supabase } from './supabase';

// Import Constants with proper typing
let Constants: any;
try {
  Constants = require('expo-constants').default;
} catch (e) {
  // Constants might not be available in all contexts
  Constants = null;
}

const COMMITTED_AI_EMAIL = 'ai@committed.app';
const COMMITTED_AI_NAME = 'Committed AI';
const OPENAI_SETTINGS_KEY = 'openai_api_key';

// High-signal product knowledge injected into the AI system prompt so the assistant
// can help users with app-specific questions and troubleshooting.
// Keep this compact; it runs on every AI turn and affects latency/cost.
const COMMITTED_APP_KNOWLEDGE = `
ABOUT THE APP (COMMITTED)
- Committed is a relationship-focused social app: profiles, relationship registration, verification, posts, reels, messages, notifications, and admin tools.

MAIN NAVIGATION (TABS)
- Home: overview of your relationship and status.
- Feed: posts from users (like/comment).
- Reels: short vertical videos.
- Messages: conversations and Committed AI chat.
- Search: find users and check relationship status.
- Notifications: alerts, requests, system notices.
- Profile/Settings: your profile and account settings.

KEY FLOWS (SHORT)
- Relationship: Relationship → Register.
- Verification: Settings → Verification.
- Post/Reel: Post → Create, Reel → Create.
- Status: Status → Create (photo/video/text).

COMMON TROUBLESHOOTING
- Photos/Gallery not working: grant photo/media permissions in phone settings; on Android 13+ allow Photos and Videos permissions. After changing plugins/permissions, rebuild/reinstall the app.
- Camera not working: grant camera permission.
- Notifications not showing: enable notifications permission; on Android ensure notifications are allowed and the channel isn’t muted.
- If something errors: ask what screen they’re on, what they tapped, and the exact error text or a screenshot.

ADMIN CAPABILITIES
- Super Admin can access Admin dashboard and settings.
- Admin Settings includes OpenAI key management (save/test) for Committed AI.
`;

let cachedOpenAIKey: string | null | undefined = undefined; // undefined = not loaded
let openAIKeyLoadPromise: Promise<string | null> | null = null;

function normalizeOpenAIKey(candidate: any): string | null {
  if (typeof candidate !== 'string') return null;
  const v = candidate.trim();
  if (!v) return null;
  // Basic sanity check: avoid cases like "[object Object]" and only accept real-looking keys.
  // OpenAI keys are typically sk-... (including sk-proj-...).
  if (!v.startsWith('sk-')) return null;
  return v;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  imageUrl?: string; // For generated images
  documentUrl?: string; // For generated documents
  documentName?: string; // For generated documents
  contentType?: 'text' | 'image' | 'document'; // Type of response
}

export interface UserLearnings {
  communication_style?: string;
  preferred_topics?: string[];
  interests?: string[];
  goals?: string[];
  relationship_status?: string;
  concerns?: string[];
  response_preferences?: any;
  conversation_patterns?: any;
  user_satisfaction_score?: number;
  total_interactions?: number;
  ai_notes?: string;
}

/**
 * Get or create the Committed AI user
 */
export async function getOrCreateAIUser(): Promise<{ id: string } | null> {
  try {
    // First, try to find existing AI user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('email', COMMITTED_AI_EMAIL)
      .maybeSingle();

    if (existingUser) {
      return { id: existingUser.id };
    }

    // If not found, try using a database function
    // Note: The auth user must be created first via Supabase Dashboard
    try {
      const { data: functionResult, error: functionError } = await supabase
        .rpc('create_ai_user');

      if (!functionError && functionResult) {
        // Try to fetch the newly created user
        const { data: newUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', COMMITTED_AI_EMAIL)
          .single();

        if (newUser) {
          return { id: newUser.id };
        }
      }
    } catch (error) {
      console.log('Database function not available or auth user not created yet');
    }

    // If we still don't have the user, return null
    // The user should create the auth user first via Dashboard, then run create-ai-user.sql
    console.error('AI user not found. Please:');
    console.error('1. Go to Supabase Dashboard → Authentication → Users');
    console.error('2. Create user with email: ai@committed.app');
    console.error('3. Run create-ai-user.sql in Supabase SQL Editor');
    return null;
  } catch (error: any) {
    console.error('Error getting/creating AI user:', error);
    return null;
  }
}

async function loadOpenAIKeyFromSupabase(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', OPENAI_SETTINGS_KEY)
      .maybeSingle();

    if (error) return null;
    return normalizeOpenAIKey(data?.value ?? null);
  } catch {
    return null;
  }
}

/**
 * Get OpenAI API key:
 * - First: Expo build-time config/env
 * - Then: Supabase `app_settings` (super_admin-managed)
 */
async function getOpenAIApiKeyAsync(): Promise<string | null> {
  // 1) Expo Constants (recommended for Expo)
  try {
    if (Constants && Constants.expoConfig) {
      const expoConfig = Constants.expoConfig;
      if (expoConfig?.extra?.openaiApiKey) {
        const v = normalizeOpenAIKey(expoConfig.extra.openaiApiKey);
        if (v) return v;
      }
    }
  } catch {
    // ignore
  }

  // 2) Process env (works at build time in Expo)
  try {
    // @ts-ignore - process.env is available in Expo at build time
    const processEnv: any = typeof process !== 'undefined' && process.env ? process.env : {};
    const v1 = normalizeOpenAIKey(processEnv.EXPO_PUBLIC_OPENAI_API_KEY);
    if (v1) return v1;
    const v2 = normalizeOpenAIKey(processEnv.OPENAI_API_KEY);
    if (v2) return v2;
  } catch {
    // ignore
  }

  // 3) Cached DB value (load once)
  if (cachedOpenAIKey !== undefined) return cachedOpenAIKey;
  if (!openAIKeyLoadPromise) {
    openAIKeyLoadPromise = loadOpenAIKeyFromSupabase().finally(() => {
      openAIKeyLoadPromise = null;
    });
  }
  cachedOpenAIKey = await openAIKeyLoadPromise;
  return cachedOpenAIKey;
}

export async function refreshOpenAIKeyCache(): Promise<string | null> {
  cachedOpenAIKey = await loadOpenAIKeyFromSupabase();
  return cachedOpenAIKey;
}

async function generateImage(prompt: string): Promise<AIResponse> {
  try {
    const shouldUseDirectOpenAI = __DEV__ && !!(await getOpenAIApiKeyAsync());

    // Clean up the prompt - remove common request phrases
    let cleanPrompt = prompt
      .replace(/generate (an? )?image (of|for|showing)/i, '')
      .replace(/create (an? )?(picture|image|photo) (of|for|showing)/i, '')
      .replace(/show me (an? )?(picture|image|photo) (of|for)/i, '')
      .replace(/draw (me )?(an? )?(picture|image) (of|for)/i, '')
      .replace(/make (an? )?(picture|image) (of|for)/i, '')
      .trim();

    if (!cleanPrompt) {
      cleanPrompt = prompt; // Fallback to original if cleaning removed everything
    }

    let imageUrl: string | null = null;

    if (shouldUseDirectOpenAI) {
      const openaiApiKey = await getOpenAIApiKeyAsync();
      if (!openaiApiKey) throw new Error('OpenAI API key missing');

      // Dev-only: call OpenAI directly
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: cleanPrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI image error: ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      imageUrl = data?.data?.[0]?.url ?? null;
    } else {
      // Production: call Supabase Edge Function so the key stays server-side
      const { data, error } = await supabase.functions.invoke('openai-image', {
        body: {
          prompt: cleanPrompt,
          model: 'dall-e-3',
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'openai-image failed');
      imageUrl = typeof data?.imageUrl === 'string' ? data.imageUrl : null;
    }

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    // Upload image to Supabase storage
    const uploadedUrl = await uploadImageToStorage(imageUrl, cleanPrompt);

    return {
      success: true,
      message: `I've generated an image for you: "${cleanPrompt}"`,
      imageUrl: uploadedUrl,
      contentType: 'image',
    };
  } catch (error: any) {
    console.error('Image generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate image. Please try again.',
    };
  }
}

/**
 * Upload generated image to Supabase storage
 */
async function uploadImageToStorage(imageUrl: string, prompt: string): Promise<string> {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generate filename
    const timestamp = Date.now();
    const sanitizedPrompt = prompt.substring(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `ai-generated/${timestamp}_${sanitizedPrompt}.png`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('media')
      .upload(filename, uint8Array, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image to storage:', error);
      // Return original URL if upload fails
      return imageUrl;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    // Return original URL if upload fails
    return imageUrl;
  }
}

/**
 * Generate document (PDF/text) based on user request
 */
async function generateDocument(
  userRequest: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIResponse> {
  try {
    const shouldUseDirectOpenAI = __DEV__ && !!(await getOpenAIApiKeyAsync());

    // Determine document type and content
    const systemPrompt = `You are a professional document writer. Based on the user's request, generate a well-structured document. The document should be professional, clear, and comprehensive. Format it as plain text that can be converted to PDF. Include appropriate sections, headings, and content based on the document type requested.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-5), // Last 5 messages for context
      { role: 'user', content: `Please generate a document based on this request: ${userRequest}` },
    ];

    let documentContent = '';

    if (shouldUseDirectOpenAI) {
      const openaiApiKey = await getOpenAIApiKeyAsync();
      if (!openaiApiKey) throw new Error('OpenAI API key missing');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json().catch(() => ({}));
      documentContent = data?.choices?.[0]?.message?.content || '';
    } else {
      const { data, error } = await supabase.functions.invoke('openai-chat', {
        body: {
          messages,
          temperature: 0.7,
          max_tokens: 2000,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'openai-chat failed');
      documentContent = String(data.message ?? '');
    }

    if (!documentContent) {
      throw new Error('No document content generated');
    }

    // Determine document name from request
    let documentName = 'document.txt';
    if (userRequest.toLowerCase().includes('contract')) {
      documentName = 'contract.txt';
    } else if (userRequest.toLowerCase().includes('agreement')) {
      documentName = 'agreement.txt';
    } else if (userRequest.toLowerCase().includes('proposal')) {
      documentName = 'proposal.txt';
    } else if (userRequest.toLowerCase().includes('report')) {
      documentName = 'report.txt';
    } else if (userRequest.toLowerCase().includes('letter')) {
      documentName = 'letter.txt';
    }

    // Upload document to Supabase storage
    const documentUrl = await uploadDocumentToStorage(documentContent, documentName);

    return {
      success: true,
      message: `I've generated a ${documentName.replace('.txt', '')} for you. You can download it from the message.`,
      documentUrl: documentUrl,
      documentName: documentName,
      contentType: 'document',
    };
  } catch (error: any) {
    console.error('Document generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate document. Please try again.',
    };
  }
}

/**
 * Upload generated document to Supabase storage
 */
async function uploadDocumentToStorage(content: string, filename: string): Promise<string> {
  try {
    // Convert text to blob
    const blob = new Blob([content], { type: 'text/plain' });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generate storage filename
    const timestamp = Date.now();
    const storageFilename = `ai-documents/${timestamp}_${filename}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('media')
      .upload(storageFilename, uint8Array, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading document to storage:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(storageFilename);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}

/**
 * Check if this is the first message in the conversation
 */
export function isFirstMessage(conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>): boolean {
  return conversationHistory.length === 0;
}

/**
 * Get user learnings from database
 */
export async function getUserLearnings(userId: string): Promise<UserLearnings | null> {
  try {
    const { data, error } = await supabase
      .from('ai_user_learnings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      communication_style: data.communication_style,
      preferred_topics: data.preferred_topics || [],
      interests: data.interests || [],
      goals: data.goals || [],
      relationship_status: data.relationship_status,
      concerns: data.concerns || [],
      response_preferences: data.response_preferences,
      conversation_patterns: data.conversation_patterns,
      user_satisfaction_score: data.user_satisfaction_score,
      total_interactions: data.total_interactions,
      ai_notes: data.ai_notes,
    };
  } catch (error) {
    console.error('Error getting user learnings:', error);
    return null;
  }
}

/**
 * Analyze conversation and extract learnings
 */
async function analyzeConversationForLearnings(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userId: string
): Promise<Partial<UserLearnings>> {
  try {
    // Use OpenAI to analyze the conversation if available
    const openaiApiKey = await getOpenAIApiKeyAsync();

    if (openaiApiKey) {
      // Create analysis prompt
      const analysisPrompt = `Analyze this conversation and extract user characteristics. Respond ONLY with valid JSON:
{
  "communication_style": "formal|casual|friendly|direct",
  "interests": ["interest1", "interest2"],
  "topics": ["topic1", "topic2"],
  "goals": ["goal1"],
  "relationship_status": "single|dating|married|etc",
  "concerns": ["concern1"],
  "response_preferences": {"length": "short|medium|long", "tone": "supportive|direct|etc"}
}

User messages: ${conversationHistory.filter(m => m.role === 'user').slice(-10).map(m => m.content).join('\n')}
Latest message: ${userMessage}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are an expert at analyzing conversations and extracting user characteristics. Respond only with valid JSON.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const analysisText = data.choices[0]?.message?.content || '{}';
        try {
          const analysis = JSON.parse(analysisText);
          return {
            communication_style: analysis.communication_style,
            preferred_topics: analysis.topics,
            interests: analysis.interests,
            goals: analysis.goals,
            relationship_status: analysis.relationship_status,
            concerns: analysis.concerns,
            response_preferences: analysis.response_preferences,
          };
        } catch (e) {
          console.error('Error parsing analysis JSON:', e);
        }
      }
    }

    // Fallback: Simple pattern-based analysis
    return analyzeConversationPatterns(userMessage, conversationHistory);
  } catch (error) {
    console.error('Error analyzing conversation:', error);
    return analyzeConversationPatterns(userMessage, conversationHistory);
  }
}

/**
 * Simple pattern-based conversation analysis (fallback)
 */
function analyzeConversationPatterns(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Partial<UserLearnings> {
  const message = userMessage.toLowerCase();
  const allMessages = conversationHistory.filter(m => m.role === 'user').map(m => m.content.toLowerCase()).join(' ');
  
  const learnings: Partial<UserLearnings> = {};
  const interests: string[] = [];
  const topics: string[] = [];
  const concerns: string[] = [];

  // Detect communication style
  if (message.includes('please') || message.includes('thank you') || message.includes('appreciate')) {
    learnings.communication_style = 'formal';
  } else if (message.includes('hey') || message.includes("what's up") || message.includes('lol')) {
    learnings.communication_style = 'casual';
  } else if (message.length < 20) {
    learnings.communication_style = 'direct';
  }

  // Detect topics and interests
  if (allMessages.includes('relationship') || allMessages.includes('partner')) topics.push('relationships');
  if (allMessages.includes('business') || allMessages.includes('work') || allMessages.includes('career')) topics.push('business');
  if (allMessages.includes('health') || allMessages.includes('fitness') || allMessages.includes('exercise')) topics.push('health');
  if (allMessages.includes('travel') || allMessages.includes('vacation')) interests.push('travel');
  if (allMessages.includes('music') || allMessages.includes('song')) interests.push('music');
  if (allMessages.includes('food') || allMessages.includes('cooking') || allMessages.includes('recipe')) interests.push('food');

  // Detect concerns
  if (allMessages.includes('stressed') || allMessages.includes('worried') || allMessages.includes('anxious')) concerns.push('stress');
  if (allMessages.includes('sad') || allMessages.includes('depressed') || allMessages.includes('down')) concerns.push('emotional');
  if (allMessages.includes('relationship') && (allMessages.includes('problem') || allMessages.includes('issue'))) concerns.push('relationship_issues');

  if (topics.length > 0) learnings.preferred_topics = topics;
  if (interests.length > 0) learnings.interests = interests;
  if (concerns.length > 0) learnings.concerns = concerns;

  return learnings;
}

/**
 * Update user learnings in database
 */
export async function updateUserLearnings(
  userId: string,
  learnings: Partial<UserLearnings>,
  satisfactionScore?: number
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_ai_learnings', {
      p_user_id: userId,
      p_communication_style: learnings.communication_style || null,
      p_preferred_topics: learnings.preferred_topics || null,
      p_interests: learnings.interests || null,
      p_goals: learnings.goals || null,
      p_relationship_status: learnings.relationship_status || null,
      p_concerns: learnings.concerns || null,
      p_response_preferences: learnings.response_preferences || null,
      p_conversation_patterns: learnings.conversation_patterns || null,
      p_satisfaction_score: satisfactionScore || null,
      p_ai_notes: learnings.ai_notes || null,
    });

    if (error) {
      console.error('Error updating user learnings:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error updating user learnings:', error);
    return false;
  }
}

/**
 * Generate personalized system prompt based on learnings
 */
function buildPersonalizedSystemPrompt(
  userName: string,
  userUsername?: string,
  learnings?: UserLearnings | null
): string {
  const userDisplayName = userName || userUsername || 'the user';
  let prompt = `You are Committed AI, the in-app assistant for the Committed mobile application.
Your job is to (1) answer normal questions, and (2) provide Committed app-specific help: guidance, troubleshooting, and step-by-step instructions.

APP KNOWLEDGE (SOURCE OF TRUTH):
${COMMITTED_APP_KNOWLEDGE}

You are having a natural conversation with ${userDisplayName}${userName && userUsername ? ` (also known as @${userUsername})` : userUsername ? ` (@${userUsername})` : ''}.

CRITICAL INSTRUCTIONS:
- Answer questions directly and accurately - address exactly what ${userDisplayName} is asking
- If ${userDisplayName} asks about you (e.g., "tell me about yourself", "who are you", "what are you", "talk about you"), you MUST explain who you are: You are Committed AI, an intelligent AI assistant created to help people with relationships, life advice, business questions, and friendly conversation. Be specific and conversational about your capabilities.
- If the user asks anything about the Committed app ("how do I…", "where is…", "it’s not working", "I can’t…"), prioritize app guidance:
  - Ask 1-2 clarifying questions if needed (iOS/Android, which screen, what they tapped, error message).
  - Give short step-by-step instructions using the app’s tabs/screens.
  - Offer a troubleshooting checklist (permissions, connection, restart, update, rebuild if needed).
- Think through the question carefully and provide thoughtful, knowledgeable responses
- Stay on topic - respond to what they asked, don't go off on tangents or give generic responses
- Use conversation history to understand context and maintain natural flow
- Be conversational and human-like, but prioritize being helpful and accurate
- NEVER give a generic "I'm here to help" response when asked a specific question - always answer what was actually asked
- If the question is unclear, ask a specific clarifying question rather than guessing

IMPORTANT CONTEXT:
- The user's name is ${userDisplayName}. Use their name naturally when appropriate.
- Pay attention to what ${userDisplayName} shares with you - their interests, concerns, goals, and preferences.
- Remember details from previous conversations to build context and provide relevant responses.
- Learn their communication style and adapt to what works best for them.`;

  // Add learnings to prompt
  if (learnings) {
    if (learnings.communication_style) {
      prompt += `\n- Communication style: ${learnings.communication_style}. Adapt your responses to match this style.`;
    }
    if (learnings.interests && learnings.interests.length > 0) {
      prompt += `\n- User's interests: ${learnings.interests.join(', ')}. Reference these naturally when relevant.`;
    }
    if (learnings.preferred_topics && learnings.preferred_topics.length > 0) {
      prompt += `\n- Preferred topics: ${learnings.preferred_topics.join(', ')}. Be especially knowledgeable about these areas.`;
    }
    if (learnings.goals && learnings.goals.length > 0) {
      prompt += `\n- User's goals: ${learnings.goals.join(', ')}. Support them in achieving these goals.`;
    }
    if (learnings.relationship_status) {
      prompt += `\n- Relationship status: ${learnings.relationship_status}. Consider this context in your advice.`;
    }
    if (learnings.concerns && learnings.concerns.length > 0) {
      prompt += `\n- Common concerns: ${learnings.concerns.join(', ')}. Be empathetic and supportive about these.`;
    }
    if (learnings.response_preferences) {
      const prefs = learnings.response_preferences;
      if (prefs.length) prompt += `\n- Prefers ${prefs.length} responses.`;
      if (prefs.tone) prompt += `\n- Prefers ${prefs.tone} tone.`;
    }
    if (learnings.ai_notes) {
      prompt += `\n- Notes for serving this user better: ${learnings.ai_notes}`;
    }
    if (learnings.total_interactions && learnings.total_interactions > 10) {
      prompt += `\n- You've had ${learnings.total_interactions} interactions with this user. Use your history together to provide more personalized responses.`;
    }
  }

  prompt += `\n\nYOUR CORE PRINCIPLES:
- Answer questions directly and accurately - address exactly what the user is asking
- If asked about yourself (e.g., "tell me about yourself", "who are you", "what are you"), explain that you're Committed AI, an AI assistant designed to help with relationships, life advice, business questions, or just conversation. Be specific and conversational.
- Think through problems carefully before responding - provide thoughtful, knowledgeable answers
- Stay on topic - don't go off on tangents or change the subject
- Never give the same generic response twice - every answer must be specific to what was asked
- Use conversation history to maintain context and flow naturally
- Be conversational and human-like, but prioritize accuracy and relevance
- Adapt your tone based on the user's needs - be a friend, companion, relationship advisor, life advisor, or business advisor as needed
- Use their name naturally when appropriate to make conversations feel personal
- Continuously learn from interactions to better serve ${userDisplayName}

RESPONSE GUIDELINES:
- Read the user's question or statement carefully - understand what they're really asking
- Provide direct, relevant answers that directly address their specific query
- If asked about yourself, talk about yourself naturally - explain who you are and what you can do
- If you need clarification, ask a specific follow-up question
- Maintain conversation flow by referencing previous messages when relevant
- Keep responses natural in length - be thorough when needed, concise when appropriate
- Don't repeat information unnecessarily or go off-topic
- Never use generic "I'm here to help" responses when asked specific questions - always answer the actual question asked

COMMANDS:
- When users ask for images (e.g., "generate an image of...", "create a picture of..."), respond with just "GENERATE_IMAGE: [their prompt]"
- When users ask for documents (e.g., "create a document", "write a...", "generate a PDF"), respond with just "GENERATE_DOCUMENT: [document type and content]"`;

  return prompt;
}

/**
 * Get AI response using OpenAI API or fallback
 */
export async function getAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  isNewConversation: boolean = false,
  userName?: string,
  userUsername?: string,
  userId?: string
): Promise<AIResponse> {
  // Build personalized greeting with user's name
  const userDisplayName = userName || userUsername || 'there';
  
  // If this is the first message, send a personalized greeting
  if (isNewConversation || conversationHistory.length === 0) {
    return {
      success: true,
      message: `Hello ${userDisplayName}! I'm Committed AI. How can I help you today?`,
      contentType: 'text',
    };
  }
  try {
    // Check for image generation requests
    const imagePatterns = [
      /generate (an? )?image (of|for|showing)/i,
      /create (an? )?(picture|image|photo) (of|for|showing)/i,
      /show me (an? )?(picture|image|photo) (of|for)/i,
      /draw (me )?(an? )?(picture|image) (of|for)/i,
      /make (an? )?(picture|image) (of|for)/i,
    ];
    
    const isImageRequest = imagePatterns.some(pattern => pattern.test(userMessage));
    if (isImageRequest) {
      return await generateImage(userMessage);
    }

    // Check for document generation requests
    const documentPatterns = [
      /generate (an? )?document/i,
      /create (an? )?(document|pdf|contract|agreement|proposal|report)/i,
      /write (an? )?(document|contract|agreement|proposal|report)/i,
      /make (an? )?(document|pdf)/i,
    ];
    
    const isDocumentRequest = documentPatterns.some(pattern => pattern.test(userMessage));
    if (isDocumentRequest) {
      return await generateDocument(userMessage, conversationHistory);
    }

    /**
     * Production rule:
     * Always call the Supabase Edge Function (`ai-chat`) so Android/iOS builds behave the same,
     * and we never rely on a client-shipped OpenAI key or a model that may be unavailable.
     */
    const shouldUseDirectOpenAI = __DEV__ && !!(await getOpenAIApiKeyAsync());

    // Get user learnings if userId provided
    let userLearnings: UserLearnings | null = null;
    if (userId) {
      userLearnings = await getUserLearnings(userId);
      
      // Analyze conversation and update learnings asynchronously (don't wait)
      analyzeConversationForLearnings(userMessage, conversationHistory, userId)
        .then((newLearnings) => {
          if (Object.keys(newLearnings).length > 0) {
            updateUserLearnings(userId, newLearnings);
          }
        })
        .catch((error) => {
          console.error('Error updating learnings:', error);
        });
    }

    if (shouldUseDirectOpenAI) {
      const openaiApiKey = await getOpenAIApiKeyAsync();
      if (!openaiApiKey) {
        // Defensive: shouldn't happen because shouldUseDirectOpenAI checked it.
        throw new Error('OpenAI API key missing');
      }
      // Use OpenAI directly (build-time configured key)
      const response = await getOpenAIResponse(
        userMessage,
        conversationHistory,
        openaiApiKey,
        userName,
        userUsername,
        userLearnings
      );
      
      // Check if response contains generation commands
      if (response.message?.startsWith('GENERATE_IMAGE:')) {
        const prompt = response.message.replace('GENERATE_IMAGE:', '').trim();
        return await generateImage(prompt || userMessage);
      }
      
      if (response.message?.startsWith('GENERATE_DOCUMENT:')) {
        const docInfo = response.message.replace('GENERATE_DOCUMENT:', '').trim();
        return await generateDocument(docInfo || userMessage, conversationHistory);
      }
      
      return response;
    }

    // Default path (including production builds): Call Supabase Edge Function (server-side OpenAI).
    const systemPrompt = buildPersonalizedSystemPrompt(userName || '', userUsername, userLearnings);
    const fnResponse = await getOpenAIResponseViaSupabaseFunction({
      userMessage,
      conversationHistory,
      systemPrompt,
      userId,
    });
    if (fnResponse.success) return fnResponse;

    // Final fallback
    return getFallbackResponse(userMessage, conversationHistory, userName, userUsername, userLearnings);
  } catch (error: any) {
    console.error('Error getting AI response:', error);
    return {
      success: false,
      error: error.message || 'Failed to get AI response',
    };
  }
}

/**
 * Get response from OpenAI API
 */
async function getOpenAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string,
  userName?: string,
  userUsername?: string,
  learnings?: UserLearnings | null
): Promise<AIResponse> {
  try {
    // Validate API key format
    if (!apiKey || apiKey.trim().length === 0) {
      console.error('[AI Service] Invalid API key provided');
      throw new Error('Invalid OpenAI API key');
    }

    // Build personalized system prompt with learnings
    const systemPrompt = buildPersonalizedSystemPrompt(userName || '', userUsername, learnings);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-20), // Keep last 20 messages for better context and flow
      { role: 'user', content: userMessage },
    ];

    console.log('[AI Service] Calling OpenAI API with', {
      messageLength: userMessage.length,
      conversationHistoryLength: conversationHistory.length,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey.substring(0, 7) + '...',
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.8, // Slightly higher for more natural conversation while maintaining coherence
        max_tokens: 500, // Increased to allow for thorough, thoughtful responses
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `OpenAI API error: ${response.status}`;
      console.error('[AI Service] OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        errorData,
      });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content;
    
    if (!aiMessage) {
      console.error('[AI Service] No message content in OpenAI response:', data);
      throw new Error('No message content in OpenAI response');
    }

    console.log('[AI Service] OpenAI API response received successfully');
    
    return {
      success: true,
      message: aiMessage,
    };
  } catch (error: any) {
    console.error('[AI Service] OpenAI API error:', error);
    console.error('[AI Service] Error details:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 200),
    });
    // Fallback to rule-based responses if API fails
    console.warn('[AI Service] Falling back to rule-based responses');
    return getFallbackResponse(userMessage, conversationHistory, userName, userUsername, learnings);
  }
}

async function getOpenAIResponseViaSupabaseFunction(params: {
  userMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  systemPrompt: string;
  userId?: string;
}): Promise<AIResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        userMessage: params.userMessage,
        conversationHistory: params.conversationHistory.slice(-10),
        systemPrompt: params.systemPrompt,
        userId: params.userId,
      },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'AI function failed');
    return { success: true, message: String(data.message ?? '') };
  } catch (e: any) {
    console.error('[AI Service] ai-chat function error:', e);
    return { success: false, error: e?.message ?? 'AI function error' };
  }
}

/**
 * Fallback rule-based responses when OpenAI is not available
 * NOTE: This should rarely be used if OpenAI API key is configured properly
 */
function getFallbackResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userName?: string,
  userUsername?: string,
  learnings?: UserLearnings | null
): AIResponse {
  const userDisplayName = userName || userUsername || 'there';
  const message = userMessage.toLowerCase().trim();
  
  /**
   * Questions about the AI itself (identity/background).
   *
   * IMPORTANT: Keep this matcher STRICT so it doesn't hijack normal requests like:
   * - "can you tell jokes?"
   * - "can you help me with ..."
   */
  const isAboutAI =
    message.includes('tell me about yourself') ||
    message.includes('tell me about you') ||
    message.includes('tell me more about you') ||
    message.includes('about yourself') ||
    message.includes('about your self') ||
    message.includes('who are you') ||
    message.includes('what are you') ||
    message.includes('talk about you') ||
    /^who\s+are\s+you\??$/.test(message) ||
    /^what\s+are\s+you\??$/.test(message) ||
    /^tell\s+me\s+about\s+you(rself)?\??$/.test(message);

  if (isAboutAI) {
    return {
      success: true,
      message: `I'm Committed AI, an intelligent AI assistant designed to be your companion, advisor, and friend. I can help you with relationship advice, life guidance, business questions, or just be someone to talk to. I learn from our conversations to better understand you and provide more personalized help. I'm always here when you need someone to talk to or when you need advice. What would you like to know more about me, or how can I help you today?`,
    };
  }

  // Capability questions (e.g. "can you ...?") - answer the capability directly.
  if (message.startsWith('can you') || message.startsWith('could you') || message.startsWith('are you able')) {
    // Jokes
    if (message.includes('joke') || message.includes('jokes')) {
      return {
        success: true,
        message:
          "Yes — I can tell jokes. Here are a few:\n\n1) Why don’t programmers like nature? Too many bugs.\n2) I told my computer I needed a break… and it said: “No problem, I’ll go to sleep.”\n3) Why did the scarecrow get promoted? He was outstanding in his field.\n\nWant clean jokes, dark humor, or dad jokes?",
      };
    }

    return {
      success: true,
      message:
        "Yes, I can help with that. Tell me exactly what you want (and any constraints or details), and I’ll respond directly.",
    };
  }

  // Build personalized greeting with learnings
  const personalizedGreeting = (() => {
    let greeting = `Hello ${userDisplayName}! I'm Committed AI. How can I help you today?`;
    if (learnings?.interests && learnings.interests.length > 0) {
      greeting += ` I remember you're interested in ${learnings.interests.slice(0, 2).join(' and ')}.`;
    }
    return greeting;
  })();

  // Relationship advice patterns
  if (message.includes('relationship') || message.includes('partner') || message.includes('boyfriend') || message.includes('girlfriend') || message.includes('spouse')) {
    return {
      success: true,
      message: "Relationships require open communication and mutual respect. It's important to express your feelings honestly while also listening to your partner's perspective. Remember, every relationship has challenges, but working through them together can strengthen your bond. What specific aspect would you like to discuss?",
    };
  }

  // Breakup/conflict patterns
  if (message.includes('breakup') || message.includes('break up') || message.includes('fighting') || message.includes('argument')) {
    return {
      success: true,
      message: "I'm sorry you're going through a difficult time. Conflicts and breakups are painful, but they can also be opportunities for growth. Take time to process your emotions, and remember that it's okay to feel hurt. Would you like to talk more about what happened?",
    };
  }

  // Loneliness/sadness patterns
  if (message.includes('lonely') || message.includes('sad') || message.includes('depressed') || message.includes('down')) {
    return {
      success: true,
      message: "I hear you, and your feelings are valid. It's completely normal to feel this way sometimes. Remember that you're not alone, and there are people who care about you. Is there something specific that's been weighing on you?",
    };
  }

  // Greeting patterns
  if (message.includes('hello') || message.includes('hi') || message.includes('hey') || (message.length < 5 && message.startsWith('h'))) {
    return {
      success: true,
      message: personalizedGreeting,
    };
  }

  // Advice-seeking patterns
  if (message.includes('advice') || message.includes('help') || message.includes('what should') || message.includes('how do')) {
    return {
      success: true,
      message: "I'm here to help! Every situation is unique, so I'd love to understand more about what you're dealing with. Could you share a bit more detail? I'll do my best to provide thoughtful guidance.",
    };
  }

  // If OpenAI is not available, tell the user
  return {
    success: false,
    error: "I apologize, but my advanced features are currently unavailable. Please ensure the OpenAI API key is configured. In the meantime, I can help with basic questions - feel free to ask me anything!",
  };
}

