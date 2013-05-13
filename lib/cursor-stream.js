var inject = require("reconnect/inject")
var through = require("through")

module.exports = CursorStream

/* The cursor stream is a stream representation of the tailable
    cursor with retry baked in.
*/
function CursorStream(collection, options) {
    var lastTime = Date.now() - options.timeToLive
    var openStream = through()

    var reconnector = inject(function createConnection() {
        var cursor = collection.find({
            "timestamp": {
                $gte: lastTime
            }
        }, {
            sort: {
                $natural: 1
            },
            tailable: true,
            awaitdata: true,
            numberOfRetries: -1
        })

        var cursorStream = cursor.stream(function transform(value) {
            lastTime = value.timestamp

            return value
        })

        openStream.once("close", function () {
            reconnector.disconnect()
            cursorStream.destroy()
        })

        return cursorStream
    })({ immediate: true }, function (stream) {
        stream.pipe(openStream, {
            end: false
        })
    }).connect()

    return openStream
}
