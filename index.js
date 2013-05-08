var timestamp = require("monotonic-timestamp")

var CursorStream = require("./lib/cursor-stream")
var BufferedCursor = require("./lib/buffered-cursor")

module.exports = eventLog

/* Semantics::

    ## Addition

    When inserting it inserts into the collection as normal.

    add(type, data) does `col.insert({ eventType: type, value: data })`

    ## Reading

    When reading it creates a single Tailable cursor and stores any
    events in a buffered queue based on insertion order where the
    back items drop off after they exceed their time to live.

    The queue should support reading in insertion order.

    When read is called we return `concat(queue, cursor)`

    When we create a fresh cursor we should read from the persisted
    collection for items between now and (now - TIME_TO_LIVE)

    Every time a TIME_TO_LIVE window passes the buffer should drop
    the last window out of memorycd ev

*/
function eventLog(collection, options) {
    var rawCollection = options.rawCollection
    if (!options.timeToLive) {
        options.timeToLive = 120 * 1000
    }

    var cursorStream = CursorStream(collection, options)
    var bufferedCursor = BufferedCursor(cursorStream, options)

    return { add: add, read: read, close: close }

    function add(type, value, realtime, cb) {
        if (typeof realtime === "function") {
            cb = realtime
            realtime = true
        }

        var now = timestamp()
        var counter = realtime ? 1 : 2

        rawCollection.insert([{
            eventType: type,
            timestamp: now,
            value: value
        }], { safe: true }, handleResult)

        if (realtime !== false) {
            collection.insert([{
                eventType: type,
                timestamp: now,
                value: value
            }], { safe: true }, handleResult)
        }

        function handleResult(err, records) {
            if (err) {
                return cb(err)
            }

            if (--counter === 0) {
                cb(null, records[0])
            }
        }
    }

    function read(ts) {
        return bufferedCursor(function (x) {
            return x.timestamp > ts
        })
    }

    function close() {
        cursorStream.destroy()
        bufferedCursor.destroy()
    }
}
