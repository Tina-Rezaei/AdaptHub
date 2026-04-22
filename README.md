# AdaptHub - Adaptive, User-Centric and Privacy-Driven Smart Home Hub

AdaptHub extends [HubOS](https://github.com/CloudLargeScale-UCLouvain/HubOS_NG) with adaptive computation offloading that balances privacy, performance, and resource constraints. It uses a decision-making algorithm to dynamically choose between local and cloud execution based on privacy sensitivity scores and available resources.

## Overview

AdaptHub supports multiple execution modes:

| Mode | Description |
|------|-------------|
| `adapthub` | Full system with decision-making + cgroups + privacy optimization |
| `localOnly` | HubOS baseline - all apps run locally, no offloading |
| `cloudOnly` | All apps offloaded to cloud servers |
| `adaptHubAlpha` | Decision-making without cgroups resource management |
| `noPrivacy` | Decision-making with privacy-oblivious algorithm |

## Prerequisites

### System Requirements

- **Node.js** v16.14.2+ and npm v8.10.0+
- **Python** 3.8+ with Pyomo and [Gurobi](https://support.gurobi.com/hc/en-us/articles/360044290292-How-do-I-install-Gurobi-for-Python) solver
- **Yarn** package manager
- **Linux** with cgroups v2 support (for `adapthub` and `noPrivacy` modes)

### Node.js and npm

Install Node.js and npm from official distribution channels (not OS package managers).

### Yarn

```bash
npm install --global yarn
```

### Build Dependencies (Ubuntu)

```bash
sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### Python Dependencies

Install Python dependencies for the decision-making component:

```bash
cd system/decision-making
pip install -r requirements.txt
```

The decision-making algorithm requires **Gurobi** solver. Obtain an academic or commercial license from [gurobi.com](https://www.gurobi.com/).

### Redis Server

Redis provides an in-memory key-value store for applications.

```bash
cd docker/
./create-redis-container.sh
```

To restart later:
```bash
./start-redis-container.sh
```

### MQTT Server (Mosquitto)

```bash
sudo apt install mosquitto
```

### Cgroups Configuration

Modes using resource management require passwordless sudo for cgroup operations:

```bash
sudo visudo -f /etc/sudoers.d/hubos-cgroups
```

Add (replace `<username>` with your username):
```
<username> ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /sys/fs/cgroup/*, /usr/bin/tee /sys/fs/cgroup/*, /usr/bin/rmdir /sys/fs/cgroup/*, /usr/bin/kill *
```

### Cloud Endpoints

Cloud servers receive offloaded computations. For testing, run them locally:

**Butler Server (Speech Recognition)**
```bash
cd docker/butler-server/
./download-model.sh
sudo apt install sox
npm i
node start.js
```

**FallDetection Server (Pose Detection)**
```bash
cd docker/falldetection-server/
npm i
node start.js
```

Download MoveNet model from [Kaggle](https://www.kaggle.com/models/google/movenet/tfJs/singlepose-lightning/4) and place in `docker/falldetection-server/models/movenet/`.

**FallWatch Streaming Server (Video streaming to care agent)**
```bash
cd docker/fallwatch-streaming-server/
npm i
node start-socket-server.js
```

**SmartCamera Server (Face Recognition)**
```bash
cd docker/smartcamera-server/
npm i
node start.js
```

### AdaptHub Core Setup

```bash
cd system/
yarn
```

Create `.env` file:
```bash
touch .env
```

Add environment variables:
```
BUTLER_CLOUD_SERVER=0.0.0.0
FALLWATCH_CLOUD_SERVER=0.0.0.0
SMARTCAMERA_CLOUD_SERVER=0.0.0.0
FALLDETECTION_CLOUD_SERVER=0.0.0.0
```

For Raspberry Pi, rebuild TensorFlow.js:
```bash
npm rebuild @tensorflow/tfjs-node --build-from-source
```

## Running

### Start the Decision-Making Server

For modes using decision-making (`adapthub`, `adaptHubAlpha`, `noPrivacy`):

```bash
cd system/decision-making
python pythonscript.py
```

### Command-Line Interface

```bash
cd system/
node start.js [options]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--mode=<mode>` | Execution mode (default: `adapthub`) |
| `--app=<name>` | Run specific app: `Butler`, `ButlerLocal`, `FallWatch`, `SmartCamera` |
| `--eval` | Run in evaluation mode |
| `--instances=<n>` | Number of app instances (default: 1) |
| `--iteration=<n>` | Iteration number for logging (default: auto-increment) |
| `--privacy=<scores>` | Comma-separated privacy scores (auto-generated if not provided) |
| `--warmup=<n>` | Warmup rounds (default: 1) |
| `--experiments=<n>` | Experiment rounds (default: 1) |
| `--help` | Show help message |

### Examples

**Run all apps in AdaptHub mode (default):**
```bash
node start.js
```

**Run a specific app:**
```bash
node start.js --app=Butler
node start.js --app=SmartCamera
```

**Run in LocalOnly mode (no decision-making, no offloading):**
```bash
node start.js --mode=localOnly
```

**Run in CloudOnly mode (all offloaded):**
```bash
node start.js --mode=cloudOnly
```

**Evaluation mode - basic (auto-increments iteration, auto-generates privacy scores):**
```bash
node start.js --eval --mode=localOnly
node start.js --eval --mode=adapthub
```

**Evaluation with multiple instances:**
```bash
node start.js --eval --mode=localOnly --instances=5
node start.js --eval --mode=adapthub --instances=3
```

**Evaluation with custom privacy scores:**
```bash
# 2 instances × 3 apps = 6 privacy scores needed
node start.js --eval --mode=adapthub --instances=2 --privacy=2,3,4,5,1,2
```

**Full evaluation with warmup and experiments:**
```bash
node start.js --eval --mode=adapthub --instances=3 --warmup=5 --experiments=20
```

## Demo Applications

| App | Description |
|-----|-------------|
| **Butler** | Voice-controlled smart home with local + cloud STT |
| **ButlerLocal** | Voice-controlled smart home (local-only STT) |
| **FallWatch** | Fall detection with video streaming to care agent |
| **SmartCamera** | Face recognition at front door |

## Evaluation

### Output Files

Evaluation results are saved in `system/results/iter-<n>/` where `<n>` auto-increments.

**File naming convention:** `{mode}-{app}-{instances}-{type}.{ext}`

| File Pattern | Contents |
|--------------|----------|
| `AdaptHub-all-3-timings.csv` | Raw timing values (3 = instances count) |
| `AdaptHub-all-3-stats.csv` | Mean and standard deviation |
| `AdaptHub-all-3-decisions.json` | App specifications and optimization decisions |
| `AdaptHub-3-cpu.txt` | CPU utilization during execution |

**Mode prefixes:** `AdaptHub-`, `AdaptHubAlpha-`, `localOnly-`, `cloudOnly-`, `privacyOblivious-`

**Instance count mapping:**
- `--instances=1` → 3 total apps (1 Butler, 1 FallWatch, 1 SmartCamera)
- `--instances=3` → 9 total apps (3 of each)
- `--instances=5` → 15 total apps (5 of each)

### Example Evaluation Workflow

```bash
# Terminal 1: Start Python decision-making server
cd system/decision-making
python pythonscript.py

# Terminal 2: Run evaluation
cd system

# Quick test (1 warmup + 1 experiment)
node start.js --eval --mode=adapthub

# Full evaluation
node start.js --eval --mode=adapthub --instances=3 --experiments=20

# Compare baselines
node start.js --eval --mode=localOnly --instances=3 --warmup=1 --experiments=20
node start.js --eval --mode=cloudOnly --instances=3 --warmup=1 --experiments=20

# Results auto-saved to results/iter-1/, results/iter-2/, etc.
```

### Visualization Scripts

Visualization scripts are available in `system/evaluation/`:

```bash
# Execution time comparison
cd system/evaluation/execution_time/
python3 tima_completion_variance_all.py

# CPU usage visualization
cd system/evaluation/CPU_usage/
python3 cpu_usage_visualization.py

# Privacy analysis
cd system/evaluation/privacy/
python3 privacy_analysis.py
python3 privacy_score_distribution.py

# Time budget variance
cd system/evaluation/user-centricity/
python3 time_budget_variance.py
```

Plots are saved to a `plots/` subdirectory in each evaluation folder.

### Sample Output

```
╔════════════════════════════════════════════════════════════╗
║                    AdaptHub System                         ║
╚════════════════════════════════════════════════════════════╝

[CONFIG] Mode: adapthub
[CONFIG] Decision-making: Enabled
[CONFIG] Resource management (cgroups): Enabled
[CONFIG] Algorithm: minMaxPrivacy

[INIT] Initializing core components...
[INIT] Core components ready

[APPS] Loading 3 app modules (1 instance(s) × 3 apps)
[APPS] All applications loaded

[EVAL] Starting evaluation mode
[EVAL] Iteration: 1 (auto-incremented from existing results)
[EVAL] Results will be saved to: ./results/iter-1/

┌─────────────────────────────────────────────────────────────┐
│  EXPERIMENT Round 1/1                                       │
└─────────────────────────────────────────────────────────────┘
[EXEC] Executing 3 module(s)...
[CPU] Available: 45.2% idle, 8 cores
[OPTIMIZER] Connecting to decision-making server...
[DECISION] FaceRecognition: Execute LOCAL (alpha=0, quota=15000)
[DECISION] FallDetection: Execute LOCAL (alpha=0, quota=12000)
[DECISION] SpeechRecognition: Execute LOCAL (alpha=0, quota=10000)
[ROUND] Completed in 2345ms
```

## Architecture

```
system/
├── start.js              # Unified entry point
├── core/
│   ├── config.js         # Mode configurations
│   ├── AppRuntime.js     # Application lifecycle management
│   ├── master.js         # Execution routing (local/remote)
│   ├── WorkerLocal.js    # Local execution with optional cgroups
│   ├── EventEngine.js    # Event processing
│   └── cgroupManager.js  # Linux cgroup resource management
├── decision-making/
│   ├── pythonscript.py   # Socket server for optimization
│   ├── core.py           # Optimization orchestration
│   ├── DecisionMaking.py # Pyomo optimization model (minMaxPrivacy)
│   └── privacy_oblivious.py # Privacy-oblivious algorithm
├── apps/                 # Demo applications
│   ├── Butler/
│   ├── ButlerLocal/
│   ├── FallWatch/
│   └── SmartCamera/
└── utils/
    └── logger.js         # Logging and experiment results
```

## Troubleshooting

### Cgroup Permission Denied

If you see `sudo: a terminal is required to read the password`:

**Option 1: Configure passwordless sudo for cgroups (recommended)**

Create a sudoers file for cgroup operations:
```bash
sudo visudo -f /etc/sudoers.d/hubos-cgroups
```

Add this line (replace `<username>` with your username):
```
<username> ALL=(ALL) NOPASSWD: /usr/bin/mkdir -p /sys/fs/cgroup/*, /usr/bin/tee /sys/fs/cgroup/*, /usr/bin/rmdir /sys/fs/cgroup/*, /usr/bin/kill *
```

This allows only specific cgroup-related commands without password, not full sudo access.


### Python Server Connection Failed

Ensure the decision-making server is running:
```bash
cd system/decision-making && python pythonscript.py
```

### Node.js Version Issues

Ensure you're using the correct Node.js version (v16.x recommended):
```bash
node --version  # Should show v16.x.x
nvm use 16      # If using nvm
```

## References

- [AdaptHub Paper]()
- [HubOS Paper](https://ieeexplore.ieee.org/abstract/document/11107379)

