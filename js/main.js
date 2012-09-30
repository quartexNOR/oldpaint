$(function () {
    if (!window.console) window.console = {};
    if (!window.console.log) window.console.log = function() {};

    // Tools
    var tools = OldPaint.tools = new OldPaint.Tools();
    var Tool = OldPaint.Tool;
    tools.add(new Tool({name: "pencil", key: "p", preview: true,
                        draw: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            layer.draw_line(stroke.last, stroke.pos,
                                            stroke.brush, stroke.color);}}));

    tools.add(new Tool({name: "points", preview: true,
                        draw: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            layer.draw_brush(stroke.pos, stroke.brush, stroke.color);
                        }}));

    tools.add(new Tool({name: "line", preview: true,
                        draw: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            layer.restore_backup(layer.last_change);
                            layer.draw_line(stroke.start, stroke.pos,
                                            stroke.brush, stroke.color);
                        }}));

    tools.add(new Tool({name: "rectangle", preview: true,
                        draw: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            var size = {x: stroke.pos.x - stroke.start.x,
                                        y: stroke.pos.y - stroke.start.y};
                            layer.restore_backup(layer.last_change);
                            layer.draw_rectangle(stroke.start, size,
                                                 stroke.brush, stroke.color,
                                                 stroke.shift);
                        }, help: "Hold SHIFT key to make a filled rectangle."}));

    tools.add(new Tool({name: "ellipse", preview: true,
                        draw: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            var radius = {x: stroke.pos.x - stroke.start.x,
                                          y: stroke.pos.y - stroke.start.y};
                            layer.restore_backup(layer.last_change);
                            layer.draw_ellipse(stroke.start, radius,
                                               stroke.brush, stroke.color,
                                               stroke.shift);
                        }, help: "Hold SHIFT key to make a filled ellipse."}));

    tools.add(new Tool({name: "floodfill", oneshot: true, preview: false,
                        draw: function (drawing, stroke) {
                            drawing.layers.active.draw_fill(stroke.pos, stroke.color);
                        }}));

    // tools.add(new Tool({name: "gradientfill",
    //                     draw: function (drawing, stroke) {
    //                         drawing.layers.active.draw_gradientfill(
    //                             stroke.pos, drawing.palette.range);
    //                     }}));

    tools.add(new Tool({name: "brush", preview: false,
                        help: "Drag the corner handles to resize selection, and click anywhere else to finish.",
                        before: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            var rect = Util.rectify(stroke.start,
                                                    {x: stroke.pos.x + 1,
                                                     y: stroke.pos.y + 1});
                            var select_brush = function () {
                                console.log("action");
                                var layer = drawing.layers.active;
                                var brush = new OldPaint.ImageBrush({
                                    patch: layer.make_patch(drawing.selection),
                                    image_type: drawing.image_type});
                                user_brushes.add(brush);
                                user_brushes.set_active(brush);
                                drawing.set_selection();
                                tools.set_active(tools.previous);
                            };
                            drawing.set_selection(rect, select_brush);
                        },
                        draw: function (drawing, stroke) {
                            var layer = drawing.layers.active;
                            var rect = Util.rectify(stroke.start,
                                                    {x: stroke.pos.x + 1,
                                                     y: stroke.pos.y + 1});
                            drawing.set_selection(rect);
                        },
                        after:function (drawing, stroke) {
                            drawing.trigger("selection_done");
                        }}));

    tools.add(new Tool({name: "picker", preview: false,
                        draw: function (drawing, stroke) {
                            var rgb, color=0;
                            drawing.layers.each(function (layer) {
                                color = layer.get_pixel(stroke.pos);
                                if (color[0] != undefined) color = color[0];
                            });
                            if (color != drawing.palette.foreground)
                                drawing.palette.set_foreground(color);
                        }}));

    var tools_view = new OldPaint.ToolsView({collection: tools});
    tools.set_active(tools.at(0));

    // Palette
    var colors = [[0, 0, 0, 255]];
    for (var i=1; i<256; i++) {
        colors.push([Math.floor(Math.random()*255),
                     Math.floor(Math.random()*255),
                     Math.floor(Math.random()*255), 255]);
    }
    var palette = new OldPaint.Palette({colors: colors, transparent: [0]});
    var palette_editor_view = new OldPaint.PaletteEditorView(
        {model: palette, size: {x: 32, y: 8}});
    palette.set_foreground(1);


    //var image_type = OldPaint.RGBImage;
    var image_type = OldPaint.IndexedImage;

    // Brushes
    var brushes = OldPaint.brushes = new OldPaint.Brushes();

    console.log("brushes...");
    brushes.add(new OldPaint.RectangleBrush({width: 1, height: 1, color: 1,
                                             palette: palette,
                                             image_type: image_type}));
    brushes.add(new OldPaint.EllipseBrush({width: 1, height: 1, color: 1,
                                           palette: palette,
                                           image_type: image_type}));
    brushes.add(new OldPaint.EllipseBrush({width: 3, height: 3, color: 1,
                                           palette: palette,
                                           image_type: image_type}));
    brushes.add(new OldPaint.EllipseBrush({width: 5, height: 5, color: 1,
                                           palette: palette,
                                           image_type: image_type}));
    brushes.add(new OldPaint.EllipseBrush({width: 50, height: 25, color: 1,
                                           palette: palette,
                                           image_type: image_type}));
    brushes.add(new OldPaint.RectangleBrush({width: 2, height: 2, color: 1,
                                             palette: palette,
                                             image_type: image_type}));
    brushes.add(new OldPaint.RectangleBrush({width: 5, height: 5, color: 1,
                                             palette: palette,
                                             image_type: image_type}));
    brushes.add(new OldPaint.RectangleBrush({width: 50, height: 50, color: 1,
                                             palette: palette,
                                             image_type: image_type}));
    console.log("done adding brushes");
    var brushes_view = new OldPaint.BrushesView({collection: brushes,
                                                 name: "brushes"});
    brushes.set_active(brushes.at(2));

    var user_brushes = OldPaint.user_brushes = new OldPaint.Brushes();
    var user_brushes_view = new OldPaint.BrushesView({collection: user_brushes,
                                                      name: "user_brushes"});

    OldPaint.active_brushes = OldPaint.brushes;

    // Drawing
    console.log("create drawing");
    var drawing = new OldPaint.Drawing(
        { width: 800, height: 600, palette: palette, image_type: image_type});
    var drawing_view = new OldPaint.DrawingView({model: drawing});
    var layers_view = new OldPaint.MiniLayersView({model: drawing});
    var info_view = new OldPaint.InfoView({model: drawing});

    console.log("adding layer from main");
    drawing.add_layer(true);

});
