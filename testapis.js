const axios = require('axios');
const https = require('https');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
require('dotenv').config();

const pollyClient = new PollyClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Dummy base64-encoded audio data
const dummyAudioData = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACAAgAZGF0YQAAAAA=';

async function testDeepgram(audioData) {
  try {
    // Convert the base64-encoded audio data to a Buffer
    const audioBuffer = Buffer.from(audioData.split(',')[1], 'base64');

    const deepgramResponse = await axios.post('https://api.deepgram.com/v1/listen', audioBuffer, {
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/wav',
      },
    });
    console.log('Deepgram response:', deepgramResponse.data);
    return { success: true };
  } catch (error) {
    if (error.response) {
      console.error('Error testing Deepgram API:', error.response.status, error.response.data);
      return { success: false, error: `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` };
    } else {
      console.error('Error testing Deepgram API:', error.message);
      return { success: false, error: error.message };
    }
  }
}

async function testGPT4oMini(prompt) {
  try {
    const agent = new https.Agent({  
      rejectUnauthorized: false
    });

    const gptResponse = await axios.post('https://api.gpt4o.com/v1/engines/gpt4o-mini/completions', {
      prompt: prompt,
      max_tokens: 150,
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GPT4O_MINI_API_KEY}`,
      },
      httpsAgent: agent
    });
    console.log('GPT-4o Mini response:', gptResponse.data);
    return { success: true };
  } catch (error) {
    if (error.response) {
      console.error('Error testing GPT-4o Mini API:', error.response.status, error.response.data);
      return { success: false, error: `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` };
    } else {
      console.error('Error testing GPT-4o Mini API:', error.message);
      return { success: false, error: error.message };
    }
  }
}

async function testPolly(text) {
  try {
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: 'mp3',
      VoiceId: 'Joanna',
    });

    const pollyResponse = await pollyClient.send(command);
    console.log('Amazon Polly response:', pollyResponse.AudioStream);
    return { success: true };
  } catch (error) {
    if (error.response) {
      console.error('Error testing Amazon Polly API:', error.response.status, error.response.data);
      return { success: false, error: `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}` };
    } else {
      console.error('Error testing Amazon Polly API:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Test each API individually
(async () => {
  const dummyPrompt = 'Hello, how are you?';
  const dummyText = 'This is a test for Amazon Polly.';

  const deepgramResult = await testDeepgram(dummyAudioData);
  const gpt4oMiniResult = await testGPT4oMini(dummyPrompt);
  const pollyResult = await testPolly(dummyText);

  console.log(`Deepgram API working: ${deepgramResult.success}`);
  if (!deepgramResult.success) {
    console.log(`Deepgram API error: ${deepgramResult.error}`);
  }

  console.log(`GPT-4o Mini API working: ${gpt4oMiniResult.success}`);
  if (!gpt4oMiniResult.success) {
    console.log(`GPT-4o Mini API error: ${gpt4oMiniResult.error}`);
  }

  console.log(`Amazon Polly API working: ${pollyResult.success}`);
  if (!pollyResult.success) {
    console.log(`Amazon Polly API error: ${pollyResult.error}`);
  }
})();
