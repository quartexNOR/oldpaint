OldPaint.Image = Backbone.Model.extend ({

    initialize: function (spec) {
        _.bindAll(this);
        this.palette = spec.palette || new OldPaint.Palette({});
        this.image = new spec.image_type(
            {width: spec.width, height: spec.height,
             palette: this.palette, image: spec.image});
        if (!spec.data && spec.background) this.clear(spec.background);
        if (spec.patch) {
            this.draw_patch(spec.patch, {left: 0, top:0});
        }
        this.make_backup();
    },

    get_size: function () {
        return {width: this.image.canvas.width,
                height: this.image.canvas.height};
    },


    get_pixel: function (pos) {
        return this.image.getpixel(pos.x, pos.y);
    },

    make_backup: function () {
        this.backup = Util.copy_canvas(this.image.get_data());
    },

    restore_backup: function (rect, dest_rect, silent) {
        if (rect) {
            if (dest_rect) {
                this.image.blit(this.backup, rect, dest_rect, true);
                if (!silent) this.trigger_update(dest_rect, true);
            } else {
                this.image.blit(this.backup, rect, rect, true);
                if (!silent) this.trigger_update(rect, true);
            }
        } else {
            var size = this.get_size();
            var all_rect = {left: 0, top: 0,
                            width: size.width, height: size.height};
            this.image.blit(this.backup, all_rect, all_rect, true);
            if (!silent) this.trigger_update(all_rect, true);
        }
    },

    // Create a Patch from part of the image
    make_patch: function (rect, backup) {
        var size = this.get_size();
        rect = Util.intersect(rect, {left: 0, top:0,
                                     width: size.width, height: size.height});
        return new OldPaint.Patch(backup ? this.backup : this.image.get_data(),
                         rect, this.cid, this.image.palette);
    },

    draw_patch: function (patch, position, merge) {
        var rect = position ?
                {left: position.left, top: position.top,
                 width: patch.rect.width, height: patch.rect.height}
            : patch.rect;
        return this.image.blit(patch.canvas,
                               {left: 0, top: 0,
                                width: patch.rect.width,
                                height: patch.rect.height},
                               rect, !merge);
    },

    draw_rectangle: function (topleft, size, brush, color, filled) {
        return filled ?
            this.image.drawfilledrectangle(topleft, size, color) :
            this.image.drawrectangle(topleft, size, brush, color);
    },

    draw_ellipse: function (center, radii, brush, color, filled) {
        return filled ?
            this.image.drawfilledellipse(center, radii, color) :
            this.image.drawellipse(center, radii, brush, color);
    },

    draw_brush: function (pos, brush, color) {
        return this.image.drawbrush(pos, brush);
    },

    draw_line: function (start, end, brush, color) {
        return this.image.drawline(start, end, brush, color);
    },

    draw_fill: function (start, color) {
        return this.image.bucketfill(start, color);
    },

    draw_gradientfill: function (start, colors) {
        return this.image.gradientfill(start, colors);
    },

    draw_clear: function (color) {
        var rect = this.image.clear();
        if (color >= 0) {
            this.draw_fill({x: 0, y: 0}, color);
        }
        return rect;
    },

    flip_x: function () {
        return this.image.flipx();
    },

    flip_y: function () {
        return this.image.flipy();
    },

    trim_rect: function (rect) {
        var size = this.get_size();
        return Util.intersect(rect, {left: 0, top: 0,
                                     width: size.width,
                                     height: size.height});
    },

    trigger_update: function () {}
});


// Part of an Image
OldPaint.Patch = function (source, rect, layerid, palette) {
    console.log("Patch:", rect, source, layerid, palette);
    this.canvas = Util.copy_canvas(source, rect);
    this.rect = rect;
    this.layerid = layerid;
    this.palette = palette;
};
