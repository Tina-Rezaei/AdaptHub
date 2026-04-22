#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CPU Usage Visualization for AdaptHub evaluation.

File naming convention:
  {mode}-{instances}-cpu.txt

Where:
  mode      = AdaptHub, AdaptHubAlpha, localOnly, cloudOnly
  instances = --instances parameter value (1, 3, 5, etc.)

Instance count mapping:
  --instances=1 → 3 total apps  (1 Butler, 1 FallWatch, 1 SmartCamera)
  --instances=3 → 9 total apps  (3 of each)
  --instances=5 → 15 total apps (5 of each)

Examples:
  AdaptHub-1-cpu.txt      (--instances=1, 3 apps)
  AdaptHub-3-cpu.txt      (--instances=3, 9 apps)
  localOnly-5-cpu.txt     (--instances=5, 15 apps)

Run from: system/evaluation/CPU_usage/
Results at: system/results/iter-{iteration}/

Author: AdaptHub Team
"""

import re
import matplotlib.pyplot as plt
import pandas as pd
import os

# ----------------------------------------------------------------------
# Configuration (EDIT THESE)
# ----------------------------------------------------------------------
RESULTS_BASE_PATH = "../../results"
PLOTS_DIR = "plots"
ITERATION = 2  # Which iteration folder to read from

# Create plots directory if it doesn't exist
os.makedirs(PLOTS_DIR, exist_ok=True)

# Instance counts to plot (--instances=N values)
# Each instance = 3 apps, so instances=1 → 3 apps, instances=3 → 9 apps
instance_counts = [1, 3, 5]


# Map instance count to total apps for display labels
def total_apps(n):
    return n * 3


# Methods/modes to compare (must match filename prefixes)
methods = ['localOnly', 'cloudOnly', 'AdaptHubAlpha', 'AdaptHub']

# Display names for legend
methods_display_name = {
    'localOnly': 'Local-only (HubOS)',
    'cloudOnly': 'Cloud-only',
    'AdaptHubAlpha': 'AdaptHubα',
    'AdaptHub': 'AdaptHub',
}

# Colors for each method
method_colors = {
    'localOnly': '#009E73',
    'cloudOnly': '#0072B2',
    'AdaptHubAlpha': '#F0E442',
    'AdaptHub': '#D55E00',
}


# ----------------------------------------------------------------------
# Parsing function
# ----------------------------------------------------------------------
def parse_log_file(file_path):
    """
    Parse CPU log file and extract utilization over time.

    Expected format:
        Core 0: XX.XX%
        Core 1: XX.XX%
        ...
        Total CPU Usage: XX.XX%
        Process CPU at TIMESTAMP: {...}
    """
    cpu_pattern = re.compile(r"Total CPU Usage:\s*([\d\.]+)%")
    process_pattern = re.compile(r"Process CPU at (\d+):")

    with open(file_path, 'r') as file:
        lines = file.readlines()

    cpu_utilizations = []
    timestamps = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Look for Total CPU Usage line
        cpu_match = cpu_pattern.match(line)
        if cpu_match:
            cpu_percent = float(cpu_match.group(1))
            cpu_utilizations.append(cpu_percent)

            # Look for the Process CPU line that follows
            if i + 1 < len(lines):
                process_line = lines[i + 1].strip()
                process_match = process_pattern.match(process_line)
                if process_match:
                    timestamp_ms = int(process_match.group(1))
                    timestamps.append(timestamp_ms)
                else:
                    timestamps.append(None)
            else:
                timestamps.append(None)

        i += 1

    # Create DataFrame
    df = pd.DataFrame({
        'Timestamp_ms': timestamps,
        'CPU_Utilization': cpu_utilizations
    })
    df.dropna(inplace=True)

    if df.empty:
        return df

    # Convert to relative time in seconds
    df['Time_s'] = (df['Timestamp_ms'] - df['Timestamp_ms'].min()) / 1000.0
    return df[['Time_s', 'CPU_Utilization']]


# ----------------------------------------------------------------------
# Plotting function
# ----------------------------------------------------------------------
def plot_cpu_utilization_subplots(cpu_data, instance_counts, methods,
                                  method_colors, methods_display_name,
                                  output_file="cpu_utilization_subplots.pdf"):
    """
    Create subplots comparing CPU utilization across different app loads.
    """
    num_plots = len(instance_counts)
    fig, axes = plt.subplots(nrows=1, ncols=num_plots,
                             figsize=(6 * num_plots, 4), sharey=True)

    # Handle single subplot case
    if num_plots == 1:
        axes = [axes]

    # Find global min and max time for consistent x-axis
    global_min_time = float('inf')
    global_max_time = float('-inf')

    for n in instance_counts:
        for method in methods:
            data = cpu_data[n].get(method)
            if data is not None and not data.empty:
                local_min = data['Time_s'].min()
                local_max = data['Time_s'].max()
                global_min_time = min(global_min_time, local_min)
                global_max_time = max(global_max_time, local_max)

    # Plot each instance count
    for idx, n in enumerate(instance_counts):
        ax = axes[idx]

        for method in methods:
            data = cpu_data[n].get(method)
            if data is not None and not data.empty:
                label = methods_display_name.get(method, method)
                color = method_colors.get(method, "#000000")

                ax.plot(data['Time_s'], data['CPU_Utilization'],
                        label=label, color=color,
                        marker='', linestyle='-', linewidth=1.5)

        # Subplot formatting
        apps = total_apps(n)
        ax.set_title(f'{apps} Apps ({n} instance{"s" if n > 1 else ""} each)',
                     fontsize=14)
        ax.set_xlabel('Time (s)', fontsize=12)
        ax.legend(fontsize=10, loc='upper right')
        ax.grid(True, linestyle='--', alpha=0.5)
        ax.tick_params(axis='both', labelsize=10)

        # Set consistent x-axis limits
        if global_max_time > global_min_time:
            ax.set_xlim(global_min_time - 0.3, global_max_time + 0.3)

    # Y-axis label only on first subplot
    axes[0].set_ylabel('CPU Utilization (%)', fontsize=12)

    plt.tight_layout()
    plt.savefig(output_file, dpi=300, format="pdf", bbox_inches='tight')
    print(f"Saved: {output_file}")
    plt.show()


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------
if __name__ == "__main__":
    print(f"Loading CPU data from: {RESULTS_BASE_PATH}/iter-{ITERATION}/")

    # Initialize data structure
    cpu_data = {n: {} for n in instance_counts}
    files_found = 0

    # Load data for each instance count and method
    for n in instance_counts:
        for method in methods:
            # Try new naming first: {method}-{instances}-cpu.txt
            file_path_new = f'{RESULTS_BASE_PATH}/iter-{ITERATION}/{method}-{n}-cpu.txt'
            # Fallback to old naming: {method}-cpu.txt (no instance count)
            file_path_old = f'{RESULTS_BASE_PATH}/iter-{ITERATION}/{method}-cpu.txt'

            if os.path.exists(file_path_new):
                print(f"  Loading: {file_path_new}")
                df = parse_log_file(file_path_new)
                cpu_data[n][method] = df
                files_found += 1
            elif os.path.exists(file_path_old):
                print(f"  Loading (old format): {file_path_old}")
                df = parse_log_file(file_path_old)
                cpu_data[n][method] = df
                files_found += 1
            else:
                print(f"  Missing: {file_path_new}")
                cpu_data[n][method] = None

    print(f"\nLoaded {files_found} CPU log files")

    if files_found == 0:
        print("\nNo files found! Make sure you've run evaluations first.")
        print(f"Expected files at: {RESULTS_BASE_PATH}/iter-{ITERATION}/")
        print("Expected format: {mode}-{instances}-cpu.txt")
        print("Example: AdaptHub-3-cpu.txt (for --instances=3)")
    else:
        output_file = os.path.join(PLOTS_DIR, "cpu_utilization_comparison.pdf")
        plot_cpu_utilization_subplots(
            cpu_data, instance_counts, methods,
            method_colors, methods_display_name,
            output_file=output_file
        )
