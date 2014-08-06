/*global define, $, brackets, Mustache, console */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(function() {
      return (root.openDialog = factory());
    });
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.openDialog = factory();
  }
}(this, function() {

  function createDialog(data) {

    var dialogWrapper = document.createElement("div");
    dialogWrapper.classList.add("file-dialog-wrapper");
    var dialogBackdrop = document.createElement("div");
    dialogBackdrop.classList.add("file-dialog-backdrop");
    var dialogInnerWrapper = document.createElement("div");
    dialogInnerWrapper.classList.add("file-dialog-inner-wrapper");
    var dialog = document.createElement("div");
    dialog.classList.add("makedrive-file-dialog");

    dialogWrapper.appendChild(dialogInnerWrapper);
    dialogInnerWrapper.appendChild(dialogBackdrop);
    dialogInnerWrapper.appendChild(dialog);

    // I want to fix this. Having HTML live in a string is not awesome. Should be an HTML file.
    // I need the HTML template to be loaded via a relative path, without require.
    // Problem is this file itself may be loaded in via require, which changes any relative paths.
    // I also cannot have large changes to a require config that loads this module.
    // For now, this string may be ugly, but it's working.
    dialogString =
      '  <div class="file-dialog-header">' +
      '    <h1 class="file-dialog-title"></h1>';
    if (data.saveAs) {
      dialogString +=
        '    <div class="file-name-container">' +
        '      <span class="input-label">Name </span>' +
        '      <span class="fa-floppy-o fa-icon floppy-icon"></span>' +
        '      <input class="file-name-input" value="">' +
        '    </div>';
    }
    dialogString +=
      '    <div class="file-path">' +
      '      <span class="input-label">Folder </span>' +
      '      <span class="fa-arrow-left fa-icon back-button"></span>' +
      '      <input class="folder-name" value="">' +
      '      <span class="fa-chevron-down fa-icon drop-down"></span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="file-dialog-body">' +
      '    <div class="open-files-container"></div>' +
      '  </div>' +
      '  <div class="file-dialog-footer">' +
      '    <button class="cancel-button" data-button-id="cancel"></button>' +
      '    <button class="open-button" data-button-id="done"></button>' +
      '  </div>';

    dialog.innerHTML = dialogString;

    dialog.querySelector(".open-button").textContent = data.done;
    dialog.querySelector(".cancel-button").textContent = data.cancel;
    dialog.querySelector(".file-dialog-title").textContent = data.title;

    return dialogWrapper;
  }

  // Also wish this was a template and I could clone it.
  function createIcon(name, type) {
    var file = document.createElement("span");
    var iconContainer = document.createElement("div");
    var icon = document.createElement("span");
    var fileNameContainer = document.createElement("div");
    var fileName = document.createElement("div");
    file.classList.add("file");

    icon.classList.add(type);
    icon.classList.add("file-icon");
    fileNameContainer.classList.add("file-name");
    fileName.textContent = name;

    iconContainer.appendChild(icon);
    fileNameContainer.appendChild(fileName);

    file.appendChild(iconContainer);
    file.appendChild(fileNameContainer);

    return file;
  }

  function FileDialog() {
    var workingFiles = [];
    var dialog;
    var dialogWrapper;
    var sh;
    var fs;
    var MakeDrive;
    var onAction = function() {};

    function onDoubleClick() {
      var workingFile = workingFiles[0];
      if (workingFile.type === "DIRECTORY") {
        displayFilesForDir(workingFile.path);
        return;
      }
      onAction();
    }

    function displayFilesForDir(dir) {
      sh.cd(dir, function(err) {
        if (err) {
          console.error(err);
          return;
        }
        displayFiles();
      });
    }

    function displayFiles() {
      sh.ls(".", function(err, files) {
        if (err) {
          console.error(err);
          return;
        }
        var container = dialog.querySelector(".open-files-container");
        container.innerHTML = "";
        var pathInput = dialog.querySelector(".folder-name");

        pathInput.value = sh.pwd();
        workingFiles = [];
        pathInput.addEventListener("change", function() {
          var inputValue = pathInput.value.trim();
          // starting work on getting the url bar to trigger changes
          fs.stat(inputValue, function(err, stats) {
            if (err) {
              pathInput.value = sh.pwd();
              return;
              // kaboom?
            }
            var fileName;
            var filePath;
            if (stats.type === "DIRECTORY") {
              displayFilesForDir(inputValue);
            } else {
              filePath = inputValue.split("/");
              fileName = filePath.pop();
              filePath = filePath.join("/");
              sh.cd(filePath, function(err) {
                if (err) {
                  console.error(err);
                  return;
                }
                workingFiles = [{path:fileName}];
                onAction();
              });
            }
          });
        });
        files.forEach(function(item, index) {
          var type;
          if (item.type === "DIRECTORY") {
            type = "fa-folder-o";
          } else {
            type = "fa-file-code-o";
          }
          var file = createIcon(item.path, type);
          file.querySelector(".file-icon").addEventListener("mousedown", function() {
            var selected = container.querySelector(".selected");
            if (selected) {
              selected.classList.remove("selected");
            }
            file.classList.add("selected");
            workingFiles = [item];
          });
          file.querySelector(".file-icon").addEventListener("dblclick", onDoubleClick);
          container.appendChild(file);
        });
      });
    }

    function closeModal() {
      if(dialogWrapper && dialogWrapper.parentNode) {
        dialogWrapper.parentNode.removeChild(dialogWrapper);
      }
    }

    function setupDialog(initialPath, data) {

      if (window.appshell) {
        MakeDrive = appshell.MakeDrive;
      } else if (window.MakeDrive) {
        MakeDrive = window.MakeDrive;
      }

      fs = MakeDrive.fs();
      sh = fs.Shell();
      initialPath = initialPath || "/";
      dialogWrapper = createDialog(data);
      $("body").append(dialogWrapper);

      dialog = dialogWrapper.querySelector(".makedrive-file-dialog");

      dialog.querySelector(".cancel-button[data-button-id='cancel']").addEventListener("click", closeModal);

      dialog.querySelector(".back-button").addEventListener("click", function() {
        displayFilesForDir("../");
      });

      $(window).on('keydown.makedrive-file-dialog', function (event) {
        if (event.keyCode === 27) {
          closeModal();
        } else if (event.keyCode === 13) {
          onAction();
        }
      });

      displayFilesForDir(initialPath);
    }

    return {
      showSaveAsDialog: function(title, initialPath, defaultName, callback) {
        callback = callback || arguments[arguments.length - 1]; // get last arg for callback
        setupDialog(initialPath, {
          title: "Save As",
          cancel: "Cancel",
          done: "Save",
          saveAs: true
        });

        dialog.querySelector(".open-button[data-button-id='done']").addEventListener("click", function() {
          var fileName = dialog.querySelector(".file-name-input").value.trim();
          if (!fileName) {
            return;
          }

          callback(null, sh.pwd() + "/" + fileName);
          closeModal();
        });
      },
      showOpenDialog: function(allowMultipleSelection, chooseDirectories, title, initialPath, fileTypes, callback) {
        callback = callback || arguments[arguments.length - 1]; // get last arg for callback
        onAction = function() {
          if (workingFiles.length && (workingFiles[0].type !== "DIRECTORY" || chooseDirectories)) {
            callback(null, [sh.pwd() + "/" + workingFiles[0].path]);
            closeModal();
          }
        };

        setupDialog(initialPath, {
          title: "Open",
          cancel: "Cancel",
          done: "Open"
        });

        dialog.querySelector(".open-button[data-button-id='done']").addEventListener("click", onAction);
      }
    };
  }

  return {
    showOpenDialog: function() {
      var dialog = new FileDialog();
      dialog.showOpenDialog.apply(null, arguments);
    },

    showSaveAsDialog: function() {
      var dialog = new FileDialog();
      dialog.showSaveAsDialog.apply(null, arguments);
    }
  };
}));
