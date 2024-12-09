const moment = require("moment-timezone");
moment.locale("ko");
moment.tz.setDefault("Asia/Seoul");

const bcrypt = require("bcryptjs");

const COMMON = require("modules/common");
const ERROR = require("modules/error");
const DB = require("modules/DB");
const PRE = require("modules/preprocess");
const UTIL = require("modules/util");
const FZ = require("modules/freezed");

const SALT_ROUNDS = 10;
const HASH = async (password) => {
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  return hashed;
};

HASH.verify = async (password, hashed) => {
  const isMatched = await bcrypt.compare(password, hashed);
  return isMatched;
};

const SESSION_VALID_DAYS = 30;
module.exports.login = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { account, password } = body;

  try {
    if (!account || !password) throw ERROR.INVALID_PARAMS;

    const user = await DB.first("User", {
      account,
      status: FZ.USER_STATUS.ACTIVE,
    });

    if (!user) throw Error(ERROR.USER_NOT_FOUND);

    const { _id: userId, password: hashed } = user;

    const verified = await HASH.verify(password, hashed);
    if (!verified) throw Error(ERROR.PASSWORD_FAILED);

    const session = await DB.insert("Session", {
      token: COMMON.generateSessionToken(),
      _p_user: `User$${userId}`,
      restricted: false,
      expiresAt: moment().add(SESSION_VALID_DAYS, "d").endOf("d").toDate(),
    });

    const { token, expiresAt } = session;
    return COMMON.response(200, { token, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.validate = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  try {
    const session = await PRE.sync(event, context, callback);
    const { expiresAt } = session;

    return COMMON.response(200, { expiresAt: expiresAt.toISOString() });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.new = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { account, username, password } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const registeredUser = await DB.first("User", { account });
    if (!!registeredUser) throw Error(ERROR.TARGET_DUPLICATED);

    const hashed = await HASH(password);

    return DB.insert("User", {
      account,
      username,
      status: FZ.USER_STATUS.ACTIVE,
      password: hashed,
    }).then((result) => {
      return COMMON.response(200, { result });
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.list = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.findAll("User", {}).then((users) => {
      return COMMON.response(200, { users });
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.detail = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { userId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.first("User", {
      _id: userId,
      isDeleted: { $ne: true },
    }).then((user) => {
      return COMMON.response(200, user);
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.auth = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const { check_auth: checkAuth } = event.queryStringParameters || {};

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.first("Auth", {
      _p_user,
      isDeleted: { $ne: true },
    })
      .then((auth = {}) => {
        const { content = {} } = auth;
        const validAuths = Object.entries(content).reduce(
          (auths, [authKey, { at, validUntil, options }]) => {
            if (!!validUntil && moment(validUntil).isBefore(moment()))
              return auths;
            auths.push(authKey);
            return auths;
          },
          []
        );

        if (!!checkAuth) {
          if (!validAuths.includes(checkAuth)) throw Error(ERROR.UNAUTHORIZED);
          return COMMON.response(200, true);
        }
        return COMMON.response(200, { auth: validAuths });
      })
      .catch((e) => {
        console.error("Error: ", e.message);
        return ERROR(e);
      });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.update = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { userId } = event.pathParameters;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { account, username, password, status } = body;

  try {
    if (!FZ.USER_STATUS.isValid(status)) throw Error(ERROR.INVALID_PARAMS);
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const hashed = await HASH(password);

    return DB.update(
      "User",
      {
        $set: {
          account,
          username,
          password: hashed,
          status,
        },
      },
      { _id: userId }
    ).then((result) => {
      return COMMON.response(200, { result });
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.delete = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { userId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.update(
      "User",
      {
        $set: {
          status: FZ.USER_STATUS.INACTIVE,
          isDeleted: true,
        },
      },
      { _id: userId }
    ).then((result) => {
      return COMMON.response(200, { result });
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.search = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const { search_text: searchText } = event.queryStringParameters || {};

  try {
    if (!searchText) return COMMON.response(200, { users: [] });
    const users = await DB.findAll("User", {
      $or: [
        {
          account: { $regex: searchText, $options: "i" },
        },
        {
          username: { $regex: searchText, $options: "i" },
        },
        {
          _id: { $regex: searchText, $options: "i" },
        },
      ],
    });

    return COMMON.response(200, { users });
  } catch (e) {
    console.error("Error: ", e.message);
    return COMMON.response(200, { users: [] });
  }
};
