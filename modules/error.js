const TAG = "ERR";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

const ERROR_MESSAGE_MAP = {
  510: "INVALID_PARAMS",
  511: "INVALID_AUTH",
  512: "SESSION_NOT_FOUND",
  513: "USER_NOT_FOUND",
  519: "PASSWORD_FAILED",
  521: "TARGET_NOT_FOUND",
  522: "TARGET_DUPLICATED",
};

module.exports = (error) => ({
  isBase64Encoded: false,
  statusCode: typeof error == "object" ? error.message : error,
  headers: { "Access-Control-Allow-Origin": "*" },
  body: JSON.stringify({
    success: false,
    result: {
      message:
        ERROR_MESSAGE_MAP[typeof error == "object" ? error.message : error],
    },
  }),
});

Object.entries(ERROR_MESSAGE_MAP).map(
  ([code, msg]) => (module.exports[msg] = code)
);
