import { execSync } from 'child_process';
import os from 'os';

const port = 3000;

console.log(`Checking for processes on port ${port}...`);

try {
    if (os.platform() === 'win32') {
        const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = stdout.trim().split('\n');
        const pids = new Set();

        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && pid !== '0' && !isNaN(pid)) {
                pids.add(pid);
            }
        });

        pids.forEach(pid => {
            try {
                console.log(`Killing process ${pid} on port ${port}...`);
                execSync(`taskkill /F /PID ${pid}`);
            } catch (e) {
                // Ignore errors if process is already gone
            }
        });
    } else {
        // Unix-like
        try {
            execSync(`lsof -t -i:${port} | xargs kill -9`);
            console.log(`Port ${port} cleared.`);
        } catch (e) {
            // Ignore if no process found
        }
    }
} catch (error) {
    // console.log(`No process found on port ${port} or error occurred.`);
}

console.log(`Port ${port} is ready.`);
