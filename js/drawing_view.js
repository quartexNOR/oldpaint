/* This is the main drawing view.
 * Drawing and key press events are handled here. */

OldPaint.DrawingView = Backbone.View.extend({

    el: $("#drawing"),

    zoom: 0,
    window: _.extend({scale: 1, offset: Util.pos(0, 0)}, Backbone.Events),
    stroke: null,
    mouse: false,  // is the mouse over the drawing?

    events: {
        "mousedown": "begin_stroke",
        "mousewheel": "on_wheel_zoom",
        "mouseover": "on_mouse_enter",
        "mouseout": "on_mouse_leave"
    },

    initialize: function (options) {
        _.bindAll(this);

        this.tools = options.tools;
        this.brushes = options.brushes;
        this.eventbus = options.eventbus;

        // Remove context menu for the drawing part, so we can erase
        var no_context_menu = function(event) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        };
        document.querySelector('#drawing_window').oncontextmenu = no_context_menu;
        document.querySelector('#drawing').oncontextmenu = no_context_menu;

        // Load settings from local storage
        this.load_settings();

        this.center();

        // Let's save to local storage periodically
        // TODO: the save system should be smart enough to e.g. only save layers that
        // have been changed since last save.
        //var intervalID = setInterval(this.save_internal, 60000);

        // === Menu ===
        // Items are defined by name and function/subitems
        // Keyboard shortcut is the first Uppercase letter in the name,
        // don't put overlapping keybindings in the same level!
        this.menuitems = {
            Drawing: {
                reName: this.rename,
                Load: this.load_popup,
                Save: this.save_internal,
                Import: this.load,
                Export: {
                    PNG: this.save_as_png,
                    ORA: this.save_as_ora
                },
                Resize: this.resize_image,
                Convert: this.convert_image
            },
            Layer: {
                Add: function () {this.model.add_layer(true);},
                Delete: function () {
                    this.model.remove_layer(this.model.layers.active);
                },
                Flip: {
                    Horizontally: this.model.flip_layer_horizontal,
                    Vertically: this.model.flip_layer_vertical
                },
                Export: this.save_layer_as_png
            },
            Brush: {
                Colorize: this.brush_colorize,
                Flip: {
                    Horizontally: this.brush_flip_x,
                    Vertically: this.brush_flip_y
                },
            }
        };

        // Keyboard bindings.
        var keybindings = [
            ["return", this.show_menu.bind(this, null)],

            ["-", this.zoom_out, "Zoom out."],
            ["+", this.zoom_in, "Zoom in."],
            ["z", this.on_undo, "Undo last change."],
            ["y", this.on_redo, "Redo last undo."],

            ["r", function () {this.model.redraw();}, "Redraw the screen."],

            // Experimental save to internal storage
            ["i s", this.save_internal, "Save drawing to browser's local storage."],
            ["i l", this.load_internal, "Load drawing from browser's local storage."],
            ["i d", this.delete_internal, "Delete drawing from browser's local storage."],
            ["i i", this.save_settings, "Save settings."],
            ["i o", this.load_settings, "Load settings."],

            // Layer key actions
            ["l", function () {this.show_menu("Layer");}],
            // ["l a", function () {this.model.add_layer(true);}, "Add a new layer."],

            // ["l d", function () {
            //     console.log("removeong layer");
            //     this.model.remove_layer(this.model.layers.active);
            // }, "Delete the current layer."],

            ["del", function () {
                this.model.clear_layer(this.model.layers.active,
                                       this.model.palette.background2);
            }, "Clear the current layer."],

            ["v", function () {
                this.model.layers.active.set(
                    "visible", !this.model.layers.active.get("visible"));
            }, "Toggle the current layer's visibility flag."],

            ["A", function () {
                this.model.layers.active.set(
                    "animated", !this.model.layers.active.get("animated"));
            }, "Toggle the current layer's animation flag."],

            ["a", function () {  // previous layer
                var index = this.model.layers.indexOf(this.model.layers.active);
                var new_index = index === 0 ? this.model.layers.length - 1 : index - 1;
                this.model.layers.at(new_index).activate();
            }, "Jump to the layer below the current."],

            ["q", function () {  // next animation frame
                var index = this.model.layers.indexOf(this.model.layers.active);
                var new_index = index == this.model.layers.length - 1 ? 0 : index + 1;
                this.model.layers.at(new_index).activate();
            }, "Jump to the layer above the current."],

            ["s", function () {  // previous animation frame
                var frames = this.model.layers.get_animated();
                if (frames.length > 1) {
                    var index = _.indexOf(frames, this.model.layers.active);
                    var new_index = index === 0 ? frames.length - 1 : index - 1;
                    (frames[new_index]).activate();
                }
            }, "Jump to previous animation frame."],

            ["w", function () {  // next animation frame
                var frames = this.model.layers.get_animated();
                if (frames.length > 1) {
                    var index = _.indexOf(frames, this.model.layers.active);
                    var new_index = index == frames.length - 1 ? 0 : index + 1;
                    (frames[new_index]).activate();
                }
            }, "Jump to next animation frame."],

            // ["f h", function () {
            //     this.model.flip_layer_horizontal(this.model.layers.active);
            // }, "Flip the current layer horizontally."],

            // ["f v", function () {
            //     this.model.flip_layer_vertical(this.model.layers.active);
            // }, "Flip the current layer vertically."],
            ["b", function () {this.show_menu("Brush");}],
            // ["b h", function () {
            //     var brush = this.brushes.active;
            //     brush.flip_x();
            //     this.model.preview_brush(brush, this.model.palette.foreground);
            // }, "Flip the current brush horizontally."],

            // ["b v", function () {
            //     var brush = this.brushes.active;
            //     brush.flip_y();
            //     this.model.preview_brush(brush, this.model.palette.foreground);
            // }, "Flip the current brush vertically"],

            // ["b c", function () {
            //     var brush = this.brushes.active;
            //     brush.set_color(this.model.palette.foreground, true);
            //     this.model.preview_brush(brush, this.model.palette.foreground);
            // }, "Flip the current brush vertically"],

            ["0", this.center, "Center the view."]
        ];
        _.each(keybindings, function (binding) {
            Mousetrap.bind(binding[0], _.bind(binding[1], this));}, this);

        // Keep track of whether space is held down.
        this.scroll_mode = false;
        var scroll_key = " ".charCodeAt(0);
        var scroll_key_down = _.bind(function (event) {
            this.scroll_mode = true;
        }, this);
        var scroll_key_up = _.bind(function (event) {
            this.scroll_mode = false;
        }, this);

        $(document).keyup(function(evt) {
            if (evt.keyCode == scroll_key) {
                scroll_key_up(evt);
            }
        }).keydown(function(evt) {
            if (evt.keyCode == scroll_key) {
                scroll_key_down(evt);
            }
        });

        // Events

        // Mousemove is performance critical so let's bind it directly
        var el = document.getElementById('drawing');
        el.onmousemove = this.update_stroke;

        $(window).resize(this.on_window_resize);

        this.model.layers.on("add", this.on_layer_added);
        this.model.layers.on("move", this.on_layer_reordered);

        this.model.on("resize", this.on_resize);
        this.model.on("selection", this.on_selection);
        //this.model.on("selection_done", this.edit_selection);
        this.model.on("load", this.on_load);
        this.model.on("change:title", this.on_rename);

        this.model.palette.on("foreground", this.brush_update);
        this.model.palette.on("change", this.on_palette_changed);
        //this.model.palette.on("transparency", this.on_palette_transparency_changed);

        this.brushes.on("activate", this.brush_update);
        this.tools.on("activate", this.cleanup);

        $('#files').on('change', this.on_file_select);
        $("#logo").click(this.show_menu.bind(this, null));
        $("#undo").click(this.on_undo);
        $("#redo").click(this.on_redo);
    },

    render: function (update_image) {
        this.model.layers.each(function (layer, index) {
            if (update_image) layer.image.updateCanvas();
            layer.trigger("redraw", false);
        });
        // Position the "frame"
        $("#drawing_frame").css({
            left: this.window.offset.x, top: this.window.offset.y,
            width: this.model.get("width") * this.window.scale,
            height: this.model.get("height") * this.window.scale
        });

        this.update_title();
    },

    on_mouse_enter: function (ev) {
        this.mouse = true;
    },

    on_mouse_leave: function (ev) {
        if (!this.stroke) {
            this.mouse = false;
            this.model.layers.active.clear_temporary();
        }
    },

    on_window_resize: _.throttle(function (ev) {
        this.model.layers.each(function (layer) {
            layer.trigger("resize");
        });
        this.render(false);
    }, 250),

    show_menu: function (start) {
        this.eventbus.info("Menu mode. Select with keyboard or mouse. Leave with Esc.");
        if (!this.menu) {
            $("#title").linearMenu(this.menuitems, this, start, this.eventbus.clear);
        }
    },

    // Load an user selected file from the normal filesystem
    load: function () {
        if (chrome.fileSystem) this.chrome_open();
        else $('#files').click();
    },

    // Save as PNG to the normal filesystem. If we can, let the user choose where.
    save_as_png: function () {
        if (chrome.fileSystem) this.chrome_save_as_png();
        else this.model.export_png();
    },

    // Save layer as PNG to the normal filesystem. If we can, let the user choose where.
    save_layer_as_png: function () {
        if (chrome.fileSystem) this.chrome_save_as_png(true);
        else this.model.export_png(true);
    },

    // Save as ORA to the normal filesystem. If we can, let the user choose where.
    save_as_ora: function () {
        if (chrome.fileSystem) this.chrome_save_as_ora();
        else this.model.export_ora();
    },

    chrome_open: function () {
        ChromeApp.fileLoadChooser({"png": this.load_png_data,
                                   "ora": this.load_ora_data});
    },

    chrome_save_as_ora: function () {
        ChromeApp.fileSaveChooser(Util.change_extension(this.model.get("title"), "ora"),
                                  Util.convertDataURIToBlob(Util.create_ora(this.model)),
                                  "image/ora",
                                  function () {console.log("write done");});
    },

    chrome_save_as_png: function (single) {
        var model = this.model;
        ChromeApp.fileSaveChooser(
            Util.change_extension(this.model.get("title"), "png"),
            single ? this.layers.active.image.make_png(true) :
                this.model.flatten_visible_layers().make_png(true),
            "image/png",
            function (something) {console.log(something);});
    },

    on_file_select: function (evt) {
        var files = evt.target.files;
        if (files.length > 0) {
            var f = files[0];
            var reader = new FileReader();
            if (f.type.match('image/png')) {
                reader.onload = this.load_png_data;
            } else {
                reader.onload = this.load_ora_data;
            }
            reader.readAsDataURL(f);
            this.model.set("title", f.name.split(".")[0]);
        }
    },

    load_png_data: function (e) {
        this.model.load(Util.load_png, {layers: [e.target.result.slice(22)]});
    },

    load_ora_data: function (e) {
        this.model.load(Util.load_ora, e.target.result);
    },

    load_settings: function (e) {
        var model = this.model;
        LocalStorage.request(
            LocalStorage.read_txt,
            {name: "settings.json",
             on_load: function (e) {
                 var settings = JSON.parse(e.target.result);
                 console.log("settings:", settings);
                 if (settings.last_drawing) {
                     model.load_from_storage(settings.last_drawing);
                 }
             }
            });
    },

    save_settings: function () {
        console.log("save settings");
        var settings = {
            last_drawing: this.model.get("title")
        };
        LocalStorage.request(LocalStorage.write,
                             {name: "settings.json",
                              blob: new Blob([JSON.stringify(settings)],
                                             {type: 'text/plain'})});
    },

    on_load: function () {
        this.render(true);
        this.center();
    },

    rename: function () {
        var on_ok = (function (name) {
            this.model.set("title", name);
        }).bind(this);
        var on_abort = function () {};
        Modal.input("Rename drawing", "What do you want to name it?", on_ok, on_abort);
    },

    on_rename: function (model, value) {
        this.update_title();
    },

    update_title: function () {
        var text = this.model.get("title") + " " +
                "(" + this.model.get("width") + "x" + this.model.get("height") + ", " +
                this.model.get_type() + ") " +
                Math.pow(2, this.zoom) + "x";
        $("#title").text(text);  // Probably better to make a view for this
    },

    update_scale: function() {
        this.window.scale = Math.pow(2, this.zoom);
        this.window.trigger("change");
    },

    cleanup: function () {
        this.model.layers.active.clear_temporary();
    },

    // Save the image to the browser's internal storage. Let's not do that
    // while the user is actually drawing though, since it will cause stutter.
    save_internal: function () {
        if (this.stroke) {
            setTimeout(this.model.save_to_storage, 1000);
        } else {
            this.model.save_to_storage();
        }
    },

    delete_internal: function () {
        if (this.stroke) {
            setTimeout(this.save_to_storage, 1000);
        } else {
            this.model.remove_from_storage();
        }
    },

    load_internal: function (evt) {
        this.model.load_from_storage();
    },

    // Show the saved drawings list
    load_popup: function (event) {
        var load = _.bind(function (title) {
            this.model.save_to_storage();
            this.model.load_from_storage(title);
        }, this);
        var callback = function (result) {
            var dirs = _.filter(result, function (item) {return item.isDirectory;}),
                names = _.map(dirs, function (item) {return item.name;});
            Modal.list(names, load);
        };
        var drawings = LocalStorage.list({callback: callback});
    },

    // Center the drawing on screen
    center: function () {
        this.center_on_image_pos(
            {x: Math.round(this.model.get("width") / 2),
             y: Math.round(this.model.get("height") / 2)},
            {x: Math.round($("#drawing").width() / 2),
             y: Math.round($("#drawing").height() / 2)});
        this.render();
    },

    resize_image: function () {
        var resize = (function () {
            this.model.resize(this.model.selection.rect);
            this.eventbus.info("Resized to (" + this.model.selection.width + ", " +
                               this.model.selection.height + ")");
            this.model.end_selection();
        }).bind(this);
        this.model.make_selection(resize, this.model.get_rect());
        this.eventbus.info("Resize the image by dragging the corner handles. " +
                           "Click anywhere to finish.");
    },

    on_undo: function () {
        if (this.model.undo()) {
            this.eventbus.info("Undo");
        } else this.eventbus.info("Nothing more to undo!");
    },

    on_redo: function () {
        if (this.model.redo()) {
            this.eventbus.info("Redo");
        } else this.eventbus.info("Nothing more to redo!");
    },


    // Callback for when the user changes the palette
    on_palette_changed: function (changes) {
        // Here might be some logic to only update layers that use the
        // changed colors, perhaps even only the relevant parts, etc...
        if (this.model.image_type === OldPaint.IndexedImage) {
            this.render(true);
        }
        this.brush_update();
    },

    // Callback for when the user changes the palette transparency
    on_palette_transparency_changed: function () {
        if (this.model.image_type === OldPaint.IndexedImage) {
            this.model.layers.each(function (layer) {
                layer.cleanup(true);
            });
            this.render(true);
        }
        this.brush_update();
    },

    // Callback for when a layer has been added
    on_layer_added: function (layer, options) {
        console.log("added layer", layer.cid);
        var layerview = new OldPaint.LayerView({model: layer, window: this.window});
        $("#layers_container").append(layerview.el);
        this.render();
    },

    // Callback for when the user changes the position of a layer in
    // the stack
    on_layer_reordered: function (from, to) {
        var layer_views = $("#layers_container").children("canvas");
        var $from_layer = $(layer_views[from]);
        var $to_layer = $(layer_views[to]);
        $from_layer.remove();
        if ($to_layer.index() == to) {
            $from_layer.insertBefore($to_layer);
        } else {
            $from_layer.insertAfter($to_layer);
        }
    },

    on_resize: function () {
        this.render();
        this.center();
        this.update_title();
    },

    convert_image: function (event) {
        var on_ok = (function () {
            if (!this.model.convert_to_rgb_type())
                this.eventbus.info("Drawing is not of Indexed type - not converting.");
            else {
                this.brushes.each(function (brush) {brush.convert(OldPaint.RGBImage);});
                this.update_title();
            }
        }).bind(this);
        var on_abort = function () {};
        Modal.alert("Convert image",
                    "You are about to convert the image to RGB palette format. " +
                    "This is (currently) an irreversible operation, and you will " +
                    "lose your undo history. Proceed?", on_ok, on_abort);
    },

    // update_brush: function (color) {
    //     this.brushes.active.set_color(color);
    // },

    brush_flip_x: function () {
        var brush = this.brushes.active;
        brush.flip_x();
        this.model.preview_brush(brush, this.model.palette.foreground);
    },

    brush_flip_y: function () {
        var brush = this.brushes.active;
        brush.flip_y();
        this.model.preview_brush(brush, this.model.palette.foreground);
    },

    brush_colorize: function () {
        var brush = this.brushes.active;
        brush.set_color(this.model.palette.foreground, true);
        this.brush_update();
    },

    brush_update: function () {
        var brush = this.brushes.active;
        if (!brush.type)  // is it a standard brush?
            brush.set_color(this.model.palette.foreground, true);
        if (this.mouse && this.tools.active.preview)
            this.model.preview_brush(brush, this.model.palette.foreground);
    },

    brush_restore: function () {
        this.brushes.active.restore_backup();
    },

    // Update the cursor position and draw brush preview
    update_cursor: _.throttle(function (event, stroke) {
        var coords = Util.image_coords(Util.event_coords(event), this.window);
        if (this.stroke && this.stroke.start) {
            coords.x = Math.abs(coords.x - this.stroke.start.x) + 1;
            coords.y = Math.abs(coords.y - this.stroke.start.y) + 1;
        } else {
            if (this.mouse && this.tools.active.preview_brush) {
                // Draw the brush preview
                this.model.preview_brush(this.brushes.active,
                                         this.model.palette.foreground, coords);
            }
        }
        this.model.update_coords(coords);
    }, 20),

    // Callback for when the user presses a mouse button on the canvas
    begin_stroke: function (event) {
        var offset = Util.event_coords(event);
        this.stroke = {
            button: event.which,
            offset: offset,
            pos: Util.image_coords(offset, this.window),
            shift: event.shiftKey,
            brush: this.brushes.active
        };
        this.stroke.start = this.stroke.last = this.stroke.pos;
        $(".fg").css({"pointer-events": "none"});
        if (!this.scroll_mode) {
            switch (this.stroke.button) {
            case 1:  // Drawing
                this.eventbus.info(this.tools.active.help);
                this.model.before_draw(this.tools.active, this.stroke);
                this.stroke.draw = true;  // we're drawing, not e.g. panning
                this.stroke.color = this.model.palette.foreground;
                this.stroke.brush.set_color(this.stroke.color);
                this.model.draw(this.tools.active, this.stroke);
                break;
            case 3:  // Erasing
                this.eventbus.info(this.tools.active.help);
                this.model.before_draw(this.tools.active, this.stroke);
                this.stroke.draw = true;
                this.stroke.color = this.model.palette.background;
                this.stroke.brush.set_color(this.stroke.color, true);
                this.model.draw(this.tools.active, this.stroke);
                break;
            }
        }
        document.onmouseup = this.end_stroke;
    },

    // Callback for when the user is moving the mouse
    update_stroke: function (event) {
        //console.log(this.stroke.draw);
        this.update_cursor(event);
        if (this.stroke) {
            var cpos = Util.event_coords(event);
            if (this.stroke.draw) {
                this.stroke.pos = Util.image_coords(cpos, this.window);
                if (!OldPaint.tools.active.oneshot)
                    this.model.draw(OldPaint.tools.active, this.stroke);
                this.stroke.last = this.stroke.pos;
                this.stroke.shift = event.shiftKey;
            } else {
                this.update_offset({
                    x: cpos.x - this.stroke.offset.x + this.window.offset.x,
                    y: cpos.y - this.stroke.offset.y + this.window.offset.y});
                this.stroke.offset = cpos;
                this.render();
            }
        }
    },

    // Callback for when letting go of a mouse button
    end_stroke: function (event) {
        if (this.stroke.draw) {
            this.model.after_draw(OldPaint.tools.active, this.stroke);
        }
        if (this.stroke.button === 3)
            this.brush_restore();
        this.stroke = null;
        $(".fg").css({"pointer-events": "auto"});
        this.eventbus.clear();
        document.onmouseup = null;
    },

    update_offset: function (offset) {
        this.window.offset = {x: Math.floor(offset.x),
                              y: Math.floor(offset.y)};
        this.window.trigger("change");
    },

    // Center the display on a certain image coordinate
    center_on_image_pos: function (ipos, cpos) {
        //var scale = this.get_scale();
        var offset = {x: Math.round(cpos.x - (ipos.x + 0.5) * this.window.scale),
                      y: Math.round(cpos.y - (ipos.y + 0.5) * this.window.scale)};
        this.update_offset(offset);
    },

    set_zoom: function (zoom, center_pos) {
        var image_pos = Util.image_coords(center_pos, this.window);
        this.zoom = Math.max(-3, Math.min(5, zoom));
        this.model.layers.active.clear_temporary();
        this.update_scale();
        this.center_on_image_pos(image_pos, center_pos);
        this.render();
        this.update_title();
    },

    zoom_in: function (event, center_mouse) {
        var canvas_pos;
        if (center_mouse === true) {
            canvas_pos = Util.event_coords(event);
        } else {
            canvas_pos = {
                x: Math.floor($("#drawing").width() / 2),
                y: Math.floor($("#drawing").height() / 2)
            };
        }
        this.set_zoom(this.zoom + 1, canvas_pos);
    },

    zoom_out: function (event, center_mouse) {
        var canvas_pos;
        if (center_mouse === true) {
            canvas_pos = Util.event_coords(event);
        } else {
            canvas_pos = {
                x: Math.floor($("#drawing").width() / 2),
                y: Math.floor($("#drawing").height() / 2)
            };
        }
        this.set_zoom(this.zoom - 1, canvas_pos);
    },

    on_wheel_zoom: function (event, delta, deltaX, deltaY) {
        switch (deltaY) {
        case 1: this.zoom_in(event, true); break;
        case -1: this.zoom_out(event, true); break;
        }
    },

    // When a selection rectangle is created, make a view for it
    on_selection: function (selection) {
        new OldPaint.SelectionView({model: selection,
                                    eventbus: this.eventbus,
                                    window: this.window});
    }

});
