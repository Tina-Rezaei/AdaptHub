async function processTriggerEvent() {
    // console.log("Butler app received event:",event);
    console.log("inside butler")

    logger.log.info("Butler app received event:",event);

    // console.log("The voice command was: ", event);

    // making a call to a remote STT service
    let originalVoiceCommand = await VoiceAssistant.getLastVoiceCommandAudio();

    let start = logger.timeLog("butler-app-sending-audio-to-cloud","start")

     // console.log("Butler: Sending voice command audio to the backend server.");
    logger.log.info("Butler: Sending voice command audio to the backend server.");

    let response = await NetworkClient.sendAudioViaNetSocket(env.BUTLER_CLOUD_SERVER, 8124, originalVoiceCommand);
    let result = response.result
    // console.log('Butler: Got response:', response);
    logger.log.info(`Butler: Got response: ${response}`);

    let end = logger.timeLog("butler-app-sending-audio-to-cloud","end")
    logger.addExperimentResults("butler-app-sending-audio-to-cloud", end-start)

    start = logger.timeLog("butler-app-controlling-thermostat","start")


    let currentTemp = Thermostat.getTemp();
    let newTemp = currentTemp + 5;


    if (result.includes("make it warmer")) {
        logger.log.info("Butler: Updating state of the thermostat locally.");
        Thermostat.setTemp(newTemp)
    }

    end = logger.timeLog("butler-app-controlling-thermostat","end")
    logger.addExperimentResults("butler-app-controlling-thermostat", end-start)

    start = logger.timeLog("butler-app-sending-command-to-va","start")
    VoiceAssistant.say("Okay, setting a warmer temperature");
    end = logger.timeLog("butler-app-sending-command-to-va","end")
    logger.addExperimentResults("butler-app-sending-command-to-va", end-start)

    logger.finishCurrentRound();


}

processTriggerEvent();