/**
 * Quick test script to verify AI configuration
 * Run with: node test-ai-config.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying AI Configuration...\n');

// Check 1: Token limits
console.log('1️⃣ Checking token limits...');
const aiService = fs.readFileSync(path.join(__dirname, 'lib/ai-service.ts'), 'utf8');
const has500Tokens = aiService.includes('max_tokens: 500');
const has30sTimeout = aiService.includes('createTimeoutAbortSignal(30000)');
console.log(`   ✅ max_tokens: 500 - ${has500Tokens ? 'FOUND' : 'NOT FOUND'}`);
console.log(`   ✅ timeout: 30s - ${has30sTimeout ? 'FOUND' : 'NOT FOUND'}`);

// Check 2: Retry logic
console.log('\n2️⃣ Checking retry logic...');
const hasRetryLogic = aiService.includes('maxRetries') && aiService.includes('attempt < maxRetries');
console.log(`   ✅ Retry logic - ${hasRetryLogic ? 'FOUND' : 'NOT FOUND'}`);

// Check 3: Error handling
console.log('\n3️⃣ Checking error handling...');
const conversationFile = fs.readFileSync(path.join(__dirname, 'app/messages/[conversationId].tsx'), 'utf8');
const hasErrorHandling = conversationFile.includes("I'm sorry, I encountered an error");
const hasSuccessCheck = conversationFile.includes('if (!aiResponse.success)');
console.log(`   ✅ Error message display - ${hasErrorHandling ? 'FOUND' : 'NOT FOUND'}`);
console.log(`   ✅ Success check - ${hasSuccessCheck ? 'FOUND' : 'NOT FOUND'}`);

// Check 4: Edge Function exists
console.log('\n4️⃣ Checking Supabase Edge Function...');
const edgeFunctionPath = path.join(__dirname, 'supabase/functions/ai-chat/index.ts');
const edgeFunctionExists = fs.existsSync(edgeFunctionPath);
console.log(`   ✅ Edge Function exists - ${edgeFunctionExists ? 'YES' : 'NO'}`);

if (edgeFunctionExists) {
  const edgeFunction = fs.readFileSync(edgeFunctionPath, 'utf8');
  const hasMaxTokens = edgeFunction.includes('max_tokens');
  console.log(`   ✅ Has max_tokens config - ${hasMaxTokens ? 'YES' : 'NO'}`);
}

// Check 5: API Key configuration
console.log('\n5️⃣ Checking API key configuration...');
const appConfig = fs.readFileSync(path.join(__dirname, 'app.config.ts'), 'utf8');
const hasApiKeyConfig = appConfig.includes('EXPO_PUBLIC_OPENAI_API_KEY');
console.log(`   ✅ API key config - ${hasApiKeyConfig ? 'FOUND' : 'NOT FOUND'}`);

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 SUMMARY');
console.log('='.repeat(50));
const allChecks = [
  has500Tokens,
  has30sTimeout,
  hasRetryLogic,
  hasErrorHandling,
  hasSuccessCheck,
  edgeFunctionExists,
  hasApiKeyConfig,
];

const passed = allChecks.filter(Boolean).length;
const total = allChecks.length;

console.log(`\n✅ Passed: ${passed}/${total} checks`);

if (passed === total) {
  console.log('\n🎉 All configurations verified!');
  console.log('\n📝 Next steps:');
  console.log('   1. Deploy Edge Function: supabase functions deploy ai-chat');
  console.log('   2. Set OpenAI API key via Admin Settings or environment variable');
  console.log('   3. Test by sending a message to Committed AI');
} else {
  console.log('\n⚠️  Some checks failed. Review the output above.');
}

console.log('\n');

