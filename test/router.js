var http = require("http")
var test = require("tape")
var uuid = require("uuid")
var request = require("request")

var EventLogRouter = require("../router")

var PORT = Math.round(Math.random() * 10000) + 2000
var router = EventLogRouter()
var server = http.createServer(router)

router.addRoute("/event/foo", function (req, res, ev) {
    res.end(JSON.stringify(ev))
})
router.addRoute("/query/viewName", function (req, res, ev) {
    res.end(JSON.stringify(ev))
})

test("configure http server", function (assert) {
    server.listen(PORT, function () {
        assert.end()
    })
})

test("send an event", function (assert) {
    var id = uuid()

    request({
        method: "POST",
        uri: "http://localhost:" + PORT + "/event-log/send",
        json: {
            eventType: "add",
            value: { type: "foo", id: id }
        }
    }, function (err, res, body) {
        assert.ifError(err)
        assert.equal(res.statusCode, 200)

        assert.deepEqual(body, {
            eventType: "add",
            value: { type: "foo", id: id }
        })
        assert.end()
    })
})

test("send a query", function (assert) {
    var id = uuid()

    request({
        method: "POST",
        uri: "http://localhost:" + PORT + "/event-log/query/viewName",
        json: {
            eventType: "add",
            value: { type: "foo", id: id }
        }
    }, function (err, res, body) {
        assert.ifError(err)
        assert.equal(res.statusCode, 200)

        assert.deepEqual(body, {
            eventType: "add",
            value: { type: "foo", id: id }
        })
        assert.end()
    })
})

test("close server", function (assert) {
    server.close(function (err) {
        assert.ifError(err)

        assert.end()
    })
})
