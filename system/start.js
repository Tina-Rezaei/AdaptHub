/**
 * AdaptHub/HubOS Unified Entry Point
 * 
 * Supports multiple execution modes:
 *   - adapthub:      Full AdaptHub with decision-making + cgroups + privacy optimization
 *   - localOnly:     HubOS baseline - all apps run locally, no offloading
 *   - cloudOnly:     All apps offloaded to cloud
 *   - adaptHubAlpha: AdaptHub without cgroups resource management
 *   - noPrivacy:     AdaptHub with privacy-oblivious decision-making
 * 
 * Usage:
 *   node start.js [options]
 * 
 * Options:
 *   --mode=<mode>         Execution mode (default: adapthub)
 *   --app=<appName>       Run a specific app only (butler, butlerlocal, fallwatch, smartcamera)
 *   --eval                Run in evaluation mode
 *   --instances=<n>       Number of app instances (default: 1)
 *   --iteration=<n>       Iteration number for logging
 *   --privacy=<scores>    Comma-separated privacy scores (required for adapthub/adaptHubAlpha/noPrivacy in eval mode)
 *   --warmup=<n>          Number of warmup rounds (default: 1)
 *   --experiments=<n>     Number of experiment rounds (default: 1)
 */

const fs = require('fs');
const path = require('path');

// Import unified core modules
const { getConfig, getAvailableModes, requiresPrivacyScores } = require('./core/config');
const EventEngine = require('./core/EventEngine');
const KVStore = require('./core/KVStore');
const AppRuntime = require('./core/AppRuntime');
const Logger = require('./utils/logger');
const { monitorCpuDuringExecution } = require('./core/CPUReport');

const AVAILABLE_APPS = ['Butler', 'ButlerLocal', 'FallWatch', 'SmartCamera'];

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(argv) {
    const args = {
        mode: 'adapthub',
        app: null,
        eval: false,
        instances: 1,
        iteration: null,  // null = auto-increment
        privacy: null,
        warmup: 1,
        experiments: 1,
        help: false
    };

    for (const arg of argv.slice(2)) {
        if (arg === '--help' || arg === '-h') {
            args.help = true;
        } else if (arg === '--eval' || arg === 'eval') {
            args.eval = true;
        } else if (arg.startsWith('--mode=')) {
            args.mode = arg.split('=')[1];
        } else if (arg.startsWith('--app=')) {
            args.app = arg.split('=')[1];
        } else if (arg.startsWith('--instances=')) {
            args.instances = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--iteration=')) {
            args.iteration = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--privacy=')) {
            args.privacy = arg.split('=')[1].split(',').map(Number);
        } else if (arg.startsWith('--warmup=')) {
            args.warmup = parseInt(arg.split('=')[1], 10);
        } else if (arg.startsWith('--experiments=')) {
            args.experiments = parseInt(arg.split('=')[1], 10);
        } else if (!arg.startsWith('--')) {
            // Legacy positional argument support for backward compatibility
            if (arg === 'eval') {
                args.eval = true;
            } else if (AVAILABLE_APPS.map(a => a.toLowerCase()).includes(arg.toLowerCase())) {
                args.app = arg;
            } else if (!isNaN(parseInt(arg, 10)) && args.instances === 1) {
                args.instances = parseInt(arg, 10);
            } else if (!isNaN(parseInt(arg, 10)) && args.iteration === null) {
                args.iteration = parseInt(arg, 10);
            } else if (arg.includes(',')) {
                args.privacy = arg.split(',').map(Number);
            }
        }
    }

    return args;
}

