/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, window, Mustache */

define(function (require, exports, module) {
  'use strict';

  require("lib/batch");
  require("lib/jsrender.min");
  var _merge = require("lib/merge");

  var
    CommandManager = brackets.getModule("command/CommandManager"),
    EditorManager = brackets.getModule("editor/EditorManager"),
    DocumentManager = brackets.getModule("document/DocumentManager"),
    ProjectManager = brackets.getModule("project/ProjectManager"),
    PanelManager = brackets.getModule("view/PanelManager"),
    KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
    ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
    Menus = brackets.getModule("command/Menus"),
    AppInit = brackets.getModule("utils/AppInit"),
    NativeApp = brackets.getModule("utils/NativeApp");

  var DO_TOC = "toc.run";
  var panelHtml = require("text!panel.html");
  var concatHtml = require("text!tpl/concat.html");
  var vizHtml = require("text!tpl/viz.html");
  var panel;

  var tocIcon = $("<a id='toc-toolbar-icon' class='fa fa-align-justify fa-lg' href='#'></a>")
    .appendTo($("#main-toolbar .buttons"));
  
  function parseFile(contents) {
    var data = [];
    var paragraphs = contents.split(/\n\s*\n/);
    paragraphs.forEach(function (paragraph) {
      var thisPara = {};
      paragraph = paragraph.replace(/^\s+|\s+$/g, '');
      var firstChar = paragraph.charAt(0);
      switch (firstChar) {
      case ">":
        thisPara.type = "quote";
        break;
      case "!":
        thisPara.type = "image";
        break;
      case "-":
        thisPara.type = "bullet";
        break;
      default: 
        thisPara.type = "normal";
      }
      thisPara.words = paragraph.split(/\s+/).length;
      var parts = paragraph.split("\n");
      if (parts[0].charAt(0) == "#") { 
        thisPara.head = parts.shift(); 
        if (parts[0] && parts[0].charAt(0) == "#") { 
          thisPara.subhead = parts.shift(); 
        }
      };
      thisPara.body = parts.join("<br>");
      data.push(thisPara);
    });
    return data;
  } 

  function readFiles(files) {
    var readRequest;
    var batchFunctions = [];
    $.each(files, function (index, file) {
      var path = file._path;
      var fileName = path.split("/").pop();
      var startsWithNumber = !isNaN(parseInt(fileName.charAt(0)));
      if (startsWithNumber) {
        batchFunctions.push(function (batch) {
          file.read(function (success, fileContents, stats) {
            batch.done({
              fileName: fileName.replace(/\.md/g, ""),
              fileNumber: fileName.match(/^[\d\.]+/)[0],
              fileContents: fileContents,
              numWords: fileContents.replace(/(^#.*)|(^`.*)/gm, "").split(/\s+/).length - 1,
              fileData: parseFile(fileContents)
            });
          });
        });
      }
    });
    var fileReadsBatch = new Batch(batchFunctions, function (allFiles) {
      allFiles.sort(function (a, b) {
        return a.fileName.localeCompare(b.fileName)
      });      
      concat(allFiles);
      viz(allFiles);
    });
    fileReadsBatch.execute();
  }
    
  function concat(files) {
    $("#overview-panel").append(concatHtml);
    $("#concat").html(
      $.templates("#concatTemplate").render(files)
    );    
  }

  function viz(files) {
    $("#overview-panel").append(vizHtml);
    $("#viz").html(
      $.templates("#vizTemplate").render(files, true)
    );    
  }

  function updatePanel() {
    ProjectManager.getAllFiles().then(function (files) {
      readFiles(files);
    }, function (err) {
      console.log(err);
    });
  }
  
  function _handleFileToc() {
    panel.show();
    updatePanel();
  }

  CommandManager.register("Project Overview", DO_TOC, _handleFileToc);

  AppInit.appReady(function () {
    KeyBindingManager.addBinding(DO_TOC, {
      key: "Alt-Cmd-t",
      displayKey: "Alt-Cmd-t"
    });
    var viewMenu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    viewMenu.addMenuItem(DO_TOC);
    ExtensionUtils.loadStyleSheet(module, "css/overview.css");
    ExtensionUtils.loadStyleSheet(module, "css/fa/css/font-awesome.css");
    panel = PanelManager.createBottomPanel(DO_TOC, $(panelHtml), 300);
    DocumentManager.on('documentSaved', updatePanel);
    $("#overview-panel-close").click(function () {
      panel.hide()
    });
    tocIcon.click(function () {
      _handleFileToc();
    });
    $("#overview-panel #show-diagram").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #diagram").show();
    });
    $("#overview-panel #show-concat").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #concat").show();
    });
    $("#overview-panel #show-viz").click(function () {
      _handleFileToc();
      $("#overview-panel .section").hide();
      $("#overview-panel #viz").show();
    });
    $("#overview-panel #merge-files").click(function () {
      _merge.mergeFiles();
    });
  });


});