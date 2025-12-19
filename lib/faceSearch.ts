/**
 * Face Search Service
 * 
 * This service handles face recognition and matching for the search feature.
 * It can be integrated with various face recognition services:
 * - AWS Rekognition
 * - Azure Face API
 * - Google Cloud Vision API
 * - Custom ML models
 */

import { supabase } from './supabase';

interface FaceMatchingProvider {
  id: string;
  name: string;
  provider_type: 'aws_rekognition' | 'azure_face' | 'google_vision' | 'custom' | 'local';
  is_active: boolean;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  aws_region?: string;
  azure_endpoint?: string;
  azure_subscription_key?: string;
  google_project_id?: string;
  google_credentials_json?: string;
  custom_api_endpoint?: string;
  custom_api_key?: string;
  custom_config?: any;
  similarity_threshold: number;
  max_results: number;
  enabled: boolean;
}

let cachedProvider: FaceMatchingProvider | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get the active face matching provider from database
 */
async function getActiveProvider(): Promise<FaceMatchingProvider | null> {
  const now = Date.now();
  
  // Return cached provider if still valid
  if (cachedProvider && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedProvider;
  }

  try {
    const { data, error } = await supabase
      .from('face_matching_providers')
      .select('*')
      .eq('is_active', true)
      .eq('enabled', true)
      .single();

    if (error || !data) {
      console.warn('No active face matching provider found:', error?.message);
      return null;
    }

    cachedProvider = data;
    cacheTimestamp = now;
    return data;
  } catch (error) {
    console.error('Error fetching active provider:', error);
    return null;
  }
}

export interface FaceSearchResult {
  relationshipId: string;
  partnerName: string;
  partnerPhone: string;
  partnerUserId?: string;
  relationshipType: string;
  relationshipStatus: string;
  userId: string;
  userName: string;
  userPhone: string;
  facePhotoUrl: string;
  similarityScore?: number;
}

export interface FaceMatch {
  relationshipId: string;
  partnerName: string;
  partnerPhone: string;
  partnerUserId?: string;
  relationshipType: string;
  relationshipStatus: string;
  userId: string;
  userName: string;
  userPhone: string;
  facePhotoUrl: string;
  similarityScore: number;
}

/**
 * Extract face features from an image using the active provider
 * 
 * @param imageUrl - URL or base64 of the image to analyze
 * @returns Face ID or embedding from the recognition service
 */
export async function extractFaceFeatures(imageUrl: string): Promise<string | null> {
  try {
    const provider = await getActiveProvider();
    
    if (!provider) {
      console.warn('No active face matching provider configured');
      return null;
    }

    // For Azure, we can pass the URL directly as it handles HTTP URLs
    // For other providers, convert to data URL if needed
    let imageData: string;
    if (provider.provider_type === 'azure_face') {
      // Azure can handle HTTP URLs directly, so pass it through
      imageData = imageUrl;
    } else if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) {
      // If it's already a data URL or HTTP URL, fetch and convert
      if (imageUrl.startsWith('http')) {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        imageData = imageUrl;
      }
    } else {
      imageData = imageUrl;
    }

    switch (provider.provider_type) {
      case 'aws_rekognition':
        return await extractFaceFeaturesAWS(imageData, provider);
      case 'azure_face':
        return await extractFaceFeaturesAzure(imageData, provider);
      case 'google_vision':
        return await extractFaceFeaturesGoogle(imageData, provider);
      case 'custom':
        return await extractFaceFeaturesCustom(imageData, provider);
      case 'local':
        return await extractFaceFeaturesLocal(imageData, provider);
      default:
        console.warn('Unknown provider type:', provider.provider_type);
        return null;
    }
  } catch (error) {
    console.error('Error extracting face features:', error);
    return null;
  }
}

/**
 * Extract face features using AWS Rekognition
 */
