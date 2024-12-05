const WebSocket = require("ws");
let clientId;
const wsUrl = process.env.SOCKET;
let reconnectDelay = 5000;
let wsInstance = null;
const logger = require('./logger');

async function init() {
    clientId = await runNanoID(10);
}

async function runNanoID(n) {
    const { customAlphabet } = await import('nanoid');
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-';
    const id = customAlphabet(alphabet, n);
    return `socket-server-${id()}`;
}

  
function connectClientWS() {
    function connect() {
        wsInstance = new WebSocket(wsUrl);

        wsInstance.on('open', () => {
            // Register clientId
            logger.infoWithContext(`${clientId} connected to WebSocket server`)
            wsInstance.send(JSON.stringify({ type: 'register', clientId }));
        });

        wsInstance.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                logger.infoWithContext(`Message received: ${JSON.stringify(data)}`)
            } catch (e) {
                logger.errorWithContext({ error: e, message: 'Error parsing message:'})
            }
        });

        wsInstance.on('error', (err) => {
            // Graceful handling: Close the connection to trigger reconnect logic
            logger.errorWithContext({ error: err, message: `WebSocket error ${clientId}`})
            ws.close();
        });

        wsInstance.on('close', (code, reason) => {
            // Retry after a delay
            logger.infoWithContext(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`)
            logger.infoWithContext(`Retrying connection in ${reconnectDelay / 1000} seconds...`);
            setTimeout(connect, reconnectDelay);
        });

        wsInstance.on('ping', () => {
            logger.infoWithContext(`Received ping`);
            wsInstance.pong();
        });    
    }
    init();
    connect();
    return wsInstance;
}

module.exports = {
    connectClientWS,
    getWebSocket: () => wsInstance,
    WebSocket,
    clientId: () => clientId,
};