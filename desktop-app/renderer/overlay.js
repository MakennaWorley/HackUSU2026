const ANGRY_MESSAGES = [
	'Hey there—remember what you meant to focus on.',
	'A gentle reminder: your task is waiting.',
	"Let's return to your work—you've got this.",
	"This doesn't seem part of your current plan.",
	'I believe you intended to stay on task.',
	'The Griff suggests returning to your objective.',
	"I'm keeping watch—shall we head back?",
	'SQUAWK! A small detour—time to refocus.',
	'Just checking in—ready to continue?',
	"Focus mode is active—let's honor that commitment.",
	'The Griff encourages you to continue your quest.'
];

const GriffEl = document.getElementById('Griff-container');
const GriffImg = document.getElementById('Griff-img');
const speechBubble = document.getElementById('Griff-speech-bubble');

let isAngry = false;
let angryMessageInterval = null;
let _angryStartTime = 0;
let rageTimeout = null;

// ─── Mouse passthrough toggle ───
// When cursor is over the Griff image, allow clicks
GriffImg.addEventListener('mouseenter', () => {
	window.griff.setIgnoreMouse(false);
});
GriffImg.addEventListener('mouseleave', () => {
	window.griff.setIgnoreMouse(true);
});

// ─── Focus lifecycle ───
window.griff.onFocusStarted(() => {
	GriffEl.classList.remove('Griff-hidden');
	goCalm();
});

window.griff.onFocusStopped(() => {
	goCalm();
	GriffEl.classList.add('Griff-hidden');
});

// ─── App status from window detector ───
window.griff.onAppStatus((data) => {
	if (data.isBrowser) {
		// Browser is focused – the extension handles website enforcement
		goCalm();
		GriffEl.classList.add('Griff-hidden');
	} else if (data.approved) {
		GriffEl.classList.remove('Griff-hidden');
		if (isAngry) goCalm();
	} else {
		GriffEl.classList.remove('Griff-hidden');
		if (!isAngry) goAngry(data.processName);
	}
});

// ─── State transitions ───
function goAngry(appName) {
	isAngry = true;
	_angryStartTime = Date.now();

	GriffEl.classList.add('Griff-angry');
	GriffEl.classList.remove('Griff-rage');

	showRandomMessage(appName);

	// Rotate messages every 5 seconds while angry
	if (angryMessageInterval) clearInterval(angryMessageInterval);
	angryMessageInterval = setInterval(() => showRandomMessage(appName), 5000);

	// Escalate to rage after 7 seconds on a blocked app
	if (rageTimeout) clearTimeout(rageTimeout);
	rageTimeout = setTimeout(() => {
		if (isAngry) {
			GriffEl.classList.add('Griff-rage');
		}
	}, 7000);
}

function goCalm() {
	isAngry = false;
	GriffEl.classList.remove('Griff-angry', 'Griff-rage');
	speechBubble.classList.add('Griff-hidden');

	if (angryMessageInterval) {
		clearInterval(angryMessageInterval);
		angryMessageInterval = null;
	}
	if (rageTimeout) {
		clearTimeout(rageTimeout);
		rageTimeout = null;
	}
}

function showRandomMessage(appName) {
	let msg = ANGRY_MESSAGES[Math.floor(Math.random() * ANGRY_MESSAGES.length)];
	// Occasionally personalize with the app name
	if (appName && Math.random() > 0.5) {
		msg = `I see ${appName} is open\u2026 GET BACK TO WORK!`;
	}
	speechBubble.textContent = msg;
	speechBubble.classList.remove('Griff-hidden');
}
