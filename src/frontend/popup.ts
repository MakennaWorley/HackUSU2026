import { DEFAULT_STATE, type FocusState } from '../backend/state';

function fmtRemaining(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${String(r).padStart(2, '0')}`;
}

async function loadState(): Promise<FocusState> {
	const state = (await chrome.storage.local.get(DEFAULT_STATE)) as Partial<FocusState>;
	return { ...DEFAULT_STATE, ...state };
}

function getEl<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing element #${id}`);
	return el as T;
}

async function render(): Promise<void> {
	const state = await loadState();

	const blacklistEl = getEl<HTMLInputElement>('blacklist');
	const btn = getEl<HTMLButtonElement>('toggle');
	const status = getEl<HTMLElement>('status');

	blacklistEl.value = state.blacklist.join(', ');

	if (state.focusOn && state.endsAt !== null) {
		btn.textContent = 'Stop Focus';
		status.textContent = `Focus ON — remaining ${fmtRemaining(state.endsAt - Date.now())}`;
	} else if (state.focusOn) {
		btn.textContent = 'Stop Focus';
		status.textContent = 'Focus ON';
	} else {
		btn.textContent = 'Start Focus';
		status.textContent = 'Focus OFF';
	}
}

getEl<HTMLButtonElement>('toggle').addEventListener('click', async () => {
	const state = await loadState();

	const blacklistRaw = getEl<HTMLInputElement>('blacklist').value.trim();
	const blacklist = blacklistRaw
		? blacklistRaw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
		: [];

	if (!state.focusOn) {
		const minutesStr = getEl<HTMLInputElement>('minutes').value || '25';
		const minutes = Math.max(1, parseInt(minutesStr, 10) || 25);
		const endsAt = Date.now() + minutes * 60 * 1000;

		await chrome.storage.local.set({ focusOn: true, endsAt, blacklist });

		// set alarm for end
		await chrome.alarms.clear('focusEnds');
		chrome.alarms.create('focusEnds', { when: endsAt });
	} else {
		await chrome.storage.local.set({ focusOn: false, endsAt: null, blacklist });
		await chrome.alarms.clear('focusEnds');
	}

	await render();
});

// update countdown every second when popup open
void render();
setInterval(() => {
	void render();
}, 1000);
