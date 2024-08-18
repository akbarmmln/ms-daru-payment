const axios = require('axios');
const logger = require('./logger');

axios.interceptors.request.use(
    (config) => {
        config.headers = customDataHeader(config.headers);
        return config;    
    },
    (error) => {
        // Tangani kesalahan jika terjadi selama penanganan permintaan
        return Promise.reject(error);
    }
);

axios.interceptors.response.use(
    (response) => {
        const accessToken = response.headers['access-token'];
        if (accessToken) {
            // If the token is present, set it for future requests
            axios.defaults.headers.common['access-token'] = accessToken;
        }
        return response;
    },
    (error) => {
        return Promise.reject(error);
    }
);

const customDataHeader = (headers) => {
    const newHeaders = { ...headers };

    const keysToRemove = [
        'accept',
        'host',
        'connection',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'user-agent',
        'sec-ch-ua-platform',
        'origin',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-dest',
        'accept-encoding',
        'accept-language',
        'if-none-match',
        'postman-token',
        'content-length',
        'x-request-id',
    ];

    for (const keyToRemove of keysToRemove) {
        if (headers[keyToRemove] !== undefined) {
            delete newHeaders[keyToRemove];
        }
    }

    return newHeaders;
};


module.exports = axios;