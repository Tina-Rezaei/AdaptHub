const si = require('systeminformation');
const fs = require('fs');
const os = require('os');
const path = require('path')

function getIdleCPU() {
  return new Promise((resolve, reject) => {
    try {
      const start = readCpuTimes();
      // Wait for a short interval to calculate the difference
      setTimeout(() => {
        const end = readCpuTimes();
        const idlePercentage = calculateIdlePercentage(start, end);
        resolve(idlePercentage);
      }, 100); // 100 milliseconds is a reasonable interval to measure CPU usage
    } catch (error) {
      reject(`Failed to get CPU times: ${error}`);
    }
  });
}

function readCpuTimes() {
  const data = fs.readFileSync('/proc/stat', 'utf8');
  const lines = data.split('\n');
  for (const line of lines) {
    if (line.startsWith('cpu ')) {
      const columns = line.trim().split(/\s+/).slice(1); // Ignore 'cpu' label
      return columns.map(Number);
    }
  }
  throw new Error('CPU data not found');
}

function calculateIdlePercentage(start, end) {
  const [user1, nice1, system1, idle1, iowait1, irq1, softirq1, steal1] = start;
  const [user2, nice2, system2, idle2, iowait2, irq2, softirq2, steal2] = end;

  const idleDiff = (idle2 + iowait2) - (idle1 + iowait1);
  const totalDiff =
    (user2 + nice2 + system2 + idle2 + iowait2 + irq2 + softirq2 + steal2) -
    (user1 + nice1 + system1 + idle1 + iowait1 + irq1 + softirq1 + steal1);

  return (idleDiff / totalDiff) * 100;
}

async function idleCPURatio() {
  try {
    const idlecpu = await getIdleCPU();
    console.log(`Total idle CPU percentage: ${idlecpu.toFixed(2)}%`);
    return (idlecpu.toFixed(2)) * 0.01;
  } catch (error) {
    console.error('Failed to get CPU report::', error);
    throw error;
  }
}

//async function idleCPURatio() {
//
//  try {
//    const load = await si.currentLoad();
//    const idlePercentage = 100 - load.currentLoad; // Assuming 'currentload' is active CPU
//    console.log(`Total idle CPU percentage: ${idlePercentage.toFixed(2)}%`);
//    console.log(idlePercentage)
//    return idlePercentage;
//  } catch (error) {
//    console.error('Failed to get CPU load:', error);
//    throw error;
//  }
//}

async function totalCpuFrequency() {
    try {
        // Fetch detailed CPU information
        const cpuData = await si.cpu();

        let totalMaxFrequency;

        // Use the speedMax value directly if available
        if (!isNaN(cpuData.speedMax)) {
            totalMaxFrequency = cpuData.speedMax * cpuData.cores;
        } else {
            const speedData = await si.cpuCurrentSpeed();
            // Use the max speed from the current speed data
            totalMaxFrequency = speedData.max * cpuData.cores;
        }

        console.log(`Total theoretical maximum CPU capacity (in GHz): ${totalMaxFrequency.toFixed(2)}`);
        return totalMaxFrequency;
    } catch (error) {
        console.error('Error fetching CPU information:', error);
    }
}


function getNumberOfCores(){
    const cpuCount = os.cpus().length;
    return cpuCount
}

// Calculate CPU usage difference between two snapshots
// Calculate CPU usage difference for each core
function calculateCpuUsageDifference(startUsage, endUsage) {
    return startUsage.map((startCpu, index) => {
        const endCpu = endUsage[index];

        const totalStartTime =
            startCpu.times.user +
            startCpu.times.nice +
            startCpu.times.sys +
            startCpu.times.idle +
            startCpu.times.irq +
            (startCpu.times.iowait || 0);

        const totalEndTime =
            endCpu.times.user +
            endCpu.times.nice +
            endCpu.times.sys +
            endCpu.times.idle +
            endCpu.times.irq +
            (endCpu.times.iowait || 0);

        const idleDelta = endCpu.times.idle - startCpu.times.idle;
        const totalDelta = totalEndTime - totalStartTime;

        if (totalDelta === 0) {
            return 0; // Avoid division by zero
        }

        return 100 * (1 - idleDelta / totalDelta); // Per-core usage
    });
}


// Function to get CPU usage at a particular moment
function getCpuUsage(previous) {
    const cpus = os.cpus();
    if (previous) {
        return calculateCpuUsageDifference(previous, cpus);
    }
    return cpus;
}



// Function to write logs to a file
function logToFile(message, logFilePath) {
    fs.appendFile(logFilePath, message + '\n', (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}


// Function to monitor CPU usage during execution of a target function
async function monitorCpuDuringExecution(logger, context, numberOfInstances, iteration_number) {
    return new Promise(async (resolve) => {
       const logFilePath = `./results/iter-${iteration_number}/${context}-${numberOfInstances}-cpu.txt`;
        const dir = path.dirname(logFilePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(logFilePath, '');
        const frequency = 100; // 100 millisecond interval for logging

        // Start monitoring
        console.log('Start CPU Monitoring...');

        // Capture initial system-wide CPU usage
        let startUsage = getCpuUsage(false);

        let loggingActive = true;
        let extraLogging = false;
        let extraLoggingStartTime = null;

        // Start logging both system-wide and process-specific CPU utilization
        const intervalId = setInterval(() => {
            if (!logger.isRoundRunning() && !extraLogging) {
                // Start extra logging for 1 second
                extraLogging = true;
                extraLoggingStartTime = Date.now();
            }

            // Get the next snapshot of CPU usage
            const currentUsage = getCpuUsage(startUsage); // Delta calculation

            // Log per-core CPU usage
            if (Array.isArray(currentUsage)) {
                currentUsage.forEach((coreUsage, coreIndex) => {
                    const coreMessage = `Core ${coreIndex}: ${coreUsage.toFixed(2)}%`;
                    logToFile(coreMessage, logFilePath);
                });

                // Calculate total CPU usage
                const totalCpuUsage = currentUsage.reduce((acc, coreUsage) => acc + coreUsage, 0) / currentUsage.length;

                // Log total CPU usage
                const totalMessage = `Total CPU Usage: ${totalCpuUsage.toFixed(2)}%`;
                logToFile(totalMessage, logFilePath);
            }

            // Update startUsage to current state to compare in the next interval
            startUsage = getCpuUsage(false);

            // Process CPU usage logging
            const currentProcessUsage = process.cpuUsage();
            const processMessage = `Process CPU at ${Date.now()}: ${JSON.stringify(currentProcessUsage)}`;
            logToFile(processMessage, logFilePath);

            // Check if extra logging period is over
            if (extraLogging && Date.now() - extraLoggingStartTime >= 2000) {
                clearInterval(intervalId);
                resolve();
            }
        }, frequency);




    });
}



module.exports = { idleCPURatio, totalCpuFrequency, monitorCpuDuringExecution, getCpuUsage, getNumberOfCores}