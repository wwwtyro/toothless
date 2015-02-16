var pubsub = require('pubsub');

// -------------------------------------------------------------
// Wraps pubsub with functionality to return the most recent 
// message on subscribe.
// -------------------------------------------------------------
module.exports = function() {

    var self = this;

    var ps = pubsub();
    var hist = [];

    self.subscribe = function(callback) {
        callback.apply(undefined, hist);
        ps.subscribe(callback);
    }

    self.publish = function() {
        hist = arguments;
        ps.publish.apply(undefined, arguments);
    }

    return self;
}