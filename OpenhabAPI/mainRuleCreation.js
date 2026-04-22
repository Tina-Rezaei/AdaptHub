const postlib = require("./nodejspost_new_1");
const putlib = require("./nodejsput_new_1");

function createRuleOpenhab(hostName,postpath,username,password,payloadPostFilepath,payloadPutFilepath,ruleId,ruleName, thingID, thingChannelID,actionScript){

  var fs2 = require('fs');
  let content2 = JSON.parse(fs2.readFileSync(payloadPutFilepath, 'utf8'));
  // edit or add property
  content2.triggers[0].configuration.thingUID= thingID;
  content2.triggers[0].configuration.channelUID= thingChannelID;
  content2.uid= ruleId;
  content2.name= ruleName;
  content2.actions[0].configuration.script= actionScript;
  //write file
  fs2.writeFileSync(payloadPutFilepath, JSON.stringify(content2));

  var fs1 = require('fs');
  let content1 = JSON.parse(fs1.readFileSync(payloadPostFilepath, 'utf8'));
  // edit or add property
  content1.uid= ruleId;
  content1.name= ruleName;
  content1.triggers[0].configuration.thingUID= thingID;
  content1.triggers[0].configuration.channelUID= thingChannelID;

  //write file
  fs1.writeFileSync(payloadPostFilepath, JSON.stringify(content1));


var putpath=postpath+'/'+ruleId;
postlib.postrulestoopenhab(hostName,postpath,username,password,payloadPostFilepath);
putlib.putrulestoopenhab(hostName,putpath,username,password,payloadPutFilepath);

} //end function

module.exports = {createRuleOpenhab};
//createRuleOpenhab('localhost','/rest/rules','Sirris','Sirris2021','post-payload.json','put-payload.json','87289fc209','Test-13-10-2022-1', 'mqtt:broker:87289fc274', 'mqtt:broker:87289fc274:Opendoor','executeCommandLine("/Users/annandarath/Documents/SSHC/Openhab3/conf/scripts/OpendoorScript.sh")')
