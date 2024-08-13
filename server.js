const express = require('express');
const axios = require('axios');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const https = require('https');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const port = 80;

const pollyClient = new PollyClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Serve static files from the "static" directory
app.use('/static', express.static('static'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket connection established.');

  ws.on('message', async (message) => {
    console.log('Received message:', message);

    const { audioData, conversationHistory } = JSON.parse(message);
    const startTime = Date.now();

    try {
      if (!audioData) {
        throw new Error('No audio data received');
      }

      // Deepgram Nova2 Speech-to-Text
      console.log('Sending request to Deepgram...');
      const audioBuffer = Buffer.from(audioData, 'base64');
      const deepgramResponse = await axios.post('https://api.deepgram.com/v1/listen', audioBuffer, {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav',
        },
      });
      console.log('Deepgram response:', deepgramResponse.data);

      const transcript = deepgramResponse.data.results.channels[0].alternatives[0].transcript;
      console.log('Transcript from Deepgram:', transcript);

      conversationHistory.push({ role: 'user', content: transcript });

      // Generate response with GPT-4o Mini
      console.log('Sending request to GPT-4o Mini...');
      const agent = new https.Agent({ rejectUnauthorized: false });
      const gptPayload = {
        model: 'gpt-4o-mini',
        messages: conversationHistory,
        max_tokens: 150
      };
      console.log('GPT-4o Mini payload:', gptPayload);
      const gptResponse = await axios.post('https://api.openai.com/v1/chat/completions', gptPayload, {
        headers: {
          'Authorization': `Bearer ${process.env.GPT4O_MINI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        httpsAgent: agent,
      });
      console.log('GPT-4o Mini response:', gptResponse.data);

      const botResponse = gptResponse.data.choices[0].message.content.trim();
      console.log('Response from GPT-4o Mini:', botResponse);

      conversationHistory.push({ role: 'assistant', content: botResponse });

      // Text-to-Speech with Amazon Polly
      console.log('Sending request to Amazon Polly...');
      const command = new SynthesizeSpeechCommand({
        Text: botResponse,
        OutputFormat: 'mp3',
        VoiceId: 'Joanna',
      });

      const pollyResponse = await pollyClient.send(command);
      console.log('Amazon Polly response:', pollyResponse);

      const audioStream = pollyResponse.AudioStream;
      const audioChunks = [];
      for await (const chunk of audioStream) {
        audioChunks.push(chunk);
      }
      const audioBufferConcat = Buffer.concat(audioChunks);

      const endTime = Date.now();
      console.log(`Total Latency: ${endTime - startTime} ms`);

      ws.send(JSON.stringify({
        transcript: transcript,
        botResponse: botResponse,
        audioData: audioBufferConcat.toString('base64'),
      }));
    } catch (error) {
      console.error('Error processing the conversation:', error);
      if (error.response) {
        console.error('Error details:', error.response.data);
        ws.send(JSON.stringify({ error: `Error processing the conversation: ${error.response.data}` }));
      } else {
        ws.send(JSON.stringify({ error: `Error processing the conversation: ${error.message}` }));
      }
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed.');
  });
});
