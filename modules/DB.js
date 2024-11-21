const TAG = "DB";
const LTAG = (...args) => console.log(`[${TAG}]`, ...args);

const MongoClient = require("mongodb").MongoClient;
const COMMON = require("modules/common");

const DB_URL = process.env.DB_URL,
    DB_NAME = process.env.DB_NAME;

let client, db, dbPromise, onCreate = false;
const getDBConnection = module.exports.getDBConnection = () => {
    console.log('on get DB connection, DB_URL : %s, DB_NAME : %s', DB_URL, DB_NAME);

    if (client && db) {
        return Promise.resolve((() => { const _db = db; return _db; })());
    }
    if (onCreate) return dbPromise;
    onCreate = true;

    dbPromise = MongoClient.connect(DB_URL).then(_client => {
        client = _client;
        return client.db(DB_NAME);
    }).then(_db => {
        db = _db;
        onCreate = false;
        return _db;
    }).catch(error => {
        onCreate = false;
        return Promise.reject(error);
    });
    return dbPromise;
};

module.exports.close = () => {
    console.log("on close database connection");

    const isValidConnection = client && db;
    if (!!client) {
    } else {
        console.log("there is no history that client has been allocated");
    }

    if (!isValidConnection) {
        console.log("bypass client.close()");
    }

    return (isValidConnection ? client.close() : Promise.resolve("bypass"))
        .then(result => {
            if (result !== "bypass") {
            }
            return result;
        }).catch(error => {
            console.log("Failed to close db connection");
            return error;
        });
};

const timedOut = (promise, options = {}) => {
    let {
        maxTime,
        remainingTimeInMillis,
        offset,
        defaultValue
    } = options;

    if (!maxTime || defaultValue === undefined) {
        return promise.toArray();
    }

    if (remainingTimeInMillis <= offset) {
        return promise.close().then(() => {
            console.log("isClosed after timing out :", promise.isClosed());
            return defaultValue;
        });
    }

    let timer;
    return Promise.race([
        promise.toArray().then(result => {
            console.log("race result : %j", result);
            return result;
        }),
        new Promise((resolve, reject) => timer = setTimeout(() => {
            resolve("timedOut");
        }, Math.min(maxTime, ((remainingTimeInMillis - offset) || maxTime))))
    ]).then(result => {
        clearTimeout(timer);
        if (result === "timedOut") {
            return promise.close().then(() => {
                console.log("isClosed after timedOut :", promise.isClosed());
                return defaultValue;
            });
        }

        return result;
    });
};

module.exports.aggregate = (collectionName, params, options = {}) => {
    console.log('on aggregate with collection : %s, params : %j, options : %j', collectionName, params, options);

    let {
        maxTime,
        remainingTimeInMillis,
        offset,
        defaultValue
    } = options;

    return getDBConnection()
        .then(db => {
            let promise = db.collection(collectionName).aggregate(params);

            return timedOut(promise, { maxTime, remainingTimeInMillis, offset, defaultValue });
        })
        .catch(error => {
            console.log('Failed to aggregate with the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.distinct = (collectionName, columnName, params) => {
    console.log('on distinct with collection : %s, columnName : %j, params : %j', collectionName, columnName, params);

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .distinct(columnName, params);
        })
        .catch(error => {
            console.log('Failed to aggregate with the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.first = (collectionName, params, options = {}) => {
    console.log('on first from collection : %s, params : %j, options : %j', collectionName, params, options);

    let { projection } = options;

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .find(params)
                .project(projection || {})
                .limit(1)
                .toArray();
        })
        .then(([result]) => {
            return result;
        })
        .catch(error => {
            console.log('Failed to first from the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.find = (collectionName, params, options = {}) => {
    console.log('on find from collection : %s, params : %j, options : %j', collectionName, params, options);

    let {
        projection,
        limit,
        sort,
        maxTime,
        remainingTimeInMillis,
        offset,
        defaultValue
    } = options;

    return getDBConnection()
        .then(db => {
            let promise = db.collection(collectionName)
                .find(params)
                .project(projection || {})
                .sort(sort || { _updated_at: -1 })
                .limit(limit || 100);

            return timedOut(promise, { maxTime, remainingTimeInMillis, offset, defaultValue });
        })
        .catch(error => {
            console.log('Failed to find from the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.findAll = (collectionName, params, options = {}) => {
    console.log('on findAll from collection : %s, params : %j, options : %j', collectionName, params, options);

    let {
        projection,
        limit,
        sort,
        maxTime,
        remainingTimeInMillis,
        offset,
        defaultValue
    } = options;

    return getDBConnection()
        .then(db => {
            let promise = db.collection(collectionName)
                .find(params)
                .project(projection || {})
                .sort(sort || { _updated_at: -1 })
                .limit(limit || 0);

            return timedOut(promise, { maxTime, remainingTimeInMillis, offset, defaultValue });
        })
        .catch(error => {
            console.log('Failed to find from the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.insert = (collectionName, params = {}) => {
    console.log('on insert into collection : %s, params : %j', collectionName, params);

    params._id = params._id || COMMON.randomString(10);

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .insertOne({
                    _created_at: new Date(),
                    _updated_at: new Date(),
                    ...params
                });
        })
        .then(({ ops = [params] }) => {
            // insert 했던 정보 그대로 반환
            console.log('Inserted into the collection %j', ops[0]);
            return ops[0];
        })
        .catch(error => {
            console.log('Failed to insert into the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.insertMany = (collectionName, array = []) => {
    console.log('on insert many into collection : %s, array : %j', collectionName, array);

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .insertMany(array.map(params => {
                    params._id = params._id || COMMON.randomString(10);

                    return ({
                        _created_at: new Date(),
                        _updated_at: new Date(),
                        _acl: {},
                        _wperm: [],
                        _rperm: [],
                        ...params // _id 뿐만 아니라 _created_at, _updated_at, _acl, _wperm, _rperm 도 임의값 넣을 수 있게
                    })
                }));
        })
        .catch(error => {
            console.log('Failed to insert into the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.update = (collectionName, params, filter, options = {}) => {
    console.log('on update from collection : %s, params : %j, filter : %j, options : %j', collectionName, params, filter, options);

    return getDBConnection()
        .then(db => {
            if (!params.$set) params.$set = {};
            params.$set['_updated_at'] = new Date();

            if (!!options.upsert) {
                params.$set['_acl'] = {};
                params.$set['_wperm'] = [];
                params.$set['_rperm'] = [];
            }

            return db.collection(collectionName)
                .updateMany(filter, params, options);
        })
        .then(res => {
            console.log('Updated into the collection %j', res);
            return res;
        })
        .catch(error => {
            console.log('Failed to update into the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.delete = (collectionName, params) => {
    console.log('on delete from collection : %s, params : %j', collectionName, params);

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .deleteOne(params);
        })
        .then(res => {
            console.log('Deleted from the collection %j', res);
            return res;
        })
        .catch(error => {
            console.log('Failed to delete from the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.deleteMany = (collectionName, params) => {
    console.log('on deleteMany into collection : %s, params : %j', collectionName, params);

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .deleteMany(params);
        })
        .then(res => {
            console.log('Deleted many from the collection %j', res);
            return res;
        })
        .catch(error => {
            console.log('Failed to delete many from the collection %j', error);
            return Promise.reject(error);
        });
};

module.exports.count = (collectionName, params) => {
    console.log('on count from collection : %s, params : %j', collectionName, params);

    return getDBConnection()
        .then(db => {
            return db.collection(collectionName)
                .count(params);
        })
        .catch(error => {
            console.log('Failed to count from the collection %j', error);
            return Promise.reject(error);
        });
};