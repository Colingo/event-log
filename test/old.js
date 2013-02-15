var test = require("tape")
var take = require("reducers/take")
var fold = require("reducers/fold")
var hub = require("reducers/hub")
var uuid = require("node-uuid")
var mongo = require("mongo-client")
var close = require("mongo-client/close")
var passback = require("callback-reduce/passback")
var introspect = require("introspect-reduce")
var setTimeout = require("timers").setTimeout

var eventLog = require("../index")
var client = mongo("mongodb://localhost:27017/colingo-group-tests")
var collectionName = uuid()
var col = client(collectionName)
var rawCollection = client(collectionName + "@")

var SECOND = 1000
var MINUTE = 60 * SECOND
var HOUR = 60 * MINUTE

test("ensure col is capped", function (assert) {
    fold(col, function (col) {
        col.db.createCollection(col.collectionName, {
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

    var command = log.add("add", {
        id: id
        , timestamp: Date.now()
        , type: "some-event"
    })

    passback(command, Array, function (err, values) {
        assert.ifError(err)
        var first = values[0]
        var second = values[1]

        assert.equal(first.eventType, "add")
        assert.equal(second.eventType, "add")
        assert.ok(first._id)
        assert.ok(second._id)
        assert.notEqual(String(first._id), String(second._id))
        assert.equal(first.value.id, id)
        assert.equal(second.value.id, id)

        assert.end()
    })
})

test("can read from eventLog", function (assert) {
    var log = eventLog(col, {
        rawCollection: rawCollection
        , timeToLive: HOUR
    })

    var data = hub(log.read(Date.now() - 1000))

    setTimeout(function () {
        passback(log.add("add", {
            id: uuid()
            , timestamp: Date.now()
            , type: "some-event"
            , foo: "inserted after"
        }), Array, function (err, value) {
            if (err) {
                throw err
            }
        })
    }, 20)

    passback(log.add("add", {
        id: uuid()
        , timestamp: Date.now()
        , type: "some-event"
        , foo: "inserted before"
    }), Array, function (err, value) {
        if (err) {
            throw err
        }

        passback(take(data, 3), Array, function (err, values) {
            assert.ifError(err)

            assert.equal(values.length, 3)
            assert.equal(values[0].value.type, "some-event")
            assert.equal(values[1].value.foo, "inserted before")
            assert.equal(values[2].value.foo, "inserted after")

            fold(rawCollection, function (rawCollection) {
                rawCollection.drop(function () {
                    close(rawCollection)
                })
            })
            fold(col, function (col) {
                col.drop(function () {
                    close(col)
                })
            })

            assert.end()
        })
    })
})
