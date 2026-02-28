(() => {
	// Prevent double-injection
	if (window.__griffinFocusInjected) return;
	window.__griffinFocusInjected = true;

	const GRIFFIN_IMG = chrome.runtime.getURL('assets/griff.png');

	// ─── Warning messages the griffin can say ───
	const ANGRY_MESSAGES = [
		'Hey there—remember what you meant to focus on.',
		'A gentle reminder: your task is waiting.',
		"Let's return to your work—you've got this.",
		"This doesn't seem part of your current plan.",
		'I believe you intended to stay on task.',
		'The griffin suggests returning to your objective.',
		"I'm keeping watch—shall we head back?",
		'SQUAWK! A small detour—time to refocus.',
		'Just checking in—ready to continue?',
		"Focus mode is active—let's honor that commitment.",
		'The griffin encourages you to continue your quest.'
	];

	let griffinEl = null;
	let speechBubble = null;
	let countdownEl = null;
	let warningTimeout = null;
	let countdownInterval = null;
	let isBlocked = false;
	let isDragging = false;
	let wanderInterval = null;
	let desktopAppActive = false;
	const dragOffset = { x: 0, y: 0 };
	let currentX = 0;
	let currentY = 0;
	let targetY = 0;
	let dragCount = 0;
	let dragResetTimeout = null;

	// ─── Create the floating griffin ───
	function createGriffin() {
		if (griffinEl) return;
		// Ensure body exists before creating griffin
		if (!document.body) {
			// Wait for body to be available
			if (document.readyState === 'loading') {
				document.addEventListener('DOMContentLoaded', createGriffin, { once: true });
			}
			return;
		}

		griffinEl = document.createElement('div');
		griffinEl.id = 'griffin-focus-container';

		const img = document.createElement('img');
		img.src = GRIFFIN_IMG;
		img.id = 'griffin-focus-img';
		img.draggable = false;

		speechBubble = document.createElement('div');
		speechBubble.id = 'griffin-speech-bubble';
		speechBubble.classList.add('griffin-hidden');

		griffinEl.appendChild(speechBubble);
		griffinEl.appendChild(img);
		document.body.appendChild(griffinEl);

		// Position at bottom and start wandering
		griffinEl.style.position = 'fixed';
		griffinEl.style.bottom = '20px';
		griffinEl.style.left = '50px';
		currentX = 50;
		currentY = window.innerHeight - 100;
		targetY = window.innerHeight - 100;
		startWandering();

		// Make draggable
		griffinEl.addEventListener('mousedown', startDrag);
		document.addEventListener('mousemove', onDrag);
		document.addEventListener('mouseup', endDrag);
	}

	function removeGriffin() {
		clearTimers();
		stopWandering();
		if (griffinEl) {
			griffinEl.remove();
			griffinEl = null;
			speechBubble = null;
			countdownEl = null;
		}
		isBlocked = false;
	}

	// ─── Drag logic ───
	function startDrag(e) {
		isDragging = true;
		stopWandering();
		const rect = griffinEl.getBoundingClientRect();
		dragOffset.x = e.clientX - rect.left;
		dragOffset.y = e.clientY - rect.top;
		griffinEl.style.transition = 'none';

		// Track drag count for detecting harassment
		dragCount++;
		if (dragCount === 1) {
			// Start counting window – reset after 5 seconds of no drags
			if (dragResetTimeout) clearTimeout(dragResetTimeout);
			dragResetTimeout = setTimeout(() => {
				dragCount = 0;
			}, 8000);
		}
		// If dragged 4+ times in 8 seconds, go angry
		if (dragCount >= 3 && !isBlocked) {
			dragCount = 0;
			goAngryNoClose();
		}
	}
	function onDrag(e) {
		if (!isDragging || !griffinEl) return;
		const newX = e.clientX - dragOffset.x;
		const newY = e.clientY - dragOffset.y;
		const minX = 0;
		const maxX = window.innerWidth - 80;
		const maxY = window.innerHeight - 50;
		currentX = Math.max(minX, Math.min(newX, maxX));
		currentY = newY;
		griffinEl.style.left = currentX + 'px';
		griffinEl.style.top = currentY + 'px';
		griffinEl.style.right = 'auto';
		griffinEl.style.bottom = 'auto';
	}
	function endDrag() {
		isDragging = false;
		if (griffinEl) {
			griffinEl.style.transition = 'top 1.6s ease-out, left 0.15s ease-out';
			if (currentY < window.innerHeight - 150) {
				targetY = window.innerHeight - 100;
			} else {
				targetY = window.innerHeight - 100;
			}
			griffinEl.style.top = targetY + 'px';
			currentY = targetY;
		}
		setTimeout(startWandering, 600);
	}

	// ─── Angry mode ───
	function goAngry() {
		if (!griffinEl) return;
		isBlocked = true;

		griffinEl.classList.add('griffin-angry');

		// Show speech bubble with random message
		const msg = ANGRY_MESSAGES[Math.floor(Math.random() * ANGRY_MESSAGES.length)];
		speechBubble.textContent = msg;
		speechBubble.classList.remove('griffin-hidden');

		// Start 10-second countdown timer
		let seconds = 10;

		countdownInterval = setInterval(() => {
			seconds--;
			if (seconds <= 0) {
				clearTimers();
				closeTab();
			} else {
				// Intensify shaking at lower counts
				if (seconds <= 3) {
					griffinEl.classList.add('griffin-rage');
				}
			}
		}, 1000);
	}

	function goAngryNoClose() {
		if (!griffinEl) return;

		griffinEl.classList.add('griffin-angry');

		// Show speech bubble with random message
		const msg = ANGRY_MESSAGES[Math.floor((Math.random() * ANGRY_MESSAGES.length) / 2)];
		speechBubble.textContent = msg;
		speechBubble.classList.remove('griffin-hidden');

		// Shake for 2 seconds then calm down
		griffinEl.classList.add('griffin-rage');
		warningTimeout = setTimeout(() => {
			goCalm();
		}, 2000);
	}

	function goCalm() {
		if (!griffinEl) return;
		isBlocked = false;
		clearTimers();

		griffinEl.classList.remove('griffin-angry', 'griffin-rage');
		speechBubble.classList.add('griffin-hidden');
	}

	function clearTimers() {
		if (warningTimeout) {
			clearTimeout(warningTimeout);
			warningTimeout = null;
		}
		if (countdownInterval) {
			clearInterval(countdownInterval);
			countdownInterval = null;
		}
		if (dragResetTimeout) {
			clearTimeout(dragResetTimeout);
			dragResetTimeout = null;
		}
	}

	// ─── Autonomous wandering ───
	function startWandering() {
		if (wanderInterval || isDragging) return;
		wanderInterval = setInterval(() => {
			if (isDragging || !griffinEl) return;
			const moveAmount = (Math.random() - 0.5) * 80;
			const newX = currentX + moveAmount;
			const minX = 0;
			const maxX = window.innerWidth - 80;
			currentX = Math.max(minX, Math.min(newX, maxX));
			griffinEl.style.transition = 'left 0.8s ease-in-out';
			griffinEl.style.left = currentX + 'px';
		}, 2000);
	}

	function stopWandering() {
		if (wanderInterval) {
			clearInterval(wanderInterval);
			wanderInterval = null;
		}
	}

	function closeTab() {
		// Dramatic exit animation then ask background to close
		if (griffinEl) {
			griffinEl.classList.add('griffin-swipe');
		}
		setTimeout(() => {
			chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
		}, 600);
	}

	// ─── Check if this page is blocked ───
	let checkInProgress = false;
	function checkCurrentSite() {
		if (checkInProgress) return;
		checkInProgress = true;

		const hostname = window.location.hostname;
		chrome.runtime.sendMessage({ type: 'CHECK_SITE', hostname }, (response) => {
			checkInProgress = false;
			if (chrome.runtime.lastError) return; // extension context invalidated
			if (!response) return;

			if (response.focusActive) {
				if (response.blocked) {
					// Always enforce blocked sites, even when desktop app is active
					createGriffin();
					if (!isBlocked) {
						goAngry();
					}
				} else if (desktopAppActive) {
					// Desktop overlay handles the calm/idle griffin
					removeGriffin();
				} else {
					createGriffin();
					if (isBlocked) {
						goCalm();
					}
				}
			} else {
				removeGriffin();
			}
		});
	}

	// ─── Listen for messages from background ───
	chrome.runtime.onMessage.addListener((msg) => {
		if (msg.type === 'FOCUS_STARTED') {
			checkCurrentSite();
		}
		if (msg.type === 'FOCUS_ENDED') {
			removeGriffin();
		}
		if (msg.type === 'DESKTOP_APP_STATE') {
			desktopAppActive = msg.state.running && msg.state.focusActive;
			// Re-check: keeps angry griffin on blocked sites, removes calm griffin
			checkCurrentSite();
		}
	});

	// ─── Initial check ───
	// Wait for DOM to be ready before checking
	function init() {
		checkCurrentSite();

		// Re-check on visibility change (e.g. switching tabs)
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') {
				checkCurrentSite();
			}
		});
	}

	// Start checking when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		// DOM is already ready
		init();
	}
})();
