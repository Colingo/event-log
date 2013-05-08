var through = require("through")
var setInterval = require("timers").setInterval
var clearInterval = require("timers").clearInterval

module.exports = BufferedCursor

function BufferedCursor(cursorStream, options) {
    var timeToLive = options.timeToLive
    var buffer = []

    cursorStream.on("data", function (record) {
        buffer.push({ timestamp: Date.now(), value: record })
    })

    var interval = setInterval(purge, timeToLive / 2)

    createStream.destroy = function destroy() {
        clearInterval(interval)
    }

    return createStream

    function createStream(filter) {
        var stream = through(function (x) {
            if (filter(x)) {
                this.push(x)
            }
        })

        stream.pause()

        for (var i = 0; i < buffer.length; i++) {
            stream.write(buffer[i].value)
        }

        cursorStream.pipe(stream)

        return stream
    }

    function purge() {
        var now = Date.now()

        // while the first item in the buffer is too old
        // remove the head of the buffer.
        // terminates when the tail of the buffer is recent
        // this works because buffer is sorted chronologically
        while (buffer[0].timestamp < now - timeToLive) {
            buffer.shift()
        }
    }
}
