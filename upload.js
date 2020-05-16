const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const Busboy = require('busboy');

function Upload() {
  return (req, res, next) => {
    var busboy = new Busboy({"headers": req.headers, "limits":{"fileSize":1024 * 1024 * 5}});
    busboy.on('field', (fieldname, val) => {
      req.body[fieldname] = val;
    });
    req.file = null;
    let size = 0;
    let fileCount = 0;
    let tooLarge = false;
    let tooManyFiles = false;
    busboy.on('file', function(fieldname, file, filename, encoding, mimetype) {
      fileCount++;
      if (fileCount > 1) {
        fs.unlink(os.tmpdir(), req.file.filename);
        if (!tooManyFiles) {
          tooManyFiles = true;
          res.status(400).json({"code":400,"message":"Too many files."});
        }
        return null;
      }
      const randomname = crypto.randomBytes(16).toString('hex');
      file.on('limit', ()=>{
        fs.unlink(path.join(os.tmpdir(), randomname));
        tooLarge = true;
        res.status(413).json({"code":413, "message":"File is too large."});
      });
      file.on('data', (data)=>{
        size += data.length;
      });
      var saveTo = path.join(os.tmpdir(), randomname);
      req.file = {
        "filename": randomname,
        "originalname":filename,
        "encoding":encoding,
        "mimetype":mimetype,
        "path":saveTo
      };
      file.pipe(fs.createWriteStream(saveTo));
    });

    busboy.on('finish', function() {
      if (!tooLarge && !tooManyFiles) {
        req.file.size = size;
        next();
      }
    });

    return req.pipe(busboy);

  };
}

module.exports = Upload;
