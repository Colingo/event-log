var jsonBody = require("body/json")
var sendJson = require("send-data/json")
var Router = require("routes").Router

var isSend = /\/send$/
var isQuery = /.*\/query\/(.+)/

module.exports = EventLogRouter

/*  EventLog is a router where you can handle event's and queries.

    ```js
    var router = EventLogRouter(EventLog(...))

    router.addRoute("/event/{{ev.value.type}}", function (ev, req, res) {
        // is this event valid?
        // store it
        // return some kind of error or ok message
    })
    router.addRoute("/event/*", function (ev, req, res) {
        // all other events not manually enumerated
    })
    router.addRoute("/query/{{query.name}}", function () {
        // someone asked for a query
        // find the thing in the database
        // return it
    })

    httpRouter.addRoute("/event-log/*", router)
    ```

    To use this you should make http requests to

        POST /event-log/send EVENT_BODY
        POST /event-log/query/QUERY_NAME
*/

function EventLogRouter(log, opts) {
    var router = Router()
    var notFound = (opts && opts.notFound) || fourofour

    handler.addRoute = function addRoute(uri, fn) {
        router.addRoute(uri, fn)
    }

    return handler

    function handler(req, res) {
        var uri = req.url
        var isSendRequest = uri.match(isSend)
        var isQueryRequest = uri.match(isQuery)

        if (!isSendRequest && !isQueryRequest) {
            return fourofour(req, res)
        }

        jsonBody(req, res)(function (err, body) {
            if (err) {
                return sendJson(req, res, {
                    body: { message: err.message },
                    statusCode: 500
                })
            }

            var route

            if (isSendRequest) {
                var type = body && body.value && body.value.type

                if (type) {
                    route = router.match("/event/" + type)
                } else {
                    route = router.match("/event")
                }
            } else if (isQueryRequest) {
                var viewName = isQueryRequest[1]
                route = router.match("/query/" + viewName)
            }

            if (!route) {
                return fourofour(req, res)
            }

            route.fn(req, res, body, route.params)
        })
    }

    function fourofour(req, res) {
        sendJson(req, res, {
            body: {
                message: "event-log-server: 404 Not Found"
            },
            statusCode: 404
        })
    }
}
