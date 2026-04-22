import pyomo.environ as pyo
from pyomo.environ import *
from pyomo.opt import TerminationCondition


def rule_backhaul_bandwidth(model, backhaul_bandwidth_budget):
    return pyo.summation(model.bB) <= backhaul_bandwidth_budget


def rule_backhaul_bandwidth_auxiliary(model, i):
    return model.bb[i] * model.bB[i] == 1


def rule_frequency(model, available_local_budget):
    # return pyo.summation(model.F) <= available_local_budget
    return sum((1 - model.alpha[i]) * model.F[i] for i in model.i) <= available_local_budget


def rule_frequency_auxiliary(model, i):
    return model.f[i] * model.F[i] == 1


def rule_maximize_frequency(model, available_local_budget):
    return sum((1 - model.alpha[i]) * model.F[i] for i in model.i) >= 5/6 * available_local_budget


def frequency_limit(model, i):
    return model.F[i] >= 1000


def time_budget(model, i):
    return model.alpha[i] * (model.D[i] * model.bb[i]) <= model.t[i]


def rule_privacy_leakage(model, i):
    return model.r[i] == model.p[i] * model.alpha[i]


def risk_auxiliary(model, i):
    return model.R >= model.r[i]


def total_cpu_utilization(model):
    return sum((1 - model.alpha[i]) * model.Z[i] for i in model.i)


def cpu_utilization_objective(model):
    return total_cpu_utilization(model)


def obj_expression(model):
    return model.R


def rule_local_budget(model, available_local_budget):
    return sum((1 - model.alpha[i]) * model.q[i] for i in model.i) <= available_local_budget


def quota_definition(model, i):
    return model.q[i] == model.available_local_budget * model.phi[i]


def time_budget_local(model, i):
    return (1 - model.alpha[i]) * model.Z[i] * model.time_slice <= model.t[i] * model.phi[i] * model.available_local_budget



def privacy_oblivious_algo(rsc_budget, tasks, time_slice):
    print("resource budget", f'{rsc_budget:,}')
    backhaul_bandwidth_budget = 5 * (10**8)

    # all training tasks params
    tasks_data_size = {}
    tasks_required_comp = {}
    tasks_time_budget = {}
    tasks_privacy_score = {}
    tasks_ids = []

    for task_id, specs in tasks.items():
        tasks_data_size[task_id] = specs['dataSize']
        tasks_required_comp[task_id] = specs['comp']
        tasks_time_budget[task_id] = specs['timeBudget']
        tasks_privacy_score[task_id] = specs['privacyScore']
        tasks_ids.append(task_id)

    # scale_factor = 1e8
    scale_factor = 1
    # tasks_time_budget = {task_id: specs['timeBudget'] * scale_factor for task_id, specs in tasks.items()}
    tasks_required_comp = {task_id: specs['comp'] / scale_factor for task_id, specs in tasks.items()}
    available_local_budget = rsc_budget / scale_factor
    tasks_data_size = {task_id: specs['dataSize'] / scale_factor for task_id, specs in tasks.items()}
    backhaul_bandwidth_budget = backhaul_bandwidth_budget / scale_factor
    print("comp of tasks", tasks_required_comp)
    print("cpu cycle frequency", available_local_budget)

    model = pyo.ConcreteModel()

    model.i = pyo.Set(initialize=tasks_ids)

    # common params
    model.D = pyo.Param(model.i, initialize=tasks_data_size)

    model.t = pyo.Param(model.i, initialize=tasks_time_budget)

    model.p = pyo.Param(model.i, initialize=tasks_privacy_score)

    model.Z = pyo.Param(model.i, initialize=tasks_required_comp)

    max_p = max([value for key, value in tasks_privacy_score.items()])

    model.available_local_budget = pyo.Param(initialize=available_local_budget)

    model.time_slice = pyo.Param(initialize=time_slice)

    #  variables
    model.phi = pyo.Var(model.i, bounds=(0, 1))

    model.q = pyo.Var(model.i, bounds=(0, available_local_budget))

    model.F = pyo.Var(model.i, bounds=(1 / available_local_budget, available_local_budget))  # Frequency variables

    model.bB = pyo.Var(model.i, bounds=(1/backhaul_bandwidth_budget, backhaul_bandwidth_budget))  # Backhaul Bandwidth variables

    model.alpha = pyo.Var(model.i, domain=pyo.Binary)

    model.f = pyo.Var(model.i, bounds=(1 / available_local_budget, available_local_budget))  # auxilary variable

    model.bb = pyo.Var(model.i,
                       bounds=(1 / backhaul_bandwidth_budget, backhaul_bandwidth_budget))  # auxilary variable for backhaul bandwidth

    model.r = pyo.Var(model.i, bounds=(0, max_p))

    model.R = pyo.Var(within=pyo.Integers, bounds=(0, max_p))

    # constraints
    model.Constraint2 = pyo.Constraint(expr=rule_backhaul_bandwidth(model, backhaul_bandwidth_budget))
    model.Constraint5 = pyo.Constraint(model.i, rule=rule_backhaul_bandwidth_auxiliary)
    model.Constraint3 = pyo.Constraint(expr=rule_local_budget(model, available_local_budget))
    model.Constraint4 = pyo.Constraint(model.i, rule=quota_definition)
    # model.Constraint3 = pyo.Constraint(expr=rule_frequency(model, available_local_budget))
    # model.Constraint6 = pyo.Constraint(model.i, rule=rule_frequency_auxiliary)
    # model.Constraint11 = pyo.Constraint(expr=rule_maximize_frequency(model, available_local_budget))
    # model.Constraint4 = pyo.Constraint(model.i, rule=frequency_limit)
    model.Constraint8 = pyo.Constraint(model.i, rule=time_budget)
    model.Constraint9 = pyo.Constraint(model.i, rule=time_budget_local)

    # objective function
    model.obj_primary = pyo.Objective(rule=cpu_utilization_objective, sense=pyo.maximize)

    # call solver
    opt = pyo.SolverFactory('gurobi')

    # change solver options
    opt.options['timelimit'] = 5
    opt.options['NonConvex'] = 2
    opt.options['Presolve'] = 1
    # opt.options['ScaleFlag'] = 2
    opt.options['ObjScale'] = -1
    opt.options['AggFill'] = 0
    opt.options['Method'] = 4
    # opt.options['Method'] = 3
    opt.options['logfile'] = 'gurobi.log'
    opt.options['BarHomogeneous'] = 1

    try:
        # solve the problem
        solver_parameters = "ResultFile=model.ilp"
        results = opt.solve(model, tee=True, options_string=solver_parameters)
        # instance.display()

        # Solve again
        if results.solver.termination_condition == TerminationCondition.infeasible:
            print("---------- INFEASIBLE ---------")
            # solver_model = opt._solver_model()
            # solver_model.computeIIS()
            # solver_model.write("model.ilp")
            print("IIS written to model.ilp")
            # instance.display()

            return model, results.solver.termination_condition
        elif results.solver.termination_condition != TerminationCondition.optimal:
            print("non_optimal")
        # print(results.solver.termination_condition)
        print(results.solver.status)
        # print("==========================================")
        return model, results.solver.termination_condition
    except Exception as e:
        print(e)
        print("==========================================")
        return model, e


