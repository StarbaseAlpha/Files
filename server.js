'use strict';

const multer = require('multer');
const fs = require('fs');
const router = require('express').Router();

function Files(db, auth, bucket=null, options={
  "destination":"uploads",
  "temp":"/tmp",
  "fieldName":"file",
  "dbPath":"files",
  "limit":1024 * 1024 * 5,
  "userspace":false,
  "isAuthorized":null,
  "url":null,
  "adminUser":"admin"
  }) {
  
  const fieldName = options.fieldName || "file";
  const limit = options.limit || 1024 * 1024 * 5;
  const destination = options.destination || "uploads";
  const temp = options.temp || "/tmp";
  const dbPath = options.dbPath || "files";
  const url = options.url || null;
  const adminUser = options.adminUser || 'admin';

  const isUserspace = (token, folder, user, db, auth) => {
    return (user && user.username && db.path(folder).parse().path === db.path('userspace/' + user.username).parse().path);
  };

  let authorizeHandler = null;
  if (options.isAuthorized && typeof options.isAuthorized === 'function') {
    authorizeHandler = options.isAuthorized;
  }

  const uploader = multer({"dest":temp, "limits":{"fileSize":limit}});

  const cloudSave = async (file, filename, isPublic=true) => {
    return bucket.upload(file, {
      "public":isPublic,
      "destination":filename
    }).then((r)=>{
      return {"upload":true, "filename":filename};
    });
  };

  const cloudDelete = async (filename) => {
    return bucket.file(filename).delete().then(result=>{
      return {"delete":true, "filename":filename};
    });
  };

  const getUser = async (token=null) => {
    return await auth.verifyToken(token).then(result=>{return result.user}).catch(err=>{return null;});
  };

  const isAuthorized = async (token=null, folder="") => {
    let user = await getUser(token);
    if (authorizeHandler && (authorizeHandler(token, folder, user, db, auth))) {
      return true;
    }
    if (options.userspace && isUserspace(token, folder, user, db, auth)) {
      return true;
    }
    return (user && user.username && user.username === adminUser);
  };

  const deleteFile = (file) => {
    return new Promise((resolve, reject) => {
      if (bucket) {
        resolve(cloudDelete(file.path).catch(err=>{return null;}));
      } else {
        fs.unlink(file.path, (err) => {
          resolve();
        });
      }
    });
  };

  const Meta = () => {
    return async (req, res, next) => {
        let authorized = await isAuthorized(req.body.token||"", req.body.folder||"");
        if (authorized) {
          if (req.body.id) {
            let path = destination + db.path((req.body.folder||"")).path(req.body.id).parse().path;
            let result = await db.path(dbPath).path(path).get().catch(err=>{return err;});
            return res.json(result);
          }
          next();
        } else {
          res.status(400).json({"code":403,"message":"Forbidden"});
        }
    };
  };

  const List = () => {
    return async (req, res, next) => {
        let authorized = await isAuthorized(req.body.token||"", req.body.folder||"");
        if (authorized) {
          if (req.body.query) {
            let path = destination + db.path((req.body.folder||"")).parse().path;
            return res.json(await db.path(dbPath).path(path).list(req.body.query).catch(err=>{return err;}));
          }
          next();
        } else {
          res.status(400).json({"code":403,"message":"Forbidden"});
        }
    };
  };

  const Upload = () => {
    return (req, res, next) => {
      uploader.single(fieldName)(req, res, async (err)=> {
        if (err) {
          return res.json({"code":400,"message":err.message||err.toString()||"Error"});
        }
        let authorized = await isAuthorized(req.body.token||"", req.body.folder||"");
        if (authorized) {
          if (req.file) {
            let result = {
              "filename":req.file.filename,
              "folder": req.body.folder||"",
              "path":destination + db.path((req.body.folder||"")).path(req.file.filename).parse().path,
              "mimetype":req.file.mimetype,
              "size": req.file.size,
              "originalname": req.file.originalname
            };
            if (url) {
              result.url = url + db.path(result.path).parse().path;
            }
            if (bucket) {
              await cloudSave(req.file.path, result.path, true);
            } else {
              await fs.writeFile(result.path, req.file.path, async()=>{return true;});
            }
            await fs.unlink(temp + '/' + result.filename, async()=>{return true;});
            await db.path(dbPath).path(result.path).put(result);
            await fs.unlink(temp + '/' + result.filename, async()=>{return true;});
            return res.json(result);
          }
          next();
        } else {
          if (req.file) {
            await fs.unlink(temp + '/' + req.file.filename, async()=>{return true;});
          }
          res.status(400).json({"code":403,"message":"Forbidden"});
        }
      });
    };
  };

  const Remove = () => {
    return async (req, res, next) => {
        let authorized = await isAuthorized(req.body.token||"", req.body.folder||"");
        if (authorized) {
          if (req.body.id && db.parse(req.body.id).path !== db.parse('/').path) {
            let path = destination + db.path((req.body.folder||"")).path(req.body.id).parse().path;
            await db.path(dbPath).path(path).del();
            await deleteFile({"path":path});
            res.json({"deleted":true, "path":path});
            return;
          }
          next();
        } else {
          if (req.file) {
            await fs.unlink(temp + '/' + req.file.filename, async()=>{return true;});
          }
          res.status(400).json({"code":403,"message":"Forbidden"});
        }
    };
  };

  router.use('/upload', Upload());
  router.use('/remove', Remove());
  router.use('/meta', Meta());
  router.use('/list', List());

  const express = () => {
    return router;
  };

  return {express};
}

module.exports = Files;
