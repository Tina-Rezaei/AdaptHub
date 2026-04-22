/**
 * Core Module Configuration
 * 
 * Defines execution modes for AdaptHub/HubOS system.
 * Each mode configures how applications are executed and resources are managed.
 */

/**
 * Execution strategies:
 * - 'local':    Always execute locally
 * - 'remote':   Always execute remotely (cloud)
 * - 'decision': Use decision-making algorithm (alpha) to decide
 */
const EXECUTION_STRATEGY = {
    LOCAL: 'local',
    REMOTE: 'remote',
    DECISION: 'decision',
};

/**
 * Mode configurations for different execution approaches
 */
const MODES = {
    /**
     * AdaptHub: Full system with decision-making, cgroups, and privacy optimization
     */
    adapthub: {
        execution: EXECUTION_STRATEGY.DECISION,
        resourceManagement: true,   // Use cgroups for CPU quotas
        decisionMaking: true,       // Call Python optimizer
        algorithm: 'minMaxPrivacy', // Privacy-aware optimization
        label: 'AdaptHub',
    },

    /**
     * LocalOnly: HubOS baseline - all apps run locally without offloading
     */
    localOnly: {
        execution: EXECUTION_STRATEGY.LOCAL,
        resourceManagement: false,  // No cgroups
        decisionMaking: false,      // No optimization
        algorithm: null,
        label: 'localOnly',
    },

    /**
     * CloudOnly: All apps offloaded to cloud servers
     */
    cloudOnly: {
        execution: EXECUTION_STRATEGY.REMOTE,
        resourceManagement: false,
        decisionMaking: false,
        algorithm: null,
        label: 'cloudOnly',
    },

    /**
     * AdaptHubAlpha: Decision-making but without cgroups resource management
     */
    adaptHubAlpha: {
        execution: EXECUTION_STRATEGY.DECISION,
        resourceManagement: false,  // No cgroups
        decisionMaking: true,
        algorithm: 'minMaxPrivacy',
        label: 'AdaptHubAlpha',
    },

    /**
     * NoPrivacy: Decision-making with privacy-oblivious algorithm
     */
    noPrivacy: {
        execution: EXECUTION_STRATEGY.DECISION,
        resourceManagement: true,
        decisionMaking: true,
        algorithm: 'privacy_oblivious',
        label: 'privacyOblivious',
    },
};

/**
 * Get configuration for a specific mode
 * @param {string} modeName - Name of the mode
 * @returns {Object} Mode configuration
 */
function getConfig(modeName) {
    const config = MODES[modeName];
    if (!config) {
        throw new Error(`Unknown mode: ${modeName}. Available modes: ${Object.keys(MODES).join(', ')}`);
    }
    return { ...config, modeName };
}

/**
 * Check if a mode requires privacy scores
 * @param {string} modeName - Name of the mode
 * @returns {boolean}
 */
function requiresPrivacyScores(modeName) {
    const config = MODES[modeName];
    return config && config.decisionMaking;
}

/**
 * Get list of available modes
 * @returns {string[]}
 */
function getAvailableModes() {
    return Object.keys(MODES);
}

module.exports = {
    MODES,
    EXECUTION_STRATEGY,
    getConfig,
    requiresPrivacyScores,
    getAvailableModes,
};