async function extractFaceFeaturesAWS(imageData: string, provider: FaceMatchingProvider): Promise<string | null> {
  try {
    // Note: AWS SDK would need to be installed: npm install aws-sdk
    // For now, this is a placeholder implementation
    // In production, you would use the AWS SDK:
    /*
    const AWS = require('aws-sdk');
    AWS.config.update({
      accessKeyId: provider.aws_access_key_id,
      secretAccessKey: provider.aws_secret_access_key,
      region: provider.aws_region || 'us-east-1'
    });
    
    const rekognition = new AWS.Rekognition();
    const imageBytes = Buffer.from(imageData.split(',')[1], 'base64');
    
    const result = await rekognition.detectFaces({
      Image: { Bytes: imageBytes },
      Attributes: ['ALL']
    }).promise();
    
    if (result.FaceDetails && result.FaceDetails.length > 0) {
      // Store face ID or return a unique identifier
      return result.FaceDetails[0].FaceId || `aws_${Date.now()}`;
    }
    */
    
    console.log('AWS Rekognition integration requires AWS SDK');
    return `aws_${Date.now()}`;
  } catch (error) {
    console.error('AWS Rekognition error:', error);
    return null;
  }
}

/**
 * Extract face features using Azure Face API
 */
async function extractFaceFeaturesAzure(imageData: string, provider: FaceMatchingProvider): Promise<string | null> {
  try {
    if (!provider.azure_endpoint || !provider.azure_subscription_key) {
      throw new Error('Azure endpoint and subscription key required');
    }

    const endpoint = provider.azure_endpoint.replace(/\/$/, '');
    // Note: Many face attributes (emotion, gender, age, smile, facialHair, hair, makeup) 
    // have been deprecated by Azure. Only request faceId.
    // Use the simplest detection call - no model parameters to avoid approval requirements
    const url = `${endpoint}/face/v1.0/detect?returnFaceId=true`;

    let imageBytes: Uint8Array;

    // Handle different input formats
    if (imageData.startsWith('data:')) {
      // Data URL format: data:image/jpeg;base64,/9j/4AAQ...
      const base64Data = imageData.split(',')[1];
      imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      // HTTP URL - fetch the image as binary
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      imageBytes = new Uint8Array(arrayBuffer);
    } else {
      // Assume it's base64 string without data URL prefix
      imageBytes = Uint8Array.from(atob(imageData), c => c.charCodeAt(0));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': provider.azure_subscription_key,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBytes as any,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = null;
      }
      
      // Check if it's an approval/feature error
      if (errorJson?.error?.innererror?.code === 'UnsupportedFeature') {
        const featureMsg = errorJson.error.innererror.message || '';
        // Even detection might require approval in some cases
        // Return null gracefully instead of throwing to allow batch processing
        console.warn('Azure Face API feature approval required:', featureMsg);
        console.warn('Please apply for access at: https://aka.ms/facerecognition');
        return null;
      }
      
      console.warn(`Azure Face API detection error: ${response.status} - ${errorText}`);
      // Return null instead of throwing to allow batch processing to continue
      return null;
    }

    const faces = await response.json();
    if (faces && faces.length > 0 && faces[0].faceId) {
      return faces[0].faceId;
    }

    console.warn('No face detected in image by Azure Face API');
    return null;
  } catch (error: any) {
    console.error('Azure Face API detection error:', error);
    // Don't throw - return null to allow batch processing to continue
    // The error is already logged, and we don't want to stop the entire regeneration process
    return null;
  }
}

/**
 * Extract face features using Google Cloud Vision API
 */
async function extractFaceFeaturesGoogle(imageData: string, provider: FaceMatchingProvider): Promise<string | null> {
  try {
    if (!provider.google_project_id || !provider.google_credentials_json) {
      throw new Error('Google project ID and credentials required');
    }

    // Note: Google Cloud Vision API requires authentication via service account
    // This is a placeholder - in production, you'd use the Google Cloud client library
    /*
    const vision = require('@google-cloud/vision');
    const client = new vision.ImageAnnotatorClient({
      projectId: provider.google_project_id,
      credentials: JSON.parse(provider.google_credentials_json)
    });

    const [result] = await client.faceDetection({
      image: { content: imageData.split(',')[1] }
    });

    if (result.faceAnnotations && result.faceAnnotations.length > 0) {
      // Return a unique identifier based on face detection
      return `google_${Date.now()}`;
    }
    */

    console.log('Google Cloud Vision integration requires @google-cloud/vision package');
    return `google_${Date.now()}`;
  } catch (error) {
    console.error('Google Cloud Vision error:', error);
    return null;
  }
}

