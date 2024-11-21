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

  const {
    type,
    name,
    description = "",
    projectId,
    metadata,
    externalUrl,
    fileExt,
  } = body;

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
      ],
      isDeleted: { $ne: true },
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

        return DB.insert("Item", {
          _p_owner: _p_user,
          type,
          fileExt,
          name,
          description,
          _p_project: `Project$${projectId}`,
          metadata,
          externalUrl,
        });
      })
      .then((result) => {
        const { _id: itemId } = result;

        return Promise.all([
          result,
          S3.createUploadUrl(
            `project/${projectId}/${type}/${itemId}.${fileExt}`
          ),
        ]);
      })
      .then(([result, uploadUrl]) => {
        return COMMON.response(200, { ...result, uploadUrl });
      });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};

module.exports.list = async (event, context, callback) => {
  console.log("processing event: %j", event);
  console.log("processing context: %j", context);

  const { projectId } = event.queryStringParameters || {};

  try {
    if (!projectId) throw Error(ERROR.INVALID_PARAMS);

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
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);
        return DB.findAll("Item", {
          _p_project: `Project$${projectId}`,
          isDeleted: { $ne: true },
        });
      })
      .then((items) => {
        return COMMON.response(200, { items });
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

  const { projectId } = event.queryStringParameters || {};
  const { itemId } = event.pathParameters;

  try {
    if (!projectId) throw Error(ERROR.INVALID_PARAMS);

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
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);
        return DB.first("Item", {
          _p_project: `Project$${projectId}`,
          _id: itemId,
          isDeleted: { $ne: true },
        });
      })
      .then((item) => {
        return COMMON.response(200, item);
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

  const { itemId } = event.pathParameters;

  const body = UTIL.jsonParser(event.body);
  console.log("processing body: %j", body);

  const {
    type,
    name,
    description = "",
    projectId,
    metadata,
    externalUrl,
    fileExt,
  } = body;

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
      ],
      isDeleted: { $ne: true },
    })
      .then((project) => {
        if (!project) throw Error(ERROR.TARGET_NOT_FOUND);

        return DB.update(
          "Item",
          {
            $set: {
              fileExt,
              name,
              description,
              metadata,
              externalUrl,
            },
          },
          { _id: itemId }
        );
      })
      .then((result) => {
        return S3.createUploadUrl(
          `project/${projectId}/${type}/${itemId}.${fileExt}`
        );
      })
      .then((uploadUrl) => {
        return COMMON.response(200, { uploadUrl });
      });
  } catch (e) {
    console.error("Error: ", e.message);
    return ERROR(e);
  }
};
