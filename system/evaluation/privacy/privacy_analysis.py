import json
import matplotlib.pyplot as plt
from collections import defaultdict
import numpy as np
import os

# Configuration
PLOTS_DIR = "plots"

# Create plots directory if it doesn't exist
os.makedirs(PLOTS_DIR, exist_ok=True)

def plot_privacy(data, plot_name):
    # Group data by application type (name), privacy score, and alpha (local/remote execution)
    results = defaultdict(lambda: defaultdict(lambda: {'local': 0, 'remote': 0}))

    # Parse the data
    for app_id, app_data in data.items():
        app_name = app_data['name']
        privacy_score = app_data['privacyScore']
        alpha = app_data['decisions']['alpha']

        # Increment the count based on local (alpha = 0) or remote (alpha = 1) execution
        if alpha == 0:
            results[app_name][privacy_score]['local'] += 1
        elif alpha == 1:
            results[app_name][privacy_score]['remote'] += 1

    # Define a custom color palette
    colors = {
        'local': '#009E73',  # Blue for local execution
        'remote': '#56B4E9'      # Red for remote execution
    }

    # Professional font style
    plt.rcParams.update({'font.size': 12, 'font.family': 'sans-serif'})

    # Plot the results for each application type
    for app_name, privacy_data in results.items():
        privacy_scores = sorted(privacy_data.keys())

        # Extract counts of local and remote executions for each privacy score
        local_counts = [privacy_data[score]['local'] for score in privacy_scores]
        remote_counts = [privacy_data[score]['remote'] for score in privacy_scores]

        num_bars = len(privacy_scores)

        # Dynamically adjust figure size based on the number of bars
        fig_width = max(4, min(num_bars * 1.5, 10))  # Minimum width 4, maximum width 10
        fig_height = 6

        # Adjust bar width based on the number of bars
        width = 0.6 if num_bars > 4 else 0.4
        # width = 0.1

        # Create the bar plot
        x = np.arange(num_bars)  # X-axis positions

        fig, ax = plt.subplots(figsize=(fig_width, fig_height))

        # Stacked bar plot
        bars_local = ax.bar(x, local_counts, width, label='Local Execution', color=colors['local'])
        bars_remote = ax.bar(x, remote_counts, width, bottom=local_counts, label='Remote Execution',
                             color=colors['remote'])

        # Adjust x-axis limits to center the bars
        if num_bars == 1:
            ax.set_xlim(-0.5, 0.5)
        else:
            ax.set_xlim(-0.5, num_bars - 0.5)

        # Automatically adjust y-axis limit to avoid cutting off the bars
        max_total = max(np.add(local_counts, remote_counts))
        print(max_total)
        ax.set_ylim(0, max_total * 1.1)  # Add 10% margin at the top

        # Add value labels to the bars
        def add_value_labels(bars, counts):
            for bar, count in zip(bars, counts):
                yval = bar.get_height()
                if yval > 0:  # Only label bars with height > 0
                    ax.text(
                        bar.get_x() + bar.get_width() / 2,
                        bar.get_y() + yval + max_total * 0.02,
                        int(yval),
                        ha='center',
                        va='bottom',
                        fontsize=10
                    )

        add_value_labels(bars_local, local_counts)
        add_value_labels(bars_remote, remote_counts)

        # Add gridlines
        ax.yaxis.grid(True, linestyle='--', alpha=0.7)

        # Add labels, title, and legend
        ax.set_xlabel('Privacy Score', fontsize=14)
        ax.set_ylabel('Number of Instances', fontsize=14)
        ax.set_title(f'{app_name}', fontsize=16, weight='bold')
        ax.set_xticks(x)
        ax.set_xticklabels(privacy_scores)
        ax.legend(loc='upper left', frameon=False, fontsize=12)

        # Add padding and layout adjustments for a cleaner look
        fig.tight_layout()
        output_path = os.path.join(PLOTS_DIR, f'{app_name}_{plot_name}.pdf')
        plt.savefig(output_path, format='pdf', bbox_inches='tight')
        print(f"Saved: {output_path}")
        plt.show()


import json
import matplotlib.pyplot as plt
from collections import defaultdict
import numpy as np

