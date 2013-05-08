var test = require("tape")
var mongo = require("continuable-mongo")
var uuid = require("node-uuid")
var setTimeout = require("timers").setTimeout

var eventLog = require("../index")
var client = mongo("mongodb://localhost:27017/colingo-group-tests")
var collectionName = uuid()
var col = client.collection(collectionName)
var rawCollection = client.collection(collectionName + "@")

var SECOND = 1000
var MINUTE = 60 * SECOND
var HOUR = 60 * MINUTE

test("ensure col is capped", function (assert) {
    client(function (err, db) {
        assert.ifError(err)

        db.createCollection(collectionName, {
            capped: true
            , size: 100000
        }, function (err, res) {
            assert.ifError(err)

            assert.end()
        })
    })
})

test("can add to eventLog", function (assert) {
    var log = eventLog(col, {
        timeToLive: HOUR
        , rawCollection: rawCollection
    })
    var id = uuid()

    log.add("add", {
        id: id
        , timestamp: Date.now()
        , type: "some-event"
    }, function (err, value) {
        assert.ifError(err)

        assert.equal(value.eventType, "add")
        assert.ok(value._id)
        assert.equal(value.value.id, id)

        log.close()

        assert.end()
    })
})

test("can read from eventLog", function (assert) {
    var log = eventLog(col, {
        rawCollection: rawCollection
        , timeToLive: HOUR
    })

    var stream = log.read(Date.now() - 1000)

    setTimeout(function () {
        log.add("add", {
            id: uuid()
            , timestamp: Date.now()
            , type: "some-event"
            , foo: "inserted after"
        }, function (err, value) {
            assert.ifError(err)
        })
    }, 20)

    log.add("add", {
        id: uuid()
        , timestamp: Date.now()
        , type: "some-event"
        , foo: "inserted before"
    }, function (err, value) {
        assert.ifError(err)

        var list = []
        var cleanupCounter = 2

        stream.on("data", function (chunk) {
            list.push(chunk)
            if (list.length === 3) {
                next()
            }
        })

        stream.resume()

        function next() {
            assert.equal(list.length, 3)
            assert.equal(list[0].value.type, "some-event")
            assert.equal(list[1].value.foo, "inserted before")
            assert.equal(list[2].value.foo, "inserted after")

            rawCollection(function (err, rawCollection) {
                assert.ifError(err)

                rawCollection.drop(function (err) {
                    assert.ifError(err)

                    if (--cleanupCounter === 0) {
                        cleanup()
                    }
                })
            })

            col(function (err, col) {
                assert.ifError(err)

                col.drop(function (err) {
                    assert.ifError(err)

                    if (--cleanupCounter === 0) {
                        cleanup()
                    }
                })
            })
        }

        function cleanup() {
            log.close()

            console.log("cleanup")
            client.close(function (err) {
                assert.ifError(err)

                assert.end()
            })
        }
    })
})
