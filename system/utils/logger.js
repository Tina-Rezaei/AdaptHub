const winston = require('winston');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// logger.js

class Logger {
  constructor(appID) {
    this.appID = appID;
    this.starters = new Map();
    this.enders = new Map();
    this.experimentResults = new Map();
    this.totalLog = {};
    this.roundRunning = false;
    this.roundCount = 0;

    // Setup winston loggers
    const myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
      return `${message}`;
    });

    this.log = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [],
    });

    this.expLog = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [],
    });

    if (process.env.NODE_ENV === 'production') {
      this.log.add(
        new winston.transports.Console({
          silent: true,
        })
      );
      this.expLog.add(
        new winston.transports.Console({
          format: myFormat,
        })
      );
    } else {
      this.log.add(
        new winston.transports.Console({
          format: myFormat,
        })
      );
      this.expLog.add(
        new winston.transports.Console({
          format: myFormat,
        })
      );
    }
  }

  /**
   * Logs the start or end time of a named event.
   * @param {string} name - The name of the event.
   * @param {'start'|'end'} type - Whether this is a start or end time.
   */
  timeLog(name, type) {
    const time = Date.now(); // Using millisecond precision
    if (type === 'start') {
      this.starters.set(name, time);
    } else if (type === 'end') {
      this.enders.set(name, time);
      // Calculate duration immediately
      if (this.starters.has(name)) {
        const duration = this.enders.get(name) - this.starters.get(name);
        if (duration < 0) {
          this.log.error(`Logger: got negative duration for ${name} key`);
        } else {
          if (!this.experimentResults.has(name)) {
            this.experimentResults.set(name, []);
          }
          this.experimentResults.get(name).push(duration);
        }
      } else {
        this.log.error(`End time logged without a start time for ${name}`);
      }
    }
  }

  /**
   * Logs a duration directly.
   * @param {string} name - The name of the event.
   * @param {number} duration - The duration in milliseconds.
   */
  durationLog(name, duration) {
    // Set start time to 0 and end time to duration
    this.starters.set(name, 0);
    this.enders.set(name, duration);
    if (!this.experimentResults.has(name)) {
      this.experimentResults.set(name, []);
    }
    this.experimentResults.get(name).push(duration);
  }

  /**
   * Reports the logged start and end times.
   * @returns {Array} An array containing starters and enders maps.
   */
  reportLoggedTimes() {
    return [this.starters, this.enders];
  }

  /**
   * Sets log times from external starters and enders lists.
   * @param {Array} starters_list - Array of starters.
   * @param {Array} enders_list - Array of enders.
   */
  setLogTime(starters_list, enders_list) {
    try {
      let starters = new Map(starters_list);
      let enders = new Map(enders_list);
      starters.forEach((startTime, key) => {
        if (!enders.has(key)) {
          throw new Error("Logger couldn't find the same key in enders map.");
        }
        let endTime = enders.get(key);
        let duration = endTime - startTime;
        if (duration < 0) {
          throw new Error(`Logger: got negative duration for ${key} key`);
        }
        if (!this.experimentResults.has(key)) {
          this.experimentResults.set(key, []);
        }
        this.experimentResults.get(key).push(duration);
      });
    } catch (error) {
      this.log.error(`Error adding log data: ${error}`);
    }
  }

  /**
   * Adds an experiment result directly.
   * @param {string} key - The name of the experiment.
   * @param {number} duration - The duration to add.
   */
  addExperimentResults(key, duration) {
    if (!this.experimentResults.has(key)) {
      this.experimentResults.set(key, []);
    }
    this.experimentResults.get(key).push(duration);
  }

  /**
   * Clears all experiment results (used after warmup rounds).
   */
  clearExperimentResults() {
    this.experimentResults.clear();
    this.totalLog = {};
  }

  /**
   * Prints the experiment results to a CSV file.
   * @param {string} appName - The application name.
   * @param {string} context - The context or environment.
   */

