module.exports.randomString = (l) => {
  let text = "",
    possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < l; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

module.exports.generateSessionToken = () => {
  let text = "sstk:",
    possible = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

module.exports.response = (
  statusCode,
  result,
  headers = { "Access-Control-Allow-Origin": "*" }
) => ({
  isBase64Encoded: false,
  statusCode: statusCode,
  headers,
  body: JSON.stringify({
    success: parseInt(statusCode / 100) == 2,
    result,
  }),
});

const ERROR_MESSAGE_MAP = {
  510: "INVALID_PARAMS",
  511: "USER_NOT_FOUND",
  512: "SESSION_NOT_FOUND",
};
module.exports.ERROR = (error) => ({
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
