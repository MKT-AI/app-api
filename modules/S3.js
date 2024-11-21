const TAG = "S3";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

const ERROR = require("modules/error");

const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");
const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const CLIENT_PARAMS = {
  region: process.env.AWS_REGION,
};
const BUCKET_NAME = "mktcontentsbucket";

module.exports.createFolder = async (name) => {
  LTAG("on create folder");

  const client = new S3Client(CLIENT_PARAMS);

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${name}/`,
    });
    const response = await client.send(command);
    LTAG(`folder created`, response);
    return response;
  } catch (error) {
    console.log(error);
    return ERROR(error);
  }
};

module.exports.createUploadUrl = async (name) => {
  const client = new S3Client(CLIENT_PARAMS);
  
  const objectParams = {
    Bucket: BUCKET_NAME,
    Key: `${name}`,
  };
  const command = new PutObjectCommand(objectParams);
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });
  return uploadUrl;
};
