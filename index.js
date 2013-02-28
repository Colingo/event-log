var insert = require("mongo-client/insert")
var find = require("mongo-client/find")

var filter = require("reducers/filter")
var merge = require("reducers/merge")
var hub = require("reducers/hub")
var map = require("reducers/map")
var concat = require("reducers/concat")
var expand = require("reducers/expand")

var reducible = require("reducible/reducible")
var reduce = require("reducible/reduce")
var cache = require("cache-reduce/cache")

var extend = require("xtend")

var slice = Array.prototype.slice
var SECOND = 1000
var MINUTE = 60 * SECOND
var HOUR = 60 * MINUTE

module.exports = eventLog

/* Semantics::

    When inserting it inserts into the collection as normal.

    insert(type, data) does `insert(col, { eventType: type, value: data })`

    When reading it creates a single Tailable cursor and stores any
    events in a buffered queue based on insertion order where the
    back items drop off after they exceed their time to live.

    The queue should support reading in insertion order.

    When read is called we return `concat(reverse(queue), cursor)`

    When we create a fresh cursor we should read from the persisted
    collection for items between now and (now - TIME_TO_LIVE)

    Every time a TIME_TO_LIVE window passes the buffer should drop
    the last window out of memory

*/
function eventLog(col, options) {
    var cursor = createCursor(col, options)
    var bufferedCursor = BufferedCursor(cursor, options)
    var rawCollection = options.rawCollection
    var timeToLive = options.timeToLive || HOUR

    var source = concat(
        cache(find(rawCollection, {
            "value.timestamp": {
                $gt: Date.now() - timeToLive * 2
                , $lt: Date.now()
            }
        }))
        , bufferedCursor
    )

    return { add: add, read: read }

    function add(type, value) {
        var now = Date.now()

        return merge([
            insert(col, {
                eventType: type
                , timestamp: now
                , value: value
            }, { safe: true })
            , insert(rawCollection, {
                eventType: type
                , timestamp: now
                , value: value
            }, { safe: true })
        ])
    }

    function read(ts) {
        return filter(source, function (item) {
            return item.value.timestamp > ts
        })
    }
}

function BufferedCursor(cursor, options) {
    var timeToLive = options.timeToLive || HOUR
    var buffer = []

    return merge([
        hub(expand(cursor, function (item) {
            var now = Date.now()

            buffer.push(item)

            for (var i = 0; i < buffer.length; i++) {
                var item = buffer[0]

                if (!item) {
                    break
                }

                if (item.value.timestamp < now - timeToLive) {
                    buffer.shift()
                } else {
                    break
                }
            }
        }))
        , concat(buffer, cursor)
    ])
}

function createCursor(col, options) {
    options = extend({}, options)

    var lastTime = options.timestamp || Date.now()

    var cursor = find(col, {
        "value.timestamp": {
            $gte: lastTime
        }
    }, {
        sort: {
            $natural: 1
        }
        , tailable: true
        , awaitdata: true
        , numberOfRetries: -1
    })

    return hub(concat(map(cursor, function (item) {
        options.timestamp = item.value.timestamp
        return item
    }), lazy(createCursor, col, options)))
}

function lazy(f) {
    var args = slice.call(arguments, 1)

    return reducible(function (next, initial) {
        reduce(f.apply(null, args), next, initial)
    })
}
