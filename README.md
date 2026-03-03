# GET IT DONE With Griff! 🦅

GET IT DONE With Griff is a Chrome extension and Windows desktop application designed to boost productivity and improve time management. It helps users stay focused by automatically closing browser tabs and warning users when they visit distracting websites or applications defined in their personal blacklist.

The extension runs in the background and enforces focus mode even when distracting tabs are opened outside the active window, ensuring users remain on task without manual intervention.

## ✨ Features

### Browser Extension
- **Customizable Focus Sessions**: Set your focus session length (default 25 minutes)
- **Interactive Griff Mascot**: An animated griffin that:
  - Floats on your screen during focus sessions
  - Wanders around autonomously
  - Can be dragged and positioned anywhere
  - Gets progressively angrier when you visit blocked sites
  - Gives you a 10-second warning before closing distracting tabs
  - Opens an AI-powered chat interface with triple-click
- **Smart Blocklist Management**: 
  - Pre-configured categories (Social Media, Video Streaming, Chat, News, Forums, Shopping, Gaming, etc.)
  - Add custom sites and create your own categories
  - Toggle categories on/off with checkboxes
  - Blacklist or Whitelist mode support
- **Automatic Site Enforcement**: Griff automatically closes blacklisted websites during focus sessions
- **AI-Powered Chat**: Chat with Griff using Ollama (Phi Mini model) for:
  - Getting focus suggestions
  - Automatically adding recommended blocked sites
  - General conversation and encouragement
- **Lightweight**: Built with vanilla JavaScript, HTML, and CSS

### Windows Desktop Application
- **System-Wide Application Monitoring**: Monitor and block distracting applications outside your browser
- **Real-Time Window Detection**: Detects active applications using PowerShell integration
- **Overlay Display**: Shows Griff and timer overlay on your desktop during focus sessions
- **Synchronized with Browser**: Desktop app and browser extension work together seamlessly
- **System Tray Integration**: Runs quietly in the background with tray icon
- **HTTP Server**: Provides status API for browser extension communication (localhost:52525)

## 🎯 How It Works

### Browser Extension
1. **Start a Session**: Click the extension icon and set your focus duration
2. **Configure Blocklist**: Select category checkboxes or add custom sites
3. **Stay Focused**: Griff appears on every tab, wandering around your screen
4. **Automatic Enforcement**: 
   - Visiting a blocked site makes Griff angry
   - You get a 10-second warning with countdown
   - Tab closes automatically if you don't leave
5. **Chat with Griff**: Triple-click Griff to open the AI chat for help
6. **Session Complete**: Griff disappears when your focus time ends

### Desktop Application
1. **Launch the App**: Runs in system tray with a Griff icon
2. **Start Focus**: Set duration and enable application blocking
3. **Real-Time Monitoring**: Tracks which application window is active
4. **Desktop Overlay**: Griff appears as an overlay showing timer and status
5. **Application Blocking**: Warns you when using blocked applications
6. **Syncs with Browser**: Works alongside the browser extension for complete coverage

## 📦 Installation

### Browser Extension (Manual Installation)

1. **Clone or Download** this repository:
   ```bash
   git clone https://github.com/yourusername/get-it-done-griff.git
   cd get-it-done-griff
   ```

2. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner

3. **Load the Extension**:
   - Click "Load unpacked"
   - Select the `browser-extension` folder from this repository
   - The extension will appear in your Chrome toolbar

4. **Pin the Extension** (recommended):
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "GET IT DONE With Griff!" for easy access

### Windows Desktop Application

1. **Install Dependencies**:
   ```bash
   cd desktop-app
   npm install
   ```

2. **Run the Application**:
   ```bash
   npm start
   ```

3. **System Tray**: The app will start and appear in your system tray with a Griff icon

### LLM Integration (Optional but Recommended)

To enable AI-powered chat with Griff, you need to install and configure Ollama:

#### Step 1: Install Ollama

