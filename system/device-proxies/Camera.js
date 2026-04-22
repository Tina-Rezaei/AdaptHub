const http = require('node:http');
const fs = require('fs');
const path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const lockfile = require('proper-lockfile');
// const fr = require('../utils/file-reader');

module.exports = class Camera {
    constructor(context = {"access": "Camera","context":{"period": "5"}}) { // default context value if not provided
        if (context == "service") {
            this.context = context;
        } else {
            this.voiceAssistantName = context['access'];
            this.activityPeriod = context['context']['period'];
            this.startTime = null;

        }
        // this.frame = fr.getImageSample();
    }

    async getFrame() {
    if (this.context !== "service") {
        if (this.startTime != null) {
            const millisdiff = Date.now() - this.startTime;
            if (millisdiff > this.activityPeriod * 1000) return;
        } else {
            this.startTime = Date.now();
        }
    }

    let framePath = path.join(__dirname, "../resources/camera-frame2.jpg");
//    try {
//        // Attempt to lock the file with retries
//        await lockfile.lock(framePath, { retries: 5, retryWait: 100 });
//
//        const frame = fs.readFileSync(framePath);
//        return frame;
//    } catch (error) {
//        console.error('Failed to read the frame:', error);
//        throw error;  // It's generally a good practice to handle or log the error adequately
//    } finally {
//        // Ensure that the lock is always released
//        try {
//            await lockfile.unlock(framePath);
//        } catch (unlockError) {
//            console.error('Failed to unlock the frame:', unlockError);
//        }
//    }

        try {
            let framePath = path.join(__dirname, "../resources/camera-frame2.jpg");
            let frame = await readFile(framePath);
            return frame;
        } catch (error) {
            console.error('Error reading frame:', error);
            throw error;  // Re-throw the error or handle it as necessary
        }        // console.log(frame);
        return frame;
         return this.frame;


    }

    getStream() {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        return fs.createReadStream(path.join(__dirname,"../resources/pose_squats.mp4"));
    }

    // async getStream(callback) {
    //     if (this.startTime!=null) {
    //         const millisdiff = Date.now() - this.startTime;
    //         if (millisdiff>this.activityPeriod*1000) return;
    //     } else {
    //         this.startTime = Date.now();
    //     }
    //     // http://81.82.235.114:8001/control/faststream.jpg?stream=full&fps=16
    //     http.get('http://81.82.235.114:8001/control/faststream.jpg?stream=full&fps=16', res => {

    //         res.on('data', chunk => { 
    //             if (this.startTime!=null) {
    //                 const millisdiff = Date.now() - this.startTime;
    //                 if (millisdiff>this.activityPeriod*1000) return;
    //             } else {
    //                 this.startTime = Date.now();
    //             }
    //             callback(chunk)
    //         }) 
    //     })
    // }

}