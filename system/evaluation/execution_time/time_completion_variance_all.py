#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Grouped bar-plots comparing approaches across different app loads.

File naming convention:
  {ctx}-all-{n}-decisions.json

Where:
  ctx = AdaptHub, AdaptHubAlpha, localOnly, cloudOnly (execution mode)
  n   = instance count (--instances=N parameter)

Instance count mapping:
  --instances=1 → 3 total apps  (1 Butler, 1 FallWatch, 1 SmartCamera)
  --instances=3 → 9 total apps  (3 of each)
  --instances=5 → 15 total apps (5 of each)

Run from: system/evaluation/execution_time/
Results at: system/results/iter-{iteration}/

Author: AdaptHub Team
"""

# ----------------------------------------------------------------------
# Imports
# ----------------------------------------------------------------------
import os
import json
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
import matplotlib.patches as patches

# ----------------------------------------------------------------------
# Constants & styling (CONFIGURE THESE)
# ----------------------------------------------------------------------
number_of_iterations = 3  # how many iter-* folders to scan

# Instance counts (--instances=N parameter value)
# Each "instance" = 1 Butler + 1 FallWatch + 1 SmartCamera = 3 total apps
# So: --instances=1 → 3 apps, --instances=3 → 9 apps, --instances=5 → 15 apps
instance_counts = [1, 3, 5]

application_types = ["FaceRecognition",
                     "FallDetection",
                     "SpeechRecognition"]
application_types_acronym = ["FR", "FD", "SR"]  # for x-ticks

# Path to results directory (relative to this script's location)
RESULTS_BASE_PATH = "../../results"
PLOTS_DIR = "plots"

# Create plots directory if it doesn't exist
os.makedirs(PLOTS_DIR, exist_ok=True)

# Subplot labels: instance_count → (caption letter, label text)
subplot_labels = {
    1: ("a", "3 apps (1 instance each)"),
    3: ("b", "9 apps (3 instances each)"),
    5: ("c", "15 apps (5 instances each)")
}

# Map context keys from filenames → nice display names
context_mapping = {
    "AdaptHub": "AdaptHub",
    "AdaptHubAlpha": "AdaptHubAlpha",
    "localOnly": "Local-only",
    "cloudOnly": "Cloud-only"
}

# Category order (ctx, ctx-part) - ctx matches filename prefix
approaches_order = [
    ("localOnly", "Local-only-overall"),
    ("cloudOnly", "Cloud-only-overall"),
    ("AdaptHubAlpha", "AdaptHubAlpha-overall"),
    ("AdaptHubAlpha", "AdaptHubAlpha-local"),
    ("AdaptHubAlpha", "AdaptHubAlpha-remote"),
    ("AdaptHub", "AdaptHub-overall"),
    ("AdaptHub", "AdaptHub-local"),
    ("AdaptHub", "AdaptHub-remote")
]

# Colours and hatches
colors = {
    "Local-only": "#009E73",
    "Cloud-only": "#0072B2",
    "AdaptHubAlpha": "#F0E442",
    "AdaptHub": "#D55E00"
}
hatches = {
    "Local-only-overall": "",
    "Cloud-only-overall": "",
    "AdaptHubAlpha-overall": "",
    "AdaptHubAlpha-local": "//",
    "AdaptHubAlpha-remote": "\\\\",
    "AdaptHub-overall": "",
    "AdaptHub-local": "//",
    "AdaptHub-remote": "\\\\"
}

constant = 1600  # constant offset for y-limits


# ----------------------------------------------------------------------
# Parse data into nested dict  data[n][app][ctx] -> (overall, local, remote)
# File naming: {ctx}-all-{n}-decisions.json
# ----------------------------------------------------------------------
def parse_data():
    data = {n: {app: {} for app in application_types}
            for n in instance_counts}

    files_found = 0
    files_missing = []

    for iteration in range(1, number_of_iterations + 1):
        base_path = f'{RESULTS_BASE_PATH}/iter-{iteration}/'

        if not os.path.exists(base_path):
            continue

        for n in instance_counts:
            for ctx in ["AdaptHub", "AdaptHubAlpha", "localOnly", "cloudOnly"]:
                # File format: {ctx}-all-{n}-decisions.json
                file_path = f'{base_path}{ctx}-all-{n}-decisions.json'

                if not os.path.exists(file_path):
                    files_missing.append(file_path)
                    continue

                files_found += 1
                print(f"  Loading: {file_path}")

                with open(file_path, "r") as fh:
                    json_data = json.load(fh)

                for element in json_data.values():
                    app_type = element.get("name")
                    if app_type not in application_types:
                        continue

                    # completion time (first value of the *total* key)
                    completion_time = next(
                        (val[0] for k, val in element.items()
                         if "total" in k and isinstance(val, list) and val),
                        None
                    )
                    if completion_time is None:
                        continue

                    variance = completion_time

                    overall, local, remote = data[n][app_type].setdefault(ctx, ([], [], []))
                    alpha = element.get("decisions", {}).get("alpha", None)

                    overall.append(variance)
                    if alpha is None:
                        pass  # stand-alone local/cloud
                    else:
                        (local if alpha == 0 else remote).append(variance)
                    data[n][app_type][ctx] = (overall, local, remote)

    print(f"\nLoaded {files_found} result files")
    if files_found == 0:
        print(f"\nNo files found! Expected files at: {RESULTS_BASE_PATH}/iter-*/")
        print(f"Expected format: {{ctx}}-all-{{n}}-decisions.json")
        print(f"Example: AdaptHub-all-3-decisions.json")

    return data


print("Parsing evaluation data...")
data = parse_data()


# ----------------------------------------------------------------------
# Helpers for stats & ticks
# ----------------------------------------------------------------------
def compute_stats(n, app, ctx, cat):  # cat: overall / local / remote
    overall, local, remote = data[n][app].get(ctx, ([], [], []))
    values = {"overall": overall, "local": local, "remote": remote}[cat]
    return (np.mean(values), np.std(values)) if values else (np.nan, np.nan)


def set_y_ticks_in_thousands(ax, lo, hi):
    lo_tick = int(np.floor(lo / 1000) * 1000)
    hi_tick = int(np.ceil(hi / 1000) * 1000 + 1000)
    ax.set_yticks(np.arange(lo_tick, hi_tick, 1000))


# ----------------------------------------------------------------------
# Pre-compute global y-limits
# ----------------------------------------------------------------------
all_vals = []
for n in instance_counts:
    for app in application_types:
        for ctx_vals in data[n][app].values():
            all_vals.extend(sum(ctx_vals, []))  # overall+local+remote

if not all_vals:
    print("\nERROR: No data values found!")
    print(f"Check that result files exist in {RESULTS_BASE_PATH}/iter-*/")
    print("Expected files: {ctx}-all-{n}-decisions.json")
    print("Example: AdaptHub-all-3-decisions.json, localOnly-all-9-decisions.json")
    exit(1)

global_min, global_max = np.nanmin(all_vals), np.nanmax(all_vals)

# ----------------------------------------------------------------------
# Figure with three sub-plots
# ----------------------------------------------------------------------
bar_width = 0.05
num_cats = len(approaches_order)
offsets = np.linspace(-0.18, 0.18, num_cats)  # same offsets for each subplot

fig, axes = plt.subplots(1, len(instance_counts),
                         figsize=(22, 6))

# Handle single subplot case (axes is not indexable when there's only one)
if len(instance_counts) == 1:
    axes = [axes]

for idx, n in enumerate(instance_counts):
    ax = axes[idx]
    x_pos = np.array([0, 0.5, 1])  # three app types
    # grey background for 2nd group
    rect = patches.Rectangle((x_pos[1] - 0.25, 0),
                             width=0.5,
                             height=(global_max - global_min) * 1.2 + constant,
                             color="#BBBBBB", alpha=0.3, zorder=0)
    ax.add_patch(rect)

    # means/stds dictionaries
    means = {app: [] for app in application_types}
    stds = {app: [] for app in application_types}

    for ctx, cat_key in approaches_order:
        cat_part = cat_key.split("-")[-1]  # overall / local / remote
        approach_name = context_mapping.get(ctx, ctx)

        for app in application_types:
            m, s = compute_stats(n, app, ctx, cat_part)
            means[app].append(m)
            stds[app].append(s)

    # bar-plots for this subplot
    for cat_idx, (ctx, cat_key) in enumerate(approaches_order):
        approach_name = context_mapping.get(ctx, ctx)
        color = colors[approach_name]
        hatch = hatches[cat_key]

        m_arr = [means[app][cat_idx] for app in application_types]
        s_arr = [stds[app][cat_idx] for app in application_types]

        ax.bar(x_pos + offsets[cat_idx], m_arr,
               yerr=s_arr, capsize=5, width=bar_width,
               color=color, edgecolor="black", hatch=hatch)

    # axes cosmetics
    ax.set_xticks(x_pos)
    ax.set_xticklabels(application_types_acronym, fontsize=20)
    caption, label_text = subplot_labels.get(n, ("?", f"{n * 3} apps ({n} instances each)"))
    ax.set_xlabel(f"({caption}) {label_text}", fontsize=24, labelpad=12)
    ax.set_ylim(global_min - 0.1 * abs(global_min),
                global_max + 0.1 * abs(global_max) + constant)
    set_y_ticks_in_thousands(ax, global_min, global_max)
    ax.tick_params(axis="y", labelsize=15)
    if idx == 0:
        ax.tick_params(axis="y", labelsize=15)
        ax.set_ylabel("Completion time in ms (Mean ± Std)", fontsize=19)

    ax.grid(True, linestyle="--", alpha=0.6)

# ----------------------------------------------------------------------
# ONE shared legend (handles + labels)
legend_handles = [
    Patch(facecolor=colors["Local-only"], edgecolor='black', hatch='', label="HubOS"),
    Patch(facecolor=colors["Cloud-only"], edgecolor='black', hatch='', label="Cloud-only"),
    Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='', label="AdaptHubα Overall"),
    Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='', label="AdaptHub Overall"),
    Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='//', label="AdaptHubα Local"),
    Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='//', label="AdaptHub Local"),
    Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='\\\\', label="AdaptHubα Remote"),
    Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='\\\\', label="AdaptHub Remote")
]
# ----------------------------------------------------------------------
dummy_patch = Patch(facecolor='none', edgecolor='none', label='')
fig.tight_layout(rect=[0, 0, 1, 0.88])  # <-- leave head-room

leg = fig.legend(legend_handles,
                 [h.get_label() for h in legend_handles],
                 loc="upper center",
                 ncol=4,
                 fontsize=22,
                 frameon=True,
                 bbox_to_anchor=(0.5, 0.87),
                 bbox_transform=fig.transFigure,
                 facecolor='white')
leg.get_frame().set_facecolor('white')
leg.get_frame().set_alpha(1.0)  # no transparency

output_file = os.path.join(PLOTS_DIR, "time_comparison_bar_all_new.pdf")
plt.savefig(output_file, dpi=300, bbox_inches='tight')
print(f"\nSaved: {output_file}")
plt.show()
