const https = require('https');
const http = require('http');

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    format: 'openai',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  claude: {
    name: 'Claude (Anthropic)',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    endpoint: 'https://api.anthropic.com/v1/messages',
    format: 'anthropic',
    headers: (apiKey) => ({ 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
  },
  nvidia: {
    name: 'Nvidia NIM',
    models: ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct', 'mistralai/mistral-7b-instruct-v0.3'],
    defaultModel: 'meta/llama-3.1-8b-instruct',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    format: 'openai',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  groq: {
    name: 'Groq',
    models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    defaultModel: 'llama3-70b-8192',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    format: 'openai',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  google: {
    name: 'Google Gemini',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    defaultModel: 'gemini-1.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    format: 'gemini',
    headers: () => ({}),
  },
  cohere: {
    name: 'Cohere',
    models: ['command-r-plus', 'command-r', 'command'],
    defaultModel: 'command-r-plus',
    endpoint: 'https://api.cohere.ai/v1/chat',
    format: 'cohere',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  mistral: {
    name: 'Mistral',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-7b'],
    defaultModel: 'mistral-small-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    format: 'openai',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    defaultModel: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    format: 'openai',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
  together: {
    name: 'Together AI',
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1', 'meta-llama/Llama-3-70b-chat-hf'],
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    endpoint: 'https://api.together.xyz/v1/chat/completions',
    format: 'openai',
    headers: (apiKey) => ({ 'Authorization': `Bearer ${apiKey}` }),
  },
};

const ENHANCEMENT_STYLES = {
  expert: {
    label: 'Expert Role Prefix',
    systemPrompt: (topic) => `You are a world-class expert specializing in ${topic || 'the given subject'}. Your expertise is deep and comprehensive. Enhance the following text by refining it with your expert knowledge while preserving the original intent and key information. Make it more precise, authoritative, and valuable. Output only the enhanced text, no explanations.`,
  },
  clarify: {
    label: 'Clarify & Expand',
    systemPrompt: () => 'You are a skilled communication expert. Rewrite the following text to make it clearer, more detailed, and better structured. Expand on key points while maintaining accuracy. Output only the enhanced text, no explanations.',
  },
  concise: {
    label: 'Concise',
    systemPrompt: () => 'You are a master of concise communication. Rewrite the following text to be brief, clear, and impactful. Remove fluff while preserving all key information. Output only the enhanced text, no explanations.',
  },
  professional: {
    label: 'Professional',
    systemPrompt: () => 'You are a professional editor. Rewrite the following text in a formal, polished, and professional tone. Use appropriate terminology and maintain a high standard of communication. Output only the enhanced text, no explanations.',
  },
  casual: {
    label: 'Casual & Friendly',
    systemPrompt: () => 'Rewrite the following text in a casual, friendly, and approachable tone. Make it sound natural and conversational while keeping the core message intact. Output only the enhanced text, no explanations.',
  },
  custom: {
    label: 'Custom',
    systemPrompt: (template) => template || 'Enhance the following text. Output only the enhanced text, no explanations.',
  },
};

function makeRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error?.message || parsed.error || `HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', (e) => reject(e));
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function enhanceWithOpenAI(apiKey, endpoint, model, messages) {
  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  };
  const provider = Object.values(PROVIDERS).find(p => p.endpoint === endpoint);
  const headers = provider ? provider.headers(apiKey) : { 'Authorization': `Bearer ${apiKey}` };
  const data = await makeRequest(endpoint, 'POST', headers, body);
  return data.choices[0].message.content;
}

async function enhanceWithAnthropic(apiKey, endpoint, model, messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsg = messages.find(m => m.role === 'user');
  const body = {
    model,
    max_tokens: 4096,
    system: systemMsg?.content || '',
    messages: [{ role: 'user', content: userMsg?.content || '' }],
  };
  const data = await makeRequest(endpoint, 'POST', { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body);
  return data.content[0].text;
}

async function enhanceWithGemini(apiKey, endpoint, model, messages) {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsg = messages.find(m => m.role === 'user');
  const parts = [];
  if (systemMsg) parts.push({ text: systemMsg.content });
  if (userMsg) parts.push({ text: userMsg.content });
  const body = {
    contents: [{ parts, role: 'user' }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };
  const url = `${endpoint}/${model}:generateContent?key=${apiKey}`;
  const data = await makeRequest(url, 'POST', { 'Content-Type': 'application/json' }, body);
  return data.candidates[0].content.parts[0].text;
}

async function enhanceWithCohere(apiKey, endpoint, model, messages) {
  const userMsg = messages.find(m => m.role === 'user');
  const body = {
    model,
    message: userMsg?.content || '',
    preamble: messages.find(m => m.role === 'system')?.content || '',
    max_tokens: 4096,
    temperature: 0.7,
  };
  const data = await makeRequest(endpoint, 'POST', { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body);
  return data.text || data.chat_history?.[data.chat_history.length - 1]?.message || data.response?.text || '';
}

async function enhancePrompt(providerKey, apiKey, model, userText, styleKey, customPrompt) {
  const style = ENHANCEMENT_STYLES[styleKey] || ENHANCEMENT_STYLES.expert;
  const provider = PROVIDERS[providerKey];
  if (!provider) throw new Error(`Unknown provider: ${providerKey}`);
  if (!apiKey) throw new Error(`API key not configured for ${provider.name}`);

  const systemContent = styleKey === 'custom' ? style.systemPrompt(customPrompt) : style.systemPrompt('the given topic');

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: userText },
  ];

  switch (provider.format) {
    case 'anthropic':
      return await enhanceWithAnthropic(apiKey, provider.endpoint, model || provider.defaultModel, messages);
    case 'gemini':
      return await enhanceWithGemini(apiKey, provider.endpoint, model || provider.defaultModel, messages);
    case 'cohere':
      return await enhanceWithCohere(apiKey, provider.endpoint, model || provider.defaultModel, messages);
    case 'openai':
    default:
      return await enhanceWithOpenAI(apiKey, provider.endpoint, model || provider.defaultModel, messages);
  }
}

module.exports = { PROVIDERS, ENHANCEMENT_STYLES, enhancePrompt };
