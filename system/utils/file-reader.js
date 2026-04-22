const fs = require('fs');
const path = require('path');

let audioSample = null;
// let videoSample = null;
let imageSample = null;

const loadSamples = function() {
    audioSample = fs.readFileSync(path.join(__dirname,"../resources/make-it-warmer.raw"));
    // videoSample = fs.readFile(path.join(__dirname,"../resources/pose_squats.mp4"));
    imageSample = fs.readFileSync(path.join(__dirname,"../resources/camera-frame2.jpg"));
}

const getAudioSample = function() {
    return audioSample;
}

const getImageSample = function() {
    return imageSample;
}

module.exports = {loadSamples, getAudioSample, getImageSample}