function printHelp() {
    const modes = getAvailableModes();
    console.log(`
AdaptHub/HubOS Unified Entry Point

USAGE:
    node start.js [options]

OPTIONS:
    --mode=<mode>         Execution mode (default: adapthub)
                          Available modes: ${modes.join(', ')}
    --app=<appName>       Run a specific app only
                          Available apps: ${AVAILABLE_APPS.join(', ')}
    --eval                Run in evaluation mode
    --instances=<n>       Number of app instances (default: 1)
    --iteration=<n>       Iteration number for logging (default: auto-increment)
    --privacy=<scores>    Comma-separated privacy scores (auto-generated if not provided)
    --warmup=<n>          Number of warmup rounds (default: 1)
    --experiments=<n>     Number of experiment rounds (default: 1)
    --help, -h            Show this help message

MODES:
    adapthub        Full AdaptHub with decision-making + cgroups + privacy optimization
    localOnly       HubOS baseline - all apps run locally
    cloudOnly       All apps offloaded to cloud
    adaptHubAlpha   AdaptHub without cgroups resource management
    noPrivacy       AdaptHub with privacy-oblivious decision-making

EXAMPLES:
    # Run all apps in AdaptHub mode (default)
    node start.js

    # Run in evaluation mode with LocalOnly baseline
    node start.js --eval --mode=localOnly --instances=2 --iteration=1

    # Run in evaluation mode with AdaptHub and privacy scores
    node start.js --eval --mode=adapthub --instances=2 --iteration=1 --privacy=2,3,4,5,1,2

    # Run a specific app
    node start.js --app=Butler

    # Legacy format (backward compatible)
    node start.js eval Butler 2 1 2,3,4,5,1,2
`);
}

function validateArgs(args) {
    const errors = [];
    const availableModes = getAvailableModes();

    // Validate mode
    if (!availableModes.includes(args.mode)) {
        errors.push(`Invalid mode: ${args.mode}. Available modes: ${availableModes.join(', ')}`);
    }

    // Validate app name if specified
    if (args.app) {
        const normalizedApp = AVAILABLE_APPS.find(a => a.toLowerCase() === args.app.toLowerCase());
        if (!normalizedApp) {
            errors.push(`Invalid app: ${args.app}. Available apps: ${AVAILABLE_APPS.join(', ')}`);
        } else {
            args.app = normalizedApp;
        }
    }

    // Validate privacy scores if provided (they'll be auto-generated if not)
    if (args.privacy && requiresPrivacyScores(args.mode)) {
        const requiredScores = args.app ? 1 : args.instances * 3;
        if (args.privacy.length !== requiredScores) {
            errors.push(`Expected ${requiredScores} privacy scores, got ${args.privacy.length}`);
        }
    }

    // Validate instances
    if (args.instances < 1) {
        errors.push('Instances must be at least 1');
    }

    return errors;
}

// ============================================================================
// MAIN APPLICATION LOGIC
// ============================================================================

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a random privacy score between 1 and 9
 */
function randomPrivacyScore() {
    return Math.floor(Math.random() * 9) + 1;
}

/**
 * Find the next available iteration number
 * Scans ./results/iter-* folders and returns the next number
 */
function getNextIteration() {
    const resultsDir = path.join(__dirname, 'results');
    if (!fs.existsSync(resultsDir)) {
        return 1;
    }
    
    const folders = fs.readdirSync(resultsDir)
        .filter(f => f.startsWith('iter-'))
        .map(f => parseInt(f.replace('iter-', ''), 10))
        .filter(n => !isNaN(n));
    
    if (folders.length === 0) {
        return 1;
    }
    
    return Math.max(...folders) + 1;
}