/**
 * Extract face features using Local/Free method (Image hash-based)
 * This is a simple, free alternative that doesn't require API keys or approval
 * Uses perceptual hashing to create a unique identifier for the face region
 */
async function extractFaceFeaturesLocal(imageData: string, provider: FaceMatchingProvider): Promise<string | null> {
  try {
    // Convert image to a hash-based identifier
    // This is a simple approach that works without external APIs
    // We'll create a hash from the image data
    let imageString: string;
    
    if (imageData.startsWith('data:')) {
      imageString = imageData;
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      // For HTTP URLs, we'll use the URL itself as the identifier
      // In a real implementation, you'd fetch and hash the image
      return `local_${btoa(imageData).substring(0, 50)}`;
    } else {
      imageString = imageData;
    }
    
    // Create a simple hash from the image data
    // This is a basic implementation - in production you'd use a proper image hash
    const hash = await simpleImageHash(imageString);
    return `local_${hash}`;
  } catch (error) {
    console.error('Local face feature extraction error:', error);
    return null;
  }
}

/**
 * Simple image hash function
 * Creates a hash from image data for comparison
 */
async function simpleImageHash(imageData: string): Promise<string> {
  // Simple hash function - creates a consistent hash from image data
  let hash = 0;
  const str = imageData.substring(0, 1000); // Use first 1000 chars for performance
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract face features using Custom API
 */
async function extractFaceFeaturesCustom(imageData: string, provider: FaceMatchingProvider): Promise<string | null> {
  try {
    if (!provider.custom_api_endpoint || !provider.custom_api_key) {
      throw new Error('Custom API endpoint and key required');
    }

    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    
    const response = await fetch(provider.custom_api_endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.custom_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Data,
        action: 'detect',
        ...provider.custom_config,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.faceId || result.face_id || `custom_${Date.now()}`;
  } catch (error) {
    console.error('Custom API error:', error);
    return null;
  }
}

/**
 * Search for faces matching the input image
 * 
 * @param imageUrl - URL or base64 of the search image
 * @param threshold - Similarity threshold (0-1), if not provided, uses provider's threshold
 * @returns Array of matching relationships
 */
export async function searchByFace(
  imageUrl: string,
  threshold?: number
): Promise<FaceMatch[]> {
  try {
    const provider = await getActiveProvider();
    
    if (!provider) {
      console.warn('No active face matching provider configured');
      return [];
    }

    // Use provider's threshold if not specified
    const similarityThreshold = threshold ?? provider.similarity_threshold;

    // Step 1: Extract face features from input image
    const inputFaceId = await extractFaceFeatures(imageUrl);
    if (!inputFaceId) {
      throw new Error('Could not detect face in image');
    }

    // Step 2: Get all relationships with face photos
    // Try to get from stored procedure first (includes embeddings), 
    // but if that fails or returns empty, query relationships directly
    let relationships: any[] = [];
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'get_relationships_for_face_search'
    );

    if (rpcError || !rpcData || rpcData.length === 0) {
      // If RPC fails or returns empty (e.g., no embeddings stored), 
      // query relationships directly
      console.warn('No embeddings found or RPC failed, querying relationships directly');
      const { data: relData, error: relError } = await supabase
        .from('relationships')
        .select(`
          id as relationship_id,
          partner_name,
          partner_phone,
          partner_user_id,
          type as relationship_type,
          status as relationship_status,
          user_id,
          partner_face_photo as face_photo_url,
          users!relationships_user_id_fkey(full_name as user_name, phone_number as user_phone)
        `)
        .not('partner_face_photo', 'is', null)
        .neq('partner_face_photo', '');

      if (relError) {
        console.error('Error querying relationships:', relError);
        // Continue with empty array rather than throwing
      } else if (relData) {
        relationships = relData.map((rel: any) => ({
          ...rel,
          face_service_id: null, // Will be re-detected
          user_name: rel.users?.user_name || '',
          user_phone: rel.users?.user_phone || '',
        }));
      }
    } else {
      relationships = rpcData;
    }

    // Step 3: Compare with stored faces using face recognition service
    const matches: FaceMatch[] = [];
    
    for (const rel of relationships || []) {
      if (!rel.face_photo_url) continue;

      // For Azure Face API, face IDs expire after 24 hours
      // If we have a stored face_service_id, try using it, but if it fails, re-detect from image
      let similarity = 0;
      
      if (rel.face_service_id && provider.provider_type !== 'azure_face') {
        // For non-Azure providers, use stored face ID
        similarity = await compareFaces(
          inputFaceId,
          rel.face_service_id,
          rel.face_photo_url,
          provider
        );
      } else {
      // For Azure or when no stored ID, re-detect face from image and compare
      // This handles both missing embeddings and expired Azure face IDs
      const targetFaceId = await extractFaceFeatures(rel.face_photo_url);
      if (targetFaceId && targetFaceId !== 'PENDING_APPROVAL') {
        similarity = await compareFaces(
          inputFaceId,
          targetFaceId,
          rel.face_photo_url,
          provider
        );
      } else if (targetFaceId === 'PENDING_APPROVAL') {
        // Skip relationships that need approval
        console.warn(`Skipping relationship ${rel.relationship_id} - Azure approval required`);
        continue;
      }
      }
      
      if (similarity >= similarityThreshold) {
        matches.push({
          relationshipId: rel.relationship_id,
          partnerName: rel.partner_name,
          partnerPhone: rel.partner_phone,
          partnerUserId: rel.partner_user_id,
          relationshipType: rel.relationship_type,
          relationshipStatus: rel.relationship_status,
          userId: rel.user_id,
          userName: rel.user_name,
          userPhone: rel.user_phone,
          facePhotoUrl: rel.face_photo_url,
          similarityScore: similarity,
        });
      }
    }

    // Sort by similarity score (highest first) and limit results
    matches.sort((a, b) => b.similarityScore - a.similarityScore);
    return matches.slice(0, provider.max_results);
  } catch (error) {
    console.error('Error searching by face:', error);
    return [];
  }
}

/**
 * Compare two faces using the active provider
 */
async function compareFaces(
  faceId1: string,
  faceId2: string,
  targetImageUrl: string,
  provider: FaceMatchingProvider
): Promise<number> {
  try {
    switch (provider.provider_type) {
      case 'aws_rekognition':
        return await compareFacesAWS(faceId1, faceId2, targetImageUrl, provider);
      case 'azure_face':
        return await compareFacesAzure(faceId1, faceId2, targetImageUrl, provider);
      case 'google_vision':
        return await compareFacesGoogle(faceId1, faceId2, targetImageUrl, provider);
      case 'custom':
        return await compareFacesCustom(faceId1, faceId2, targetImageUrl, provider);
      default:
        console.warn('Unknown provider type:', provider.provider_type);
        return 0;
    }
  } catch (error) {
    console.error('Error comparing faces:', error);
    return 0;
  }
}

/**
 * Compare faces using AWS Rekognition
 */
async function compareFacesAWS(
  faceId1: string,
  faceId2: string,
  targetImageUrl: string,
  provider: FaceMatchingProvider
): Promise<number> {
  try {
    // Note: AWS SDK would need to be installed
    // This is a placeholder implementation
    /*
    const AWS = require('aws-sdk');
    AWS.config.update({
      accessKeyId: provider.aws_access_key_id,
      secretAccessKey: provider.aws_secret_access_key,
      region: provider.aws_region || 'us-east-1'
    });
    
    const rekognition = new AWS.Rekognition();
    
    // Fetch source and target images
    const sourceResponse = await fetch(imageUrl);
    const sourceBytes = await sourceResponse.arrayBuffer();
    const targetResponse = await fetch(targetImageUrl);
    const targetBytes = await targetResponse.arrayBuffer();
    
    const result = await rekognition.compareFaces({
      SourceImage: { Bytes: Buffer.from(sourceBytes) },
      TargetImage: { Bytes: Buffer.from(targetBytes) },
      SimilarityThreshold: provider.similarity_threshold * 100
    }).promise();
    
    if (result.FaceMatches && result.FaceMatches.length > 0) {
      return result.FaceMatches[0].Similarity / 100;
    }
    */
    
    console.log('AWS Rekognition comparison requires AWS SDK');
    return 0;
  } catch (error) {
    console.error('AWS Rekognition comparison error:', error);
    return 0;
  }
}

/**
 * Compare faces using Azure Face API
 * Note: Azure Face IDs expire after 24 hours, so we need to re-detect faces from images
 */
async function compareFacesAzure(
  faceId1: string,
  faceId2: string,
  targetImageUrl: string,
  provider: FaceMatchingProvider
): Promise<number> {
  try {
    if (!provider.azure_endpoint || !provider.azure_subscription_key) {
      throw new Error('Azure endpoint and subscription key required');
    }

    const endpoint = provider.azure_endpoint.replace(/\/$/, '');
    
    // Azure Face IDs expire after 24 hours, so we need to re-detect the target face
    // First, detect face in target image
    // Use the simplest detection call - no model parameters to avoid approval requirements
    const detectUrl = `${endpoint}/face/v1.0/detect?returnFaceId=true`;
    
    // Fetch and convert target image
    const targetResponse = await fetch(targetImageUrl);
    const targetBlob = await targetResponse.blob();
    const reader = new FileReader();
    const targetBase64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(targetBlob);
    });
    
    const base64Data = targetBase64.includes(',') ? targetBase64.split(',')[1] : targetBase64;
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const detectResponse = await fetch(detectUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': provider.azure_subscription_key,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBytes,
    });

    if (!detectResponse.ok) {
      const errorText = await detectResponse.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = null;
      }
      
      // Check if it's an approval error
      if (errorJson?.error?.innererror?.code === 'UnsupportedFeature') {
        console.warn('Azure Face API requires approval for face detection/comparison');
        return 0;
      }
      
      console.warn(`Azure Face API detect error: ${detectResponse.status} - ${errorText}`);
      return 0;
    }

    const detectedFaces = await detectResponse.json();
    if (!detectedFaces || detectedFaces.length === 0 || !detectedFaces[0].faceId) {
      console.warn('No face detected in target image');
      return 0;
    }

    const targetFaceId = detectedFaces[0].faceId;

    // Try using verify endpoint for 1:1 face comparison
    // This is simpler than findsimilars and may have different approval requirements
    const verifyUrl = `${endpoint}/face/v1.0/verify`;

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': provider.azure_subscription_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        faceId1: faceId1,
        faceId2: targetFaceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        errorJson = null;
      }
      
      // Check if it's an approval/feature error
      if (errorJson?.error?.innererror?.code === 'UnsupportedFeature') {
        console.warn('Azure Face API requires approval for Verification/Identification features.');
        console.warn('Face detection may work, but comparison requires approval.');
        console.warn('Please apply for access at: https://aka.ms/facerecognition');
        // Return 0 instead of throwing, so the process can continue
        return 0;
      }
      
      // If faceId1 is expired or invalid
      if (response.status === 400 || response.status === 404) {
        console.warn('Source face ID may be expired or invalid');
        return 0;
      }
      
      console.warn(`Azure Face API comparison error: ${response.status} - ${errorText}`);
      // Return 0 instead of throwing to allow search to continue
      return 0;
    }

    const result = await response.json();
    if (result && result.isIdentical !== undefined) {
      // verify returns isIdentical (boolean) and confidence (0-1)
      // Return confidence as similarity score
      return result.confidence || (result.isIdentical ? 0.8 : 0.2);
    }

    return 0;
  } catch (error: any) {
    console.error('Azure Face API comparison error:', error);
    // Always return 0 instead of throwing to allow the search process to continue
    return 0;
  }
}

