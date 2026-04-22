module.exports = class AppTabacRules {
    constructor(tabacRules) {
        this.rules = JSON.parse(tabacRules);
    }


    getRules() {
        return this.rules;
    }


}

