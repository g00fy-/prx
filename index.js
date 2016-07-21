const http = require('http');
const request = require('request');
const url = require('url');
const Cache = require('lru-cache');
const debug = require('debug')('prx');


const cache = Cache();

function serve(res, {statusCode, headers, body}) {
    res.writeHead(statusCode, headers);
    res.write(body);
    res.end();
}


class Proxy {
    constructor({url = arguments[0]}) {
        this.baseUrl = url;
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        this.cache = Cache();
    }

    handleRequest(req, res) {
        const upstreamUrl = `${this.baseUrl}${req.url}`
        const cached = cache.get(upstreamUrl);

        if (cached) {
            serve(res, cached)
            debug('hit', upstreamUrl)
        } else {
            debug('miss', upstreamUrl)
            const chunks = [];
            const response = request({
                url: upstreamUrl,
                encoding: null
            }, (err, response, body) => {
                if (err) {
                    // skip handling exceptions
                    response.end();
                    return
                }
                let value = Object.assign({ body }, response)
                cache.set(upstreamUrl, value);
                serve(res, value)
            })
        }
    }

    listen(...args) {
        this.server.listen(...args);
        return this;
    }
}

if (!module.parent) {
    let PORT = process.env.PORT || 8000;
    let URL = process.argv[2] || process.env.HOST;
    if (!URL) {
        process.exit(1)
    }
    let proxy = new Proxy({ url: URL }).listen(PORT, () => {
        debug(`listening on port ${PORT}`);
        debug(`redirecting to "${URL}"`)
    });
}

module.exports = {
    Proxy,
    createServer(...agrs) {
        return new Proxy(...agrs)
    }
}