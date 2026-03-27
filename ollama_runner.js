// Ollama Native Runner Loop
// This acts as a wrapper for Ollama models to give them autonomous command execution.
// It loops endlessly, asking the model for the next command, executing it, and feeding the output back.

const { exec } = require('child_process');
const http = require('http');

const model = process.argv[2] || 'llama3';
const systemPrompt = process.argv[3] || 'You are an agent.';

const OLLAMA_URL = 'http://localhost:11434/api/chat';

let messages = [
  { 
    role: 'system', 
    content: systemPrompt + '\n\nCRITICAL RULE: You must respond ONLY with the exact CLI command you want to run (e.g., "node cli/town.js look"). Do NOT include markdown formatting, backticks, or ANY conversational text. Your entire response will be passed directly into the terminal.' 
  }
];

function chat() {
  const reqData = JSON.stringify({
    model: model,
    messages: messages,
    stream: false,
    options: { temperature: 0.8 }
  });

  const req = http.request(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(reqData) }
  }, (res) => {
    let raw = '';
    res.on('data', c => raw += c);
    res.on('end', () => {
      try {
        const data = JSON.parse(raw);
        if (data.error) {
          console.error('[Ollama Error]', data.error);
          return setTimeout(chat, 5000);
        }

        let cmd = data.message?.content || '';
        cmd = cmd.replace(/```(bash)?/gi, '').trim();
        cmd = cmd.split('\n')[0]; // Taking only the first line just in case

        if (!cmd.startsWith('node cli/town.js')) {
           messages.push({ role: 'assistant', content: cmd });
           messages.push({ role: 'user', content: 'SYSTEM ERROR: Invalid command. You must respond ONLY with a "node cli/town.js [...]" command. No conversation.' });
           console.log(`[Ollama Runner] Invalid command attempted: ${cmd}`);
           return setTimeout(chat, 1000);
        }

        messages.push({ role: 'assistant', content: cmd });
        
        // Execute the command locally
        exec(cmd, { cwd: __dirname }, (err, stdout, stderr) => {
          const output = (stdout || '') + (stderr || '');
          messages.push({ role: 'user', content: output.trim() });
          
          // Truncate context window to prevent memory overflows (keep system prompt, keep last 10 pairs)
          if (messages.length > 21) {
             messages = [messages[0], ...messages.slice(-20)];
          }
          
          setTimeout(chat, 2000); // 2-second thinking pause
        });

      } catch(e) {
        console.error('[Ollama Runner] Error parsing JSON:', e.message);
        setTimeout(chat, 5000);
      }
    });
  });

  req.on('error', (e) => {
    console.error('[Ollama Runner] Connection failed (Is Ollama running?):', e.message);
    setTimeout(chat, 10000);
  });

  req.write(reqData);
  req.end();
}

console.log(`[Ollama Runner] Booting autonomous agent loop using model: ${model}...`);
chat();
