const axios = require('axios');
const logger = require('./logger');

axios.interceptors.request.use(
    (config) => {
        logger.infoWithContext(`common request with axios ${JSON.stringify(config)}`)
        return config;
    },
    (error) => {
        // Tangani kesalahan jika terjadi selama penanganan permintaan
        return Promise.reject(error);
    }
);

axios.interceptors.response.use(
    (response) => {
        logger.infoWithContext(`common respon from axios headers :${JSON.stringify(response.headers)}`)
        logger.infoWithContext(`common respon from axios data :${JSON.stringify(response.data)}`)
        const accessToken = response.headers['new-access-token'];
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

module.exports = axios;