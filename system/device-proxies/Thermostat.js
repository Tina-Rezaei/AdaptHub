module.exports = class Thermostat {
    constructor(context = {"access": "Thermostat","context":{"period": "5"}}) { // default context value if not provided
        if (context == "service") {
            this.context = context;
        } else {
            this.voiceAssistantName = context['access'];
            this.activityPeriod = context['context']['period'];
            this.startTime = null;
        }
        this.state = 0;
        this.temperature = 22;
    }

    async getState() {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        return this.state;

    }

    async setState(state) {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        this.state = state;
    }

    async getTemp() {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        return this.temperature;
    }

    async setTemp(temp) {
        if (this.context !== "service") {
            if (this.startTime!=null) {
                const millisdiff = Date.now() - this.startTime;
                if (millisdiff>this.activityPeriod*1000) return;
            } else {
                this.startTime = Date.now();
            }
        }
        this.temperature = temp
    }

}