const TAG = "CMM";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

const ENV = Object.freeze({
  DELETED_USER_NAME: "삭제된 유저",
  DELETED_PROJECT_NAME: "삭제된 프로젝트",
  DELETED_ITEM_NAME: "삭제된 리소스"
});
Object.entries(ENV).forEach(([k, v]) => module.exports[k] = v);

module.exports.randomString = (length = 10) => {
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(
    { length },
    (_) => possible[Math.floor(Math.random() * possible.length)]
  ).join("");
};

module.exports.generateSessionToken = () => {
  const possible = "abcdefghijklmnopqrstuvwxyz0123456789",
    tokenString = Array.from(
      { length: 32 },
      (_) => possible[Math.floor(Math.random() * possible.length)]
    ).join("");
  return `sst:${tokenString}`;
};

module.exports.response = (
  statusCode,
  result,
  headers
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
  521: "TARGET_NOT_FOUND",
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

Object.entries(ERROR_MESSAGE_MAP).map(
  ([code, msg]) => (module.exports.ERROR[msg] = module.exports.ERROR(code))
);
