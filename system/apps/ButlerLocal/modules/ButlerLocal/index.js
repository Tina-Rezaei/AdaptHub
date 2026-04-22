async function processTriggerEvent() {
    // console.log("Butler app received event:",event);
    logger.log.info(`ButlerLocal app received event: ${event}`);

    logger.timeLog("local-execution-butler-app-controllingThermostat","start")
    let currentTemp = Thermostat.getTemp();
    let newTemp = currentTemp + 5;

    if (event=="thermostat make it warmer") {
        console.log("ButlerLocal: Updating state of the thermostat locally.");
        Thermostat.setTemp(newTemp)
    }
    logger.timeLog("local-execution-butler-app-controllingThermostat","end")

    logger.timeLog("local-execution-butler-app-sendingCommandToVa","start")
    VoiceAssistant.say("Okay, setting a warmer temperature");
    logger.timeLog("local-execution-butler-app-sendingCommandToVa","end")

    logger.finishCurrentRound();

}

processTriggerEvent();