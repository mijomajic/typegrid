import AppKit

/// The TypeGrid loop, shared by the menu bar and app-icon renderer.
/// Coordinates mirror public/brand/typegrid-mark.svg; the cut is rotated 45°.
enum BrandMark {
    static func path(in rect: NSRect) -> NSBezierPath {
        let path = NSBezierPath()
        let scale = min(rect.width, rect.height) / 64
        let diagonal = sqrt(0.5)
        func point(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
            let dx = x - 32, dy = y - 32
            return NSPoint(x: rect.midX + (dx + dy) * diagonal * scale,
                           y: rect.midY + (dx - dy) * diagonal * scale)
        }
        var pen = NSPoint.zero
        func move(_ x: CGFloat, _ y: CGFloat) {
            pen = point(x, y); path.move(to: pen)
        }
        func line(_ x: CGFloat, _ y: CGFloat) {
            pen = point(x, y); path.line(to: pen)
        }
        func quad(_ cx: CGFloat, _ cy: CGFloat, _ x: CGFloat, _ y: CGFloat) {
            let control = point(cx, cy), end = point(x, y)
            path.curve(to: end,
                       controlPoint1: NSPoint(x: pen.x + (control.x - pen.x) * 2 / 3,
                                             y: pen.y + (control.y - pen.y) * 2 / 3),
                       controlPoint2: NSPoint(x: end.x + (control.x - end.x) * 2 / 3,
                                             y: end.y + (control.y - end.y) * 2 / 3))
            pen = end
        }
        move(20, 6); line(44, 6); quad(48, 6, 51, 9)
        line(55, 13); line(45, 23); line(41, 19); line(23, 19)
        line(19, 23); line(19, 41); line(23, 45); line(41, 45)
        line(45, 41); line(45, 37); line(32, 37); line(32, 27)
        line(58, 27); line(58, 45); quad(58, 49, 55, 52)
        line(52, 55); quad(49, 58, 45, 58); line(19, 58)
        quad(15, 58, 12, 55); line(9, 52); quad(6, 49, 6, 45)
        line(6, 19); quad(6, 15, 9, 12); line(12, 9)
        quad(15, 6, 20, 6); path.close()
        return path
    }
}
