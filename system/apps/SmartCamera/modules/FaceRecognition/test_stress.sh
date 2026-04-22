#!/bin/bash

# Output file to store stress test logs
OUTPUT_FILE="stress_test_log.txt"

# Ensure output file exists
touch $OUTPUT_FILE

# Function to create CPU load
stress_cpu() {
    echo "Stressing CPU..." | tee -a $OUTPUT_FILE
    # Use yes to generate load on all CPU cores
    for i in $(seq $(nproc)); do
        yes > /dev/null &
    done
    echo "CPU stress started. $(nproc) processes running." | tee -a $OUTPUT_FILE
}

# Function to create memory load
stress_memory() {
    echo "Stressing Memory..." | tee -a $OUTPUT_FILE
    # Allocate memory using dd and dev/zero
    dd if=/dev/zero of=/tmp/memory_stress bs=1M count=1024 &
    echo "Memory stress started with 1GB load." | tee -a $OUTPUT_FILE
}

# Function to create I/O load
stress_io() {
    echo "Stressing I/O..." | tee -a $OUTPUT_FILE
    # Use dd to write data to disk
    dd if=/dev/zero of=/tmp/io_stress bs=1M count=1024 &
    echo "I/O stress started with 1GB write." | tee -a $OUTPUT_FILE
}

# Function to create cryptographic load (CPU intensive)
stress_crypto() {
    echo "Stressing Crypto operations..." | tee -a $OUTPUT_FILE
    # Use openssl to generate cryptographic load
    openssl speed aes-256-cbc &
    echo "Crypto stress started." | tee -a $OUTPUT_FILE
}

# Function to clean up and stop stress test
cleanup() {
    echo "Cleaning up stress test..." | tee -a $OUTPUT_FILE
    pkill yes
    rm -f /tmp/memory_stress /tmp/io_stress
    echo "Cleanup complete. Stress test stopped." | tee -a $OUTPUT_FILE
}

# Trap to ensure cleanup happens on exit
trap cleanup EXIT

# Start stress tests
stress_cpu
stress_memory
stress_io
stress_crypto

# Duration of stress test in seconds
DURATION=60
echo "Stress test running for $DURATION seconds..." | tee -a $OUTPUT_FILE
sleep $DURATION

# Cleanup and exit
cleanup
