const HttpStatusCode = require('./httpStatusCode');

function httpErrorText(httpCode) {
    switch (httpCode) {
        case HttpStatusCode.OK:
            return 'OK'
        case HttpStatusCode.BAD_REQUEST:
            return 'BAD REQUEST';
        case HttpStatusCode.NOT_FOUND:
            return 'NOT FOUND';
        case HttpStatusCode.UNAUTHORIZED:
            return 'UNAUTHORIZED';
        case HttpStatusCode.FORBIDDEN:
            return 'FORBIDDEN';
        case HttpStatusCode.SERVICE_UNAVAILABLE:
            return 'SERVICE UNAVAILABLE';
        case HttpStatusCode.INTERNAL_SERVER:
        default:
            return 'INTERNAL SERVER ERROR';            
    }
}

module.exports = httpErrorText