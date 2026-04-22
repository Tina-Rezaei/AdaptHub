import matplotlib.pyplot as plt
import json
import os
import numpy as np
from matplotlib.patches import Patch
import matplotlib.patches as patches

# Configuration
RESULTS_BASE_PATH = "../../results"
PLOTS_DIR = "plots"
number_of_iterations = 10

# Create plots directory if it doesn't exist
os.makedirs(PLOTS_DIR, exist_ok=True)

# Instance counts (--instances parameter values)
# Each instance = 3 apps (1 Butler, 1 FallWatch, 1 SmartCamera)
# So: instances=4 → 12 apps, instances=5 → 15 apps, instances=6 → 18 apps
instance_counts = [4, 5, 6]

application_types = ["FaceRecognition", "FallDetection", "SpeechRecognition"]

# Mapping contexts (file prefixes) to display names
context_mapping = {
    "AdaptHub": "AdaptHub",
    "AdaptHubAlpha": "AdaptHubAlpha",
    "localOnly": "Local-only",
    "cloudOnly": "Cloud-only"
}

# Categories order (context matches filename prefix):
# 1) Local-only (overall)
# 2) Cloud-only (overall)
# 3) AdaptHubAlpha (overall)
# 4) AdaptHubAlpha (local)
# 5) AdaptHubAlpha (remote)
# 6) AdaptHub (overall)
# 7) AdaptHub (local)
# 8) AdaptHub (remote)
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

# Colors
colors = {
    "Local-only": "#009E73",
    "Cloud-only": "#0072B2",
    "AdaptHubAlpha": "#F0E442",
    "AdaptHub": "#D55E00"
}

# Hatches
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

def pars_data():
    # Data structure:
    # data[instances][app_type][context] = (list_of_overall_variances, list_of_local_variances, list_of_remote_variances)
    data = {}
    for instances in instance_counts:
        data[instances] = {}
        for app_type in application_types:
            data[instances][app_type] = {}

    files_loaded = 0
    for iteration in range(1, number_of_iterations+1):
        for instances in instance_counts:
            for context in ["AdaptHub", "AdaptHubAlpha", "localOnly", "cloudOnly"]:
                # New file format: {context}-all-{instances}-decisions.json
                file_path = f'{RESULTS_BASE_PATH}/iter-{iteration}/{context}-all-{instances}-decisions.json'
                if not os.path.exists(file_path):
                    continue
                with open(file_path, 'r') as f:
                    json_data = json.load(f)
                files_loaded += 1

                for element in json_data.values():
                    # "name" specifies application type
                    app_type = element.get("name")
                    if app_type not in application_types:
                        continue

                    # Extract completion time
                    completion_time = None
                    initialization_time = 0
                    for key, val in element.items():
                        # i removed time for initialization step
                        if "initialization" in key and isinstance(val, list) and val:
                            initialization_time = val[0]
                        if "total" in key and isinstance(val, list) and val:
                            completion_time = val[0] - initialization_time
                            break

                    if completion_time is None:
                        continue

                    # We assume numeric_time_budget is present
                    if "timeBudget" not in element:
                        continue  # Skip entries without timeBudget
                    numeric_time_budget = element["timeBudget"]
                    variance = completion_time - numeric_time_budget

                    decisions = element.get("decisions", {})
                    alpha = decisions.get("alpha", None)

                    # Ensure the structure for this context exists
                    if context not in data[instances][app_type]:
                        data[instances][app_type][context] = ([], [], [])  # (overall, local, remote)

                    overall_list, local_list, remote_list = data[instances][app_type][context]

                    if alpha is None:
                        # localOnly or cloudOnly
                        overall_list.append(variance)
                    else:
                        # AdaptHub or AdaptHubAlpha
                        overall_list.append(variance)
                        if alpha == 0:
                            local_list.append(variance)
                        else:
                            remote_list.append(variance)

                    # Put back updated lists
                    data[instances][app_type][context] = (overall_list, local_list, remote_list)
    
    print(f"Loaded {files_loaded} files")
    return data

data = pars_data()

# Gather all data values for global min/max
all_data_values = []
for instances in instance_counts:
    for app_type in application_types:
        for context in data[instances][app_type]:
            overall_data, local_data, remote_data = data[instances][app_type][context]
            all_data_values.extend(overall_data)
            all_data_values.extend(local_data)
            all_data_values.extend(remote_data)

if not all_data_values:
    raise ValueError("No data found.")

global_min = np.nanmin(all_data_values)
global_max = np.nanmax(all_data_values)

def set_y_ticks_in_thousands(ax, global_min, global_max):
    start_tick = int(np.floor(global_min / 1000) * 1000)
    end_tick = int(np.ceil(global_max / 1000) * 1000 + 1000)
    ax.set_yticks(np.arange(start_tick, end_tick, 1000))

bar_width = 0.05
num_categories = len(approaches_order)
offsets = np.linspace(-0.18, 0.18, num_categories)

########################
# GROUPED BAR CHART WITH ERROR BARS PER NUMBER OF APPLICATIONS
########################
def compute_stats_for_app_type(instances, app_type, ctx, cat):
    overall_data, local_data, remote_data = data[instances][app_type].get(ctx, ([],[],[]))
    if ctx in ["localOnly", "cloudOnly"] and cat == "overall":
        values = overall_data
    else:
        if cat == "overall":
            values = overall_data
        elif cat == "local":
            values = local_data
        elif cat == "remote":
            values = remote_data
        else:
            values = []
    if len(values) > 0:
        return np.mean(values), np.std(values)
    else:
        return np.nan, np.nan

