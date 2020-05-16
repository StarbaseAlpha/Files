'use strict';

function Files(url, auth) {

  const upload = async (folder="", file) => {
    let form = new FormData();
    form.append('token', await auth.getToken());
    form.append('folder', folder);
    form.append('file', file);
    return fetch(url + "/upload", {
      "method":"POST",
      "body":form
    }).then(response=>response.json());
  };

  const meta = async (folder="", id) => {
    return fetch(url + "/meta", {
      "method":"POST",
      "headers":{"content-type":"application/json"},
      "body":JSON.stringify({"id":id,"folder":folder, "token":await auth.getToken()})
    }).then(response=>response.json());
  };

  const remove = async (folder="", id) => {
    return fetch(url + "/remove", {
      "method":"POST",
      "headers":{"content-type":"application/json"},
      "body":JSON.stringify({"id":id,"folder":folder, "token":await auth.getToken()})
    }).then(response=>response.json());
  };

  const list = async (folder="", query={}) => {
    return fetch(url + "/list", {
      "method":"POST",
      "headers":{"content-type":"application/json"},
      "body":JSON.stringify({"query":query,"folder":folder, "token":await auth.getToken()})
    }).then(response=>response.json());
  };

  const uploader = async (folder="", container) => {
    const el = document.createElement('div');
    const info = document.createElement('p');
    const fileLabel = document.createElement('label');
    fileLabel.innerText = "Select File";
    const fileInput = document.createElement('input');
    fileInput.classList.add('hidden');
    fileLabel.appendChild(fileInput);
    fileLabel.classList.add('button');

    fileInput.type = "file";
    fileInput.multiple = true;

    el.appendChild(fileLabel);
    el.appendChild(info);
    container.append(el);

    fileInput.onchange = async (e) => {
      let promises = [];
      if (e.target.files) {
        info.innerText = "Uploading " + e.target.files.length + " file(s)...";
        for (let i = 0; i < e.target.files.length; i++) {
          promises.push(files.upload(folder, e.target.files[i]));
        }
        await Promise.all(promises).then(results=>{
          info.innerText = JSON.stringify(results, null, 4)
        }).catch(err=>{
          info.innerText = err.message||err.toString()||"Error";
        });
      }
    };
  };

  return {meta, remove, list, upload, uploader};

}
