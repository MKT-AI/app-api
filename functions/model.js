const COMMON = require("modules/common");
const ERROR = require("modules/error");
const DB = require("modules/DB");
const PRE = require("modules/preprocess");
const UTIL = require("modules/util");
const S3 = require("modules/S3");
const FZ = require("modules/freezed");

module.exports.new = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { name, description = "", members = [], isPublic = false } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.insert("Model", {
      _p_owner: _p_user,
      name,
      description,
      _r_members: [
        ...new Set([_p_user, ...members.map((userId) => `User$${userId}`)]),
      ],
      isPublic,
      status: FZ.MODEL_STATUS.ACTIVE,
    })
      .then((result) => {
        return COMMON.response(200, { result });
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

module.exports.list = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { brief, show_public } = event.queryStringParameters || {};

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const showPublic = show_public == "true" || show_public == 1;

    const models = await DB.findAll(
      "Model",
      {
        $or: [
          {
            _r_members: _p_user,
          },
          showPublic
            ? {
                isPublic: true,
              }
            : undefined,
        ].filter(Boolean),
        isDeleted: { $ne: true },
        status: { $ne: FZ.MODEL_STATUS.BLIND },
      },
      { ...(!!brief && { projection: { name: 1 } }) }
    );
    if (!!brief) {
      return COMMON.response(200, { models });
    }
    const users = await DB.findAll(
      "User",
      {
        _id: {
          $in: models
            .map(({ _r_members }) =>
              _r_members.map((_p_user) => _p_user.split("$")[1])
            )
            .flat(),
        },
        isDeleted: { $ne: true },
      },
      {
        projection: { username: 1 },
      }
    );
    const usernameMap = users.reduce((map, { _id, username }) => {
      map[_id] = username;
      return map;
    }, {});
    
    const data = models.map((model) => {
      const { _r_members, ...args } = model;
      const members = _r_members.map((_p_user) => {
        const [, userId] = _p_user.split("$");
        const username = usernameMap[userId] || COMMON.DELETED_USER_NAME;
        return { _id: userId, username, _p_user: `User$${userId}` };
      });
      return { ...args, members };
    });
    return COMMON.response(200, { models: data });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.update = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;
  const { modelId } = event.pathParameters;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const {
    name,
    description = "",
    members = [],
    isPublic,
    status,
  } = body;

  try {
    if (!!status && !FZ.MODEL_STATUS.isValid(status))
      throw Error(ERROR.INVALID_PARAMS);
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const model = await DB.first("Model", {
      _id: modelId,
      _r_members: _p_user,
    });

    if (!model) throw Error(ERROR.TARGET_NOT_FOUND);

    return DB.update(
      "Model",
      {
        $set: {
          name,
          description,
          _r_members: [
            ...new Set([...members.map((userId) => `User$${userId}`)]),
          ],
          isPublic,
          ...(!!status && { status }),
        },
      },
      { _id: modelId, _r_members: _p_user }
    )
      .then((result) => {
        return COMMON.response(200, { result });
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

module.exports.delete = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { method: REST_METHOD } = event.requestContext.http;

  const { modelId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    const model = await DB.first("Model", {
      _id: modelId,
      _r_members: _p_user,
    });

    if (!model) throw Error(ERROR.TARGET_NOT_FOUND);

    return DB.update(
      "Model",
      {
        $set: { status: FZ.MODEL_STATUS.BLIND, isDeleted: true },
      },
      { _id: modelId, _r_members: _p_user }
    )
      .then((result) => {
        return COMMON.response(200, { result });
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
