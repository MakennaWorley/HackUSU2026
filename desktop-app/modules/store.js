const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_APP_CATEGORIES = [
	{
		id: 'productivity_approved',
		name: 'Productivity (Approved)',
		description: 'Work and development tools',
		apps: ['code', 'winword', 'excel', 'powerpnt', 'onenote', 'notepad++', 'notepad', 'devenv', 'windowsterminal', 'cmd', 'powershell'],
		type: 'approved'
	},
	{
		id: 'gaming_blocked',
		name: 'Gaming',
		description: 'Game launchers and clients',
		apps: ['steam', 'steamwebhelper', 'epicgameslauncher', 'riotclientservices', 'battle.net'],
		type: 'blocked'
	},
	{
		id: 'social_blocked',
		name: 'Social & Chat',
		description: 'Messaging and social apps',
		apps: ['discord', 'telegram', 'slack', 'signal'],
		type: 'blocked'
	},
	{
		id: 'entertainment_blocked',
		name: 'Entertainment',
		description: 'Media and streaming apps',
		apps: ['spotify', 'vlc', 'itunes'],
		type: 'blocked'
	}
];

// Browser processes are always approved – website enforcement is handled by the browser extension
const BROWSER_PROCESSES = ['chrome', 'msedge', 'firefox', 'opera', 'brave', 'vivaldi', 'iexplore', 'safari', 'chromium', 'waterfox'];

class Store extends EventEmitter {
	constructor(userDataPath) {
		super();
		this.filePath = path.join(userDataPath, 'griff-settings.json');
		this.data = this._load();
	}

	_defaults() {
		return {
			appCategories: DEFAULT_APP_CATEGORIES,
			selectedCategories: ['gaming_blocked', 'social_blocked', 'entertainment_blocked'],
			customCategories: [],
			customApps: [],
			mode: 'blocklist',
			focusDuration: 25,
			focusActive: false,
			focusEnd: 0
		};
	}

	_load() {
		try {
			if (fs.existsSync(this.filePath)) {
				const raw = fs.readFileSync(this.filePath, 'utf-8');
				const saved = JSON.parse(raw);
				return { ...this._defaults(), ...saved };
			}
		} catch {
			// corrupted file, use defaults
		}
		return this._defaults();
	}

	save() {
		try {
			const dir = path.dirname(this.filePath);
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}
			fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, '\t'), 'utf-8');
		} catch (err) {
			console.error('Store save error:', err);
		}
	}

	get(key) {
		return this.data[key];
	}

	set(key, value) {
		this.data[key] = value;
		this.save();
		this.emit('changed', key, value);
	}

	getAll() {
		return { ...this.data };
	}

	update(partial) {
		Object.assign(this.data, partial);
		this.save();
		this.emit('changed', null, partial);
	}

	// Build resolved lists from categories + custom apps
	_buildResolvedList(type) {
		const apps = new Set();
		const allCategories = [...(this.data.appCategories || []), ...(this.data.customCategories || [])];
		const selected = this.data.selectedCategories || [];

		for (const catId of selected) {
			const cat = allCategories.find((c) => c.id === catId);
			if (cat && cat.type === type) {
				for (const app of cat.apps) {
					apps.add(app.toLowerCase());
				}
			}
		}

		// Custom apps are always treated as blocked in blocklist mode, approved in allowlist mode
		if (type === 'blocked' && this.data.mode === 'blocklist') {
			for (const app of (this.data.customApps || [])) {
				apps.add(app.toLowerCase());
			}
		} else if (type === 'approved' && this.data.mode === 'allowlist') {
			for (const app of (this.data.customApps || [])) {
				apps.add(app.toLowerCase());
			}
		}

		return Array.from(apps);
	}

	isAppApproved(processName) {
		if (!processName) return true;
		const name = processName.toLowerCase().replace(/\.exe$/, '');

		// Browsers are always approved – the extension handles website blocking
		if (BROWSER_PROCESSES.some((b) => name.includes(b))) return true;

		if (this.data.mode === 'blocklist') {
			// Everything is approved UNLESS it matches a blocked entry
			const blocked = this._buildResolvedList('blocked');
			return !blocked.some((entry) => name.includes(entry) || entry.includes(name));
		}
		// allowlist mode – only approved entries are allowed
		const approved = this._buildResolvedList('approved');
		return approved.some((entry) => name.includes(entry) || entry.includes(name));
	}

	isBrowser(processName) {
		if (!processName) return false;
		const name = processName.toLowerCase().replace(/\.exe$/, '');
		return BROWSER_PROCESSES.some((b) => name.includes(b));
	}

	getAllCategories() {
		return [...(this.data.appCategories || []), ...(this.data.customCategories || [])];
	}
}

module.exports = { Store, DEFAULT_APP_CATEGORIES };
