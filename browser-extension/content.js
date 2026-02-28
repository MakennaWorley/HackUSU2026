// ─── Griffin Focus Mode – Content Script ───

(() => {
  // Prevent double-injection
  if (window.__griffinFocusInjected) return;
  window.__griffinFocusInjected = true;

  const GRIFFIN_IMG = chrome.runtime.getURL("assets/griff.png");

  // ─── Warning messages the angry griffin can say ───
  const ANGRY_MESSAGES = [
    "Hey! You're supposed to be focusing!",
    "Get back to work, human!",
    "This isn't part of the plan!",
    "I'm watching you… get off this site!",
    "SQUAWK! Wrong tab! Leave NOW!",
    "You have 10 seconds. Don't test me.",
    "Focus mode is ON. This site is OFF-LIMITS!",
    "Do I look happy? GET BACK TO WORK!",
    "The griffin commands you: CLOSE THIS TAB!",
    "Procrastination detected! Deploying claws in 10…"
  ];

  let griffinEl = null;
  let speechBubble = null;
  let countdownEl = null;
  let warningTimeout = null;
  let countdownInterval = null;
  let isBlocked = false;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // ─── Create the floating griffin ───
  function createGriffin() {
    if (griffinEl) return;

    griffinEl = document.createElement("div");
    griffinEl.id = "griffin-focus-container";

    const img = document.createElement("img");
    img.src = GRIFFIN_IMG;
    img.id = "griffin-focus-img";
    img.draggable = false;

    speechBubble = document.createElement("div");
    speechBubble.id = "griffin-speech-bubble";
    speechBubble.classList.add("griffin-hidden");

    countdownEl = document.createElement("div");
    countdownEl.id = "griffin-countdown";
    countdownEl.classList.add("griffin-hidden");

    griffinEl.appendChild(speechBubble);
    griffinEl.appendChild(img);
    griffinEl.appendChild(countdownEl);
    document.body.appendChild(griffinEl);

    // Make draggable
    griffinEl.addEventListener("mousedown", startDrag);
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
  }

  function removeGriffin() {
    clearTimers();
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
    const rect = griffinEl.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    griffinEl.style.transition = "none";
  }
  function onDrag(e) {
    if (!isDragging || !griffinEl) return;
    griffinEl.style.left = (e.clientX - dragOffset.x) + "px";
    griffinEl.style.top  = (e.clientY - dragOffset.y) + "px";
    griffinEl.style.right = "auto";
    griffinEl.style.bottom = "auto";
  }
  function endDrag() {
    isDragging = false;
    if (griffinEl) griffinEl.style.transition = "";
  }

  // ─── Angry mode ───
  function goAngry() {
    if (!griffinEl) return;
    isBlocked = true;

    griffinEl.classList.add("griffin-angry");

    // Show speech bubble with random message
    const msg = ANGRY_MESSAGES[Math.floor(Math.random() * ANGRY_MESSAGES.length)];
    speechBubble.textContent = msg;
    speechBubble.classList.remove("griffin-hidden");

    // Start 10-second countdown
    let seconds = 10;
    countdownEl.textContent = seconds;
    countdownEl.classList.remove("griffin-hidden");

    countdownInterval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearTimers();
        closeTab();
      } else {
        countdownEl.textContent = seconds;
        // Intensify shaking at lower counts
        if (seconds <= 3) {
          griffinEl.classList.add("griffin-rage");
        }
      }
    }, 1000);
  }

  function goCalm() {
    if (!griffinEl) return;
    isBlocked = false;
    clearTimers();

    griffinEl.classList.remove("griffin-angry", "griffin-rage");
    speechBubble.classList.add("griffin-hidden");
    countdownEl.classList.add("griffin-hidden");
  }

  function clearTimers() {
    if (warningTimeout) { clearTimeout(warningTimeout); warningTimeout = null; }
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  function closeTab() {
    // Dramatic exit animation then ask background to close
    if (griffinEl) {
      griffinEl.classList.add("griffin-swipe");
    }
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "CLOSE_TAB" });
    }, 600);
  }

  // ─── Check if this page is blocked ───
  function checkCurrentSite() {
    const hostname = window.location.hostname;
    chrome.runtime.sendMessage({ type: "CHECK_SITE", hostname }, (response) => {
      if (chrome.runtime.lastError) return; // extension context invalidated
      if (!response) return;

      if (response.focusActive) {
        createGriffin();
        if (response.blocked) {
          goAngry();
        } else {
          goCalm();
        }
      } else {
        removeGriffin();
      }
    });
  }

  // ─── Listen for messages from background ───
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "FOCUS_STARTED") {
      checkCurrentSite();
    }
    if (msg.type === "FOCUS_ENDED") {
      removeGriffin();
    }
  });

  // ─── Initial check ───
  checkCurrentSite();

  // Re-check on visibility change (e.g. switching tabs)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkCurrentSite();
    }
  });
})();
