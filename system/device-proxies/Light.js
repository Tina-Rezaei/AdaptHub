module.exports = class Light {
    constructor(context = {"access": "Light","context":{"period": "5"}}) { // default context value if not provided
        if (context == "service") {
            this.context = context;
        } else {
            this.voiceAssistantName = context['access'];
            this.activityPeriod = context['context']['period'];
            this.startTime = null;
        }
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
        return 0;

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
    }

}