printExperimentResults(appName, context, iteration_number, instanceCount = 1) {
  try {
    const results = [];
    let n = 1;

    // Create results directory
    const dir = `./results/iter-${iteration_number}/`;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // File naming convention: <mode>-<app>-<instances>-<type>.<ext>
    const timingsFile = `${dir}${context}-${appName}-${instanceCount}-timings.csv`;
    const statsFile = `${dir}${context}-${appName}-${instanceCount}-stats.csv`;
    const decisionsFile = `${dir}${context}-${appName}-${instanceCount}-decisions.json`;

    // Write raw timing values to CSV
    const content = Array.from(this.experimentResults)
      .map(([key, values]) => `${key},${values.join(',')}`)
      .join('\n');
    fs.writeFileSync(timingsFile, content);

    // Calculate mean and standard deviation
    results.push(`operation,${context}-runtime,${context}-stdev`);
    this.experimentResults.forEach((values, key) => {
      try {
        const total = values.reduce((sum, val) => sum + val, 0);
        const meanVal = total / values.length;

        // Calculate standard deviation
        const variance =
          values.reduce((sum, val) => sum + Math.pow(val - meanVal, 2), 0) / (values.length - 1);
        const stdev = Math.sqrt(variance);

        this.expLog.info(`${n}, ${meanVal}, ${stdev}`);
        results.push(`${key}, ${meanVal}, ${stdev}`);
        n += 1;
      } catch (calcError) {
        console.error(`Error calculating stats for operation ${key}:`, calcError);
      }
    });

    // Write statistics to CSV
    try {
      fs.writeFileSync(statsFile, results.join('\r\n'));
      console.log(`Results written: ${statsFile}`);
    } catch (writeError) {
      console.error('Error writing stats CSV:', writeError);
    }

    // Write decisions/specs to JSON
    try {
      fs.writeFileSync(decisionsFile, JSON.stringify(this.totalLog, null, 2));
      console.log(`Decisions written: ${decisionsFile}`);
    } catch (jsonError) {
      console.error('Error writing decisions JSON:', jsonError);
    }
  } catch (error) {
    console.error('An unexpected error occurred in printExperimentResults:', error);
  }
}


  /**
   * Stores application-specific data.
   * @param {string} key - The application ID or name.
   * @param {Object} data - The data to store.
   */
  storeAppSpecs(key, data) {
    if (this.totalLog.hasOwnProperty(key)) {
      Object.keys(data).forEach((newKey) => {
        this.totalLog[key][newKey] = data[newKey];
      });
    } else {
      this.totalLog[key] = { ...data };
    }
  }

  /**
   * Finalizes the current logging round.
   * Processes all timing events that have both start and end times.
   * Warns about incomplete events but doesn't fail.
   */
  finishCurrentRound() {
    try {
      // Find events that are missing end times
      const missingEnds = [];
      const missingStarts = [];
      
      this.starters.forEach((_, key) => {
        if (!this.enders.has(key)) {
          missingEnds.push(key);
        }
      });
      
      this.enders.forEach((_, key) => {
        if (!this.starters.has(key)) {
          missingStarts.push(key);
        }
      });
      
      // Warn about incomplete events
      if (missingEnds.length > 0) {
        console.warn(`Logger: ${missingEnds.length} event(s) started but not ended:`, missingEnds);
      }
      if (missingStarts.length > 0) {
        console.warn(`Logger: ${missingStarts.length} event(s) ended without start:`, missingStarts);
      }
      
      // Process only complete events (those with both start and end)
      let processedCount = 0;
      this.starters.forEach((startTime, key) => {
        if (this.enders.has(key)) {
          const endTime = this.enders.get(key);
          const duration = endTime - startTime;
          
          if (duration < 0) {
            console.warn(`Logger: Negative duration for '${key}' (${duration}ms), skipping`);
            return;
          }
          
          if (!this.experimentResults.has(key)) {
            this.experimentResults.set(key, []);
          }
          this.experimentResults.get(key).push(duration);
          processedCount++;
        }
      });
      
      console.log(`Logger: Processed ${processedCount} timing events`);
      
      this.starters.clear();
      this.enders.clear();
      this.roundCount += 1;
      this.roundRunning = false;
    } catch (error) {
      console.error(`Logger error in finishCurrentRound: ${error}`);
      // Still reset state to allow next round
      this.starters.clear();
      this.enders.clear();
      this.roundRunning = false;
    }
  }

  /**
   * Starts a new logging round.
   */
  startNewRound() {
    this.roundRunning = true;
  }

  /**
   * Checks if a logging round is currently running.
   * @returns {boolean} True if a round is running, false otherwise.
   */
  isRoundRunning() {
    return this.roundRunning;
  }

  /**
   * Gets the current round count.
   * @returns {number} The round count.
   */
  getRoundCount() {
    return this.roundCount;
  }

  /**
   * Calculates durations from starters and enders lists.
   * @param {Array} starters_list - Array of starters.
   * @param {Array} enders_list - Array of enders.
   * @returns {Object} An object containing durations.
   */
  getDuration(starters_list, enders_list) {
    const durationDict = {};
    try {
      const starters = new Map(starters_list);
      const enders = new Map(enders_list);
      starters.forEach((startTime, key) => {
        if (!enders.has(key)) {
          throw new Error("Logger couldn't find the same key in enders map.");
        }
        const endTime = enders.get(key);
        const duration = endTime - startTime;
        if (duration < 0) {
          throw new Error(`Logger: got negative duration for ${key} key`);
        }
        durationDict[key] = duration;
      });
    } catch (error) {
      this.log.error(`Error calculating durations: ${error}`);
    }
    return durationDict;
  }

  /**
   * Gets the durations of all logged events.
   * @returns {Object} An object containing event durations.
   */
  getDurations() {
    const durations = {};
    this.experimentResults.forEach((values, key) => {
      durations[key] = values;
    });
    return durations;
  }
}

