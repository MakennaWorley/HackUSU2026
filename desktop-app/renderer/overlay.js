const ANGRY_MESSAGES = [
	"Hey! You're supposed to be focusing!",
	'You suck at time management!',
	'Get back to work, human!',
	"This isn't part of the plan!",
	'Procrastination detected! Deploying claws in 10\u2026',
	'Do I look happy? GET BACK TO WORK!',
	"I'm watching you\u2026 close that app!",
	'SQUAWK! Wrong app! Switch back NOW!',
	"You have 10 seconds. Don't test me.",
	'Focus mode is ON. That app is OFF-LIMITS!',
	'The griffin commands you: GET BACK ON TASK!',
	'Is that Steam I see?! Back to work!',
	"Discord can wait. Your deadline can't!"
];

const griffinEl = document.getElementById('griffin-container');
const griffinImg = document.getElementById('griffin-img');
const speechBubble = document.getElementById('griffin-speech-bubble');

let isAngry = false;
let angryMessageInterval = null;
let angryStartTime = 0;
let rageTimeout = null;

// ─── Mouse passthrough toggle ───
// When cursor is over the griffin image, allow clicks
griffinImg.addEventListener('mouseenter', () => {
	window.griff.setIgnoreMouse(false);
});
griffinImg.addEventListener('mouseleave', () => {
	window.griff.setIgnoreMouse(true);
});

// ─── Focus lifecycle ───
window.griff.onFocusStarted(() => {
	griffinEl.classList.remove('griffin-hidden');
	goCalm();
});

window.griff.onFocusStopped(() => {
	goCalm();
	griffinEl.classList.add('griffin-hidden');
});

// ─── App status from window detector ───
window.griff.onAppStatus((data) => {
	if (data.isBrowser) {
		// Browser is focused – the extension handles website enforcement
		goCalm();
		griffinEl.classList.add('griffin-hidden');
	} else if (data.approved) {
		griffinEl.classList.remove('griffin-hidden');
		if (isAngry) goCalm();
	} else {
		griffinEl.classList.remove('griffin-hidden');
		if (!isAngry) goAngry(data.processName);
	}
});

// ─── State transitions ───
function goAngry(appName) {
	isAngry = true;
	angryStartTime = Date.now();

	griffinEl.classList.add('griffin-angry');
	griffinEl.classList.remove('griffin-rage');

	showRandomMessage(appName);

	// Rotate messages every 5 seconds while angry
	if (angryMessageInterval) clearInterval(angryMessageInterval);
	angryMessageInterval = setInterval(() => showRandomMessage(appName), 5000);

	// Escalate to rage after 7 seconds on a blocked app
	if (rageTimeout) clearTimeout(rageTimeout);
	rageTimeout = setTimeout(() => {
		if (isAngry) {
			griffinEl.classList.add('griffin-rage');
		}
	}, 7000);
}

function goCalm() {
	isAngry = false;
	griffinEl.classList.remove('griffin-angry', 'griffin-rage');
	speechBubble.classList.add('griffin-hidden');

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
	speechBubble.classList.remove('griffin-hidden');
}
