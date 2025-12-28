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

- Committed is a relationship-focused social app: profiles, relationship registration, verification, posts, reels, messages, notifications, dating features, and admin tools.

MAIN NAVIGATION (TABS)
- Home: overview of your relationship and status.
- Feed: posts from users (like/comment).
- Reels: short vertical videos.
- Messages: conversations and Committed AI chat (with inline feedback buttons for AI messages).
- Dating: discover potential matches, swipe through profiles, view matches.
- Search: find users and check relationship status.
- Notifications: alerts, requests, system notices (relationship requests, end relationship requests, dating matches, date requests).
- Profile/Settings: your profile and account settings.

KEY FLOWS (SHORT)
- Relationship: Relationship → Register → Select relationship type → Verification.
- End Relationship: Settings → End Relationship → Partner confirms or auto-resolves in 7 days.
- Verification: Settings → Verification (phone, email, ID).
- Post/Reel: Post → Create, Reel → Create.
- Status: Status → Create (photo/video/text).
- Dating: Dating → Create Profile → Set Preferences → Discover → Like/Pass → Match → Chat.
- Date Requests: Matches → Create Date Request → Partner accepts/declines → Payment (if required).

DATING FEATURES (NEW)
- Dating Discovery: Swipe-style interface to discover potential matches based on preferences.
- Dating Profiles: Create profile with bio, photos (up to 9), videos, age, location, interests, relationship goals.
- Filters: Age range, distance (km), gender preference (men/women/everyone), location-based matching.
- Default Preferences: Male users default to seeing "women", female users default to seeing "men", non-binary defaults to "everyone" (can be changed).
- Matching: Mutual likes create matches automatically. Users can see all their matches.
- Interests: Pre-defined interests (sports, music, food, travel, arts, tech, lifestyle, hobbies) that users can add to their profile.
- Date Requests: Matched users can create date requests with details, location, time. Partner can accept/decline.
- Payment System: Date requests may require payment submission, approval, or rejection.
- Premium Features: Enhanced dating features available for premium users.
- Privacy: Users with active relationships are excluded from discovery. Only active profiles shown.

RELATIONSHIP MANAGEMENT
- Relationship Registration: Multi-step process including partner invitation, relationship type selection, verification.
- Relationship Types: Various types available (marriage, dating, etc.) selected during registration.
- End Relationship: Users can request to end relationship, partner must confirm or it auto-resolves after 7 days.
- End Relationship Requests: Appear in notifications, can be accepted/rejected by partner.
- Disputes System: Handles relationship end requests with auto-resolve after 7 days if not confirmed.
- False Relationship Reports: Users can report false relationships, admins review and resolve.

NOTIFICATIONS SYSTEM
- Relationship Requests: Partner requests to register relationship, can accept/reject.
- End Relationship Requests: Partner requests to end relationship, can accept/reject.
- Dating Matches: Notification when mutual match is created.
- Dating Likes: Notification when someone likes your profile (if premium).
- Date Requests: Notification when matched user creates date request.
- Date Accepted/Declined: Notification when partner responds to date request.
- Payment Notifications: Payment submission, approval, rejection notifications.
- False Relationship Reports: Notifications about report status and resolution.
- All notifications can be deleted (except active relationship requests which require action).

MESSAGES & AI CHAT
- Messages: Chat with other users, send text, images, documents, stickers.
- Committed AI: Built-in AI assistant accessible via Messages tab.
- AI Feedback: Thumbs up/down buttons appear inline with AI message timestamps for feedback.
- Message Features: Delete messages (for me or everyone), view images, download documents, long-press for options.
- Chat Backgrounds: Customizable chat backgrounds (colors, images, gradients).

PROFESSIONAL CONNECTIONS SYSTEM (IMPORTANT)
- The app has a built-in professional connection system that allows users to connect with verified professionals in real-time.
- Available professional types include: Counselors, Relationship Therapists, Psychologists, Mental Health Professionals, Life Coaches, Business Mentors, General Mentors, Legal Advisors, and Lawyers/Legal Consultants.
- The system automatically detects when users need professional help (stress, emotional distress, expressed need for help) and proactively offers to connect them with a professional.
- DO NOT tell users to "tap buttons" or explain UI features - the system handles professional connections automatically.
- When users express stress, emotional distress, relationship issues, or need for help, focus on being supportive and understanding. The system will detect their need and offer professional connection automatically.
- The system matches users with available professionals based on their needs, location, and availability.
- All professionals are verified and approved by admins before they can provide services.

