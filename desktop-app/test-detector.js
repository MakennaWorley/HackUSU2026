const { spawn } = require('node:child_process');
const ps = spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
ps.stdout.on('data', (d) => console.log('OUT:', d.toString().trim()));
ps.stderr.on('data', (d) => console.log('ERR:', d.toString().trim()));

const addType =
	'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; using System.Text; public class GriffWin32 { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId); [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int count); }\'';
ps.stdin.write(`${addType}\n`);

setTimeout(() => {
	const cmd =
		'$h=[GriffWin32]::GetForegroundWindow(); $wpid=0; [void][GriffWin32]::GetWindowThreadProcessId($h,[ref]$wpid); $p=Get-Process -Id $wpid -ErrorAction SilentlyContinue; $t=New-Object System.Text.StringBuilder 256; [void][GriffWin32]::GetWindowText($h,$t,256); Write-Output "GRIFF_RESULT:$($p.ProcessName)|$($t.ToString())"';
	console.log('Sending poll with $wpid...');
	ps.stdin.write(`${cmd}\n`);
}, 3000);

setTimeout(() => {
	console.log('Done.');
	ps.kill();
	process.exit();
}, 6000);
