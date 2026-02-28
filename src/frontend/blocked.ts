import { DEFAULT_STATE, type FocusState } from '../shared/state';

// format milliseconds → m:ss
function fmt(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const m = Math.floor(s / 60);
	const r = s % 60;
	return `${m}:${String(r).padStart(2, '0')}`;
}

async function render(): Promise<void> {
	const state = (await chrome.storage.local.get(DEFAULT_STATE)) as FocusState;

	const el = document.getElementById('remaining') as HTMLElement | null;
	if (!el) return;

	if (state.focusOn && state.endsAt !== null) {
		el.textContent = `Remaining: ${fmt(state.endsAt - Date.now())}`;
	} else {
		el.textContent = 'Focus is off.';
	}
}

const endButton = document.getElementById('end') as HTMLButtonElement | null;

endButton?.addEventListener('click', async () => {
	await chrome.storage.local.set({
		focusOn: false,
		endsAt: null
	});

	// go somewhere neutral
	window.location.href = 'https://www.google.com';
});

void render();
setInterval(() => {
	void render();
}, 1000);