COMMON TROUBLESHOOTING
- Photos/Gallery not working: grant photo/media permissions in phone settings; on Android 13+ allow Photos and Videos permissions. After changing plugins/permissions, rebuild/reinstall the app.
- Camera not working: grant camera permission.
- Notifications not showing: enable notifications permission; on Android ensure notifications are allowed and the channel isn't muted.
- Dating filters not working: Check gender preferences in dating profile settings. Default preferences apply (male→women, female→men).
- Chat button on matches opens blank: This was fixed - conversation is now created automatically before opening chat.
- End relationship errors: Ensure migrations are run (add-notifications-insert-policy.sql). Partner must confirm to end relationship.
- If something errors: ask what screen they're on, what they tapped, and the exact error text or a screenshot.

ADMIN CAPABILITIES
- Super Admin can access Admin dashboard and settings.
- Admin Settings includes OpenAI key management (save/test) for Committed AI.
- Admins can manage professional roles, approve/reject professional applications, and configure the professional system.
- Admins can view and manage all relationships, end relationships, and view relationship disputes.
- Admins can manage dating interests (add/edit/delete interests with emojis and categories).
- Admins can view and resolve false relationship reports.
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

/**
 * Create an AbortSignal that times out after the specified duration
 * Polyfill for AbortSignal.timeout() which isn't available in React Native
 */
function createTimeoutAbortSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  
  // Store timeout ID on the signal so it can be cleared if needed
  (controller.signal as any)._timeoutId = timeoutId;
  
  return controller.signal;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  imageUrl?: string; // For generated images
  documentUrl?: string; // For generated documents
  documentName?: string; // For generated documents
  contentType?: 'text' | 'image' | 'document'; // Type of response
  suggestProfessionalHelp?: boolean; // Flag to indicate AI detected need for professional help
  suggestedProfessionalType?: string; // Type of professional suggested
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

