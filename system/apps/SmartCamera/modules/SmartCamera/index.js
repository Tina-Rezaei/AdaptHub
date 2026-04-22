
async function processTriggerEvent() {
//    console.log("inside smartcamera")

    logger.log.info(`SmartCamera app received event ${event}`);
    // console.log("SmartCamera: Trying to get a frame from the camera.");
    logger.log.info("SmartCamera: Trying to get a frame from the camera.");
    // Test camera connection (should only work once)
    // logger.timeLog("smartcamera-fetching-frame", "start");
    let frame = await Doorcam.getFrame();
    // logger.timeLog("smartcamera-fetching-frame", "end");
    // console.log('SmartCamera: Got frame?',frame!=null);
    logger.log.info(`SmartCamera: Got frame? ${frame!=null}`);
    
    let start = logger.timeLog("smartcamera-sending-unknown-frame-cloud", "start");
    // console.log("SmartCamera: Trying to send a camera frame via a network connection.");
    logger.log.info("SmartCamera: Trying to send a camera frame via a network connection.");
    // Test network connection (should only work once)
//    let response = await NetworkClient.sendDataViaNetSocket(env.SMARTCAMERA_CLOUD_SERVER, 8133, frame)
    // console.log('SmartCamera: Got response?', response!=null);
//    logger.log.info(`SmartCamera: Got response? ${response!=""}. ${response}`);
    let end = logger.timeLog("smartcamera-sending-unknown-frame-cloud", "end");
    logger.addExperimentResults("smartcamera-sending-unknown-frame-cloud", end-start)

//    logger.finishCurrentRound();
}

processTriggerEvent();