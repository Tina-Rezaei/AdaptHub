import random
import json
import os


def logger(message):
    with open("log.txt", "a") as f:
        f.write(f'{message} \n')


def log_postponement(tasks_ids, path_to_save):
    if os.path.exists(os.path.join(path_to_save, 'postponement_log')):
        with open(os.path.join(path_to_save, 'postponement_log'), 'r') as f:
            postpone_dict = json.load(f)
        elements = postpone_dict.get(str(0),[])
        elements.append(tasks_ids)
        postpone_dict[0] = elements
        with open(os.path.join(path_to_save, 'postponement_log'), 'w') as f:
            json.dump(postpone_dict, f)
    else:
        with open(os.path.join(path_to_save, 'postponement_log'), 'w') as f:
            json.dump({0:[tasks_ids]}, f)


def naive_postponing(exec_q, rsc_budget, backhaul_budget, path_to_save):
    f_dropped = 0
    total_required_f = 0
    total_required_b = 0
    all_tasks = {}
    postponed_tasks = []
    waiting_queue = {}

    for task_id, task_specs in exec_q.items():
        if task_specs["alpha"] == 0:
            total_required_f += task_specs['required_comp'] / (task_specs['time_budget'])
            all_tasks.update({task_id: task_specs})
        else:
            total_required_b += task_specs['required_comp'] / task_specs['time_budget']
            all_tasks.update({task_id: task_specs})


    all_tasks_sorted = dict(sorted(all_tasks.items(), key=lambda item: (item[1]['time_budget']), reverse=True))
    f_excessive = total_required_f - rsc_budget
    b_excessive = total_required_b - backhaul_budget

    if f_excessive < 0:
        logger("naive postponing required. total required computation by local tasks is lower than "
                            "available computational resources.")

        task_id, task_specs = list(all_tasks_sorted.items())[0]
        all_tasks_sorted.pop(task_id)
        waiting_queue.update({task_id: task_specs})
        postponed_tasks.append(task_id)
    else:
        while f_dropped < f_excessive and (len(all_tasks_sorted) > 1):
            logger("naive postponing required. total required computation by local tasks is more than "
                                "available computational resources.")
            task_id, task_specs = list(all_tasks_sorted.items())[0]
            all_tasks_sorted.pop(task_id)
            waiting_queue.update({task_id: task_specs})
            postponed_tasks.append(task_id)
            if task_specs["alpha"] == 0:
                f_dropped += task_specs['remained_comp'] / task_specs['remained_time_budget']

    #  part 2
    sorted_data = sorted(waiting_queue.items(), key=lambda item: (item[1]['remained_time_budget']))
    sorted_waiting_queue = {key: value for key, value in sorted_data}
    backhaul_returned = 0

        # while backhaul_returned < b_excessive:
        #     if len(sorted_waiting_queue) > 0:
        #         task_id, task_specs = list(sorted_waiting_queue.items())[0]
        #         # if (task_specs["alpha"] == 0 and task_specs["decided"]):
        #         if (task_specs["alpha"] == 0 and task_specs["decided"]) or task_specs["decided"] == False:
        #             sorted_waiting_queue.pop(task_id)
        #             continue
        #         sorted_waiting_queue.pop(task_id)
        #         postponed_tasks.remove(task_id)
        #         all_tasks_sorted.update({task_id: task_specs})
        #         backhaul_returned += task_specs['untransmitted_data'] / task_specs['remained_time_budget']
        #     else:
        #         break

    log_postponement(postponed_tasks , path_to_save)

    return all_tasks_sorted



