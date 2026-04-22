import math
import time
import sys
import pyomo.environ as pyo
from DecisionMaking import rash
from postponing import naive_postponing
from privacy_oblivious import privacy_oblivious_algo


scale_factor = 1e8
def pars_decisions(res, tasks, total_rsc, cpu_core_counts):
    quotas = {}
    period = 100000
    shares = 1024
    sum_cpu = 0

    print(f"\n[OPTIMIZER] ===== Decisions =====")
    for task_id in tasks.keys():
        quota = pyo.value(res.q[task_id]) * 1000  # convert to microseconds
        alpha = pyo.value(res.alpha[task_id])
        sum_cpu += pyo.value(res.q[task_id])
        
        location = "CLOUD" if alpha == 1 else "LOCAL"
        app_name = tasks[task_id]["appName"]
        print(f"[OPTIMIZER]   {app_name}: {location} (quota={quota:.0f}µs)")
        
        quotas[task_id] = {
            "alpha": alpha,
            "shares": shares,
            "quota": quota,
            "period": period,
            "appName": app_name
        }
    
    print(f"[OPTIMIZER] Total CPU allocated: {sum_cpu:.2f}ms")
    print(f"[OPTIMIZER] ====================\n")
    return quotas


def check_constraints(quotas, tasks, res, time_slice):
    for task_id, task_specs in tasks.items():
        if quotas[task_id]["alpha"] == 0:
            # exec_time = task_specs["comp"]/((pyo.value(res.F[task_id])) * scale_factor)
            exec_time = (task_specs["comp"] * time_slice)/(pyo.value(res.phi[task_id]) * pyo.value(res.available_local_budget))
            if exec_time > task_specs["timeBudget"]:
                print("constrints are not satisfied", exec_time, tasks[task_id]["appName"])
                # print("check constraints", exec_time)
            else:
                print("Constraints are satisfied", exec_time, tasks[task_id]["appName"] )
    return


def optimization_executor(data):
    path_to_save = "./"
    
    tasks = data["tasks"]
    execution_queue = tasks
    bacckhaul_budget = data["backHaul"]
    cpu_core_counts = data["cpuCoreCount"]
    total_cpu_budget = 100 * cpu_core_counts  # ms
    time_slice = 100
    rsc_budget = data["idleCpuRatio"] * total_cpu_budget
    obj_function = data["decisionMakingAlgo"]
    counter = 0

    print(f"\n[OPTIMIZER] Received {len(tasks)} task(s)")
    print(f"[OPTIMIZER] Algorithm: {obj_function}")
    print(f"[OPTIMIZER] CPU budget: {rsc_budget:.2f}ms ({cpu_core_counts} cores, {data['idleCpuRatio']*100:.1f}% idle)")

    if len(tasks) == 0:
        print("[OPTIMIZER] No tasks to optimize")
        return None, {}, {}

    while True:
        start = time.time()
        print(f"[OPTIMIZER] Running solver...")
        
        if obj_function == "minMaxPrivacy":
            solver_solution, status = rash(rsc_budget, execution_queue, time_slice)
        else:
            solver_solution, status = privacy_oblivious_algo(rsc_budget, execution_queue, time_slice)
        
        end = time.time()
        print(f"[OPTIMIZER] Solver completed in {(end - start)*1000:.2f}ms (status: {status})")
        print("problem status: ", status)
        if status  == 'optimal' or status == 'maxTimeLimit':
            # print("counter", counter)
            quotas = pars_decisions(solver_solution, execution_queue, total_cpu_budget, cpu_core_counts)
            check_constraints(quotas, tasks, solver_solution, time_slice)
            return quotas

        if len(execution_queue) <= 1:
            return solver_solution, {}

        # there is no optimal or feasible solution, so, postpone some tasks
        execution_queue = naive_postponing(execution_queue, rsc_budget, bacckhaul_budget,f'{path_to_save}')

        counter += 1
