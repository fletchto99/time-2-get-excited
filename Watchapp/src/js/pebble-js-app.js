/*
* KiezelPay Integration Library - v1.4 - Copyright Kiezel 2016
*
* BECAUSE THE LIBRARY IS LICENSED FREE OF CHARGE, THERE IS NO 
* WARRANTY FOR THE LIBRARY, TO THE EXTENT PERMITTED BY APPLICABLE 
* LAW. EXCEPT WHEN OTHERWISE STATED IN WRITING THE COPYRIGHT 
* HOLDERS AND/OR OTHER PARTIES PROVIDE THE LIBRARY "AS IS" 
* WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED OR IMPLIED, 
* INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF 
* MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. THE ENTIRE
* RISK AS TO THE QUALITY AND PERFORMANCE OF THE LIBRARY IS WITH YOU.
* SHOULD THE LIBRARY PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL 
* NECESSARY SERVICING, REPAIR OR CORRECTION.
* 
* IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN 
* WRITING WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MAY 
* MODIFY AND/OR REDISTRIBUTE THE LIBRARY AS PERMITTED ABOVE, BE 
* LIABLE TO YOU FOR DAMAGES, INCLUDING ANY GENERAL, SPECIAL, 
* INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING OUT OF THE USE OR 
* INABILITY TO USE THE LIBRARY (INCLUDING BUT NOT LIMITED TO LOSS
* OF DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY 
* YOU OR THIRD PARTIES OR A FAILURE OF THE LIBRARY TO OPERATE WITH
* ANY OTHER SOFTWARE), EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN 
* ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
*/

/* === KIEZELPAY === SET TO false BEFORE RELEASING === */
var KIEZELPAY_LOGGING = true;
/* === KIEZELPAY === SET TO false BEFORE RELEASING === */


/**********************************************************************/
/* === KIEZELPAY === GENERATED CODE BEGIN === DO NOT MODIFY BELOW === */
/**********************************************************************/
var kiezelPayAppMessageHandler = null;

function kiezelPayInit(appMessageHandler) {
  kiezelPayLog("kiezelPayInit() called");
  kiezelPayAppMessageHandler = appMessageHandler;
  
  var msg = {
    "KIEZELPAY_READY": 1
  };
  Pebble.sendAppMessage(msg, 
                        function(e) {
                          kiezelPayLog("KiezelPay Ready msg successfully sent.");
                        },
                        function(e) {
                          kiezelPayLog("KiezelPay Ready msg failed.");
                        });
}

function kiezelPayLog(msg) {
  if (KIEZELPAY_LOGGING) {
    console.log(msg);
  }
}

var xhrRequest = function (url, type, callback, errorCallback, timeout) {
  try {
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
      callback(this.responseText);
    };
    xhr.open(type, url);
    if (timeout) {
      xhr.timeout = timeout;
    }
    xhr.send();
  }
  catch (ex) {
    if (errorCallback) {
      errorCallback(ex);
    }
  }
};