module.exports = Logger;






























//
//let currentRoundLogStarters = new Map();
//let currentRoundLogEnders = new Map();
//let experimentResults = new Map();
//
//let roundRunning = false;
//let roundCount = 0;
//let totalLog = {}
//
//
//class MultiMap {
//    constructor() {
//        this.map = new Map();
//    }
//
//    add(key, value) {
//        if (!this.map.has(key)) {
//            this.map.set(key, []);
//        }
//        this.map.get(key).push(value);
//    }
//
//    get(key) {
//        return this.map.get(key) || [];
//    }
//}
//
//
//const multiMap = new MultiMap();
//
//
//const log = winston.createLogger({
//    level: 'info',
//    format: winston.format.simple(),
//    // defaultMeta: { service: 'user-service' },
//    transports: [],
//});
//
//const expLog = winston.createLogger({
//    level: 'info',
//    format: winston.format.json(),
//    // defaultMeta: { service: 'user-service' },
//    transports: [],
//});
//
//const myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
//    // return `${timestamp} [${label}] ${level}: ${message}`;
//    return `${message}`;
//  });
//
////
//// If we're not in production then log to the `console` with the format:
//// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
////
//if (process.env.NODE_ENV === 'production') {
//    log.add(new winston.transports.Console({
//        silent: true
//    }));
//    expLog.add(new winston.transports.Console({
//        format: myFormat,
//    }));
//
//} else {
//    log.add(new winston.transports.Console({
//        format: myFormat,
//    }));
//    expLog.add(new winston.transports.Console({
//        format: myFormat,
//    }));
//}
//
//
//const setLogTime = function (starters_list, enders_list) {
////    new Map(starters).forEach((value, key) => {
////        currentRoundLogStarters.set(key, value);
////    });
////    new Map(enders).forEach((value, key) => {
////        currentRoundLogEnders.set(key, value);
////    });
//    try {
//    let starters = new Map(starters_list)
//    let enders = new Map(enders_list)
//    starters.forEach((value,key) => {
//        let startTime = value;
//        if (!enders.has(key)) {
//            throw new Error("Logger Couldn't find the same key in enders map.")
//        }
//        let endTime = enders.get(key);
//        let duration = endTime - startTime;
//        if (duration<0) {
//            throw new Error(`Logger: got negative duration for ${key} key`)
//        }
//        if (experimentResults.has(key)) {
//            let durationList = experimentResults.get(key);
//            durationList.push(duration);
//        } else {
//            experimentResults.set(key,[duration]);
//        }
//    })
//    }
//    catch (error){
//    console.log(`error adding log data $error`)
//    }
//}
//
//
//
//const reportLoggedTimes = function (){
//    return [currentRoundLogStarters, currentRoundLogEnders]
//}
//
//const timeLog = function (name,type) {
////    if (roundCount<15) return;
//    // console.log("HERE?",roundCount)
//    if (type==="start") {
//        let loggedTime = new Date().getTime()
//        currentRoundLogStarters.set(name,loggedTime)
//        return loggedTime
//    }
//    if (type==="end") {
//        let loggedTime = new Date().getTime()
//        currentRoundLogEnders.set(name,loggedTime)
//        return loggedTime
//
//    }
//};
//
//
//const durationLog = function (name, duration) {
//        currentRoundLogStarters.set(name,0)
//        currentRoundLogEnders.set(name,duration)
//};
//
//
//const addExperimentResults = function (key, duration) {
//    if (experimentResults.has(key)) {
//            let durationList = experimentResults.get(key);
//            durationList.push(duration);
//        } else {
//            experimentResults.set(key,[duration]);
//        }
//}
//
//
//
//const printExperimentResults = function(appName,context) {
//    results = []
//    n = 1;
////    console.log("here is all the elements ==============================================")
//    const content = Array.from(experimentResults)
//    .map(([key, values]) => `${key},${values.join(',')}`) // Join key and its array of values
//    .join('\n');
//
//    fs.writeFile(`./eval-results-${appName}-${context}-all.csv`, content, (err) => {
//      if (err) {
//        console.error('Error writing to file', err);
//      } else {
//        console.log('Dictionary with arrays has been written to dictionary.txt');
//      }
//    });
//
////    console.log(experimentResults)
//    results.push(`operation,${context}-runtime, ${context}-stdev`)
//    experimentResults.forEach((value,key) => {
//        // console.log(`${key}, ${value}`);
//        var total = 0;
//        for(var k in value)
//           total += value[k];
//        var meanVal = total / value.length;
//        // CALCULATE AVERAGE
//
//        // CALCULATE STANDARD DEVIATION
//        var SDprep = 0;
//        for(var k in value)
//           SDprep += Math.pow((parseFloat(value[k]) - meanVal),2);
//        var SDresult = Math.sqrt(SDprep/(value.length-1));
//        // CALCULATE STANDARD DEVIATION
//
//        // expLog.info("Total:"+ total);
//        // expLog.info("Mean:" + meanVal);
//        // expLog.info("Stdev:" + SDresult);
//
//        expLog.info(`${n}, ${meanVal}, ${SDresult}`);
//        results.push(`${key}, ${meanVal}, ${SDresult}`)
//        // expLog.info(`${key}, ${value}`);
//        n += 1;
//    })
//    console.log(experimentResults.keys());
//    fs.writeFileSync(`./eval-results-${appName}-${context}.csv`, results.join("\r\n"), (err) => {
//        console.log(err || "done");
//    });
//    fs.writeFile('./eval-results-all-apps.json', JSON.stringify(totalLog, null, 2), (err) => console.log(err))
//}
//
//const finishCurrentRound = function() {
//    // console.log(currentRoundLogStarters.size, currentRoundLogEnders.size);
//    try {
//        if (currentRoundLogStarters.size !== currentRoundLogEnders.size) {
//            throw new Error("Logger: Starters and Enders lists are not the same size.")
//        }
//        currentRoundLogStarters.forEach((value,key) => {
//            let startTime = value;
//            if (!currentRoundLogEnders.has(key)) {
//                throw new Error("Logger Couldn't find the same key in enders map.")
//            }
//            let endTime = currentRoundLogEnders.get(key);
//            let duration = endTime - startTime;
//            if (duration<0) {
//                throw new Error(`Logger: got negative duration for ${key} key`)
//            }
//            if (experimentResults.has(key)) {
//                let durationList = experimentResults.get(key);
//                durationList.push(duration);
//            } else {
//                experimentResults.set(key,[duration]);
//            }
//        })
//        currentRoundLogStarters.clear();
//        currentRoundLogEnders.clear();
//        roundCount += 1;
//        roundRunning = false;
//    } catch (error) {
//        // console.log(error);
//        log.info(`Something went wrong: ${error}`);
//    }
//
//}
//
//const startNewRound = function() {
//    // console.log("Current round is", roundCount);
//    roundRunning = true;
//}
//
//const isRoundRunning = function() {
//    return roundRunning;
//}
//
//const getRoundCount = function() {
//    return roundCount;
//}
//
//
//
//const getDuration = function (starters_list, enders_list) {
//    durationDict = {}
//    try {
//    let starters = new Map(starters_list)