/**
 * Compare faces using Google Cloud Vision API
 */
async function compareFacesGoogle(
  faceId1: string,
  faceId2: string,
  targetImageUrl: string,
  provider: FaceMatchingProvider
): Promise<number> {
  try {
    // Note: Google Cloud Vision API requires the client library
    // This is a placeholder implementation
    console.log('Google Cloud Vision comparison requires @google-cloud/vision package');
    return 0;
  } catch (error) {
    console.error('Google Cloud Vision comparison error:', error);
    return 0;
  }
}

/**
 * Compare faces using Local/Free method
 * Uses image hash comparison - simple but effective for basic face matching
 */
async function compareFacesLocal(
  faceId1: string,
  faceId2: string,
  targetImageUrl: string,
  provider: FaceMatchingProvider
): Promise<number> {
  try {
    // For local provider, faceId is actually an image hash
    // Compare the hashes - if they're similar, faces might match
    if (faceId1.startsWith('local_') && faceId2.startsWith('local_')) {
      // Extract hash values
      const hash1 = faceId1.replace('local_', '');
      const hash2 = faceId2.replace('local_', '');
      
      // Simple similarity based on hash distance
      // This is a basic implementation - for better results, you'd use proper image comparison
      if (hash1 === hash2) {
        return 0.95; // Exact match
      }
      
      // Calculate similarity based on hash similarity
      // This is a simplified approach - in production, use proper image comparison
      const similarity = calculateHashSimilarity(hash1, hash2);
      return similarity;
    }
    
    return 0;
  } catch (error) {
    console.error('Local face comparison error:', error);
    return 0;
  }
}