function kiezelPayOnAppMessage(appmsg) {
  if (appmsg && appmsg.payload && 
      appmsg.payload.hasOwnProperty('KIEZELPAY_STATUS_CHECK') && 
      appmsg.payload.KIEZELPAY_STATUS_CHECK > 0) {
    //its a status check message, handle it
    var devicetoken = appmsg.payload.KIEZELPAY_DEVICE_TOKEN;
    var appId = appmsg.payload.KIEZELPAY_APP_ID;
    var random = appmsg.payload.KIEZELPAY_RANDOM;
    var accounttoken = Pebble.getAccountToken();
    var platform = getPlatform();
    
    //build url
    var kiezelpayStatusUrl = 'https://www.kiezelpay.com/api/v1/status?';
    kiezelpayStatusUrl += 'appid=' + encodeURIComponent(appId);
    kiezelpayStatusUrl += '&devicetoken=' + encodeURIComponent(devicetoken);
    kiezelpayStatusUrl += '&rand=' + encodeURIComponent(random);
    kiezelpayStatusUrl += '&accounttoken=' + encodeURIComponent(accounttoken);
    kiezelpayStatusUrl += '&platform=' + encodeURIComponent(platform);
    kiezelpayStatusUrl += '&flags=' + encodeURIComponent(appmsg.payload.KIEZELPAY_STATUS_CHECK);
    kiezelpayStatusUrl += '&nocache=' + encodeURIComponent(Math.round(new Date().getTime()));
    kiezelPayLog(kiezelpayStatusUrl);
    
    //perform the request
    xhrRequest(kiezelpayStatusUrl, "GET", 
      function(responseText) {
        kiezelPayLog("KiezelPay status response: " + responseText);
        var response = JSON.parse(responseText);
        var status = 0;
        var trialDuration = 0;
        var paymentCode = 0;
        var purchaseStatus = 0;
        if (response.status === 'unlicensed') {
          status = 0;
          paymentCode = Number(response.paymentCode);
          if (response.purchaseStatus == 'waitForUser') {
            purchaseStatus = 0;
          }
          else if (response.purchaseStatus == 'inProgress') {
            purchaseStatus = 1;
          }
        } else if (response.status == 'trial') {
          status = 1;
          trialDuration = Number(response.trialDurationInSeconds);
        } else if (response.status == 'licensed') {
          status = 2;
        }

        var msg = {
          KIEZELPAY_STATUS_RESULT: status,
          KIEZELPAY_STATUS_TRIAL_DURATION: trialDuration,
          KIEZELPAY_PURCHASE_CODE: paymentCode,
          KIEZELPAY_PURCHASE_STATUS: purchaseStatus,
          KIEZELPAY_STATUS_VALIDITY_PERIOD: response.validityPeriodInDays,
          KIEZELPAY_STATUS_CHECKSUM: kiezelpay_toByteArray(response.checksum)
        };
        kiezelPayLog("KiezelPay watch status msg: " + JSON.stringify(msg));
        Pebble.sendAppMessage(msg,
                              function (e) {
                                kiezelPayLog('KiezelPay status msg successfully sent to watch');
                              },
                              function (e) {
                                kiezelPayLog('KiezelPay status msg failed sending to watch');
                              });
      },
      function (error) {
        kiezelPayLog('KiezelPay status request failed: ' + JSON.stringify(error));
        kiezelpay_sendInternetFailedMsg();
      }, 5000);
    return true;    //its our message, we handled it
  }
  
  return false;    //not a kiezelpay message
}

function kiezelpay_sendInternetFailedMsg() {
  var msg = {
    KIEZELPAY_INTERNET_FAIL: 1
  };
  Pebble.sendAppMessage(msg,
                        function (e) {
                          kiezelPayLog('KiezelPay internet fail successfully sent');
                        },
                        function (e) {
                          kiezelPayLog('KiezelPay internet fail not sent');
                        });
}

function kiezelpay_toByteArray(hexStringValue) {
  var bytes = [];
  for (var i = 0; i < hexStringValue.length; i += 2) {
    bytes.push(parseInt(hexStringValue.substr(i, 2), 16));
  }
  return bytes;
}

function getPlatform() {
  if (Pebble.getActiveWatchInfo) {
    return Pebble.getActiveWatchInfo().platform;
  }
  else {
    return "aplite";
  }
}

Pebble.addEventListener("appmessage", function (e) {
  if (!kiezelPayOnAppMessage(e) && kiezelPayAppMessageHandler) {
    kiezelPayAppMessageHandler(e);
  }
});

/********************************************************************/
/* === KIEZELPAY === GENERATED CODE END === DO NOT MODIFY ABOVE === */
/********************************************************************/


var update = function() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://www.kickstarter.com/projects/597507018/pebble-2-time-2-and-core-an-entirely-new-3g-ultra/stats.json?v=1');
    xhr.send();
    xhr.onload = function() {
        var result = JSON.parse(xhr.responseText);
        Pebble.sendAppMessage({
            BACKERS: result.project.backers_count.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,"),
            MONEY: result.project.pledged.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
        }); 
    };
}

var onAppMessageReceived = function(e) {
    update();
}

Pebble.addEventListener('showConfiguration', function(e){
    Pebble.openURL('https://www.kickstarter.com/projects/597507018/pebble-2-time-2-and-core-an-entirely-new-3g-ultra');
});

Pebble.addEventListener('ready', function(e) {
    kiezelPayInit(onAppMessageReceived);
    update();
});