PROFESSIONAL CONNECTIONS:
- DO NOT tell users to "tap the Request Live Help button" or give directions about UI elements.
- When users need professional help, the system will automatically detect this and show them an option to connect with a professional.
- Focus on understanding their needs, providing empathy, and being supportive.
- If they explicitly ask about talking to a professional, acknowledge their request naturally without explaining how to use buttons or features.
- The system handles professional connections automatically - your job is to listen, understand, and provide support until a professional can be connected.

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
    // Note: Professional help detection is now handled by detectProfessionalHelpNeeded()
    // which runs before the OpenAI call. The detection results are merged into the response.

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

    // Get user learnings if userId provided (with timeout to avoid blocking)
    let userLearnings: UserLearnings | null = null;
    if (userId) {
      // Try to get learnings quickly, but don't block if it's slow
      try {
        userLearnings = await Promise.race([
          getUserLearnings(userId),
          new Promise<UserLearnings | null>((resolve) => setTimeout(() => resolve(null), 200)), // 200ms timeout
        ]);
      } catch (error) {
        console.error('Error getting user learnings:', error);
      }
      
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

    // Professional help detection is now handled by AI in the edge function
    // For direct OpenAI path, we'll still use pattern-based detection as fallback
    const helpDetection = detectProfessionalHelpNeeded(userMessage, conversationHistory);

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
      
      // Include professional help suggestion based on detection
      // Include all confidence levels to be more helpful
      if (helpDetection.needsHelp) {
        console.log('[AI Service] Professional help detected (direct OpenAI):', {
          confidence: helpDetection.confidence,
          professionalType: helpDetection.professionalType,
        });
      }
      // Only suggest professional help for HIGH confidence explicit requests
      // Medium confidence should also work, but we're being conservative
      // Low confidence is disabled - require explicit requests or serious issues
      const shouldSuggest = helpDetection.needsHelp && 
                           (helpDetection.confidence === 'high' || helpDetection.confidence === 'medium');
      
      if (shouldSuggest) {
        console.log('[AI Service] Professional help suggested (direct OpenAI):', {
          confidence: helpDetection.confidence,
          professionalType: helpDetection.professionalType,
        });
      }
      
      return {
        ...response,
        suggestProfessionalHelp: shouldSuggest,
        suggestedProfessionalType: helpDetection.professionalType || 'professional',
      };
    }

    // Default path (including production builds): Call Supabase Edge Function (server-side OpenAI).
    // The edge function now handles AI-based professional help detection internally
    const systemPrompt = buildPersonalizedSystemPrompt(userName || '', userUsername, userLearnings);
    const fnResponse = await getOpenAIResponseViaSupabaseFunction({
      userMessage,
      conversationHistory,
      systemPrompt,
      userId,
    });
    if (fnResponse.success) {
      // The edge function now returns suggestProfessionalHelp and suggestedProfessionalType
      // based on AI analysis, not hardcoded patterns
      if (fnResponse.suggestProfessionalHelp) {
        console.log('[AI Service] Professional help suggested (AI-based detection):', {
          professionalType: fnResponse.suggestedProfessionalType,
        });
      }
      
      return fnResponse;
    }

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
      ...conversationHistory.slice(-6), // Keep last 6 messages for context (optimized for speed)
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
        temperature: 0.65, // Optimized for faster, more focused responses
        max_tokens: 500, // Increased from 200 to allow complete responses
        stream: false, // Set to false for now (streaming would require more complex handling)
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
    
    // Note: Professional help detection happens in the caller (getAIResponse)
    // This function just returns the raw AI message
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
  const maxRetries = 2;
  let lastError: any = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          userMessage: params.userMessage,
          conversationHistory: params.conversationHistory.slice(-10), // Use more history for better AI detection
          systemPrompt: params.systemPrompt,
          userId: params.userId,
        },
        // Add timeout to prevent hanging (increased for better reliability)
        signal: createTimeoutAbortSignal(30000), // 30 second timeout to allow for AI detection and response generation
      });
      
      if (error) {
        lastError = error;
        // Retry on network errors or timeouts
        if (attempt < maxRetries && (error.message?.includes('timeout') || error.message?.includes('network') || error.message?.includes('fetch'))) {
          console.log(`[AI Service] Retry attempt ${attempt + 1}/${maxRetries} after error:`, error.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
          continue;
        }
        throw error;
      }
      
      if (!data?.success) {
        const errorMsg = data?.error || 'AI function failed';
        lastError = new Error(errorMsg);
        // Don't retry on API errors (invalid key, etc.)
        throw lastError;
      }
      
      return { 
        success: true, 
        message: String(data.message ?? ''),
        suggestProfessionalHelp: data.suggestProfessionalHelp || false,
        suggestedProfessionalType: data.suggestedProfessionalType || undefined,
      };
    } catch (e: any) {
      lastError = e;
      // Only retry on network/timeout errors
      if (attempt < maxRetries && (e?.message?.includes('timeout') || e?.message?.includes('network') || e?.message?.includes('fetch') || e?.name === 'AbortError')) {
        console.log(`[AI Service] Retry attempt ${attempt + 1}/${maxRetries} after error:`, e?.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        continue;
      }
      // If not retryable or out of retries, break
      break;
    }
  }
  
  console.error('[AI Service] ai-chat function error after retries:', lastError);
  return { success: false, error: lastError?.message ?? 'AI function error' };
}

/**
 * Summarize conversation for professional escalation
 * Creates a concise summary of the user's issue for professional matching
 */
export async function summarizeConversationForProfessional(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<string> {
  try {
    // Check if we have enough meaningful conversation to summarize
    const userMessages = conversationHistory.filter(m => m.role === 'user');
    const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|bye|goodbye)[\s!.,]*$/i;
    const meaningfulMessages = userMessages.filter(msg => {
      const content = msg.content.trim();
      return content.length > 10 && !greetingPatterns.test(content);
    });
    
    // Require at least 5 meaningful messages before generating a summary
    if (meaningfulMessages.length < 5) {
      console.log('[AI Service] Not enough meaningful conversation for summary. Message count:', meaningfulMessages.length);
      return 'The user is just starting the conversation. More context is needed to provide a meaningful summary for a professional.';
    }
    
    // Build context from recent conversation (use more messages if available)
    const recentMessages = conversationHistory.slice(-15); // Get more context for better summary
    const conversationContext = recentMessages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    const summaryPrompt = `Summarize this conversation for a professional helper. The user is requesting professional assistance. Focus on:
1. The main issue or concern the user has expressed
2. Key details that would help a professional understand the situation (emotions, circumstances, context)
3. What specific type of help might be needed

Important: Only include actual concerns and issues. If the conversation is mostly greetings or casual chat without clear concerns, note that more information is needed.

Conversation:
${conversationContext}

Latest message: ${userMessage}

Provide a concise but informative summary (3-4 sentences) that would help a professional understand why the user needs help:`;

    // Try to get AI summary, fallback to simple extraction
    const shouldUseDirectOpenAI = __DEV__ && !!(await getOpenAIApiKeyAsync());
    
    if (shouldUseDirectOpenAI) {
      const openaiApiKey = await getOpenAIApiKeyAsync();
      if (openaiApiKey) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: 'You are a helpful assistant that creates concise summaries for professional referrals.' },
                { role: 'user', content: summaryPrompt },
              ],
              temperature: 0.3,
              max_tokens: 150,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            return data.choices[0]?.message?.content || getFallbackSummary(userMessage);
          }
        } catch (error) {
          console.error('Error getting AI summary:', error);
        }
      }
    }

    // Fallback: simple extraction from latest message
    return getFallbackSummary(userMessage);
  } catch (error: any) {
    console.error('Error summarizing conversation:', error);
    return getFallbackSummary(userMessage);
  }
}