for instances in instance_counts:
    total_apps = instances * 3  # For display purposes
    # For each instance count, we plot app_type on x-axis
    # We'll have three application types (SpeechRecognition, FaceRecognition, FallDetection)
    # For each app_type, we have 8 categories side by side.

    # Compute means and stds for each category and app_type
    # means[app_type][category_index], stds[app_type][category_index]
    means = {app_type: [] for app_type in application_types}
    stds = {app_type: [] for app_type in application_types}
    counts = {app_type: [] for app_type in application_types}  # Store counts for annotations

    for ctx, cat_key in approaches_order:
        category_part = cat_key.split("-")[-1]
        approach_name = context_mapping[ctx]
        for app_type in application_types:
            m, s = compute_stats_for_app_type(instances, app_type, ctx, category_part)
            counts[app_type].append(
                len(data[instances][app_type].get(ctx, ([],[],[]))[0]) if category_part == "local" else 0)
            means[app_type].append(m)
            stds[app_type].append(s)

    fig, ax = plt.subplots(figsize=(10, 6))
    x = np.arange(len(application_types))  # 0,1,2 for the three app_types
    x = [0, 0.5, 1]  # Adjust spacing for better visualization

    group_width = 0.5  # Width of one group of bars
    second_group_index = 1  # Index for the second group
    rect = patches.Rectangle(
        (x[second_group_index] - group_width / 2, -4000),
        width=group_width,
        height=(global_max - global_min) + (0.2 * abs(global_max)),
        color='#BBB',
        alpha=0.3,
        zorder=0  # Send rectangle to the background
    )
    ax.add_patch(rect)
    # Plot each category for each app_type
    # We need to iterate over categories and then over app_type
    for category_index, (ctx, cat_key) in enumerate(approaches_order):
        approach_name = context_mapping[ctx]
        color = colors[approach_name]
        hatch = hatches[cat_key]

        # Extract mean/std arrays for all app_types in order
        m_array = [means[app_type][category_index] for app_type in application_types]
        s_array = [stds[app_type][category_index] for app_type in application_types]

        pos = x + offsets[category_index]
        ax.bar(pos, m_array, yerr=s_array, capsize=5, width=bar_width, color=color, edgecolor='black', hatch=hatch)
        print((m_array))
        print((m_array))
        print((s_array))
        print((s_array))
        print("====================", approach_name)
    ax.set_xticks(x)
    ax.set_xticklabels(application_types, fontsize=22)
    plt.yticks(fontsize=19)
    # ax.set_xlabel("Application Type", fontsize=22)
    ax.set_ylabel("Time budget variance (Mean ± Std)", fontsize=22)
    # ax.set_title(f"Variance Comparison for {n} Instances (Bar Chart)", fontsize=14)
    ax.set_ylim(global_min - (0.1 * abs(global_min)), global_max + (0.1 * abs(global_max)))
    set_y_ticks_in_thousands(ax, global_min, global_max)
    ax.grid(True, linestyle='--', alpha=0.7)

    # Create the dummy patch (invisible or empty)
    dummy_patch = Patch(facecolor='none', edgecolor='none', label='')

    # Reorder patches as desired:

    legend_patches = [
        Patch(facecolor=colors["Local-only"], edgecolor='black', hatch='', label="Local-only"),
        Patch(facecolor=colors["Cloud-only"], edgecolor='black', hatch='', label="Cloud-only"),
        Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='', label="AdaptHubα Overall"),
        Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='//', label="AdaptHubα Local"),
        Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='\\\\', label="AdaptHubα Remote"),
        Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='', label="AdaptHub Overall"),
        Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='//', label="AdaptHub Local"),
        Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='\\\\', label="AdaptHub Remote")
    ]
    reordered_patches = [
        # Row 1
        Patch(facecolor=colors["Local-only"], edgecolor='black', hatch='', label="Local-only"),
        Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='', label="AdaptHubα Overall"),
        Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='', label="AdaptHub Overall"),
        # Row 2
        Patch(facecolor=colors["Cloud-only"], edgecolor='black', hatch='', label="Cloud-only"),
        Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='//', label="AdaptHubα Local"),
        Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='//', label="AdaptHub Local"),
        # Row 3
        dummy_patch,
        Patch(facecolor=colors["AdaptHubAlpha"], edgecolor='black', hatch='\\\\', label="AdaptHubα Remote"),
        Patch(facecolor=colors["AdaptHub"], edgecolor='black', hatch='\\\\', label="AdaptHub Remote")
    ]

    unique_labels = {}
    for p in legend_patches:
        if p.get_label() not in unique_labels:
            unique_labels[p.get_label()] = p

    # ax.legend(unique_labels.values(), unique_labels.keys(), fontsize=16, loc="upper right", ncol=3)
    ax.legend(reordered_patches, [p.get_label() for p in reordered_patches],
              fontsize=14, loc="upper right", ncol=3)

    plt.tight_layout()
    output_path = os.path.join(PLOTS_DIR, f"time_variance_comparison_{total_apps}_bar.pdf")
    plt.savefig(output_path, dpi=300)
    print(f"Saved: {output_path}")
    plt.show()
