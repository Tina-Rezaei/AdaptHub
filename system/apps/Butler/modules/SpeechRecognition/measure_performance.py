import subprocess
import os
import time
import numpy as np
import sys
# Output file to store performance measurements
platform = sys.argv[1]
if platform == "raspberry":
    output_file = f"performance_measurements_{platform}.txt"
elif platform == "server":
    output_file = f"performance_measurements_{platform}.txt"
else:
    print("enter either raspberry or server")
    exit()

# Path to your Node.js script
node_script = "./measurement.js"
# Ensure output file exists
if not os.path.exists(output_file):
    with open(output_file, 'w') as f:
        f.write("CPU_Cycles,Execution_Time(ns),Time_clock(ms),avg_cpu_cycles,Std_Dev_CPU_Cycles\n")

# Function to run the Node.js script and capture perf statistics


def find_node_path():
    try:
        # Run the 'which' command to find the Node.js binary path
        result = subprocess.run(['which', 'node'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        node_path = result.stdout.decode().strip()
        if not node_path:
            raise FileNotFoundError("Node.js not found. Please install Node.js.")
        return node_path
    except Exception as e:
        print(f"Error finding Node.js: {e}")
        return None


def run_measurement(node_path):
    # Run perf stat and capture the output into a temporary file
    with subprocess.Popen(['sudo', 'perf', 'stat', '-e', 'task-clock,cpu-cycles,duration_time', '-x,', '--', node_path, node_script],
                          stderr=subprocess.PIPE, stdout=subprocess.PIPE) as proc:
        stdout, stderr = proc.communicate()

    # Decode stderr to string and split by lines
    output_lines = stderr.decode().split('\n')
    # Extract CPU cycles and execution time
    cpu_cycles = None
    execution_time = None
    for line in output_lines:
        if 'cpu-cycles' in line:
            cpu_cycles = int(line.split(',')[0].strip())
        elif 'duration_time' in line:
            execution_time = int(line.split(',')[0].strip())
        elif 'task-clock' in line:
            task_clock = float(line.split(',')[0].strip())
    return cpu_cycles, execution_time, task_clock


# Find the Node.js path dynamically
node_path = find_node_path()

# Main loop to run the measurement every 1 minute
cpu_cycles_collected = []
while True:
    cpu_cycles, execution_time, time_clock = run_measurement(node_path)
    # Append the new measurement to our collection for std calculation
    cpu_cycles_collected.append(cpu_cycles)
    print(cpu_cycles_collected)
    avg_cpu_cycles = np.mean(cpu_cycles_collected)
    std_dev = np.std(cpu_cycles_collected)

    # Write the new data to the file with standard deviation
    with open(output_file, 'a') as f:
        f.write(f"{cpu_cycles},{execution_time},{time_clock},{avg_cpu_cycles},{std_dev}\n")

    # Sleep for 60 seconds
    time.sleep(30)



