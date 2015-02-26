var child = require('child_process');

function confirm(doYouWant, callback) {
    child.exec(__dirname + "/gui/node-webkit/nw " + __dirname + "/gui/confirm.nw " + doYouWant, function(err, stdout, stderr) {
        if (err) {
            callback(err, null);
        }
        callback(null, stdout.indexOf("toothless_confirm_yes") >= 0)
    });
}

module.exports = {
    confirm: confirm
}