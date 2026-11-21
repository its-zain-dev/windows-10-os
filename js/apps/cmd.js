/* ==========================================================================
   Windows 10 Command Prompt (cmd.exe) — VFS-Integrated Interactive Shell
   ========================================================================== */

import { VFS } from '../vfs.js';
import { State } from '../state.js';
import { WM } from '../wm.js';

export const CmdApp = {
  id: 'cmd',
  name: 'Command Prompt',
  icon: 'cmd',
  width: 740,
  height: 460,
  minWidth: 420,
  minHeight: 240,

  mount(container, params, api) {
    let cwd = params.cwd || 'C:\\Users\\User';
    let cmdHistory = [];
    let histPtr = 0;

    const root = document.createElement('div');
    root.className = 'cmd-root';
    root.innerHTML = `
      <div class="cmd-output" id="cmd-out">Microsoft Windows [Version 10.0.19045.4651]
(c) Microsoft Corporation. All rights reserved.

</div>
      <div class="cmd-input-line">
        <span class="cmd-prompt" id="cmd-prompt">${cwd}&gt;</span>
        <input type="text" class="cmd-input" id="cmd-in" autocomplete="off" spellcheck="false" />
      </div>
    `;
    container.appendChild(root);

    const outEl = root.querySelector('#cmd-out');
    const promptEl = root.querySelector('#cmd-prompt');
    const inEl = root.querySelector('#cmd-in');

    const print = (text = '') => {
      outEl.textContent += text + '\n';
      root.scrollTop = root.scrollHeight;
    };

    const resolvePath = (arg) => {
      if (!arg) return cwd;
      let clean = arg.replace(/^"|"$/g, '').replace(/\//g, '\\');
      if (/^[cC]:/.test(clean)) return VFS.normalizePath(clean);
      if (clean === '\\') return 'C:\\';
      if (clean === '..') return VFS.getParentPath(cwd);
      if (clean === '.') return cwd;
      let curr = cwd;
      for (const seg of clean.split('\\').filter(Boolean)) {
        if (seg === '..') curr = VFS.getParentPath(curr);
        else if (seg !== '.') curr = VFS.joinPath(curr, seg);
      }
      return VFS.normalizePath(curr);
    };

    const COLORS = {
      '0': '#0c0c0c', '1': '#0037da', '2': '#13a10e', '3': '#3a96dd',
      '4': '#c50f1f', '5': '#881798', '6': '#c19c00', '7': '#cccccc',
      '8': '#767676', '9': '#3b78ff', 'a': '#16c60c', 'b': '#61d6d6',
      'c': '#e74856', 'd': '#b4009e', 'e': '#f9f1a5', 'f': '#f2f2f2'
    };

    const runLine = (raw) => {
      print(`${cwd}>${raw}`);
      const trimmed = raw.trim();
      if (!trimmed) return;
      cmdHistory.push(trimmed);
      histPtr = cmdHistory.length;

      // Support echo text > file.txt redirection
      const redirMatch = trimmed.match(/^echo\s+(.+?)\s*>\s*(.+)$/i);
      if (redirMatch) {
        const text = redirMatch[1];
        const targetPath = resolvePath(redirMatch[2]);
        const parent = VFS.getParentPath(targetPath);
        const name = VFS.splitPath(targetPath).slice(-1)[0];
        if (VFS.writeFile(parent, name, text)) print('');
        else print('The system cannot find the path specified.');
        return;
      }

      const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      const argStr = trimmed.slice(parts[0].length).trim();

      switch (cmd) {
        case 'help':
          print(`For more information on a specific command, type the command name:
CD             Displays or changes the current directory.
CLS            Clears the screen.
COLOR          Sets the default console foreground and background colors (e.g. color 0a).
DATE           Displays the current date.
DEL            Deletes a file (moves to Recycle Bin).
DIR            Displays a list of files and subdirectories in a directory.
ECHO           Displays messages, or writes to files (echo hello > test.txt).
EXIT           Quits the CMD.EXE program.
HOSTNAME       Displays the host name of the computer.
IPCONFIG       Displays TCP/IP network configuration values.
MD / MKDIR     Creates a directory.
PING           Sends simulated ICMP echo requests to a host.
START          Starts an app (notepad, calc, edge, explorer, settings, paint, taskmgr).
SYSTEMINFO     Displays machine specific properties and configuration.
TASKLIST       Displays all currently running applications and processes.
TASKKILL       Terminates a running app (e.g. taskkill notepad).
TIME           Displays the current system time.
TREE           Graphically displays the directory structure of a path.
TYPE           Displays the contents of a text file.
VER            Displays the Windows version.
WHOAMI         Displays current user name.
WINVER         Opens About Windows dialog.
BSOD           Triggers a simulated Windows 10 Blue Screen of Death.`);
          break;

        case 'cls':
          outEl.textContent = '';
          break;

        case 'ver':
          print('\nMicrosoft Windows [Version 10.0.19045.4651]\n');
          break;

        case 'whoami':
          print(`${State.get().pcName.toLowerCase()}\\${State.get().username.toLowerCase()}`);
          break;

        case 'hostname':
          print(State.get().pcName);
          break;

        case 'date':
          print('The current date is: ' + new Date().toLocaleDateString());
          break;

        case 'time':
          print('The current time is: ' + new Date().toLocaleTimeString());
          break;

        case 'echo':
          print(argStr);
          break;

        case 'cd':
        case 'chdir': {
          if (!argStr) { print(cwd); break; }
          const target = resolvePath(argStr);
          const node = VFS.getNode(target);
          if (node && (node.type === 'folder' || node.type === 'drive')) {
            cwd = target;
            promptEl.textContent = `${cwd}>`;
          } else {
            print('The system cannot find the path specified.');
          }
          break;
        }

        case 'dir':
        case 'ls': {
          const target = argStr ? resolvePath(argStr) : cwd;
          const node = VFS.getNode(target);
          if (!node || !node.children) { print('File Not Found'); break; }
          const items = VFS.listDir(target);
          print(` Volume in drive C has no label.\n Volume Serial Number is 48F1-9A2C\n\n Directory of ${target}\n`);
          let fCount = 0, dCount = 0, totalBytes = 0;
          items.forEach(it => {
            const dt = new Date(it.modified).toLocaleDateString().padEnd(12);
            const tm = new Date(it.modified).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).padEnd(10);
            if (it.type === 'folder') {
              dCount++;
              print(`${dt}${tm}<DIR>          ${it.name}`);
            } else {
              fCount++;
              const sz = VFS.getSizeBytes(it);
              totalBytes += sz;
              print(`${dt}${tm}${String(sz).padStart(14)} ${it.name}`);
            }
          });
          print(`               ${fCount} File(s) ${totalBytes.toLocaleString()} bytes`);
          print(`               ${dCount} Dir(s)  158,921,412,608 bytes free\n`);
          break;
        }

        case 'mkdir':
        case 'md': {
          if (!argStr) { print('The syntax of the command is incorrect.'); break; }
          const res = VFS.createFolder(cwd, argStr.replace(/^"|"$/g, ''));
          if (!res) print('A subdirectory or file already exists.');
          break;
        }

        case 'type':
        case 'cat': {
          if (!argStr) { print('The syntax of the command is incorrect.'); break; }
          const target = resolvePath(argStr);
          const node = VFS.getNode(target);
          if (!node || node.type !== 'file') print('The system cannot find the file specified.');
          else print(node.content || '[Binary Image Data]');
          break;
        }

        case 'del':
        case 'rm': {
          if (!argStr) { print('The syntax of the command is incorrect.'); break; }
          const target = resolvePath(argStr);
          if (!VFS.deleteToRecycleBin(target)) print('Could Not Find ' + target);
          break;
        }

        case 'tree': {
          const printTree = (path, prefix = '') => {
            const items = VFS.listDir(path);
            items.forEach((it, i) => {
              const last = i === items.length - 1;
              print(`${prefix}${last ? '└───' : '├───'}${it.name}`);
              if (it.type === 'folder') printTree(it.path, prefix + (last ? '    ' : '│   '));
            });
          };
          print(cwd);
          printTree(cwd);
          break;
        }

        case 'color': {
          const code = (args[0] || '07').toLowerCase();
          if (code.length === 2 && COLORS[code[0]] && COLORS[code[1]]) {
            root.style.background = COLORS[code[0]];
            root.style.color = COLORS[code[1]];
          } else if (code.length === 1 && COLORS[code[0]]) {
            root.style.color = COLORS[code[0]];
          } else {
            print('Sets console colors. Example: color 0a (green on black), color 07 (default).');
          }
          break;
        }

        case 'ipconfig': {
          const s = State.get();
          print(`\nWindows IP Configuration\n\nWireless LAN adapter Wi-Fi:\n`);
          if (s.airplaneMode || !s.wifiEnabled) {
            print('   Media State . . . . . . . . . . . : Media disconnected\n');
          } else {
            print(`   Connection-specific DNS Suffix  . : home.local
   IPv4 Address. . . . . . . . . . . : 192.168.1.104
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1\n`);
          }
          break;
        }

        case 'systeminfo':
          print(`Host Name:                 ${State.get().pcName}
OS Name:                   Microsoft Windows 10 Pro
OS Version:                10.0.19045 N/A Build 19045
OS Manufacturer:           Microsoft Corporation
System Type:               x64-based PC
Processor(s):              Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz
Total Physical Memory:     16,384 MB
Available Physical Memory: 11,420 MB
Screen Resolution:         ${window.innerWidth} x ${window.innerHeight}`);
          break;

        case 'tasklist': {
          print('\nImage Name                     PID Session Name        Mem Usage');
          print('========================= ======== ================ ============');
          print('System                           4 Services             12,400 K');
          print('explorer.exe                  2148 Console              68,912 K');
          print('dwm.exe                       1024 Console              52,304 K');
          WM.getAllWindows().forEach((w, i) => {
            const nm = (w.appId + '.exe').padEnd(25);
            const pid = String(3200 + i * 112).padStart(8);
            print(`${nm} ${pid} Console              42,180 K`);
          });
          print('');
          break;
        }

        case 'taskkill': {
          const target = (args[0] || '').replace(/\.exe$/i, '').toLowerCase();
          if (!target) { print('Usage: taskkill <appname>'); break; }
          const matches = WM.getAllWindows().filter(w => w.appId.toLowerCase() === target);
          if (!matches.length) print(`ERROR: The process "${target}.exe" not found.`);
          else {
            matches.forEach(w => WM.close(w.id, true));
            print(`SUCCESS: Sent termination signal to "${target}.exe".`);
          }
          break;
        }

        case 'ping': {
          const host = args[0] || '8.8.8.8';
          print(`\nPinging ${host} with 32 bytes of data:`);
          for (let i = 0; i < 4; i++) {
            const ms = 11 + Math.floor(Math.random() * 14);
            print(`Reply from ${host}: bytes=32 time=${ms}ms TTL=118`);
          }
          print(`\nPing statistics for ${host}:\n    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)\n`);
          break;
        }

        case 'start':
        case 'notepad':
        case 'calc':
        case 'calculator':
        case 'explorer':
        case 'mspaint':
        case 'paint':
        case 'taskmgr':
        case 'edge':
        case 'settings': {
          const map = {
            calc: 'calculator', mspaint: 'paint', 'ms-settings:': 'settings'
          };
          const appKey = cmd === 'start' ? (map[args[0]?.toLowerCase()] || args[0]?.toLowerCase()) : (map[cmd] || cmd);
          if (appKey === 'notepad' && (cmd === 'notepad' ? args[0] : args[1])) {
            const fp = resolvePath(cmd === 'notepad' ? args[0] : args[1]);
            api.openApp('notepad', { filePath: fp });
          } else if (WM.getApp(appKey)) {
            api.openApp(appKey);
          } else {
            print(`Windows cannot find '${appKey || ''}'.`);
          }
          break;
        }

        case 'winver':
          window.Win10Shell?.showWinver();
          break;

        case 'bsod':
          window.Win10Shell?.triggerBSOD('MANUALLY_INITIATED_CRASH');
          break;

        case 'exit':
          api.close();
          break;

        default:
          print(`'${parts[0]}' is not recognized as an internal or external command,\noperable program or batch file.`);
      }
      print('');
    };

    root.addEventListener('click', () => inEl.focus());

    inEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = inEl.value;
        inEl.value = '';
        runLine(val);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (histPtr > 0) { histPtr--; inEl.value = cmdHistory[histPtr] || ''; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histPtr < cmdHistory.length - 1) { histPtr++; inEl.value = cmdHistory[histPtr]; }
        else { histPtr = cmdHistory.length; inEl.value = ''; }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const toks = inEl.value.split(' ');
        const last = toks[toks.length - 1].toLowerCase();
        const match = VFS.listDir(cwd).find(it => it.name.toLowerCase().startsWith(last));
        if (match) {
          toks[toks.length - 1] = match.name.includes(' ') ? `"${match.name}"` : match.name;
          inEl.value = toks.join(' ');
        }
      }
    });

    setTimeout(() => inEl.focus(), 40);
  }
};
