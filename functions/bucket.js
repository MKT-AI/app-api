const COMMON = require("modules/common");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const PREFIX_PATH = "test/";
const BUCKET_NAME = "mktcontentsbucket";

module.exports.createGetUrl = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const pathParams = event.pathParameters;
  const client = new S3Client({
    region: process.env.AWS_REGION,
  });
  const { file_key: fileKey } = pathParams;
  if (!fileKey) return callback(null, COMMON.ERROR(510));
  const objectParams = {
    Bucket: BUCKET_NAME,
    Key: `${PREFIX_PATH}${fileKey}`,
  };
  const command = new GetObjectCommand(objectParams);
  const downloadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  return COMMON.response(200, {
    url: downloadUrl,
    key: fileKey,
  });
};

module.exports.createPostUrl = async (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const pathParams = event.pathParameters;
  const client = new S3Client(clientParams);
  const { file_extension: fileExtension } = pathParams;
  if (!fileExtension) return callback(null, COMMON.ERROR(510));
  const fileKey = `${(Math.random() + 1)
    .toString(36)
    .substring(2)}.${fileExtension}`;
  const objectParams = {
    Bucket: BUCKET_NAME,
    Key: `${PREFIX_PATH}${fileKey}`,
  };
  const command = new PutObjectCommand(objectParams);
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  return COMMON.response(200, {
    url: uploadUrl,
    key: fileKey,
  });
};

module.exports.getPresignedUrl = async (event) => {
  const pathParams = event.pathParameters;
  const client = new S3Client(clientParams);
  const { file_extension: fileExtension } = pathParams;
  if (!fileExtension) return COMMON.ERROR(510);
  const fileKey = `${(Math.random() + 1)
    .toString(36)
    .substring(2)}.${fileExtension}`;
  const objectParams = {
    Bucket: BUCKET_NAME,
    Key: `${PREFIX_PATH}${fileKey}`,
  };
  const uploadCommand = new PutObjectCommand(objectParams);
  const uploadUrl = await getSignedUrl(client, uploadCommand, {
    expiresIn: 600,
  });
  const downloadCommand = new GetObjectCommand(objectParams);
  const downloadUrl = await getSignedUrl(client, downloadCommand, {
    expiresIn: 3600,
  });
  return COMMON.response(200, {
    uploadUrl,
    downloadUrl,
    key: fileKey,
  });
};
