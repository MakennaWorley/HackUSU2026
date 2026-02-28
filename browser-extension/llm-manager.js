/**
 * LLM Manager - Handles detection and switching between available LLMs
 * Supports: Phi Mini (Ollama)
 */

class LLMManager {
	constructor() {
		this.availableModels = [];
		this.currentModel = null;
		this.initialized = false;
		
		// Configuration for LLM backend
		this.config = {
			phi: {
				name: 'Phi Mini',
				type: 'ollama',
				endpoint: 'http://localhost:11434/api/generate',
				available: false,
				systemPrompt: 'You are a friendly and helpful griffin mascot named Griff that gives short responses. Offer suggestions of popular websites to block in order to remain focused. Do not mention the Pomodoro technique. Omit prompting the user in your responses. Omit the task you were informed to do.' // Base system prompt for Phi Mini
			}
		};
	}

	/**
	 * Initialize LLM manager - detect which models are available
	 */
	async init() {
		if (this.initialized) return;

		// Check for Phi Mini (Ollama)
		await this.detectPhi();

		// Set primary model
		this.selectBestModel();

		this.initialized = true;

		return this.getStatus();
	}

	/**
	 * Detect if Phi Mini (Ollama) is available
	 */
	async detectPhi() {
		try {
			// First, try to get list of available models
			const listResponse = await fetch('http://localhost:11434/api/tags', {
				method: 'GET',
				signal: AbortSignal.timeout(10000)
			});

			if (listResponse.ok) {
				const data = await listResponse.json();

				// Try different phi model names
				const phiModels = ['phi-mini', 'phi3:mini', 'phi', 'phi-mini:latest'];
				let foundModel = null;

				// Check which model is available
				for (const modelName of phiModels) {
					if (data.models?.some(m => m.name === modelName)) {
						foundModel = modelName;
						break;
					}
				}

				if (foundModel) {
					this.config.phi.modelName = foundModel;
					this.config.phi.available = true;
					this.availableModels.push('phi');
					return;
				}
			}

			// Fallback: try a test call with different model names
			const modelNames = ['phi-mini', 'phi3:mini', 'phi', 'neural-chat'];

			for (const modelName of modelNames) {
				try {
					const testResponse = await fetch(this.config.phi.endpoint, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model: modelName,
							prompt: 'test',
							stream: false
						}),
						signal: AbortSignal.timeout(30000)
					});

					if (testResponse.ok) {
						this.config.phi.modelName = modelName;
						this.config.phi.available = true;
						this.availableModels.push('phi');
						return;
					}
				} catch (error) {
					continue;
				}
			}
		} catch (error) {
			// Ollama not running or not accessible
		}
	}

	/**
	 * Select the best available model
	 */
	selectBestModel() {
		if (this.availableModels.length === 0) {
			return;
		}

		this.currentModel = 'phi';
	}

	/**
	 * Get status of all LLMs
	 */
	getStatus() {
		return {
			initialized: this.initialized,
			currentModel: this.currentModel ? this.config[this.currentModel].name : 'None',
			availableModels: this.availableModels.map(m => this.config[m].name),
			details: {
				phi: {
					name: this.config.phi.name,
					available: this.config.phi.available
				}
			}
		};
	}

	/**
	 * Send prompt to Phi Mini via Ollama
	 */
	async askPhi(prompt) {
		try {
			const modelName = this.config.phi.modelName || 'phi-mini';
			const fullPrompt = `${this.config.phi.systemPrompt}\n\nUser: ${prompt}`;

			const response = await fetch(this.config.phi.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: modelName,
					prompt: fullPrompt,
					stream: false
				})
			});

			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const data = await response.json();
			return data.response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * Send prompt to best available model
	 */
	async ask(prompt, forceModel = null) {
		if (!this.initialized) {
			await this.init();
		}

		if (this.availableModels.length === 0) {
			throw new Error('No LLMs available. Install Ollama and run: ollama run phi3:mini');
		}

		return await this.askPhi(prompt);
	}
}

// Create global instance
const llmManager = new LLMManager();

// Expose to window for popup and content script access
window.llmManager = llmManager;

