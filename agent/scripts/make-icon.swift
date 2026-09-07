import AppKit
import Foundation
let directory = CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
for size in [16,32,128,256,512] {
    for scale in [1,2] {
        let pixels = size * scale
        let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:pixels,pixelsHigh:pixels,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:rep)
        let p = CGFloat(pixels)
        let inset = p * 0.075
        let face = NSRect(x:inset,y:inset,width:p-2*inset,height:p-2*inset)
        NSColor(calibratedWhite:0.06,alpha:1).setFill()
        let tile = NSBezierPath(roundedRect:face,xRadius:p*0.19,yRadius:p*0.19)
        tile.fill()
        NSColor(calibratedWhite:0.25,alpha:1).setStroke()
        tile.lineWidth = max(1,p*0.003); tile.stroke()
        let signal = NSColor(calibratedRed:0.57,green:0.96,blue:0.45,alpha:1)
        let white = NSColor(calibratedWhite:0.93,alpha:1)
        for (index, rect) in [
            NSRect(x:p*0.22,y:p*0.65,width:p*0.56,height:p*0.12),
            NSRect(x:p*0.28,y:p*0.51,width:p*0.44,height:p*0.075),
            NSRect(x:p*0.44,y:p*0.37,width:p*0.12,height:p*0.075),
            NSRect(x:p*0.44,y:p*0.23,width:p*0.12,height:p*0.075)
        ].enumerated() {
            (index < 2 ? white : signal).setFill()
            NSBezierPath(rect:rect).fill()
        }
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"\(directory)/icon_\(size)x\(size)\(suffix).png"))
    }
}
