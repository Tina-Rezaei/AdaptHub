const mqtt = require('mqtt');
//const logger = require('../utils/logger');


module.exports = class EventEngine {
    constructor(appRuntime, logger) {
        this.appRuntime = appRuntime;
        this.client = mqtt.connect();
        this.logger = logger
        let that = this;
        /**
         * Subscribe to all possible events supported by the system
         */
        this.client.subscribe('FaceRecognitionEvent', (err) => {
             if (err) console.log('Error subscribing to topic.', err);
//            if (err) logger.log.info('Error subscribing to topic.', err);
        })

        this.client.subscribe('FallDetectionEvent', (err) => {
             if (err) console.log('Error subscribing to topic.', err);
//            if (err) logger.log.info('Error subscribing to topic.', err);
        })

        this.client.subscribe('SpeechRecognitionEvent', (err) => {
             if (err) console.log('Error subscribing to topic.', err);
//            if (err) logger.log.info('Error subscribing to topic.', err);
        })
        
        this.client.on('connect', function () {
            // message is Buffer
             console.log('MQTT client connected')
//            logger.log.info('MQTT client connected')
        })
        this.client.on('message', function (eventType, event) {
            // message is Buffer
            console.log("event received by mqtt")
//            logger.log.info(`MQTT Client received event: ${event.toString()} of type: ${eventType}.`)
             console.log(`MQTT Client received event: ${event.toString()} of type: ${eventType}.`)
            that.processIncomingEvents(eventType,JSON.parse(event));
        })
    }
    
  
    async addEvent(eventType, event) {
        this.logger.timeLog("event-engine-processing-event","start")
        this.client.publish(eventType,JSON.stringify(event));
    }
    
    async processIncomingEvents(eventType, event) {
        // forward event to the app runtime
        this.appRuntime.processEvent(eventType,event);
    }
}