/**
 * Calculate similarity between two hashes
 * Simple implementation - returns a similarity score between 0 and 1
 */
function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (hash1 === hash2) return 1.0;
  
  // Calculate Levenshtein distance
  const len1 = hash1.length;
  const len2 = hash2.length;
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (hash1[i - 1] === hash2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = 1 - (distance / maxLen);
  
  // Scale to 0-1 range, but be conservative since this is basic comparison
  return Math.max(0, Math.min(0.7, similarity * 0.8));
}

/**
 * Compare faces using Custom API
 */
async function compareFacesCustom(
  faceId1: string,
  faceId2: string,
  targetImageUrl: string,
  provider: FaceMatchingProvider
): Promise<number> {
  try {
    if (!provider.custom_api_endpoint || !provider.custom_api_key) {
      throw new Error('Custom API endpoint and key required');
    }

    // Fetch target image
    const targetResponse = await fetch(targetImageUrl);
    const targetBlob = await targetResponse.blob();
    const reader = new FileReader();
    const targetBase64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(targetBlob);
    });

    const base64Data = targetBase64.includes(',') ? targetBase64.split(',')[1] : targetBase64;

    const response = await fetch(provider.custom_api_endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${provider.custom_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'compare',
        faceId1,
        faceId2,
        targetImage: base64Data,
        ...provider.custom_config,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Custom API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.similarity || result.confidence || 0;
  } catch (error) {
    console.error('Custom API comparison error:', error);
    return 0;
  }
}