async function main() {
    const args = parseArgs(process.argv);

    if (args.help) {
        printHelp();
        process.exit(0);
    }

    const errors = validateArgs(args);
    if (errors.length > 0) {
        console.error('Error(s):');
        errors.forEach(e => console.error(`  - ${e}`));
        console.error('\nUse --help for usage information.');
        process.exit(1);
    }

    // Auto-increment iteration number if not specified
    if (args.iteration === null) {
        args.iteration = getNextIteration();
    }

    // Get configuration for the selected mode
    const config = getConfig(args.mode);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    AdaptHub System                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log(`[CONFIG] Mode: ${args.mode}`);
    console.log(`[CONFIG] Decision-making: ${config.decisionMaking ? 'Enabled' : 'Disabled'}`);
    console.log(`[CONFIG] Resource management (cgroups): ${config.resourceManagement ? 'Enabled' : 'Disabled'}`);
    if (config.algorithm) {
        console.log(`[CONFIG] Algorithm: ${config.algorithm}`);
    }

    // Initialize core components with config
    console.log('\n[INIT] Initializing core components...');
    const logger = new Logger(1);
    const kvStore = await new KVStore(logger);
    const appRuntime = await new AppRuntime(kvStore, logger, config);
    const eventEngine = await new EventEngine(appRuntime, logger);
    appRuntime.setEventEngine(eventEngine);
    console.log('[INIT] Core components ready');

    // Add applications
    // Generate random privacy scores if not provided and mode requires decision-making
    if (config.decisionMaking && !args.privacy) {
        const totalApps = args.app ? 1 : args.instances * 3;
        args.privacy = Array.from({ length: totalApps }, () => randomPrivacyScore());
        console.log(`[CONFIG] Auto-generated privacy scores: [${args.privacy.join(', ')}]`);
    }

    console.log('\n[APPS] Loading applications...');
    if (args.app) {
        const score = config.decisionMaking ? args.privacy[0] : 5;
        console.log(`[APPS] Loading ${args.app} (privacy score: ${score})`);
        await appRuntime.addApp(args.app, score);
    } else {
        const totalApps = args.instances * 3;
        console.log(`[APPS] Loading ${totalApps} app modules (${args.instances} instance(s) × 3 apps)`);
        for (let i = 0; i < args.instances; i++) {
            if (config.decisionMaking) {
                const scoreIndex = i * 3;
                await appRuntime.addApp('SmartCamera', args.privacy[scoreIndex]);
                await appRuntime.addApp('FallWatch', args.privacy[scoreIndex + 1]);
                await appRuntime.addApp('ButlerLocal', args.privacy[scoreIndex + 2]);
            } else {
                await appRuntime.addApp('SmartCamera', 5);
                await appRuntime.addApp('FallWatch', 5);
                await appRuntime.addApp('ButlerLocal', 5);
            }
        }
    }
    console.log('[APPS] All applications loaded\n');

    // Execute based on mode
    if (args.eval) {
        console.log('[EVAL] Starting evaluation mode');
        console.log(`[EVAL] Iteration: ${args.iteration} (auto-incremented from existing results)`);
        console.log(`[EVAL] Warmup rounds: ${args.warmup}, Experiment rounds: ${args.experiments}`);
        console.log(`[EVAL] Results will be saved to: ./results/iter-${args.iteration}/\n`);
        await runEvaluation(appRuntime, logger, args, config);
    } else {
        console.log('[RUN] Starting single execution...\n');
        await appRuntime.runAllAppModules();
        console.log('\n[DONE] Execution completed');
    }
}

async function runEvaluation(appRuntime, logger, args, config) {
    let currentCount = 0;
    const totalApps = args.app ? 1 : args.instances * 3;
    const totalRounds = args.warmup + args.experiments;

    async function executeRound() {
        if (logger.isRoundRunning()) {
            setTimeout(executeRound, 200);
            return;
        }

        if (currentCount >= totalRounds) {
            logger.expLog.info('Finished experiments.');
            fs.writeFileSync('/tmp/logtest.txt', 'finished');
            await sleep(3000);
            process.exit(0);
        }

        const isWarmup = currentCount < args.warmup;
        const roundType = isWarmup ? 'WARMUP' : 'EXPERIMENT';
        const experimentNum = isWarmup ? currentCount + 1 : currentCount - args.warmup + 1;
        const maxRounds = isWarmup ? args.warmup : args.experiments;
        
        console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
        console.log(`│  ${roundType} Round ${experimentNum}/${maxRounds}                                        │`);
        console.log(`└─────────────────────────────────────────────────────────────┘`);
        
        logger.log.info(`${roundType} round ${experimentNum}/${maxRounds}`);
        logger.startNewRound();
        
        const startTime = Date.now();
        monitorCpuDuringExecution(logger, config.label, args.instances, args.iteration);

        await appRuntime.runAllAppModules();

        logger.finishCurrentRound();
        
        const endTime = Date.now();
        console.log(`[ROUND] Completed in ${endTime - startTime}ms`);
        
        if (!isWarmup) {
            logger.printExperimentResults(args.app || 'all', config.label, args.iteration, args.instances);
        } else {
            // Clear warmup data so it doesn't pollute experiment results
            logger.clearExperimentResults();
            console.log('[WARMUP] Warmup data cleared, not included in final results');
        }

        currentCount += 1;
        
        if (currentCount >= totalRounds) {
            logger.expLog.info('Finished experiments.');
            fs.writeFileSync('/tmp/logtest.txt', 'finished');
            await sleep(3000);
            process.exit(0);
        } else {
            await sleep(3000);
            setTimeout(executeRound, 0);
        }
    }

    await executeRound();
}

// ============================================================================
// ENTRY POINT
// ============================================================================

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
