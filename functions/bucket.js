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
  const client = new S3Client({
    region: process.env.AWS_REGION,
  });
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
  const client = new S3Client({
    region: process.env.AWS_REGION,
  });

  const { file_extension: fileExtension } = pathParams;
  if (!fileExtension) return COMMON.ERROR(510);

  const { count } = event.queryStringParameters || {};

  const generatePresigned = async () => {
    const fileKey = `${(Math.random() + 1)
      .toString(36)
      .substring(2)}.${fileExtension}`;

    const objectParams = {
      Bucket: BUCKET_NAME,
      Key: `${PREFIX_PATH}${fileKey}`,
    };

    const uploadCommand = new PutObjectCommand(objectParams);
    const uploadUrl = await getSignedUrl(client, uploadCommand, {
      expiresIn: 60 * 20,
    });

    const downloadCommand = new GetObjectCommand(objectParams);
    const downloadUrl = await getSignedUrl(client, downloadCommand, {
      expiresIn: 60 * 180,
    });

    return {
      uploadUrl,
      downloadUrl,
      key: fileKey,
    };
  };

  if (!!count) {
    const list = [];
    while (list.length < Number(count)) {
      const presigned = await generatePresigned();
      list.push(presigned);
    }
    return COMMON.response(200, { list });
  } else {
    const presigned = await generatePresigned();
    return COMMON.response(200, presigned);
  }
};