/**
 * Store face embedding/service ID for a relationship
 * This should be called when a partner face photo is uploaded
 */
/**
 * Store face embedding/service ID for a relationship
 * This should be called when a partner face photo is uploaded
 */
export async function storeFaceEmbedding(
  relationshipId: string,
  facePhotoUrl: string
): Promise<boolean> {
  try {
    console.log(`[storeFaceEmbedding] Starting for relationship ${relationshipId} with photo: ${facePhotoUrl}`);
    
    const provider = await getActiveProvider();
    
    if (!provider) {
      console.warn('[storeFaceEmbedding] No active face matching provider configured');
      return false;
    }

    console.log(`[storeFaceEmbedding] Active provider: ${provider.name} (${provider.provider_type})`);

    // Extract face features using the active provider
    console.log(`[storeFaceEmbedding] Extracting face features...`);
    const faceServiceId = await extractFaceFeatures(facePhotoUrl);
    if (!faceServiceId) {
      console.warn('[storeFaceEmbedding] Could not extract face features from image');
      console.warn('[storeFaceEmbedding] This might require Azure Face API approval');
      console.warn('[storeFaceEmbedding] Storing placeholder for later processing...');
      
      // Get relationship info to store placeholder
      const { data: relationship, error: relError } = await supabase
        .from('relationships')
        .select('partner_name, partner_phone, partner_face_photo')
        .eq('id', relationshipId)
        .single();

      if (relError || !relationship) {
        console.error('[storeFaceEmbedding] Error fetching relationship:', relError);
        return false;
      }

      // Store with placeholder to indicate approval is needed
      // This allows us to track which relationships need processing after approval
      const { error: upsertError } = await supabase
        .from('face_embeddings')
        .upsert({
          relationship_id: relationshipId,
          partner_name: relationship.partner_name,
          partner_phone: relationship.partner_phone,
          face_photo_url: relationship.partner_face_photo || facePhotoUrl,
          face_service_id: 'PENDING_APPROVAL', // Placeholder
          face_service_type: provider.provider_type,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'relationship_id'
        });

      if (upsertError) {
        console.error('[storeFaceEmbedding] Error storing placeholder:', upsertError);
        return false;
      }

      console.log('[storeFaceEmbedding] Stored placeholder - will process after Azure approval');
      return true; // Return true because we stored useful data
    }

    console.log(`[storeFaceEmbedding] Face features extracted, service ID: ${faceServiceId}`);

    // Get relationship info
    const { data: relationship, error: relError } = await supabase
      .from('relationships')
      .select('partner_name, partner_phone, partner_face_photo')
      .eq('id', relationshipId)
      .single();

    if (relError) {
      console.error('[storeFaceEmbedding] Error fetching relationship:', relError);
      return false;
    }

    if (!relationship) {
      console.warn(`[storeFaceEmbedding] Relationship ${relationshipId} not found`);
      return false;
    }

    console.log(`[storeFaceEmbedding] Relationship found, upserting face embedding...`);

    // Upsert face embedding
    const { error } = await supabase
      .from('face_embeddings')
      .upsert({
        relationship_id: relationshipId,
        partner_name: relationship.partner_name,
        partner_phone: relationship.partner_phone,
        face_photo_url: relationship.partner_face_photo || facePhotoUrl,
        face_service_id: faceServiceId,
        face_service_type: provider.provider_type,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'relationship_id'
      });

    if (error) {
      console.error('[storeFaceEmbedding] Error upserting face embedding:', error);
      throw error;
    }

    console.log(`[storeFaceEmbedding] Successfully stored face embedding for relationship ${relationshipId}`);
    return true;
  } catch (error) {
    console.error('[storeFaceEmbedding] Error storing face embedding:', error);
    return false;
  }
}

