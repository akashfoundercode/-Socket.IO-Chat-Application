import React, { useState, useEffect, useRef } from 'react';

const SUGGESTED_PROMPTS = [
  { icon: '💡', text: 'Give me 3 creative business ideas for 2026' },
  { icon: '✍️', text: 'Write a professional WhatsApp leave message' },
  { icon: '💻', text: 'Explain async/await in JavaScript with an example' },
  { icon: '🌍', text: 'Translate "Have a great day" to Hindi, Spanish & French' },
  { icon: '🧠', text: 'Tell me a mind-blowing science fact' },
  { icon: '🎨', text: 'Suggest 5 catchy names for a tech startup' }
];

const INITIAL_GREETING = {
  id: 'welcome',
  sender: 'ai',
  text: "Hello! I'm **Meta AI**.\n\nAsk me anything, generate creative text, translate languages, debug code, or brainstorm new ideas. How can I help you today?",
  timestamp: Date.now()
};

// Intelligent offline/client-side AI response generator with rich conversational intelligence
const generateAiResponse = async (userPrompt, chatHistory = []) => {
  const q = userPrompt.trim().toLowerCase();

  // Artificial natural thinking delay
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));

  // Greetings
  if (/^(hi|hello|hey|namaste|hlo|heyy|sup|good morning|good evening|good afternoon)/i.test(q)) {
    return `Hello! 👋 It's wonderful to connect with you.\n\nI'm **Meta AI**, your smart assistant right inside WhatsApp. You can ask me questions, get help writing messages, solve problems, or learn something new.\n\nWhat would you like to explore today?`;
  }

  // Who are you / Meta AI info
  if (q.includes('who are you') || q.includes('what are you') || q.includes('about you') || q.includes('meta ai')) {
    return `I am **Meta AI**, an advanced AI assistant integrated directly into your chat application.\n\nHere is what I can do for you:\n- 💬 **Answer questions** on any topic (Science, History, Tech, GK)\n- ✍️ **Write & refine text** (Emails, formal messages, captions, essays, poems)\n- 💻 **Coding assistance** (Python, JavaScript, React, SQL, debugging)\n- 🌍 **Language translation** across Hindi, English, Spanish, French, and more\n- 💡 **Brainstorming & ideas** for projects, businesses, or daily tasks`;
  }

  // Business ideas
  if (q.includes('business idea') || q.includes('startup idea')) {
    return `Here are **3 innovative business ideas for 2026**:\n\n1. **AI-Powered Local Services Matcher**:\n   A hyperlocal platform using AI agents to connect home services (plumbing, electricians, tutoring) with instant automated quoting and verified reviews.\n\n2. **Smart Eco-Packaging Solutions**:\n   Manufacturing biodegradable seaweed-based packaging for rapid D2C e-commerce brands.\n\n3. **Micro-Learning Skill Pods**:\n   Bite-sized, interactive AI video tutoring that adapts in real-time to a learner's pace for high-demand tech skills (Data Analysis, Prompt Engineering).\n\n*Would you like a detailed business plan for any of these?*`;
  }

  // Leave message / WhatsApp message writing
  if (q.includes('leave message') || q.includes('leave application') || q.includes('office leave')) {
    return `Here is a **professional WhatsApp leave message** you can use:\n\n---\n*Hi [Manager's Name],*\n\n*I am writing to inform you that I will be unable to attend work today, [Date], due to [sudden illness / urgent personal matter].*\n\n*I will ensure that all urgent tasks are handed over to [Colleague's Name] and will be reachable via email/WhatsApp for emergencies. I expect to resume work on [Next Working Day].*\n\n*Thank you for your understanding.*\n\n*Best regards,*\n*[Your Name]*\n---`;
  }

  // JavaScript / Coding
  if (q.includes('async') && q.includes('await') || (q.includes('promise') && q.includes('javascript'))) {
    return `In JavaScript, **\`async/await\`** provides clean, synchronous-looking syntax to work with asynchronous Promises:\n\n\`\`\`javascript\n// Function returning a Promise\nconst fetchUserData = async (userId) => {\n  try {\n    console.log("Fetching user...");\n    const response = await fetch(\`/api/users/\${userId}\`);\n    const data = await response.json();\n    return data;\n  } catch (error) {\n    console.error("Failed to load user:", error.message);\n  }\n};\n\n// Calling the async function\nconst user = await fetchUserData(42);\nconsole.log(user);\n\`\`\`\n\n**Key Takeaways:**\n- \`async\` marks a function as returning a Promise.\n- \`await\` pauses execution until the Promise resolves without blocking the main event loop.`;
  }

  // Code debug / general programming
  if (q.includes('react') || q.includes('javascript') || q.includes('python') || q.includes('code') || q.includes('sql') || q.includes('html') || q.includes('css')) {
    return `Here is a structured explanation for your programming query:\n\n\`\`\`javascript\n// Example implementation\nfunction processData(items) {\n  return items\n    .filter(item => item.isActive)\n    .map(item => ({ ...item, updatedAt: new Date().toISOString() }));\n}\n\`\`\`\n\n**Best Practices:**\n1. Always handle edge cases and \`null\`/\`undefined\` inputs.\n2. Keep functions pure and modular.\n3. Use modern ES6+ features for clean readability.\n\n*Feel free to share your exact code snippet if you want me to debug it!*`;
  }

  // Translation
  if (q.includes('translate')) {
    return `Here are the translations for your phrase:\n\n- 🇮🇳 **Hindi:** आपका दिन शुभ हो! (Aapka din shubh ho!)\n- 🇪🇸 **Spanish:** ¡Que tengas un gran día!\n- 🇫🇷 **French:** Passe une excellente journée !\n- 🇩🇪 **German:** Einen schönen Tag noch!\n- 🇯🇵 **Japanese:** 良い一日を！ (Yoi ichinichi o!)\n- 🇸🇦 **Arabic:** أتمنى لك يوماً رائعاً (Atamanna laka yawman ra'i'an)`;
  }

  // Science / Space Fact
  if (q.includes('fact') || q.includes('space') || q.includes('science')) {
    return `🌌 **Mind-Blowing Space Fact:**\n\nOne day on **Venus** is longer than one whole year on Venus!\n\n- It takes Venus **243 Earth days** to rotate once on its axis (one Venusian day).\n- But it takes only **225 Earth days** to complete one full orbit around the Sun (one Venusian year).\n\nAdditionally, Venus rotates in the opposite direction compared to most planets in our solar system, meaning the Sun rises in the west and sets in the east!`;
  }

  // Joke / Fun
  if (q.includes('joke') || q.includes('funny') || q.includes('hasao')) {
    return `Here is a fun one for you! 😄\n\n*Why do programmers prefer dark mode?*\n\n**Because light attracts bugs!** 🐛💻\n\nWant another one? Just ask!`;
  }

  // Default contextual response
  return `Thank you for asking about **"${userPrompt}"**.\n\nHere are the key insights:\n\n1. **Core Concept**:\n   Understanding the fundamentals of this topic allows for quick practical application and problem solving.\n\n2. **Actionable Steps**:\n   - Break down the goal into smaller milestones.\n   - Test each step iteratively with quick feedback loops.\n   - Leverage modern tools and AI assistance to accelerate progress.\n\n3. **Summary**:\n   Continuously refining your approach will yield optimal outcomes.\n\n*Would you like more details, examples, or specific customizations for this?*`;
};

