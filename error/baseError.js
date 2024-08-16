class BaseError extends Error {
    constructor (name, statusCode, errorCode, description, errorDetails) {
        super(description)
    
        Object.setPrototypeOf(this, new.target.prototype)
        this.name = name
        this.statusCode = statusCode
        this.errorCode = errorCode
        this.description = description
        this.errorDetails = errorDetails
    }
}
   
module.exports = BaseError