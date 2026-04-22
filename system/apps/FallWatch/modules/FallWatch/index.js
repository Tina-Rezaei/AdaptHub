
async function processTriggerEvent() {
    // console.log("FallWatch app received event:",event);
    logger.log.info(`FallWatch app received event: ${event}`);
    let start = logger.timeLog("fallwatch-app-streamin-to-care-center", "start");
    // console.log("FallWatch: Trying to forward stream from a living room camera to the agent.");
    logger.log.info("FallWatch: Trying to forward stream from a living room camera to the agent.");
    let wsWriteStream = await NetworkClient.createWebSocketStream(`ws://${env.FALLWATCH_CLOUD_SERVER}:8123`,'utf8');
    let stream = LivingRoomCam.getStream();
    stream.pipe(wsWriteStream, { end: false });


    stream.on('end', () => {
        let end = logger.timeLog("fallwatch-app-streamin-to-care-center", "end");
        logger.addExperimentResults("fallwatch-app-streamin-to-care-center", end-start)
        logger.log.info("FallWatch: Finished.");
        wsWriteStream.write('END');
//        logger.finishCurrentRound();
    })

    wsWriteStream.on('error', (err) => {
        logger.log.error('WebSocket Write Stream Error:', err);
        // Optional: Attempt reconnection logic here or handle errors
    });
    // logger.timeLog("fallwatch-app-streamin-to-care-center", "end");
    // logger.finishCurrentRound();
}


processTriggerEvent();