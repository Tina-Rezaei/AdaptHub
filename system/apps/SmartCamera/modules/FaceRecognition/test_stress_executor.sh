#!/bin/bash

# Path to the target script you want to run
TARGET_SCRIPT="./test_stress.sh"

# Optional: Path to a log file
LOG_FILE="./logfile.log"

# Check if the target script exists and is executable
if [[ ! -x "$TARGET_SCRIPT" ]]; then
    echo "Error: Target script $TARGET_SCRIPT not found or not executable." | tee -a "$LOG_FILE"
    exit 1
fi

# Infinite loop
while true; do
    # Get current timestamp
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

    # Log the start of execution
    echo "[$TIMESTAMP] Starting execution of $TARGET_SCRIPT" | tee -a "$LOG_FILE"

    # Execute the target script
    bash "$TARGET_SCRIPT" >> "$LOG_FILE" 2>&1

    # Check if the target script executed successfully
    if [[ $? -ne 0 ]]; then
        echo "[$TIMESTAMP] Error: $TARGET_SCRIPT encountered an issue." | tee -a "$LOG_FILE"
        # Optional: Exit the loop if the script fails
        # exit 1
    else
        echo "[$TIMESTAMP] Completed execution of $TARGET_SCRIPT successfully." | tee -a "$LOG_FILE"
    fi

    # Sleep for 5 minutes (300 seconds)
    echo "[$TIMESTAMP] Sleeping for 5 minutes before next execution." | tee -a "$LOG_FILE"
    sleep 300
done
