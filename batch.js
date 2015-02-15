//Original source: http://oli.me.uk/2013/09/11/handling-concurrency-and-asynchronous-javascript/

/**
 * Executes a list of functions that call back when they are finished.
 *
 * @class
 * @param {Array} functions Target methods to execute when requested.
 * @param {Function} completionHandler Executed when all target functions are finished.
 */
function Batch(functions, completionHandler) {
    this._functions = functions;
    this._completionHandler = completionHandler;
}


/**
 * Executes the functions passed to the constructor.
 */
Batch.prototype.execute = function execute() {
    var i;
    var functions = this._functions;
    var length = this._remaining = functions.length;
    this._results = [];

    for (i = 0; i < length; i += 1) {
        functions[i](this);
    }
};


/**
 * Signifies that another function has finished executing. Can be provided with
 * a value to store in the results array which is passed to the completion
 * handler.
 *
 * All functions in the batch must call this when done.
 *
 * @param {*} [result] Optional value to store and pass back to the completion handler when done.
 */
Batch.prototype.done = function done(result) {
    this._remaining -= 1;

    if (typeof result !== 'undefined') {
        this._results.push(result);
    }

    if (this._remaining === 0) {
        this._completionHandler(this._results);
    }
};