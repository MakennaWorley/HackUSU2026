# LLM Integration Guide

This extension uses Ollama with Phi Mini for local LLM inference.

## Supported Models

### **Phi Mini** (Ollama)
- ✅ Runs locally on your machine
- Requires [Ollama](https://ollama.ai) installation
- Start with: `ollama run phi3:mini`
- Runs on `http://localhost:11434`
- Models auto-detected: phi-mini, phi3:mini, phi, neural-chat

## Setup Instructions

1. Install [Ollama](https://ollama.ai)
2. Start Ollama: `ollama run phi3:mini`
3. Keep Ollama running in the background
4. The extension will automatically detect available models

## How It Works

The extension automatically:
1. **Detects** Ollama connection and available models
2. **Selects** the first available Phi model
3. **Initializes** asynchronously without blocking the UI

## Usage in Code

### Simple Usage
```javascript
// Get AI response using Phi Mini
const response = await getAIResponse("Give me a focus tip");
console.log(response);
```

### Check LLM Status
```javascript
// Get status of available models
const status = await getAIStatus();
console.log(status);
// Output: {
//   initialized: true,
//   currentModel: "Phi Mini",
//   availableModels: ["Phi Mini"],
//   details: { phi: { name: "Phi Mini", available: true } }
// }
```

## Integration Examples

### Use in Griffin's Messages
```javascript
// When griffin appears, get an encouraging message
async function greetUser() {
	const greeting = await getAIResponse("Say a brief encouraging message about staying focused");
	if (greeting && speechBubble) {
		speechBubble.textContent = greeting;
		speechBubble.classList.remove('griffin-hidden');
	}
}
```

### Use When User Gets Angry
```javascript
// Generate motivational warning when angry griffin activates
async function goAngry() {
	const warning = await getAIResponse("Give a short warning to stop the user from visiting distracting websites");
	const msg = warning || ANGRY_MESSAGES[Math.floor(Math.random() * ANGRY_MESSAGES.length)];
	speechBubble.textContent = msg;
	// ... rest of anger logic
}
```

### Add to Popup for Debugging
```javascript
// In popup.js - show available LLMs
chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
	const [tab] = tabs;
	chrome.tabs.sendMessage(tab.id, {type: 'GET_AI_STATUS'}, (response) => {
		console.log('Available LLMs:', response.availableModels);
	});
});
```

## Troubleshooting

### "No LLMs available"
- [ ] Ensure Ollama is running
- [ ] Try starting Ollama: `ollama run phi3:mini`
- [ ] Check if accessible: `curl http://localhost:11434/api/tags`

### Phi Mini not detected
- [ ] Ensure Ollama is running: `ollama list`
- [ ] Check Ollama is accessible: `curl http://localhost:11434/api/tags`
- [ ] Model might be downloading - check Ollama terminal for progress

### Slow responses
- [ ] First response takes longer (model initialization)
- [ ] Phi Mini is CPU-intensive - close other apps
- [ ] Check system resources

## Browser Compatibility

All modern browsers work with Ollama-based Phi Mini:
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Any browser that can reach localhost:11434

## Files Modified

- `llm-manager.js` - Core LLM detection and management
- `content.js` - Chat interface and griffin AI
- `manifest.json` - Extension configuration

Removed:
- ❌ `ai-injected.js` (Gemini Nano support)
- ❌ `chat.html`, `chat.css`, `chat-ui.js` (old chat files)

## API Reference

### llmManager.init()
Detects Ollama and available models, initializes the manager.

### llmManager.ask(prompt)
- `prompt` (string): The prompt to send to Phi Mini
- Returns: Promise<string> with the AI response

### llmManager.getStatus()
Returns the current LLM status and available models.

### getAIResponse(prompt)
Helper function that gets a response using Phi Mini directly.

### getAIStatus()
Helper function that gets the current LLM status.
