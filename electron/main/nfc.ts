// NFC card reader related functions

const pcsc = require('pcsclite')();

let nfcCardHandler  : { (msg : string) : void } | undefined;
let nfcErrorHandler : { (msg : string) : void } | undefined;

// APDU CMD: Get Data
const apduCmdPacket = Buffer.from([
    0xff, // Class
    0xca, // INS
    0x00, // P1: Get current card UID
    0x00, // P2
    0x00  // Le: Full Length of UID
]);

let handleApduCmdResponse = (err, response) => {

    if (err) {
        console.log(err);
        nfcErrorHandler && nfcErrorHandler(err.message || err.toString());
        return;
    }

    if (response.length < 2) {
        console.log(`Invalid response length ${response.length}. Expected minimal length was 2 bytes.`);
        return;
    }

    // last 2 bytes are the status code
    const statusCode = response.slice(-2).readUInt16BE(0);

    // an error occurred
    if (statusCode !== 0x9000) {
        let msg = 'Could not get card UID.'
        console.log(msg);
        nfcErrorHandler && nfcErrorHandler(msg);
        return;
    }

    // Device sends UID bytes LSB first.  We convert this to upper-case hex string as-is (numerically reversed).
    // strip out the status code (the rest is UID)
    const uid = response.slice(0, -2).toString('hex').toUpperCase();

    nfcCardHandler && nfcCardHandler(uid);
    console.log('Card UID is', uid);
}

pcsc.on('reader', function(reader) {

    console.log('New reader detected', reader.name);

    reader.on('error', function(err) {
        console.log('Error(', this.name, '):', err.message);
    });

    reader.on('status', function(status) {
        // console.log('Status(', this.name, '):', status);
        /* check what has changed */
        var changes = this.state ^ status.state;
        if (changes) {
            if ((changes & this.SCARD_STATE_EMPTY) && (status.state & this.SCARD_STATE_EMPTY)) {
                // console.log("card removed");/* card removed */
                reader.disconnect(reader.SCARD_LEAVE_CARD, function(err) {
                    if (err) {
                        console.log(err);
                    } else {
                        // console.log('Disconnected');
                    }
                });
            } else if ((changes & this.SCARD_STATE_PRESENT) && (status.state & this.SCARD_STATE_PRESENT)) {
                //console.log("card inserted");/* card inserted */
                reader.connect({ share_mode : this.SCARD_SHARE_SHARED }, function(err, protocol) {
                    if (err) {
                        console.log("connect error", err);
                        nfcErrorHandler && nfcErrorHandler("NFC connect error")
                    } else if (protocol === undefined) {
                        nfcErrorHandler && nfcErrorHandler("NFC connect undefined protocol argument")
                    } else {
                        // console.log('Protocol(', reader.name, '):', protocol);
                        reader.transmit(apduCmdPacket, 12, protocol, handleApduCmdResponse);
                    }
                });
            }
        }
    });

    reader.on('end', function() {
        console.log('Reader',  this.name, 'removed');
    });
});

pcsc.on('error', function(err) {
    console.log('PCSC error', err.message);
});

function setNfcCardHandler(handler? : { (uid : string) : void })
{
    nfcCardHandler = handler
}

function setNfcErrorHandler(handler? : { (uid : string) : void })
{
    nfcErrorHandler = handler
}

export { setNfcCardHandler, setNfcErrorHandler }