/**
 * Fallback summary extraction
 */
function getFallbackSummary(userMessage: string): string {
  // Simple fallback: use the latest message or a default
  if (userMessage.length > 200) {
    return userMessage.substring(0, 200) + '...';
  }
  return userMessage || 'User is seeking professional assistance.';
}

/**
 * Suggest appropriate professional role based on conversation
 * Returns role ID or null if no clear match
 */
export async function suggestProfessionalRole(
  conversationSummary: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string | null> {
  try {
    // Get active professional roles
    const { data: roles, error } = await supabase
      .from('professional_roles')
      .select('id, name, category, ai_matching_rules')
      .eq('is_active', true)
      .eq('eligible_for_live_chat', true);

    if (error || !roles || roles.length === 0) return null;

    // Simple keyword matching based on role categories and names
    const lowerSummary = conversationSummary.toLowerCase();
    const combinedText = [
      ...conversationHistory.map(m => m.content),
      conversationSummary,
    ].join(' ').toLowerCase();

    // Check each role's matching rules and keywords
    for (const role of roles) {
      const rules = role.ai_matching_rules || {};
      const keywords = rules.keywords || [];
      const categories = rules.categories || [];

      // Check if summary matches role keywords
      if (keywords.length > 0) {
        const matchesKeyword = keywords.some((keyword: string) =>
          combinedText.includes(keyword.toLowerCase())
        );
        if (matchesKeyword) return role.id;
      }

      // Category-based matching
      if (role.category) {
        const categoryLower = role.category.toLowerCase();
        if (
          (categoryLower.includes('mental') || categoryLower.includes('therapy')) &&
          (combinedText.includes('depress') ||
            combinedText.includes('anxiety') ||
            combinedText.includes('stress') ||
            combinedText.includes('therapy') ||
            combinedText.includes('counsel'))
        ) {
          return role.id;
        }

        if (
          categoryLower.includes('legal') &&
          (combinedText.includes('legal') ||
            combinedText.includes('lawyer') ||
            combinedText.includes('attorney') ||
            combinedText.includes('contract') ||
            combinedText.includes('lawsuit'))
        ) {
          return role.id;
        }

        if (
          categoryLower.includes('coach') &&
          (combinedText.includes('goal') ||
            combinedText.includes('motivation') ||
            combinedText.includes('career') ||
            combinedText.includes('life coach'))
        ) {
          return role.id;
        }

        if (
          (categoryLower.includes('business') || categoryLower.includes('mentor')) &&
          (combinedText.includes('business') ||
            combinedText.includes('mentor') ||
            combinedText.includes('career') ||
            combinedText.includes('professional development') ||
            combinedText.includes('startup') ||
            combinedText.includes('entrepreneur') ||
            combinedText.includes('work') ||
            combinedText.includes('job'))
        ) {
          return role.id;
        }

        if (
          categoryLower.includes('relationship') &&
          (combinedText.includes('relationship') ||
            combinedText.includes('partner') ||
            combinedText.includes('marriage') ||
            combinedText.includes('couple'))
        ) {
          return role.id;
        }
      }
    }

    // Default: return first general mental health role if available
    const mentalHealthRole = roles.find(
      (r) =>
        r.category?.toLowerCase().includes('mental') ||
        r.name?.toLowerCase().includes('counselor')
    );
    return mentalHealthRole?.id || roles[0]?.id || null;
  } catch (error) {
    console.error('Error suggesting professional role:', error);
    return null;
  }
}

/**
 * Detect if professional help might be needed based on conversation patterns
 * Returns true if the conversation suggests the user might benefit from professional help
 */
function detectProfessionalHelpNeeded(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): { needsHelp: boolean; professionalType?: string; confidence: 'high' | 'medium' | 'low' } {
  const message = userMessage.toLowerCase().trim();
  
  // Use recent conversation history (last 10 messages) for context
  const recentConversation = conversationHistory.slice(-10);
  const recentHistory = recentConversation.map(m => m.content).join(' ').toLowerCase();
  
  // Filter out thinking indicators and empty messages
  const validMessages = recentConversation.filter(m => 
    m.content && 
    m.content.trim().length > 0 && 
    !m.content.toLowerCase().includes('thinking')
  );
  
  const recentUserMessages = validMessages.filter((m: any) => m.role === 'user');
  const userMessageCount = recentUserMessages.length;
  
  // Check for greetings to filter them out
  const greetingPatterns = /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|bye|goodbye)[\s!.,]*$/i;
  const isGreeting = greetingPatterns.test(message.trim());
  
  // HIGH CONFIDENCE: Explicit requests for professional help
  const explicitPatterns = [
    { pattern: /(i need|i want|can i|please).*(talk to|speak with|connect with|get help from|see|meet).*(a |an )?(professional|therapist|counselor|psychologist|mentor|coach|lawyer|legal advisor)/i, type: 'professional' },
    { pattern: /(need|want).*(a |an )?(therapist|counselor|psychologist|mental health professional)/i, type: 'Therapist or Counselor' },
    { pattern: /(need|want|looking for).*(a |an )?(business mentor|career mentor)/i, type: 'Business Mentor' },
    { pattern: /(need|want|looking for).*(a |an )?(lawyer|legal advisor|legal help)/i, type: 'Legal Advisor' },
    { pattern: /(need|want|looking for).*(a |an )?(life coach)/i, type: 'Life Coach' },
  ];

  for (const { pattern, type } of explicitPatterns) {
    if (pattern.test(message) && message.length > 15 && !isGreeting) {
      return { needsHelp: true, professionalType: type, confidence: 'high' };
    }
  }
  
  // HIGH CONFIDENCE: Crisis situations (immediate professional help needed)
  const crisisPatterns = [
    { pattern: /(depressed|suicidal|self.?harm|want to die|kill myself|thinking about suicide|ending my life)/i, type: 'Mental Health Professional' },
    { pattern: /(panic attack|anxiety attack|can't breathe|feeling overwhelmed|having a breakdown|breaking down)/i, type: 'Mental Health Professional' },
    { pattern: /(trauma|abuse|violence|assault|domestic violence|being hurt|being abused)/i, type: 'Counselor' },
  ];
  
  for (const { pattern, type } of crisisPatterns) {
    if (pattern.test(message) || pattern.test(recentHistory)) {
      return { needsHelp: true, professionalType: type, confidence: 'high' };
    }
  }
  
  // MEDIUM CONFIDENCE: Strong emotional distress indicators
  // Require at least 3 user messages (some context) but be more sensitive
  if (userMessageCount >= 3) {
    // Stress and emotional distress patterns
    const stressPatterns = [
      /(i'm stressed|i am stressed|feeling stressed|so stressed|really stressed|extremely stressed)/i,
      /(overwhelmed|feeling overwhelmed|i'm overwhelmed|so overwhelmed)/i,
      /(anxious|feeling anxious|really anxious|so anxious|extremely anxious)/i,
      /(depressed|feeling depressed|i'm depressed|really depressed)/i,
      /(sad|feeling sad|i'm sad|really sad|so sad)/i,
      /(worried|feeling worried|really worried|so worried)/i,
      /(struggling|i'm struggling|really struggling|having a hard time|having trouble)/i,
      /(can't cope|can't handle|don't know what to do|lost|confused|helpless)/i,
      /(hurt|feeling hurt|really hurt|in pain|suffering)/i,
      /(lonely|feeling lonely|really lonely|isolated)/i,
      /(frustrated|feeling frustrated|really frustrated|stuck)/i,
    ];
    
    // Relationship/career/legal issues with emotional distress
    const issuePatterns = [
      { pattern: /(relationship|partner|marriage|breakup|cheating|trust issues|break up|fighting|arguing|divorcing)/i, type: 'Relationship Therapist' },
      { pattern: /(business|career|job|work|professional|mentor|guidance)/i, type: 'Business Mentor' },
      { pattern: /(legal|lawyer|divorce|separation|custody|legal advice)/i, type: 'Legal Advisor' },
    ];
    
    // Check for stress/emotional distress in current message or recent history
    const hasStressIndicators = stressPatterns.some(pattern => pattern.test(message) || pattern.test(recentHistory));
    
    // Check for specific issues
    for (const { pattern, type } of issuePatterns) {
      if ((pattern.test(message) || pattern.test(recentHistory)) && hasStressIndicators) {
        return { needsHelp: true, professionalType: type, confidence: 'medium' };
      }
    }
    
    // If stress indicators are present, suggest help even without specific issue type
    if (hasStressIndicators && message.length > 15 && !isGreeting) {
      return { needsHelp: true, professionalType: 'Counselor', confidence: 'medium' };
    }
  }
  
  // MEDIUM CONFIDENCE: Need for help expressed (after some conversation)
  // Require at least 4 user messages for context
  if (userMessageCount >= 4) {
    const needHelpPatterns = [
      /(need help|need support|need advice|need someone to talk to|need guidance)/i,
      /(don't know what to do|what should i do|what can i do|i need help)/i,
      /(can someone help|anyone can help|help me|i need someone)/i,
    ];
    
    const needsHelp = needHelpPatterns.some(pattern => pattern.test(message) || pattern.test(recentHistory));
    
    if (needsHelp && message.length > 15 && !isGreeting) {
      // Determine professional type based on context
      if (/(relationship|partner|marriage|breakup)/i.test(recentHistory)) {
        return { needsHelp: true, professionalType: 'Relationship Therapist', confidence: 'medium' };
      } else if (/(business|career|job|work)/i.test(recentHistory)) {
        return { needsHelp: true, professionalType: 'Business Mentor', confidence: 'medium' };
      } else if (/(legal|lawyer)/i.test(recentHistory)) {
        return { needsHelp: true, professionalType: 'Legal Advisor', confidence: 'medium' };
      } else {
        return { needsHelp: true, professionalType: 'Counselor', confidence: 'medium' };
      }
    }
  }

  return { needsHelp: false, confidence: 'low' };
}

/**
 * Determine if AI should respond during observer mode
 * AI should respond when:
 * 1. User explicitly asks AI (mentions "AI", "Committed AI", asks AI directly)
 * 2. Professional hasn't responded in a while (2+ minutes)
 * 3. User asks a question that doesn't require professional expertise
 */
export async function shouldAIRespondInObserverMode(
  message: string,
  conversationId: string,
  lastProfessionalMessageTime?: string
): Promise<boolean> {
  // Check if user is explicitly asking AI
  const aiMentions = [
    /(?:^|\s)(?:ai|committed ai|you)(?:\s|$|,|\!|\.|\?)/i,
    /ask (?:you|ai|committed ai)/i,
    /tell (?:you|ai|committed ai)/i,
    /(?:what|how|why|when|where|can|do|does|is|are|will|would) (?:you|ai|committed ai)/i,
  ];
  
  const mentionsAI = aiMentions.some(pattern => pattern.test(message));
  if (mentionsAI) {
    return true;
  }

  // Check if professional hasn't responded in 2+ minutes
  if (lastProfessionalMessageTime) {
    const lastResponseTime = new Date(lastProfessionalMessageTime).getTime();
    const timeSinceLastResponse = Date.now() - lastResponseTime;
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    
    if (timeSinceLastResponse >= TWO_MINUTES_MS) {
      return true; // Professional is not responding, AI should step in
    }
  }

  // Check if message is a simple question that doesn't require professional help
  const simpleQuestionPatterns = [
    /^(?:what|how|why|when|where|can|do|does|is|are|will|would) /i,
    /^(?:tell me about|explain|describe) /i,
  ];
  
  const isSimpleQuestion = simpleQuestionPatterns.some(pattern => pattern.test(message.trim()));
  
  // If it's a simple question and short (< 50 chars), AI can answer
  if (isSimpleQuestion && message.length < 50) {
    return true;
  }

  return false;
}

export async function detectNonAgreementAndSuggestAlternative(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  conversationId: string,
  userId: string,
  sessionId: string
): Promise<{ shouldEscalate: boolean; suggestion?: string }> {
  try {
    // Only analyze if we have recent messages (last 10)
    const recentMessages = conversationHistory.slice(-10);
    if (recentMessages.length < 3) {
      return { shouldEscalate: false };
    }

    // Check for negative sentiment indicators
    const negativePatterns = [
      /not (helping|working|good|satisfied|happy|clear)/i,
      /doesn't (understand|help|work|make sense)/i,
      /can't (help|understand|figure out)/i,
      /wrong|incorrect|inaccurate/i,
      /disappointed|frustrated|confused|stuck/i,
      /try (a|another) (different|other) (professional|person|therapist|counselor|mentor)/i,
      /want (a|another) (different|other) (professional|person|therapist|counselor|mentor)/i,
      /this (isn't|is not) (working|helping)/i,
    ];

    const conversationText = recentMessages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ')
      .toLowerCase();

    const hasNegativeSentiment = negativePatterns.some(pattern => pattern.test(conversationText));

    if (hasNegativeSentiment) {
      const shouldUseDirectOpenAI = __DEV__ && !!(await getOpenAIApiKeyAsync());
      let suggestion = '';

      if (shouldUseDirectOpenAI) {
        const openaiApiKey = await getOpenAIApiKeyAsync();
        if (openaiApiKey) {
          try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`,
              },
              body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: 'You are an assistant that helps detect if a user might benefit from speaking with a different professional. Respond with a brief, empathetic suggestion.',
                  },
                  {
                    role: 'user',
                    content: `Based on this conversation, should we suggest connecting with a different professional? Conversation: ${conversationText.substring(0, 500)}`,
                  },
                ],
                temperature: 0.7,
                max_tokens: 100,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              suggestion = data.choices[0]?.message?.content || '';
            }
          } catch (error) {
            console.error('Error getting AI suggestion:', error);
          }
        }
      }

      return {
        shouldEscalate: true,
        suggestion: suggestion || "I notice you might benefit from speaking with a different professional. Would you like me to find another professional who might be a better match?",
      };
    }

    return { shouldEscalate: false };
  } catch (error: any) {
    console.error('Error detecting non-agreement:', error);
    return { shouldEscalate: false };
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

  // Relationship advice patterns - suggest professional help for serious issues
  if (message.includes('relationship') || message.includes('partner') || message.includes('boyfriend') || message.includes('girlfriend') || message.includes('spouse')) {
    const isSerious = message.includes('abuse') || message.includes('violence') || message.includes('cheating') || 
                     message.includes('divorce') || message.includes('custody');
    if (isSerious) {
      return {
        success: true,
        message: "I understand you're dealing with a serious relationship issue. While I can offer support, this might be a good time to speak with a relationship therapist or counselor who can provide specialized guidance. Would you like me to connect you with a professional?",
        suggestProfessionalHelp: true,
        suggestedProfessionalType: 'Relationship Therapist',
      };
    }
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
      suggestProfessionalHelp: conversationHistory.length > 3, // Suggest after multiple messages about breakup
      suggestedProfessionalType: 'Relationship Therapist',
    };
  }

  // Loneliness/sadness patterns - suggest professional help for persistent issues
  if (message.includes('lonely') || message.includes('sad') || message.includes('depressed') || message.includes('down')) {
    const isSevere = message.includes('suicidal') || message.includes('want to die') || message.includes('self harm') || 
                    message.includes('can\'t go on') || message.includes('hopeless');
    if (isSevere) {
      return {
        success: true,
        message: "I'm really concerned about what you're going through. These feelings are serious, and I think speaking with a mental health professional could be very helpful. Would you like me to connect you with a counselor or therapist? They're trained to provide the support you need.",
        suggestProfessionalHelp: true,
        suggestedProfessionalType: 'Mental Health Professional',
      };
    }
    // For less severe but repeated mentions, suggest after multiple messages
    return {
      success: true,
      message: "I hear you, and your feelings are valid. It's completely normal to feel this way sometimes. Remember that you're not alone, and there are people who care about you. Is there something specific that's been weighing on you?",
      suggestProfessionalHelp: conversationHistory.length > 5 && conversationHistory.filter(m => 
        m.role === 'user' && (m.content.toLowerCase().includes('sad') || m.content.toLowerCase().includes('depressed') || m.content.toLowerCase().includes('lonely'))
      ).length >= 2,
      suggestedProfessionalType: 'Counselor',
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

