import csv
import sys

platform = sys.argv[1]
if platform == "raspberry":
    file_path = f"performance_measurements_{platform}.txt"
elif platform == "server":
    file_path = f"performance_measurements_{platform}.txt"
else:
    print("enter either raspberry or server")
    exit()

cpu_cycles_column = []
time_column = []
with open(file_path, "r") as f:
    reader = csv.DictReader(f)
    for row in reader:
        cpu_cycles_column.append(float(row["Time_clock(ms)"]))
        time_column.append(int(row["Execution_Time(ns)"]))

print("avg_CPU_Cycles", sum(cpu_cycles_column)/len(cpu_cycles_column))
print("min_CPU_Cycles", min(cpu_cycles_column))
print("max_CPU_Cycles", max(cpu_cycles_column))

print("avg_execution_time", sum(time_column)/len(time_column))
print("min_execution_time", min(time_column))
print("max_execution_time", max(time_column))