def plot_privacy_combined(data, plot_name):
    # Group data by privacy score and alpha (local/remote execution)
    results = defaultdict(lambda: {'local': 0, 'remote': 0})

    # Parse the data
    for app_id, app_data in data.items():
        privacy_score = app_data['privacyScore']
        alpha = app_data['decisions']['alpha']

        # Increment the count based on local (alpha = 0) or remote (alpha = 1) execution
        if alpha == 0:
            results[privacy_score]['local'] += 1
        elif alpha == 1:
            results[privacy_score]['remote'] += 1

    colors = {
        'local': '#009E73',  # Blue for local execution
        'remote': '#56B4E9'      # Red for remote execution
    }

    # Professional font style
    plt.rcParams.update({'font.size': 20, 'font.family': 'sans-serif'})

    # Extract data for plotting
    privacy_scores = sorted(results.keys())
    local_counts = [results[score]['local'] for score in privacy_scores]
    remote_counts = [results[score]['remote'] for score in privacy_scores]

    num_bars = len(privacy_scores)

    # Dynamically adjust figure size based on the number of bars
    fig_width = max(6, min(num_bars * 1.5, 12))  # Minimum width 6, maximum width 12
    width = 0.35 if num_bars > 1 else 0.4        # Adjust bar width
    # width = 0.2     # Adjust bar width

    # fig, ax = plt.subplots(figsize=(fig_width, 6))
    fig, ax = plt.subplots(figsize=(10, 6))

    # X-axis positions
    x = np.arange(num_bars)

    # Side-by-side bar plot
    bars_remote = ax.bar(x - width / 2, remote_counts, width, label='Remote Execution', color=colors['remote'])
    bars_local = ax.bar(x + width / 2, local_counts, width, label='Local Execution', color=colors['local'])

    # Adjust x-axis limits to center the bars
    if num_bars == 1:
        ax.set_xlim(-0.5, 0.5)
    else:
        ax.set_xlim(-width, num_bars - 1 + width)

    # Set x-ticks
    ax.set_xticks(x)
    ax.set_xticklabels(privacy_scores)

    # Automatically adjust y-axis limit
    max_total = max(local_counts + remote_counts)
    print(max_total)
    ax.set_ylim(0, 5)  # Add 10% margin at the top

    # Add value labels to the bars
    def add_value_labels(bars):
        for bar in bars:
            yval = bar.get_height()
            if yval > 0:
                ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    yval + max_total * 0.02,
                    int(yval),
                    ha='center',
                    va='bottom',
                    fontsize=24
                )

    add_value_labels(bars_local)
    add_value_labels(bars_remote)

    # Add gridlines
    ax.yaxis.grid(True, linestyle='--', alpha=0.7)

    # Add labels, title, and legend
    ax.set_xlabel('Privacy Score', fontsize=29)
    ax.set_ylabel('Number of Applications', fontsize=29)
    # ax.set_title('Privacy Score vs Number of Applications', fontsize=16, weight='bold')
    ax.legend(loc='upper left', frameon=False, fontsize=26)
    plt.xticks(fontsize=24)
    # Adjust layout and save the plot
    fig.tight_layout()
    output_path = os.path.join(PLOTS_DIR, f'{plot_name}.pdf')
    plt.savefig(output_path, format='pdf', bbox_inches='tight')
    print(f"Saved: {output_path}")
    plt.show()


# Configuration
RESULTS_BASE_PATH = "../../results"
ITERATION = 6
MODE = "AdaptHub"  # Options: AdaptHub, AdaptHubAlpha, localOnly, cloudOnly, privacyOblivious

# Instance counts (--instances parameter values)
# Each instance = 3 apps (1 Butler, 1 FallWatch, 1 SmartCamera)
instance_counts = [1, 2, 3, 4, 5, 6]

for instances in instance_counts:
    total_apps = instances * 3
    # New file format: {mode}-all-{instances}-decisions.json
    file_path = f'{RESULTS_BASE_PATH}/iter-{ITERATION}/{MODE}-all-{instances}-decisions.json'
    
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            # plot_privacy(data, f'{total_apps}_apps_privacy')
            plot_privacy_combined(data, f'privacy_combined_{total_apps}')
    except FileNotFoundError:
        print(f"File not found: {file_path}")