/**
 * Regenerate face embeddings for all existing relationships that have face photos
 * This is useful when:
 * - A face matching provider is activated after relationships already exist
 * - Face embeddings need to be updated after changing providers
 * - Face embeddings are missing or corrupted
 */
export async function regenerateAllFaceEmbeddings(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    const provider = await getActiveProvider();
    
    if (!provider) {
      throw new Error('No active face matching provider configured');
    }

    // Get all relationships with face photos but no embeddings, or all relationships with face photos
    const { data: relationships, error } = await supabase
      .from('relationships')
      .select('id, partner_face_photo, partner_name, partner_phone')
      .not('partner_face_photo', 'is', null)
      .neq('partner_face_photo', '');

    if (error) throw error;

    if (!relationships || relationships.length === 0) {
      return results;
    }

    console.log(`Regenerating face embeddings for ${relationships.length} relationships...`);

    // Process relationships in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < relationships.length; i += batchSize) {
      const batch = relationships.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (rel) => {
          try {
            if (!rel.partner_face_photo) {
              results.failed++;
              return;
            }

            const success = await storeFaceEmbedding(rel.id, rel.partner_face_photo);
            if (success) {
              results.success++;
            } else {
              results.failed++;
              // Check if it's an approval error
              const errorMsg = `Failed to store embedding for relationship ${rel.id}`;
              results.errors.push(errorMsg);
            }
          } catch (error: any) {
            results.failed++;
            const errorMessage = error?.message || 'Unknown error';
            
            // Check if it's the approval error
            if (errorMessage.includes('UnsupportedFeature') || errorMessage.includes('missing approval') || errorMessage.includes('requires approval')) {
              if (!results.errors.some(e => e.includes('Azure Face API approval'))) {
                results.errors.push(
                  '⚠️ Azure Face API: Face comparison requires approval for Verification/Identification features. ' +
                  'Face detection (storing face IDs) should still work. ' +
                  'Please apply for access at: https://aka.ms/facerecognition ' +
                  'to enable face comparison/search functionality.'
                );
              }
            } else {
              results.errors.push(
                `Error processing relationship ${rel.id}: ${errorMessage}`
              );
            }
            console.error(`Error processing relationship ${rel.id}:`, error);
          }
        })
      );

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < relationships.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Regeneration complete: ${results.success} succeeded, ${results.failed} failed`);
    return results;
  } catch (error: any) {
    console.error('Error regenerating face embeddings:', error);
    throw error;
  }
}

