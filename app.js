require('dotenv').config();
const express = require('express')
const app = express();
const bodyParser = require('body-parser');
const helmet = require('helmet');
const {asyncLocalStorage, integrationGenerateContext} = require('./config/context');
const {integrationAttachResponseBody, integrationAttachContext, httpLogger} = require('./config/httpLogger');

app.use(integrationAttachResponseBody);
app.use(integrationGenerateContext);
app.use(integrationAttachContext);
app.use(bodyParser.json({ type: 'application/json', limit: '100mb', parameterLimit: 100000, extended: true }));
app.use(bodyParser.urlencoded({ limit: '100mb', parameterLimit: 100000, extended: true }));
app.use(bodyParser.text());
app.use(helmet());

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            message: "request not permitted",
            error: true,
        });
    }
});

app.use('/', require('./routes'));

app.use((req, res, next) => {
    const err = new Error('Route Not Found');
    res.status(err.status || 404);
    res.json({
        message: err.message,
        error: true,
    });
});

module.exports = app;