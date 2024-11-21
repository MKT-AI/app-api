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

  const { name, description = "", members = [], isPublic } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.insert("Project", {
      _p_owner: _p_user,
      name,
      description,
      _r_members: [_p_user, ...members.map((userId) => `User$${userId}`)],
      isPublic,
      status: FZ.PROJECT_STATUS.ACTIVE,
    })
      .then((result) => {
        const { _id: projectId } = result;
        return S3.createFolder(`project/${projectId}`);
      })
      .then((result) => {
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
  const { brief } = event.queryStringParameters || {};

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.findAll(
      "Project",
      {
        $or: [
          {
            _r_members: _p_user,
          },
          {
            isPublic: true,
          },
        ],
        isDeleted: { $ne: true },
        status: { $ne: FZ.PROJECT_STATUS.BLIND },
      },
      { ...(!!brief && { projection: { name: 1 } }) }
    ).then((projects) => {
      return COMMON.response(200, { projects });
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
  const { projectId } = event.pathParameters;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.first("Project", {
      _id: projectId,
      $or: [
        {
          _r_members: _p_user,
        },
        {
          isPublic: true,
        },
      ],
      isDeleted: { $ne: true },
      status: { $ne: FZ.PROJECT_STATUS.BLIND },
    }).then((project) => {
      return COMMON.response(200, project);
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
  const { projectId } = event.pathParameters;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const { name, description = "", members = [], isPublic, apiKey } = body;

  try {
    const session = await PRE.sync(event, context, callback);
    const { _p_user } = session;

    if (!_p_user) throw Error(ERROR.USER_NOT_FOUND);

    return DB.update(
      "Project",
      {
        $set: {
          name,
          description,
          _r_members: [_p_user, ...members],
          isPublic,
          ...(!!apiKey && { apiKey }),
        },
      },
      { _id: projectId }
    ).then((result) => {
      return COMMON.response(200, { result });
    });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};
