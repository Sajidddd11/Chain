/**
 * Voice Mode Setup Verification Script
 * Run with: node test-voice-setup.js
 */

require('dotenv').config();

const tests = [
  {
    name: 'ElevenLabs API Key',
    check: () => !!process.env.ELEVENLABS_API_KEY,
    fix: 'Add ELEVENLABS_API_KEY to .env file'
  },
  {
    name: 'ElevenLabs Voice ID',
    check: () => !!process.env.ELEVENLABS_VOICE_ID,
    fix: 'Add ELEVENLABS_VOICE_ID to .env (or use default: JBFqnCBsd6RMkjVDRZzb)'
  },
  {
    name: 'OpenAI API Key',
    check: () => !!process.env.OPENAI_API_KEY,
    fix: 'Add OPENAI_API_KEY to .env file'
  },
  {
    name: 'Dependencies: ws',
    check: () => {
      try {
        require('ws');
        return true;
      } catch (e) {
        return false;
      }
    },
    fix: 'Run: npm install ws'
  },
  {
    name: 'Dependencies: form-data',
    check: () => {
      try {
        require('form-data');
        return true;
      } catch (e) {
        return false;
      }
    },
    fix: 'Run: npm install form-data'
  },
  {
    name: 'Dependencies: openai',
    check: () => {
      try {
        require('openai');
        return true;
      } catch (e) {
        return false;
      }
    },
    fix: 'Already installed'
  }
];

console.log('\n🔍 AgriSense Voice Mode Setup Check\n');
console.log('='.repeat(50));

let allPassed = true;

tests.forEach(test => {
  const passed = test.check();
  const icon = passed ? '✅' : '❌';
  console.log(`\n${icon} ${test.name}`);
  
  if (!passed) {
    console.log(`   Fix: ${test.fix}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('\n✨ All checks passed! Voice Mode is ready to use.');
  console.log('\nNext steps:');
  console.log('1. Start backend: npm run dev');
  console.log('2. Start frontend: cd ../frontend && npm run dev');
  console.log('3. Open chatbot and click speaker icon to test');
} else {
  console.log('\n⚠️  Some checks failed. Fix the issues above and try again.');
  process.exit(1);
}

console.log('\n');