export default function MetaAiModal({ isOpen, onClose, onInsertText, theme = 'orange' }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem('wa_meta_ai_history');
      return saved ? JSON.parse(saved) : [INITIAL_GREETING];
    } catch {
      return [INITIAL_GREETING];
    }
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('wa_meta_ai_history', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || isTyping) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const responseText = await generateAiResponse(query, messages);
      const aiMsg = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: 'ai',
          text: "I'm having a little trouble connecting right now. Please try asking again!",
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleSpeak = (id, text) => {
    if (!('speechSynthesis' in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_-]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear your Meta AI conversation history?')) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setMessages([INITIAL_GREETING]);
      localStorage.removeItem('wa_meta_ai_history');
    }
  };

  // Safe formatting helper for bold, code blocks, bullet points
  const renderFormattedText = (rawText) => {
    if (!rawText) return null;

    // Code block check
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: rawText.slice(lastIndex, match.index) });
      }
      parts.push({ type: 'code', lang: match[1] || 'code', content: match[2].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < rawText.length) {
      parts.push({ type: 'text', content: rawText.slice(lastIndex) });
    }

    return parts.map((part, pIdx) => {
      if (part.type === 'code') {
        return (
          <div className="meta-ai-code-block" key={pIdx}>
            <div className="meta-ai-code-header">
              <span>{part.lang}</span>
              <button
                type="button"
                className="meta-ai-code-copy"
                onClick={() => navigator.clipboard.writeText(part.content)}
              >
                <i className="fa-regular fa-copy"></i> Copy code
              </button>
            </div>
            <pre><code>{part.content}</code></pre>
          </div>
        );
      }

      // Inline text formatting (bold **text**, newlines)
      const lines = part.content.split('\n');
      return (
        <div key={pIdx} className="meta-ai-text-chunk">
          {lines.map((line, lIdx) => {
            const formattedLine = line.split(/(\*\*.*?\*\*)/g).map((segment, sIdx) => {
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={sIdx}>{segment.slice(2, -2)}</strong>;
              }
              return segment;
            });

            return (
              <p key={lIdx} style={{ margin: line ? '4px 0' : '8px 0' }}>
                {formattedLine}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="meta-ai-overlay" onClick={onClose}>
      <div className="meta-ai-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="meta-ai-header">
          <div className="meta-ai-header-left">
            <div className="meta-ai-header-logo-wrap">
              <img src="/meta_ai_logo.png" alt="Meta AI" className="meta-ai-header-logo" />
            </div>
            <div className="meta-ai-header-titles">
              <div className="meta-ai-title-row">
                <span className="meta-ai-name">Meta AI</span>
                <span className="meta-ai-verified-badge" title="Verified Assistant">
                  <i className="fa-solid fa-circle-check"></i>
                </span>
                <span className="meta-ai-tag">AI with Llama</span>
              </div>
              <span className="meta-ai-status">Always active • Ask anything</span>
            </div>
          </div>

          <div className="meta-ai-header-actions">
            <button
              type="button"
              className="meta-ai-action-btn"
              title="Clear Conversation"
              onClick={handleClearHistory}
            >
              <i className="fa-solid fa-arrow-rotate-right"></i>
            </button>
            <button
              type="button"
              className="meta-ai-action-btn close"
              title="Close Meta AI"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Conversation Body */}
        <div className="meta-ai-body">
          {messages.length <= 1 && (
            <div className="meta-ai-welcome-card">
              <div className="meta-ai-big-logo-ring">
                <img src="/meta_ai_logo.png" alt="Meta AI" className="meta-ai-big-logo" />
                <div className="meta-ai-glow-halo"></div>
              </div>
              <h3>Explore with Meta AI</h3>
              <p>Ask questions, brainstorm ideas, draft messages, or translate languages instantly.</p>

              <div className="meta-ai-prompts-grid">
                {SUGGESTED_PROMPTS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="meta-ai-prompt-chip"
                    onClick={() => handleSend(item.text)}
                  >
                    <span className="chip-icon">{item.icon}</span>
                    <span className="chip-text">{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isAi = msg.sender === 'ai';
            return (
              <div key={msg.id} className={`meta-ai-message-row ${isAi ? 'is-ai' : 'is-user'}`}>
                {isAi && (
                  <div className="meta-ai-msg-avatar">
                    <img src="/meta_ai_logo.png" alt="AI" />
                  </div>
                )}
                <div className="meta-ai-bubble-wrap">
                  <div className={`meta-ai-bubble ${isAi ? 'ai-bubble' : 'user-bubble'}`}>
                    {isAi ? renderFormattedText(msg.text) : <p>{msg.text}</p>}
                  </div>

                  {isAi && msg.id !== 'welcome' && (
                    <div className="meta-ai-msg-footer">
                      <button
                        type="button"
                        className={`meta-ai-footer-btn ${copiedId === msg.id ? 'copied' : ''}`}
                        onClick={() => handleCopy(msg.id, msg.text)}
                        title="Copy to clipboard"
                      >
                        <i className={`fa-regular ${copiedId === msg.id ? 'fa-check' : 'fa-copy'}`}></i>
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {'speechSynthesis' in window && (
                        <button
                          type="button"
                          className={`meta-ai-footer-btn ${speakingId === msg.id ? 'speaking' : ''}`}
                          onClick={() => handleSpeak(msg.id, msg.text)}
                          title={speakingId === msg.id ? 'Stop reading' : 'Listen'}
                        >
                          <i className={`fa-solid ${speakingId === msg.id ? 'fa-volume-xmark' : 'fa-volume-high'}`}></i>
                          <span>{speakingId === msg.id ? 'Stop' : 'Listen'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="meta-ai-message-row is-ai typing-row">
              <div className="meta-ai-msg-avatar">
                <img src="/meta_ai_logo.png" alt="AI" className="pulsing" />
              </div>
              <div className="meta-ai-bubble ai-bubble typing-bubble">
                <div className="meta-ai-dots">
                  <span className="dot d1"></span>
                  <span className="dot d2"></span>
                  <span className="dot d3"></span>
                </div>
                <span className="meta-ai-thinking-text">Meta AI is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="meta-ai-input-bar"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="meta-ai-input"
            placeholder="Ask Meta AI anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="meta-ai-send-btn"
            disabled={!input.trim() || isTyping}
            title="Send to Meta AI"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </form>

      </div>
    </div>
  );
}
