const BaseError = require("./baseError");
const errCode = require("./errCode");
const httpErrorText = require("./httpErrorText");
const HttpStatusCode = require('./httpStatusCode');

class ApiErrorMsg extends BaseError {
    constructor(httpCode = HttpStatusCode.INTERNAL_SERVER, errorCode = '10000', descDetails = '') {
        const name = httpErrorText(httpCode)
        const desc = errCode[errorCode] ?? 'internal server error';
        super(name, httpCode, errorCode, desc, descDetails);
    }
}

module.exports = ApiErrorMsg