1. **Download Ollama**:
   - Visit [ollama.ai](https://ollama.ai)
   - Download and install for your operating system

2. **Verify Installation**:
   ```bash
   # Check if ollama is in your PATH
   ollama --version
   ```

   **If you get "command not found"**, add Ollama to your PATH:
   ```bash
   # For macOS/Linux (add to ~/.zshrc or ~/.bashrc)
   echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

#### Step 2: Download the Phi-3 Mini Model

```bash
# Pull the model (this will download ~2.2 GB)
/usr/local/bin/ollama pull phi3:mini
```

You'll see a progress bar like:
```
pulling manifest 
pulling 633fc5be925f: 100% ▕███████████████▏ 2.2 GB
pulling fa8235e5b48f: 100% ▕███████████████▏ 1.1 KB
verifying sha256 digest 
writing manifest 
success
```

#### Step 3: Configure CORS for Chrome Extension

Ollama needs to allow requests from Chrome extensions:

```bash
# Set environment variable to allow all origins
export OLLAMA_ORIGINS="*"

# Make it permanent by adding to your shell config
echo 'export OLLAMA_ORIGINS="*"' >> ~/.zshrc
source ~/.zshrc
```

#### Step 4: Start Ollama Server

```bash
# Kill any existing Ollama processes
pkill ollama

# Start Ollama server (must be running while using the extension)
ollama serve
```

You should see output like:
```
time=... level=INFO source=routes.go:1720 msg="Listening on 127.0.0.1:11434 (version 0.17.5)"
```

**Keep this terminal window open** - Ollama must be running for the AI chat to work!

#### Step 5: Test the Connection

In a new terminal window:

```bash
# Check if Ollama is responding
curl http://localhost:11434/api/tags
```

You should see JSON output with your installed models.

#### Step 6: Use Griff's AI Chat

1. **Load the extension** in Chrome
2. **Start a focus session**
3. **Triple-click Griff** to open the chat interface
4. The chat will show "🟢 Using: Phi Mini" when connected

#### Troubleshooting

**"command not found: ollama"**
- Ollama is not in your PATH
- Use the full path: `/usr/local/bin/ollama`
- Or add to PATH as shown in Step 1

**"No LLMs available" in chat**
- Make sure Ollama is running: `ollama serve`
- Check if accessible: `curl http://localhost:11434/api/tags`
- Verify CORS is configured: `echo $OLLAMA_ORIGINS` should show `*`

**"Error: listen tcp 127.0.0.1:11434: bind: address already in use"**
- Ollama is already running (this is good!)
- Just use the existing instance
- Or kill it first: `pkill ollama` then `ollama serve`

**Slow responses**
- First response takes longer (model initialization)
- Subsequent responses are faster
- Close other applications to free up resources

For detailed LLM API documentation and advanced usage, see [LLM_INTEGRATION.md](LLM_INTEGRATION.md)

## ⚙️ Configuration

### Browser Extension Settings

Click the extension icon to access settings:

1. **Focus Duration**: Set your default session length (in minutes)
2. **Mode Selection**: Choose between Blacklist or Whitelist mode
3. **Category Management**:
   - Check/uncheck pre-configured categories
   - Delete categories you don't need (including defaults)
   - Create custom categories with your own sites
4. **Custom Sites**: Add individual sites to your blocklist (one per line)
5. **Reset to Defaults**: Restore original categories and settings

### Desktop Application Settings

1. **Open Config Window**: Click the tray icon or right-click → "Show Config"
2. **Application Blocking**: Add applications to monitor (e.g., Discord, Steam)
3. **Categories**: Manage application categories similar to browser extension
4. **Focus Duration**: Set your preferred session length
5. **Mode**: Choose Blacklist or Whitelist for applications

## 🛠️ Tech Stack

### Browser Extension
- **Languages**: JavaScript (vanilla), HTML5, CSS3
- **APIs**: Chrome Extension Manifest V3
  - chrome.storage (local data persistence)
  - chrome.tabs (tab management)
  - chrome.alarms (timer management)
  - chrome.runtime (background messaging)
- **AI Integration**: Ollama API (local LLM inference)
- **Build Tools**: Biome (formatting & linting)

### Desktop Application
- **Framework**: Electron 33.0.0
- **Runtime**: Node.js
- **Architecture**:
  - Main Process (Electron)
  - Renderer Process (HTML/CSS/JS)
  - IPC Communication (inter-process)
- **System Integration**:
  - PowerShell (Windows API access)
  - Native modules (window detection)
  - HTTP Server (localhost:52525)
- **Storage**: JSON file-based store

### AI/LLM
- **Provider**: Ollama (local inference)
- **Model**: Phi-3 Mini (3.8B parameters)
- **Features**: JSON-structured responses, site suggestions, conversational AI

## 📁 Project Structure

```
get-it-done-griff/
├── browser-extension/          # Chrome extension
│   ├── manifest.json          # Extension configuration
│   ├── background.js          # Service worker (LLM, messaging, storage)
│   ├── content.js             # Griff mascot, chat UI, site blocking
│   ├── popup.html/js/css      # Extension popup interface
│   └── assets/                # Images and icons
├── desktop-app/               # Windows application
│   ├── main.js               # Electron main process
│   ├── preload.js            # IPC bridge
│   ├── modules/              # Core functionality
│   │   ├── focus-manager.js  # Session management
│   │   ├── window-detector.js # Active window tracking
│   │   ├── http-server.js    # Browser communication
│   │   └── store.js          # Data persistence
│   └── renderer/             # UI windows
│       ├── config.html/js/css   # Configuration window
│       └── overlay.html/js/css  # Desktop overlay
├── LLM_INTEGRATION.md        # AI setup documentation
├── package.json              # Root dependencies (Biome)
└── README.md                 # This file
```

## 🚀 Development

### Prerequisites
- Node.js 18+ and npm
- Google Chrome or Chromium-based browser
- Windows OS (for desktop app)
- Ollama (optional, for AI features)

### Running Development Environment

```bash
# Install root dependencies (linting/formatting)
npm install

# Format code
npm run format

# Lint code
npm run lint

# Check code (format + lint)
npm run check
```

### Testing the Extension
1. Make changes to files in `browser-extension/`
2. Go to `chrome://extensions/`
3. Click the refresh icon on the "GET IT DONE With Griff!" card
4. Test your changes

### Testing the Desktop App
```bash
cd desktop-app
npm install
npm start
```

## 🤝 Contributing

Contributions are welcome! Here are some ways you can help:

- 🐛 Report bugs and issues
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit pull requests

Please ensure code follows the Biome formatting rules (`npm run check`).

## 📝 License

This project was built at HackUSU 2026 (24-hour hackathon).

## 👥 Team

Built by a team of 3 at HackUSU 2026:
- **Makenna Worley**
- **Caden Proulx**
- **Liz Carmichael**

## 🔮 Future Plans

- [ ] Chrome Web Store publication
- [ ] macOS and Linux desktop app support
- [ ] Firefox extension port
- [ ] Cloud sync for settings
- [ ] Focus session statistics and analytics
- [ ] Pomodoro timer integration
- [ ] Custom Griff themes and animations
- [ ] Mobile companion app

---

**Coming soon to the Chrome Web Store!** 🎉

Made with ❤️ and ☕ at HackUSU 2026
