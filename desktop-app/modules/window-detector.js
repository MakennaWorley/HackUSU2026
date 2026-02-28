const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');

class WindowDetector extends EventEmitter {
	constructor() {
		super();
		this.psProcess = null;
		this.pollTimer = null;
		this.lastProcessName = null;
		this.outputBuffer = '';
		this.initialized = false;
	}

	start(intervalMs = 1500) {
		if (this.pollTimer) return;
		this._spawnPowerShell();
		this.pollTimer = setInterval(() => this._poll(), intervalMs);
		// Initial poll after PS has time to compile Add-Type
		setTimeout(() => this._poll(), 2500);
	}

	stop() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this._killPowerShell();
		this.lastProcessName = null;
	}

	_spawnPowerShell() {
		if (this.psProcess) return;

		this.psProcess = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', '-'], {
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true
		});

		this.psProcess.stdout.on('data', (data) => {
			this.outputBuffer += data.toString();
			this._processOutput();
		});

		this.psProcess.stderr.on('data', (data) => {
			// Ignore stderr noise from PowerShell
		});

		this.psProcess.on('close', () => {
			this.psProcess = null;
			this.initialized = false;
			// Respawn if we're still polling
			if (this.pollTimer) {
				setTimeout(() => this._spawnPowerShell(), 1000);
			}
		});

		// Register the Win32 type once (must be a single line for stdin)
		const addTypeCmd = "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; using System.Text; public class GriffWin32 { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); [DllImport(\"user32.dll\", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int count); }'";

		this.psProcess.stdin.write(addTypeCmd + '\n');
		// Wait for Add-Type to compile before marking as initialized
		setTimeout(() => { this.initialized = true; }, 2000);
	}

	_killPowerShell() {
		if (this.psProcess) {
			try {
				this.psProcess.stdin.end();
				this.psProcess.kill();
			} catch {
				// Process may already be dead
			}
			this.psProcess = null;
			this.initialized = false;
		}
	}

	_poll() {
		if (!this.psProcess || !this.initialized) return;

		const cmd = [
			'$h=[GriffWin32]::GetForegroundWindow();',
			'$wpid=0;',
			'[void][GriffWin32]::GetWindowThreadProcessId($h,[ref]$wpid);',
			'$p=Get-Process -Id $wpid -ErrorAction SilentlyContinue;',
			'$t=New-Object System.Text.StringBuilder 256;',
			'[void][GriffWin32]::GetWindowText($h,$t,256);',
			"Write-Output \"GRIFF_RESULT:$($p.ProcessName)|$($t.ToString())\""
		].join(' ');

		try {
			this.psProcess.stdin.write(cmd + '\n');
		} catch {
			// stdin may be closed, respawn will handle it
		}
	}

	_processOutput() {
		const lines = this.outputBuffer.split('\n');
		// Keep last incomplete line in buffer
		this.outputBuffer = lines.pop() || '';

		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith('GRIFF_RESULT:')) {
				const payload = trimmed.substring('GRIFF_RESULT:'.length);
				const parts = payload.split('|');
				const processName = (parts[0] || '').trim();
				const windowTitle = (parts[1] || '').trim();

				if (processName && processName !== this.lastProcessName) {
					this.lastProcessName = processName;
					this.emit('windowChanged', { processName, windowTitle });
				}
			}
		}
	}

	getCurrentWindow() {
		return { processName: this.lastProcessName || '' };
	}
}

module.exports = { WindowDetector };
