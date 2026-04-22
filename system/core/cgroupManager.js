const { exec } = require('child_process');

function manageCgroup(action, cgroupName, options = {}) {
    return new Promise((resolve, reject) => {
        let cmd;

        switch (action) {
            case 'create':
                cmd = `sudo mkdir /sys/fs/cgroup/${cgroupName}`;
                break;
            case 'set':
                const { alpha, shares, quota, period } = options;
                cmd = [
                    `echo ${shares} | sudo tee /sys/fs/cgroup/${cgroupName}/cpu.weight`,
                    `echo "${quota} ${period}" | sudo tee /sys/fs/cgroup/${cgroupName}/cpu.max`
                ].join(' && ');
                break;
            case 'addpid':
                cmd = `echo ${options.pid} | sudo tee /sys/fs/cgroup/${cgroupName}/cgroup.procs`;
                break;
            case 'kill':
                cmd = `sudo kill -9 ${options.pid}`;
                break;
            case 'remove':
                cmd = `sudo rmdir /sys/fs/cgroup/${cgroupName}`;
                break;
            default:
                return reject(new Error('Invalid action'));
        }

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error managing cgroup: ${stderr}`);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}


module.exports = { manageCgroup };
