import json
import matplotlib.pyplot as plt
from collections import Counter
import numpy as np
import os

# Configuration
RESULTS_BASE_PATH = "../../results"
PLOTS_DIR = "plots"
number_of_iterations = 10

# Create plots directory if it doesn't exist
os.makedirs(PLOTS_DIR, exist_ok=True)
# Instance counts (--instances parameter values)
# Each instance = 3 apps (1 Butler, 1 FallWatch, 1 SmartCamera)
instance_counts = [1, 2, 3, 4, 5, 6]


def get_risk_scores(mode):
    """
    Load risk scores from result files.
    
    Args:
        mode: AdaptHub, AdaptHubAlpha, privacyOblivious, etc.
    """
    risk_scores = {"local": [],
                   "remote": []}
    files_loaded = 0
    
    for iteration in range(1, number_of_iterations + 1):
        for instances in instance_counts:
            # New file format: {mode}-all-{instances}-decisions.json
            path = f'{RESULTS_BASE_PATH}/iter-{iteration}/{mode}-all-{instances}-decisions.json'
            
            if not os.path.exists(path):
                continue
                
            with open(path, 'r') as f:
                data = json.load(f)
            files_loaded += 1
            
            for instance in data.values():
                # Skip entries without decisions (e.g., localOnly/cloudOnly modes)
                if 'decisions' not in instance or 'alpha' not in instance.get('decisions', {}):
                    continue
                if 'privacyScore' not in instance:
                    continue
                    
                if instance['decisions']['alpha'] == 1:
                    risk_scores["remote"].append(instance['privacyScore'])
                else:
                    risk_scores["local"].append(instance['privacyScore'])
    
    print(f"Loaded {files_loaded} files for mode '{mode}'")
    return risk_scores


def plot(scores, context):
    # privacy_scores_adapthub = get_risk_scores('privacyOblivious')
    risk_scores = {}
    risk_scores["local"] = scores["local"]
    risk_scores["remote"] = scores["remote"]

    # Count occurrences of each sensitivity level
    local_counts = Counter(risk_scores["local"])
    remote_counts = Counter(risk_scores["remote"])

    # Prepare data for the plot
    local_values = [local_counts[level] for level in sensitivity_levels]
    remote_values = [remote_counts[level] for level in sensitivity_levels]

    # Plotting
    plt.figure(figsize=(10, 6))
    bar_width = 0.5
    x_positions = np.arange(len(sensitivity_levels))

    plt.bar(x_positions, local_values, color='#009E73', label='Local execution')
    plt.bar(x_positions, remote_values, bottom=local_values, color='#56B4E9', label='Remote execution')

    # Add labels and title
    plt.xlabel('Privacy score', fontsize=30)
    plt.yticks(fontsize=26)
    plt.ylabel('Number of instances', fontsize=30)
    # plt.title('Distribution of Privacy Sensitivity Levels in Local and Remote Modes')
    plt.xticks(x_positions, sensitivity_levels, fontsize=26)
    plt.legend(fontsize=25, loc="upper left")
    plt.ylim(0, 155)
    plt.grid(axis='y', linestyle='--', alpha=0.7)

    # Show the plot
    plt.tight_layout()
    output_path = os.path.join(PLOTS_DIR, f"risk_scores_{context}.pdf")
    plt.savefig(output_path, format="pdf", bbox_inches="tight")
    print(f"Saved: {output_path}")
    plt.show()

# Plot AdaptHub privacy score distribution
context = 'AdaptHub'
privacy_scores_adapthub = get_risk_scores('AdaptHub')
if privacy_scores_adapthub["local"] or privacy_scores_adapthub["remote"]:
    print(f"\n{context} Results:")
    print(f"  Local executions: {len(privacy_scores_adapthub['local'])}")
    print(f"  Remote executions: {len(privacy_scores_adapthub['remote'])}")
    total = len(privacy_scores_adapthub["local"]) + len(privacy_scores_adapthub["remote"])
    if total > 0:
        print(f"  Local ratio: {len(privacy_scores_adapthub['local'])/total:.2%}")
    
    all_scores = privacy_scores_adapthub["local"] + privacy_scores_adapthub["remote"]
    if all_scores:
        min_privacy_score = min(all_scores)
        max_privacy_score = max(all_scores)
        sensitivity_levels = range(min_privacy_score, max_privacy_score + 1)
        plot(privacy_scores_adapthub, context)
else:
    print(f"No data found for {context}")

# Plot privacyOblivious privacy score distribution
context = 'privacyOblivious'
privacy_scores_po = get_risk_scores('privacyOblivious')
if privacy_scores_po["local"] or privacy_scores_po["remote"]:
    print(f"\n{context} Results:")
    print(f"  Local executions: {len(privacy_scores_po['local'])}")
    print(f"  Remote executions: {len(privacy_scores_po['remote'])}")
    total = len(privacy_scores_po["local"]) + len(privacy_scores_po["remote"])
    if total > 0:
        print(f"  Local ratio: {len(privacy_scores_po['local'])/total:.2%}")
    
    all_scores = privacy_scores_po["local"] + privacy_scores_po["remote"]
    if all_scores:
        min_privacy_score = min(all_scores)
        max_privacy_score = max(all_scores)
        sensitivity_levels = range(min_privacy_score, max_privacy_score + 1)
        plot(privacy_scores_po, context)
else:
    print(f"No data found for {context}")


