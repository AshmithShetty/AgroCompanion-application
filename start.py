import os
import signal
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def run_process(name, command, cwd):
    if not cwd.exists():
        raise FileNotFoundError(str(cwd))
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        shell=True,
        creationflags=creationflags,
    )


def taskkill(pid):
    subprocess.run(
        ["taskkill", "/PID", str(pid), "/T", "/F"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def main():
    processes = []
    try:
        processes.append(("AgroCompanion", run_process("AgroCompanion", "npx expo start -c", ROOT / "AgroCompanion")))
        processes.append(("simulation-server", run_process("simulation-server", "node server.js", ROOT / "simulation-server")))
        processes.append(("demo-controller", run_process("demo-controller", "npm run dev", ROOT / "demo-controller")))
    except Exception as e:
        for _, p in processes:
            try:
                taskkill(p.pid)
            except Exception:
                pass
        print(str(e), file=sys.stderr)
        return 1

    for name, p in processes:
        print(f"{name} started (pid={p.pid})")

    try:
        while True:
            exited = [(name, p.poll()) for name, p in processes]
            for name, code in exited:
                if code is not None:
                    print(f"{name} exited (code={code})", file=sys.stderr)
                    return code if isinstance(code, int) else 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        if os.name == "nt":
            for _, p in processes:
                try:
                    p.send_signal(signal.CTRL_BREAK_EVENT)
                except Exception:
                    pass
            time.sleep(1.5)
        for _, p in processes:
            try:
                if p.poll() is None:
                    taskkill(p.pid)
            except Exception:
                pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

