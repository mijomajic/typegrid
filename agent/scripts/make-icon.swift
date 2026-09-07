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
        NSColor(calibratedWhite:0.105,alpha:1).setFill()
        let tile = NSBezierPath(roundedRect:face,xRadius:p*0.19,yRadius:p*0.19)
        tile.fill()
        NSColor(calibratedWhite:0.27,alpha:1).setStroke()
        tile.lineWidth = max(1,p*0.003); tile.stroke()
        for row in 0..<5 { for col in 0..<5 {
            let active = row == 0 || col == 2
            if active { NSColor(calibratedRed:0.77,green:0.94,blue:0.54,alpha:1).setFill() }
            else { NSColor(calibratedWhite:0.24,alpha:1).setFill() }
            NSBezierPath(ovalIn:NSRect(x:p*(0.24+CGFloat(col)*0.11),y:p*(0.68-CGFloat(row)*0.11),width:p*0.065,height:p*0.065)).fill()
        }}
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:"\(directory)/icon_\(size)x\(size)\(suffix).png"))
    }
}