//    let enders = new Map(enders_list)
//    starters.forEach((value,key) => {
//        let startTime = value;
//        if (!enders.has(key)) {
//            throw new Error("Logger Couldn't find the same key in enders map.")
//        }
//        let endTime = enders.get(key);
//        let duration = endTime - startTime;
//        if (duration<0) {
//            throw new Error(`Logger: got negative duration for ${key} key`)
//        }
//        durationDict[key] = duration
//    })
//    }
//    catch (error){
//    console.log(`error adding log data $error`)
//    }
//    return durationDict
//}
//
//
//function storeAppSpecs(key, newDictionary) {
//    // Check if the key exists in the target object
//    if (totalLog.hasOwnProperty(key)) {
//        // If the key exists, merge the existing values with the new dictionary values
//        Object.keys(newDictionary).forEach(newKey => {
//            // add the new key-value pair
//                totalLog[key][newKey] = newDictionary[newKey];
//            })
//    } else {
//        // If the key doesn't exist, simply add the new dictionary under the key
//        totalLog[key] = { ...newDictionary };
//    }
//}
//
//
//module.exports = {log, expLog, timeLog, printExperimentResults,finishCurrentRound,startNewRound,isRoundRunning,getRoundCount,reportLoggedTimes,setLogTime,durationLog,addExperimentResults,storeAppSpecs,getDuration};
