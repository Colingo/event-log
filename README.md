# event-log

[![build status][1]][2] [![dependency status][3]][4]

<!-- [![browser support][5]][6] -->

An append only event log with streaming support

## Example

An event-log is currently coupled to mongo and backed by two
    collection. A capped real time collection of events and a
    historic collection.

You configure the event log with a time to live, this means that
    the event log will keep events in memory for that period of
    time. If you try to `read()` from the log for any events
    older then `Date.now() - timeToLive` it will not return them.

The event log is designed for real time events and should be used
    in combination with snapshots, i.e. you read the recent state
    from a concrete snapshot and merge in real time data from
    the event log on the fly, preferably in the browser.

```js
var eventLog = require("event-log")

/* get a mongoDB guy somehow */
var db = someMongoDb

db.createCollection("event-log.realtime", {
    capped: true
    , size: 100000
}, function (err, res) {
    /* ensure that the real time collection is capped */
    /* this allows us to use tailable cursors */
})

var realtimeCollection = db.collection("event-log.realtime")
var rawCollection = db.collection("event-log")

var log = eventLog(realtimeCollection, {
    timeToLive: 60 * 60 * 1000 /* HOUR */
    , rawCollection: rawCollection
})

/* each piece of data being added MUST have a timestamp */
log.add("event-type", {
    /* some data */
    timestamp: Date.now()
}, function (err, record) {
    // inserted data
})

/* infinite stream of data */
var stream = log.read(Date.now() - 1000)

stream.on("data", function (item) {
    /* item from event log */
})
```

## Installation

`npm install event-log`

## Contributors

 - Raynos

## MIT Licenced

  [1]: https://secure.travis-ci.org/Colingo/event-log.png
  [2]: http://travis-ci.org/Colingo/event-log
  [3]: http://david-dm.org/Colingo/event-log.png
  [4]: http://david-dm.org/Colingo/event-log
  [5]: http://ci.testling.com/Colingo/event-log.png
  [6]: http://ci.testling.com/Colingo/event-log
